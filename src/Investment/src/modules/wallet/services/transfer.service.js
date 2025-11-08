'use strict';

/**
 * TransferService
 * ---------------
 * High-level flows (A→T, T→A, R→A). Orchestrates:
 * - withTransaction boundary
 * - consistent wallet row locks (stable order)
 * - balance updates + trading lock updates
 * - immutable ledger entries + wallet_transfers record
 * - post-commit notifications & audit logs
 */

const { WalletService, WalletError, LOCK_ORDER } = require('./wallet.service');
const { ValidationService } = require('./validation.service');
const { MIN_TRADE_USD } = require('../policies/wallet.policy');

class TransferService {
    /**
     * @param {object} deps
     * @param {{query:Function}} deps.db
     * @param {WalletService} deps.walletService
     * @param {{sendTransfer?:Function}} [deps.notificationService]
     * @param {{logTransfer?:Function}} [deps.auditService]
     * @param {(fn:(client:any)=>Promise<any>)=>Promise<any>} [deps.withTransaction]
     * @param {Console|import('pino').Logger} [deps.logger]
     */
    constructor({ db, walletService, notificationService, auditService, withTransaction, logger = console }) {
        this.db = db;
        this.wallets = walletService;
        this.validate = new ValidationService();
        this.notify = notificationService;
        this.audit = auditService;
        this.withTransaction = withTransaction || walletService.withTransaction.bind(walletService);
        this.log = logger;
    }

    /**
     * Generic dispatcher used by controller.
     * @param {string} userId
     * @param {'account'|'trading'|'referral'} from
     * @param {'account'|'trading'|'referral'} to
     * @param {number} amount
     * @param {string} [idempotencyKey]
     */
    async transfer(userId, from, to, amount, idempotencyKey) {
        if (from === 'account' && to === 'trading') {
            return this.transferAccountToTrading(userId, amount, idempotencyKey);
        }
        if (from === 'trading' && to === 'account') {
            return this.transferTradingToAccount(userId, amount, idempotencyKey);
        }
        if (from === 'referral' && to === 'account') {
            return this.transferReferralToAccount(userId, amount, idempotencyKey);
        }
        throw new WalletError('FLOW_NOT_ALLOWED', 'This transfer flow is not supported');
    }

