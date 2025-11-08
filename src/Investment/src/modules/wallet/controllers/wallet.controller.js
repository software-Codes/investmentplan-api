'use strict';

const { validateTransferBody } = require('../validations/wallet.validation');
const { makeBalanceDTO, makeTransferDTO } = require('../dto/wallet.dto');
const { WalletError } = require('../services/wallet.service');

class WalletController {
    constructor({ transferService, walletService, logger = console }) {
        if (!transferService) throw new Error('WalletController requires transferService');
        if (!walletService) throw new Error('WalletController requires walletService');
        this.transferService = transferService;
        this.walletService = walletService;
        this.log = logger;

        this.transfer = this.transfer.bind(this);
        this.balances = this.balances.bind(this);
        this.transferHistory = this.transferHistory.bind(this);
        this.transactionHistory = this.transactionHistory.bind(this);
        this.lockedFunds = this.lockedFunds.bind(this);
    }

    async transfer(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { from, to, amount, idempotencyKey } = validateTransferBody(req.body);

            const result = await this.transferService.transfer(userId, from, to, amount, idempotencyKey);
            const dto = makeTransferDTO({
                transferId: result.transferId,
                from,
                to,
                amount,
                lockedUntil: result.lockedUntil || null,
                newBalances: makeBalanceDTO({
                    account: result.balances.account,
                    trading: result.balances.trading,
                    tradingLocked: result.balances.tradingLocked,
                    referral: result.balances.referral,
                }),
            });

            return res.status(200).json({ success: true, data: dto });
        } catch (err) {
            if (err instanceof WalletError) {
                return res.status(err.status || 400).json({ success: false, error: err.code, message: err.message });
            }
            if (err?.issues?.length) {
                const first = err.issues[0];
                return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: first?.message || 'Invalid request' });
            }
            this.log.error({ err }, 'wallet.transfer failed');
            return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Something went wrong' });
        }
    }

    async balances(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const b = await this.walletService.getBalances(userId);
            const dto = makeBalanceDTO({
                account: b.account,
                trading: b.trading,
                tradingLocked: b.tradingLocked,
                referral: b.referral,
            });

            return res.status(200).json({ success: true, data: dto });
        } catch (err) {
            this.log.error({ err }, 'wallet.balances failed');
            return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Something went wrong' });
        }
    }

    async transferHistory(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const offset = (page - 1) * limit;

            const { rows } = await this.walletService.db.query(
                `SELECT transfer_id, from_wallet, to_wallet, amount::numeric, transfer_type, 
                        locked_until, unlocked_at, status, created_at
                 FROM wallet_transfers
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            );

            const { rows: countRows } = await this.walletService.db.query(
                'SELECT COUNT(*)::int AS total FROM wallet_transfers WHERE user_id = $1',
                [userId]
            );

            return res.status(200).json({
                success: true,
                data: {
                    transfers: rows.map(r => ({
                        transferId: r.transfer_id,
                        from: r.from_wallet,
                        to: r.to_wallet,
                        amount: Number(r.amount),
                        type: r.transfer_type,
                        lockedUntil: r.locked_until,
                        unlockedAt: r.unlocked_at,
                        status: r.status,
                        createdAt: r.created_at
                    })),
                    pagination: {
                        page,
                        limit,
                        total: countRows[0]?.total || 0,
                        totalPages: Math.ceil((countRows[0]?.total || 0) / limit)
                    }
                }
            });
        } catch (err) {
            this.log.error({ err }, 'wallet.transferHistory failed');
            return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Something went wrong' });
        }
    }

    async transactionHistory(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const offset = (page - 1) * limit;

            const { rows } = await this.walletService.db.query(
                `SELECT wt.transaction_id, wt.direction, wt.amount::numeric, wt.balance_after::numeric,
                        wt.reason, wt.ref_type, wt.ref_id, wt.created_at, w.wallet_type
                 FROM wallet_transactions wt
                 JOIN wallets w ON wt.wallet_id = w.wallet_id
                 WHERE w.user_id = $1
                 ORDER BY wt.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            );

            const { rows: countRows } = await this.walletService.db.query(
                `SELECT COUNT(*)::int AS total 
                 FROM wallet_transactions wt
                 JOIN wallets w ON wt.wallet_id = w.wallet_id
                 WHERE w.user_id = $1`,
                [userId]
            );

            return res.status(200).json({
                success: true,
                data: {
                    transactions: rows.map(r => ({
                        transactionId: r.transaction_id,
                        wallet: r.wallet_type,
                        direction: r.direction,
                        amount: Number(r.amount),
                        balanceAfter: Number(r.balance_after),
                        reason: r.reason,
                        refType: r.ref_type,
                        refId: r.ref_id,
                        createdAt: r.created_at
                    })),
                    pagination: {
                        page,
                        limit,
                        total: countRows[0]?.total || 0,
                        totalPages: Math.ceil((countRows[0]?.total || 0) / limit)
                    }
                }
            });
        } catch (err) {
            this.log.error({ err }, 'wallet.transactionHistory failed');
            return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Something went wrong' });
        }
    }

    async lockedFunds(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { rows } = await this.walletService.db.query(
                `SELECT transfer_id, amount::numeric, locked_until, created_at,
                        EXTRACT(EPOCH FROM (locked_until - NOW())) AS seconds_remaining
                 FROM wallet_transfers
                 WHERE user_id = $1
                   AND from_wallet = 'account'
                   AND to_wallet = 'trading'
                   AND transfer_type = 'principal'
                   AND status = 'active'
                   AND unlocked_at IS NULL
                 ORDER BY locked_until`,
                [userId]
            );

            const totalLocked = rows.reduce((sum, r) => sum + Number(r.amount), 0);

            return res.status(200).json({
                success: true,
                data: {
                    totalLocked: totalLocked.toFixed(2),
                    locks: rows.map(r => ({
                        transferId: r.transfer_id,
                        amount: Number(r.amount).toFixed(2),
                        lockedUntil: r.locked_until,
                        investedAt: r.created_at,
                        daysRemaining: Math.max(0, Math.ceil(Number(r.seconds_remaining) / 86400))
                    }))
                }
            });
        } catch (err) {
            this.log.error({ err }, 'wallet.lockedFunds failed');
            return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Something went wrong' });
        }
    }
}

module.exports = { WalletController };
