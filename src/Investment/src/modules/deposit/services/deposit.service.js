'use strict';

/**
 * DepositService
 *
 * Responsibilities:
 * - Validate incoming txId (format).
 * - Create a PENDING deposit claim for the user (idempotent).
 * - Verify the txId with Binance and resolve its amount/network/address/status.
 * - If verified SUCCESS and matches the admin deposit address/network:
 *     -> credit Account wallet (idempotent), then mark CONFIRMED.
 * - Otherwise move to PROCESSING (await monitor/webhook) or FAIL with reason.
 *
 * Safety/Idempotency:
 * - Uses a unique tx_id in the deposits table to prevent two users claiming the same tx.
 * - Passes idempotencyKey = `deposit:${txId}` to WalletService.creditAccount() so that
 *   retries (monitor + webhook + user re-submit) never double-credit.
 *
 * Note on shared address model:
 * - Long-term, prefer per-user deposit addresses or tag/memo. For now, first-claim-wins
 *   guarded by unique tx_id + admin review of suspicious claims.
 */

const pino = require('pino');
const cfg = require('../config/deposit.config'); // adjust relative path if needed
const { DepositRepository, DepositError } = require('../models/deposit.model'); // adjust path
const { BinanceProvider } = require('../providers/binance.provider');
const { isValidTxHash, buildExplorerUrl, normalizeNetwork } = require('../utils/txUtils');
const { DepositStatus, makeSubmitDepositResponse } = require('../dto/deposit.dto');
const { DepositEmailService } = require('./depositEmail.service');
const { DepositLoggerService } = require('./depositLogger.service');

class DepositService {
    /**
     * @param {object} deps
     * @param {import('pg').Pool|any} deps.db - db client with query()
     * @param {object} deps.walletService - must expose creditAccount(userId, amountUsd, {reason, txId, idempotencyKey, ...})
     * @param {BinanceProvider} deps.binance
     * @param {import('pino').Logger} [deps.logger]
     */
    constructor({ db, walletService, binance, logger, emailService, depositLogger }) {
        this.repo = new DepositRepository(db);
        this.wallets = walletService;
        this.binance = binance;
        this.logger = logger || pino({ name: 'DepositService' });
        this.emailService = emailService || new DepositEmailService({ db });
        this.depositLogger = depositLogger || new DepositLoggerService();
        this.depositLogger.connect().catch(err => this.logger.error({ err }, 'Failed to connect deposit logger'));
    }

