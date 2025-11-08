'use strict';

class AdminWalletController {
    constructor({ walletService, logger = console }) {
        if (!walletService) throw new Error('AdminWalletController requires walletService');
        this.walletService = walletService;
        this.log = logger;

        this.getAllUsers = this.getAllUsers.bind(this);
        this.getUserWallet = this.getUserWallet.bind(this);
        this.getAllTransfers = this.getAllTransfers.bind(this);
        this.getLockedFunds = this.getLockedFunds.bind(this);
        this.getWalletStats = this.getWalletStats.bind(this);
    }

    async getAllUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = (page - 1) * limit;

            const { rows } = await this.walletService.db.query(
                `SELECT u.user_id, u.full_name, u.email,
                        SUM(CASE WHEN w.wallet_type = 'account' THEN w.balance ELSE 0 END)::numeric AS account_balance,
                        SUM(CASE WHEN w.wallet_type = 'trading' THEN w.balance ELSE 0 END)::numeric AS trading_balance,
                        SUM(CASE WHEN w.wallet_type = 'trading' THEN w.locked_balance ELSE 0 END)::numeric AS locked_balance,
                        SUM(CASE WHEN w.wallet_type = 'referral' THEN w.balance ELSE 0 END)::numeric AS referral_balance
                 FROM users u
                 LEFT JOIN wallets w ON u.user_id = w.user_id
                 GROUP BY u.user_id, u.full_name, u.email
                 ORDER BY u.created_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            const { rows: countRows } = await this.walletService.db.query('SELECT COUNT(*)::int AS total FROM users');

            return res.status(200).json({
                success: true,
                data: {
                    users: rows.map(r => ({
                        userId: r.user_id,
                        name: r.full_name,
                        email: r.email,
                        balances: {
                            account: Number(r.account_balance || 0).toFixed(2),
                            trading: Number(r.trading_balance || 0).toFixed(2),
                            locked: Number(r.locked_balance || 0).toFixed(2),
                            referral: Number(r.referral_balance || 0).toFixed(2)
                        }
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
            this.log.error({ err }, 'admin.getAllUsers failed');
            return res.status(500).json({ success: false, message: 'Something went wrong' });
        }
    }

    async getUserWallet(req, res) {
        try {
            const { userId } = req.params;

            const { rows: userRows } = await this.walletService.db.query(
                'SELECT user_id, full_name, email FROM users WHERE user_id = $1',
                [userId]
            );

            if (!userRows.length) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const balances = await this.walletService.getBalances(userId);

            const { rows: transfers } = await this.walletService.db.query(
                `SELECT transfer_id, from_wallet, to_wallet, amount::numeric, transfer_type, 
                        locked_until, unlocked_at, status, created_at
                 FROM wallet_transfers
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [userId]
            );

