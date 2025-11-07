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

class DepositService {
    /**
     * @param {object} deps
     * @param {import('pg').Pool|any} deps.db - db client with query()
     * @param {object} deps.walletService - must expose creditAccount(userId, amountUsd, {reason, txId, idempotencyKey, ...})
     * @param {BinanceProvider} deps.binance
     * @param {import('pino').Logger} [deps.logger]
     */
    constructor({ db, walletService, binance, logger }) {
        this.repo = new DepositRepository(db);
        this.wallets = walletService;
        this.binance = binance;
        this.logger = logger || pino({ name: 'DepositService' });
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

        // 1) Validate tx format
        if (!isValidTxHash(txId, net)) {
            throw new DepositError('ERR_TXID_INVALID', 'Invalid transaction hash format for ERC20');
        }

        // 2) If tx exists, allow the SAME user to trigger a fresh verify; block others.
        const existing = await this.repo.findByTxId(txId);
        if (existing) {
            if (existing.user_id && existing.user_id !== userId) {
                throw new DepositError('ERR_TXID_ALREADY_CLAIMED', 'This transaction has already been claimed');
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
            throw new DepositError('ERR_TXID_NOT_FOUND', 'Transaction not found in Binance deposit history. Please verify the transaction hash and ensure it was sent to the correct address.');
        }

        // 4) Validate address match
        const addressMatch = onChain.address && onChain.address.length > 6
            ? onChain.address.toLowerCase() === cfg.DEPOSIT_ADDRESS.toLowerCase()
            : true;

        if (!addressMatch) {
            throw new DepositError('ERR_ADDRESS_MISMATCH', `This deposit was sent to ${onChain.address} but our address is ${cfg.DEPOSIT_ADDRESS}. Please contact support.`);
        }

        // 5) Check status - only accept SUCCESS
        if (onChain.status === 'PENDING') {
            throw new DepositError('ERR_PENDING_CONFIRMATION', `Your deposit is pending confirmation on the blockchain. Current status: ${onChain.status}. Please wait a few minutes and try again.`);
        }

        if (onChain.status !== 'SUCCESS') {
            throw new DepositError('ERR_PROVIDER_STATUS', `Deposit status is ${onChain.status}. Only successful deposits can be credited. Please contact support if this persists.`);
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

        // 8) Credit wallet (idempotent)
        await this.wallets.creditAccount(userId, amountUsd, {
            reason: 'deposit',
            txId,
            network: net,
            source: 'manual',
            idempotencyKey: `deposit:${txId}`,
        });

        // 9) Mark as confirmed
        const confirmed = await this.repo.markConfirmed(deposit.deposit_id, {
            amountUsd,
            verifiedAt: new Date(),
            creditedAt: new Date(),
            metadata: { provider: onChain, credited_amount_usd: amountUsd },
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
}

module.exports = { DepositService };