    /**
     * Submit a deposit claim with only txId; amount is fetched from Binance.
     * If the same user re-submits a pending/processing claim, we attempt a fresh verify.
     *
     * @param {object} params
     * @param {string} params.userId
     * @param {string} params.txId
     * @param {string} [params.network='ERC20']
     */
    async submitDeposit({ userId, txId, network = 'ERC20' }) {
        const net = normalizeNetwork(network);
        let logId = null;

        // Get user info for logging
        try {
            const { rows } = await this.repo.db.query(
                'SELECT full_name, email FROM users WHERE user_id = $1',
                [userId]
            );
            const user = rows[0] || {};
            
            // Create single log document
            logId = await this.depositLogger.createLog({
                userId,
                userName: user.full_name || 'Unknown',
                userEmail: user.email || 'Unknown',
                txId
            });

            await this.depositLogger.addStage({
                logId,
                stage: 'SUBMIT_STARTED',
                status: 'info',
                data: { network: net }
            });
        } catch (err) {
            this.logger.error({ err }, 'Failed to initialize deposit log');
        }

        // 1) Validate tx format
        if (!isValidTxHash(txId, net)) {
            const error = new DepositError('ERR_TXID_INVALID', 'Invalid transaction hash format for ERC20');
            await this.depositLogger.addStage({
                logId,
                stage: 'VALIDATION_FAILED',
                status: 'error',
                data: { reason: 'invalid_format' },
                error
            });
            throw error;
        }

        // 2) If tx exists, allow the SAME user to trigger a fresh verify; block others.
        const existing = await this.repo.findByTxId(txId);
        if (existing) {
            if (existing.user_id && existing.user_id !== userId) {
                const error = new DepositError('ERR_TXID_ALREADY_CLAIMED', 'This transaction has already been claimed');
                await this.depositLogger.addStage({
                    logId,
                    stage: 'DUPLICATE_CLAIM',
                    status: 'error',
                    data: { claimedBy: existing.user_id },
                    error
                });
                throw error;
            }

            // Same user re-submitted; try to progress the state (fresh verify).
            const refreshed = await this.verifyAndConfirm({ txId, userId: existing.user_id || userId });
            const explorerUrl = buildExplorerUrl(txId, net);
            return makeSubmitDepositResponse({ deposit: refreshed || existing, explorerUrl });
        }

        // 3) Fetch ALL recent Binance deposits (last 90 days) and find matching txId
        const sinceMs = Date.now() - (90 * 24 * 60 * 60 * 1000);
        const allDeposits = await this.binance.listRecentDeposits({
            sinceMs,
            coin: cfg.SUPPORTED_ASSET,
            network: 'ETH',
        });

        const onChain = allDeposits.find(d => (d.txId || '').toLowerCase() === txId.toLowerCase());

        if (!onChain) {
            const error = new DepositError('ERR_TXID_NOT_FOUND', 'Transaction not found in Binance deposit history. Please verify the transaction hash and ensure it was sent to the correct address.');
            await this.depositLogger.addStage({
                logId,
                stage: 'BINANCE_LOOKUP',
                status: 'error',
                data: { reason: 'not_found', searchedDeposits: allDeposits.length },
                error
            });
            throw error;
        }

        await this.depositLogger.addStage({
            logId,
            stage: 'BINANCE_FOUND',
            status: 'success',
            data: { amount: onChain.amount, status: onChain.status, address: onChain.address }
        });

        // 4) Validate address match
        const addressMatch = onChain.address && onChain.address.length > 6
            ? onChain.address.toLowerCase() === cfg.DEPOSIT_ADDRESS.toLowerCase()
            : true;

        if (!addressMatch) {
            const error = new DepositError('ERR_ADDRESS_MISMATCH', `This deposit was sent to ${onChain.address} but our address is ${cfg.DEPOSIT_ADDRESS}. Please contact support.`);
            await this.depositLogger.addStage({
                logId,
                stage: 'ADDRESS_VALIDATION',
                status: 'error',
                data: { expected: cfg.DEPOSIT_ADDRESS, received: onChain.address },
                error
            });
            throw error;
        }

        // 5) Check status - only accept SUCCESS
        if (onChain.status === 'PENDING') {
            const error = new DepositError('ERR_PENDING_CONFIRMATION', `Your deposit is pending confirmation on the blockchain. Current status: ${onChain.status}. Please wait a few minutes and try again.`);
            await this.depositLogger.addStage({
                logId,
                stage: 'STATUS_CHECK',
                status: 'pending',
                data: { binanceStatus: onChain.status },
                error
            });
            throw error;
        }

        if (onChain.status !== 'SUCCESS') {
            const error = new DepositError('ERR_PROVIDER_STATUS', `Deposit status is ${onChain.status}. Only successful deposits can be credited. Please contact support if this persists.`);
            await this.depositLogger.addStage({
                logId,
                stage: 'STATUS_CHECK',
                status: 'error',
                data: { binanceStatus: onChain.status },
                error
            });
            throw error;
        }

        // 6) SUCCESS — validate amount and credit wallet
        const amountUsd = Math.round(Number(onChain.amount || 0) * 100) / 100;
        if (!(amountUsd >= cfg.MIN_DEPOSIT_USD) || (cfg.MAX_DEPOSIT_USD && amountUsd > cfg.MAX_DEPOSIT_USD)) {
            throw new DepositError('ERR_AMOUNT_OUT_OF_RANGE', 'Deposit amount outside allowed bounds');
        }

        // 7) Create deposit record (only for successful transactions)
        const deposit = await this.repo.createPending({
            userId,
            txId,
            amountUsd,
            network: net,
            source: 'manual',
        });

        await this.depositLogger.updateDepositId({ logId, depositId: deposit.deposit_id });
        await this.depositLogger.addStage({
            logId,
            stage: 'DB_RECORD_CREATED',
            status: 'success',
            data: { depositId: deposit.deposit_id, amount: amountUsd }
        });

        // 8) Credit wallet (idempotent)
        await this.wallets.creditAccount(userId, amountUsd, {
            reason: 'deposit',
            txId,
            network: net,
            source: 'manual',
            idempotencyKey: `deposit:${txId}`,
        });

        await this.depositLogger.addStage({
            logId,
            stage: 'WALLET_CREDITED',
            status: 'success',
            data: { amount: amountUsd, idempotencyKey: `deposit:${txId}` }
        });

        // 9) Mark as confirmed
        const confirmed = await this.repo.markConfirmed(deposit.deposit_id, {
            amountUsd,
            verifiedAt: new Date(),
            creditedAt: new Date(),
            metadata: { provider: onChain, credited_amount_usd: amountUsd },
        });

        await this.depositLogger.addStage({
            logId,
            stage: 'STATUS_CONFIRMED',
            status: 'success',
            data: { status: 'completed' }
        });

        // 10) Send email notifications (async, don't block response)
        this._sendDepositEmails(userId, confirmed.deposit_id, txId, amountUsd, logId).catch(err => {
            this.logger.error({ err, depositId: confirmed.deposit_id }, 'Failed to send deposit emails');
        });

        await this.depositLogger.addStage({
            logId,
            stage: 'DEPOSIT_COMPLETED',
            status: 'success',
            data: { amount: amountUsd, depositId: deposit.deposit_id }
        });

        const explorerUrl = buildExplorerUrl(txId, net);
        return makeSubmitDepositResponse({ deposit: confirmed, explorerUrl });
    }