    /**
     * Account → Trading (locks principal)
     */
    async transferAccountToTrading(userId, amount, idempotencyKey) {
        if (!(amount > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be > 0');
        if (amount < MIN_TRADE_USD) this.validate.assertMinForAccountToTrading(amount);

        const result = await this.withTransaction(async (client) => {
            // Ensure wallets exist
            await this.wallets.ensureUserWallets(userId, client);

            // LOCK in stable order
            const lockSeq = this._lockOrder(['account', 'trading']);
            const locks = {};
            for (const t of lockSeq) locks[t] = await this.wallets.getWalletForUpdate(client, userId, t);
            const acc = locks['account'];
            const trg = locks['trading'];

            // Business checks
            this.validate.assertSufficient(acc.balance, amount);

            // Create transfer record with 30-day lock
            const lockedUntil = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
            const insTransfer = `
        INSERT INTO wallet_transfers (user_id, from_wallet, to_wallet, amount, transfer_type, locked_until, status, created_at)
        VALUES ($1, 'account', 'trading', $2, 'principal', $3, 'active', NOW())
        RETURNING transfer_id
      `;
            const { rows: trows } = await client.query(insTransfer, [userId, amount, lockedUntil]);
            const transferId = trows[0].transfer_id;

            // Debit account, credit trading
            const accAfter = await this.wallets.debit(client, {
                walletId: acc.wallet_id,
                currentBalance: acc.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            const trgAfter = await this.wallets.credit(client, {
                walletId: trg.wallet_id,
                currentBalance: trg.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            // Increase trading locked principal by amount
            await this.wallets.adjustTradingLock(client, userId, +amount);

            return { transferId, balances: await this.wallets.getBalances(userId), lockedUntil };
        });

        // Post-commit side effects (fire-and-forget)
        this._postTransferEffects(userId, { ...result, from: 'account', to: 'trading', amount, transferType: 'principal' });
        return result;
    }

    /**
     * Trading → Account (profits only; principal remains locked)
     */
    async transferTradingToAccount(userId, amount, idempotencyKey) {
        if (!(amount > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be > 0');

        const result = await this.withTransaction(async (client) => {
            await this.wallets.ensureUserWallets(userId, client);

            const lockSeq = this._lockOrder(['account', 'trading']);
            const locks = {};
            for (const t of lockSeq) locks[t] = await this.wallets.getWalletForUpdate(client, userId, t);
            const acc = locks['account'];
            const trg = locks['trading'];

            // Business checks: only unlocked can move
            this.validate.assertTradingHasUnlocked(trg.balance, trg.locked_balance, amount);

            // Create transfer record (profit withdrawal - no lock)
            const { rows: trows } = await client.query(
                `INSERT INTO wallet_transfers (user_id, from_wallet, to_wallet, amount, transfer_type, status, created_at)
         VALUES ($1, 'trading', 'account', $2, 'profit', 'active', NOW())
         RETURNING transfer_id`,
                [userId, amount]
            );
            const transferId = trows[0].transfer_id;

            // Debit trading (unlocked) and credit account
            const trgAfter = await this.wallets.debit(client, {
                walletId: trg.wallet_id,
                currentBalance: trg.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            const accAfter = await this.wallets.credit(client, {
                walletId: acc.wallet_id,
                currentBalance: acc.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            // NOTE: locked_balance remains unchanged (principal lock)
            return { transferId, balances: await this.wallets.getBalances(userId) };
        });

        this._postTransferEffects(userId, { ...result, from: 'trading', to: 'account', amount, transferType: 'profit' });
        return result;
    }

    /**
     * Referral → Account (no locks)
     */
    async transferReferralToAccount(userId, amount, idempotencyKey) {
        if (!(amount > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be > 0');

        const result = await this.withTransaction(async (client) => {
            await this.wallets.ensureUserWallets(userId, client);

            const lockSeq = this._lockOrder(['account', 'referral']);
            const locks = {};
            for (const t of lockSeq) locks[t] = await this.wallets.getWalletForUpdate(client, userId, t);
            const acc = locks['account'];
            const ref = locks['referral'];

            this.validate.assertSufficient(ref.balance, amount);

            const { rows: trows } = await client.query(
                `INSERT INTO wallet_transfers (user_id, from_wallet, to_wallet, amount, transfer_type, status, created_at)
         VALUES ($1, 'referral', 'account', $2, 'profit', 'active', NOW())
         RETURNING transfer_id`,
                [userId, amount]
            );
            const transferId = trows[0].transfer_id;

            const refAfter = await this.wallets.debit(client, {
                walletId: ref.wallet_id,
                currentBalance: ref.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            const accAfter = await this.wallets.credit(client, {
                walletId: acc.wallet_id,
                currentBalance: acc.balance,
                amount,
                reason: 'transfer',
                refType: 'transfer',
                refId: transferId,
                idempotencyKey: idempotencyKey || null,
            });

            return { transferId, balances: await this.wallets.getBalances(userId) };
        });

        this._postTransferEffects(userId, { ...result, from: 'referral', to: 'account', amount, transferType: 'profit' });
        return result;
    }

    // -----------------------
    // Helpers
    // -----------------------
    _lockOrder(types) {
        // Always lock in global LOCK_ORDER sequence to prevent deadlocks
        return [...types].sort((a, b) => LOCK_ORDER.indexOf(a) - LOCK_ORDER.indexOf(b));
    }

    async _postTransferEffects(userId, payload) {
        // Audit (best-effort)
        try { this.audit?.logTransfer?.(userId, payload); } catch (e) { this.log.warn({ e }, 'audit failed'); }
        // Notification (best-effort)
        try { await this.notify?.sendTransfer?.(userId, payload); } catch (e) { this.log.warn({ e }, 'notify failed'); }
    }
}

module.exports = { TransferService };