            return res.status(200).json({
                success: true,
                data: {
                    user: userRows[0],
                    balances: {
                        account: balances.account.toFixed(2),
                        trading: balances.trading.toFixed(2),
                        locked: balances.tradingLocked.toFixed(2),
                        referral: balances.referral.toFixed(2)
                    },
                    recentTransfers: transfers.map(r => ({
                        transferId: r.transfer_id,
                        from: r.from_wallet,
                        to: r.to_wallet,
                        amount: Number(r.amount).toFixed(2),
                        type: r.transfer_type,
                        lockedUntil: r.locked_until,
                        status: r.status,
                        createdAt: r.created_at
                    }))
                }
            });
        } catch (err) {
            this.log.error({ err }, 'admin.getUserWallet failed');
            return res.status(500).json({ success: false, message: 'Something went wrong' });
        }
    }

    async getAllTransfers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = (page - 1) * limit;
            const status = req.query.status;

            let whereClause = '';
            const params = [limit, offset];
            
            if (status) {
                whereClause = 'WHERE wt.status = $3';
                params.push(status);
            }

            const { rows } = await this.walletService.db.query(
                `SELECT wt.transfer_id, wt.user_id, u.full_name, u.email,
                        wt.from_wallet, wt.to_wallet, wt.amount::numeric, wt.transfer_type,
                        wt.locked_until, wt.unlocked_at, wt.status, wt.created_at
                 FROM wallet_transfers wt
                 JOIN users u ON wt.user_id = u.user_id
                 ${whereClause}
                 ORDER BY wt.created_at DESC
                 LIMIT $1 OFFSET $2`,
                params
            );

            const countQuery = status 
                ? 'SELECT COUNT(*)::int AS total FROM wallet_transfers WHERE status = $1'
                : 'SELECT COUNT(*)::int AS total FROM wallet_transfers';
            const countParams = status ? [status] : [];
            const { rows: countRows } = await this.walletService.db.query(countQuery, countParams);

            return res.status(200).json({
                success: true,
                data: {
                    transfers: rows.map(r => ({
                        transferId: r.transfer_id,
                        userId: r.user_id,
                        userName: r.full_name,
                        userEmail: r.email,
                        from: r.from_wallet,
                        to: r.to_wallet,
                        amount: Number(r.amount).toFixed(2),
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
            this.log.error({ err }, 'admin.getAllTransfers failed');
            return res.status(500).json({ success: false, message: 'Something went wrong' });
        }
    }

    async getLockedFunds(req, res) {
        try {
            const { rows } = await this.walletService.db.query(
                `SELECT wt.transfer_id, wt.user_id, u.full_name, u.email,
                        wt.amount::numeric, wt.locked_until, wt.created_at,
                        EXTRACT(EPOCH FROM (wt.locked_until - NOW())) AS seconds_remaining
                 FROM wallet_transfers wt
                 JOIN users u ON wt.user_id = u.user_id
                 WHERE wt.from_wallet = 'account'
                   AND wt.to_wallet = 'trading'
                   AND wt.transfer_type = 'principal'
                   AND wt.status = 'active'
                   AND wt.unlocked_at IS NULL
                 ORDER BY wt.locked_until`
            );

            const totalLocked = rows.reduce((sum, r) => sum + Number(r.amount), 0);

            return res.status(200).json({
                success: true,
                data: {
                    totalLocked: totalLocked.toFixed(2),
                    totalCount: rows.length,
                    locks: rows.map(r => ({
                        transferId: r.transfer_id,
                        userId: r.user_id,
                        userName: r.full_name,
                        userEmail: r.email,
                        amount: Number(r.amount).toFixed(2),
                        lockedUntil: r.locked_until,
                        investedAt: r.created_at,
                        daysRemaining: Math.max(0, Math.ceil(Number(r.seconds_remaining) / 86400))
                    }))
                }
            });
        } catch (err) {
            this.log.error({ err }, 'admin.getLockedFunds failed');
            return res.status(500).json({ success: false, message: 'Something went wrong' });
        }
    }

    async getWalletStats(req, res) {
        try {
            const { rows } = await this.walletService.db.query(
                `SELECT 
                    SUM(CASE WHEN wallet_type = 'account' THEN balance ELSE 0 END)::numeric AS total_account,
                    SUM(CASE WHEN wallet_type = 'trading' THEN balance ELSE 0 END)::numeric AS total_trading,
                    SUM(CASE WHEN wallet_type = 'trading' THEN locked_balance ELSE 0 END)::numeric AS total_locked,
                    SUM(CASE WHEN wallet_type = 'referral' THEN balance ELSE 0 END)::numeric AS total_referral
                 FROM wallets`
            );

            const { rows: transferStats } = await this.walletService.db.query(
                `SELECT 
                    COUNT(*)::int AS total_transfers,
                    COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_transfers,
                    COUNT(CASE WHEN status = 'unlocked' THEN 1 END)::int AS unlocked_transfers,
                    SUM(amount)::numeric AS total_volume
                 FROM wallet_transfers`
            );

            return res.status(200).json({
                success: true,
                data: {
                    totalBalances: {
                        account: Number(rows[0]?.total_account || 0).toFixed(2),
                        trading: Number(rows[0]?.total_trading || 0).toFixed(2),
                        locked: Number(rows[0]?.total_locked || 0).toFixed(2),
                        referral: Number(rows[0]?.total_referral || 0).toFixed(2)
                    },
                    transferStats: {
                        totalTransfers: transferStats[0]?.total_transfers || 0,
                        activeTransfers: transferStats[0]?.active_transfers || 0,
                        unlockedTransfers: transferStats[0]?.unlocked_transfers || 0,
                        totalVolume: Number(transferStats[0]?.total_volume || 0).toFixed(2)
                    }
                }
            });
        } catch (err) {
            this.log.error({ err }, 'admin.getWalletStats failed');
            return res.status(500).json({ success: false, message: 'Something went wrong' });
        }
    }
}

module.exports = { AdminWalletController };