    /**
     * Re-verify a pending/processing deposit (used by monitor/webhook and re-submits).
     * Idempotent wallet credit via idempotencyKey.
     *
     * @param {string} txId
     * @param {string} [userId] - optional override; normally read from existing deposit
     */
    async verifyAndConfirm({ txId, userId }) {
        const dep = await this.repo.findByTxId(txId);
        if (!dep) return null;

        if ((dep.status || '').toLowerCase() === 'confirmed') {
            return dep; // already done
        }

        const sinceMs = Date.now() - (90 * 24 * 60 * 60 * 1000);
        const allDeposits = await this.binance.listRecentDeposits({
            sinceMs,
            coin: cfg.SUPPORTED_ASSET,
            network: 'ETH',
        });
        const onChain = allDeposits.find(d => (d.txId || '').toLowerCase() === txId.toLowerCase());
        if (!onChain) return dep;

        if (onChain.status === 'PENDING') {
            if ((dep.status || '').toLowerCase() === 'pending') {
                await this.repo.markProcessing(dep.deposit_id, { provider: onChain });
            }
            return { ...dep, status: 'processing' };
        }

        if (onChain.status !== 'SUCCESS' && onChain.status !== 'CREDITED') {
            await this.repo.markFailed(dep.deposit_id, {
                message: `Provider status ${onChain.status}`,
                metadata: { provider: onChain },
            });
            return { ...dep, status: 'failed' };
        }

        const amountUsd = Math.round(Number(onChain.amount || 0) * 100) / 100;

        // Idempotent credit (same key as submit flow)
        await this.wallets.creditAccount(userId || dep.user_id, amountUsd, {
            reason: 'deposit',
            txId,
            network: dep.network || 'ERC20',
            source: 'auto',
            idempotencyKey: `deposit:${txId}`,
        });

        const confirmed = await this.repo.markConfirmed(dep.deposit_id, {
            amountUsd,
            verifiedAt: new Date(),
            creditedAt: new Date(),
            metadata: { provider: onChain, credited_amount_usd: amountUsd },
        });

        // Send email notifications (async, don't block)
        this._sendDepositEmails(userId || dep.user_id, confirmed.deposit_id, txId, amountUsd).catch(err => {
            this.logger.error({ err, depositId: confirmed.deposit_id }, 'Failed to send deposit emails');
        });

        return confirmed;
    }

    /**
     * Admin: Fetch all deposits from Binance (last 90 days by default)
     * @param {object} params
     * @param {number} [params.days=90] - Number of days to look back
     * @param {string} [params.coin='USDT']
     * @param {string} [params.network='ETH']
     */
    async listBinanceDeposits({ days = 90, coin = cfg.SUPPORTED_ASSET, network = 'ETH' } = {}) {
        const sinceMs = Date.now() - (days * 24 * 60 * 60 * 1000);
        const deposits = await this.binance.listRecentDeposits({ sinceMs, coin, network });
        
        // Enrich with our database status (check if claimed)
        const enriched = await Promise.all(
            deposits.map(async (dep) => {
                const claimed = await this.repo.findByTxId(dep.txId);
                return {
                    ...dep,
                    claimed: !!claimed,
                    claimedBy: claimed?.user_id || null,
                    ourStatus: claimed?.status || null,
                    explorerUrl: buildExplorerUrl(dep.txId, 'ERC20'),
                };
            })
        );

        return enriched;
    }

    /**
     * Admin: List all deposits from database with user details
     * @param {object} params
     * @param {number} [params.page=1]
     * @param {number} [params.limit=50]
     * @param {string} [params.status]
     * @param {string} [params.userId]
     */
    async listAllDeposits({ page = 1, limit = 50, status = undefined, userId = undefined } = {}) {
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        let p = 1;

        if (status) {
            where.push(`d.status = $${p}`);
            params.push(status);
            p++;
        }
        if (userId) {
            where.push(`d.user_id = $${p}`);
            params.push(userId);
            p++;
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // Use a fresh client from pool with explicit timeout
        const client = await this.repo.db.connect();
        try {
            await client.query('SET statement_timeout = 30000'); // 30 second timeout

            const countQ = `SELECT COUNT(*)::int AS total FROM deposits d ${whereSql}`;
            const { rows: countRows } = await client.query(countQ, params);
            const total = countRows[0]?.total || 0;

            const listQ = `
                SELECT 
                    d.*,
                    u.full_name,
                    u.email,
                    u.phone_number
                FROM deposits d
                LEFT JOIN users u ON d.user_id = u.user_id
                ${whereSql}
                ORDER BY d.created_at DESC
                LIMIT $${p} OFFSET $${p + 1}
            `;
            const { rows } = await client.query(listQ, [...params, limit, offset]);
            
            client.release();

            return {
                deposits: rows.map(row => ({
                    depositId: row.deposit_id,
                    userId: row.user_id,
                    userName: row.full_name,
                    userEmail: row.email,
                    userPhone: row.phone_number,
                    txId: row.tx_id,
                    amount: Number(row.amount || 0),
                    amountUsd: Number(row.amount_usd || 0),
                    asset: row.asset,
                    network: row.network,
                    status: row.status,
                    source: row.source,
                    verifiedAt: row.verified_at,
                    creditedAt: row.credited_at,
                    createdAt: row.created_at,
                    message: row.message,
                    explorerUrl: buildExplorerUrl(row.tx_id, 'ERC20'),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (err) {
            client.release();
            throw err;
        }
    }

    /**
     * Send deposit confirmation emails to user and admin
     * @private
     */
    async _sendDepositEmails(userId, depositId, txId, amount, logId) {
        try {
            // Fetch user details
            const userQuery = 'SELECT user_id, email, full_name FROM users WHERE user_id = $1';
            const { rows } = await this.repo.db.query(userQuery, [userId]);
            
            if (!rows || rows.length === 0) {
                this.logger.warn({ userId }, 'User not found for email notification');
                await this.depositLogger.addStage({
                    logId,
                    stage: 'EMAIL_USER_NOT_FOUND',
                    status: 'error',
                    data: {}
                });
                return;
            }

            const user = rows[0];

            // Send user email
            await this.emailService.sendUserDepositConfirmation({
                userEmail: user.email,
                userName: user.full_name,
                amount,
                txId,
                depositId,
            });
            this.logger.info({ userId, depositId }, 'User deposit confirmation email sent');
            await this.depositLogger.addStage({
                logId,
                stage: 'EMAIL_USER_SENT',
                status: 'success',
                data: { to: user.email }
            });

            // Send admin email
            await this.emailService.sendAdminDepositNotification({
                userEmail: user.email,
                userName: user.full_name,
                amount,
                txId,
                depositId,
                userId: user.user_id,
            });
            this.logger.info({ userId, depositId }, 'Admin deposit notification email sent');
            await this.depositLogger.addStage({
                logId,
                stage: 'EMAIL_ADMIN_SENT',
                status: 'success',
                data: {}
            });
        } catch (err) {
            this.logger.error({ err, userId, depositId }, 'Error sending deposit emails');
            await this.depositLogger.addStage({
                logId,
                stage: 'EMAIL_FAILED',
                status: 'error',
                data: {},
                error: err
            });
            // Don't throw - email failure shouldn't break deposit flow
        }
    }
}

module.exports = { DepositService };
