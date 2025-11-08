'use strict';

/**
 * WalletService
 * -------------
 * Low-level, transactional wallet operations:
 * - Ensure wallets exist (account, trading, referral).
 * - Lock wallet rows (SELECT ... FOR UPDATE).
 * - Atomic debit/credit with immutable ledger rows.
 * - Read balances (account/trading/referral).
 *
 * This service does NOT enforce business policies (min amounts, locks).
 * Policies live in validation/transfer services; here we guarantee atomicity and auditability.
 */

const REQUIRED_TYPES = ['account', 'trading', 'referral'];
const LOCK_ORDER = ['account', 'trading', 'referral']; // stable lock order to avoid deadlocks

class WalletError extends Error {
    constructor(code, message, status = 400, meta = undefined) {
        super(message);
        this.name = 'WalletError';
        this.code = code;
        this.status = status;
        this.meta = meta;
    }
}

class WalletService {
    /**
     * @param {object} deps
     * @param {{query:Function}} deps.db                         Pooled client with query(text, params)
     * @param {(fn:(client:any)=>Promise<any>)=>Promise<any>} [deps.withTransaction] Single-connection tx helper
     * @param {Console|import('pino').Logger} [deps.logger]
     */
    constructor({ db, withTransaction, logger = console } = {}) {
        if (!db || typeof db.query !== 'function') throw new Error('WalletService requires db.query');
        this.db = db;
        this.withTransaction = withTransaction || (fn => this._defaultTx(fn));
        this.log = logger;
    }

    /**
     * Ensure the three wallets exist for a user (idempotent).
     * @param {string} userId
     * @param {any} [client=this.db]
     */
    async ensureUserWallets(userId, client = this.db) {
        const q = `
      INSERT INTO wallets (user_id, wallet_type, balance, locked_balance, created_at, updated_at)
      VALUES ($1, 'account', 0, 0, NOW(), NOW()),
             ($1, 'trading', 0, 0, NOW(), NOW()),
             ($1, 'referral', 0, 0, NOW(), NOW())
      ON CONFLICT (user_id, wallet_type) DO NOTHING
    `;
        await client.query(q, [userId]);
    }

    /**
     * Fetch and lock a wallet row for update (pessimistic lock).
     * @param {any} client
     * @param {string} userId
     * @param {'account'|'trading'|'referral'} type
     * @returns {Promise<{wallet_id:string,balance:number,locked_balance:number}>}
     */
    async getWalletForUpdate(client, userId, type) {
        const sql = `
      SELECT wallet_id, balance::numeric, locked_balance::numeric
      FROM wallets
      WHERE user_id = $1 AND wallet_type = $2
      FOR UPDATE
    `;
        const { rows } = await client.query(sql, [userId, type]);
        if (!rows.length) throw new WalletError('WALLET_NOT_FOUND', `Wallet ${type} not found`, 404);
        return rows[0];
    }

    /**
     * Get all three balances for a user (no locks).
     * @param {string} userId
     */
    async getBalances(userId) {
        const sql = `
      SELECT wallet_type, balance::numeric AS balance, locked_balance::numeric AS locked
      FROM wallets
      WHERE user_id = $1
    `;
        const { rows } = await this.db.query(sql, [userId]);
        const out = { account: 0, trading: 0, tradingLocked: 0, referral: 0 };
        for (const r of rows) {
            if (r.wallet_type === 'account') out.account = Number(r.balance);
            if (r.wallet_type === 'trading') { out.trading = Number(r.balance); out.tradingLocked = Number(r.locked); }
            if (r.wallet_type === 'referral') out.referral = Number(r.balance);
        }
        return out;
    }

    /**
     * Credit a wallet and write ledger.
     * @param {any} client
     * @param {object} p
     * @param {string} p.walletId
     * @param {number} p.currentBalance
     * @param {number} p.amount
     * @param {string} [p.reason='transfer']
     * @param {string} [p.refType]
     * @param {string} [p.refId]
     * @param {string} [p.idempotencyKey]
     * @returns {Promise<number>} new balance
     */
    async credit(client, { walletId, currentBalance, amount, reason = 'transfer', refType, refId, idempotencyKey }) {
        if (!(amount > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be > 0');
        // Idempotency: if key is present and already used on this wallet, short-circuit
        if (idempotencyKey) {
            const idem = await client.query(
                `SELECT balance_after::numeric AS balance_after
           FROM wallet_transactions
          WHERE wallet_id = $1 AND idempotency_key = $2
          LIMIT 1`,
                [walletId, idempotencyKey]
            );
            if (idem.rowCount) return Number(idem.rows[0].balance_after);
        }

        const next = Math.round((Number(currentBalance) + Number(amount)) * 100) / 100;

        await client.query(
            `UPDATE wallets SET balance = $2, updated_at = NOW() WHERE wallet_id = $1`,
            [walletId, next]
        );

        await client.query(
            `INSERT INTO wallet_transactions
         (wallet_id, direction, amount, balance_after, reason, ref_type, ref_id, idempotency_key, created_at)
       VALUES
         ($1, 'credit', $2, $3, $4, $5, $6, $7, NOW())`,
            [walletId, amount, next, reason, refType || null, refId || null, idempotencyKey || null]
        );

        return next;
    }

    /**
     * Debit a wallet and write ledger.
     * @param {any} client
     * @param {object} p
     * @param {string} p.walletId
     * @param {number} p.currentBalance
     * @param {number} p.amount
     * @param {string} [p.reason='transfer']
     * @param {string} [p.refType]
     * @param {string} [p.refId]
     * @param {string} [p.idempotencyKey]
     * @returns {Promise<number>} new balance
     */
    async debit(client, { walletId, currentBalance, amount, reason = 'transfer', refType, refId, idempotencyKey }) {
        if (!(amount > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be > 0');
        const next = Math.round((Number(currentBalance) - Number(amount)) * 100) / 100;
        if (next < 0) throw new WalletError('INSUFFICIENT_FUNDS', 'Insufficient funds');

        await client.query(
            `UPDATE wallets SET balance = $2, updated_at = NOW() WHERE wallet_id = $1`,
            [walletId, next]
        );

        await client.query(
            `INSERT INTO wallet_transactions
         (wallet_id, direction, amount, balance_after, reason, ref_type, ref_id, idempotency_key, created_at)
       VALUES
         ($1, 'debit', $2, $3, $4, $5, $6, $7, NOW())`,
            [walletId, amount, next, reason, refType || null, refId || null, idempotencyKey || null]
        );

        return next;
    }

    /**
     * Adjust trading locked_balance (±amount). Does not change total balance.
     * @param {any} client
     * @param {string} userId
     * @param {number} deltaPositiveToLock  positive to increase lock, negative to decrease
     */
    async adjustTradingLock(client, userId, deltaPositiveToLock) {
        if (!Number.isFinite(deltaPositiveToLock)) throw new WalletError('LOCK_DELTA_INVALID', 'Invalid lock delta');
        const { rows } = await client.query(
            `UPDATE wallets
          SET locked_balance = GREATEST(0, (locked_balance::numeric + $3)::numeric),
              updated_at = NOW()
        WHERE user_id = $1 AND wallet_type = 'trading'
        RETURNING wallet_id, balance::numeric AS balance, locked_balance::numeric AS locked`,
            [userId, 'trading', Number(deltaPositiveToLock)]
        );
        if (!rows.length) throw new WalletError('WALLET_NOT_FOUND', 'Trading wallet not found', 404);
        const w = rows[0];
        if (Number(w.locked) > Number(w.balance)) {
            // Strong invariant: locked <= balance (DB check prevents negatives, but not > balance).
            // If this happens, rollback will revert anyway.
            throw new WalletError('LOCK_INVARIANT', 'Locked exceeds balance, aborting', 500);
        }
        return w;
    }

    /**
     * Public helper exposed for deposits, unchanged from your previous version.
     * Atomically credit Account with a deposit ledger (idempotent via idempotency_key).
     * @param {string} userId
     * @param {number|string} amountUsd
     * @param {{reason?:string, txId?:string, source?:'manual'|'auto', idempotencyKey?:string}} context
     */
    async creditAccount(userId, amountUsd, context = {}) {
        const num = typeof amountUsd === 'string' ? Number(amountUsd) : amountUsd;
        if (!Number.isFinite(num) || !(num > 0)) throw new WalletError('AMOUNT_INVALID', 'Amount must be a positive number');
        const rounded = Math.round(num * 100) / 100;
        if (context.idempotencyKey && String(context.idempotencyKey).length > 64) {
            throw new WalletError('IDEMP_KEY_INVALID', 'idempotencyKey must be <= 64 chars');
        }

        return this.withTransaction(async (client) => {
            await this.ensureUserWallets(userId, client);
            // Lock account
            const acc = await this.getWalletForUpdate(client, userId, 'account');

            // Idempotency short-circuit
            if (context.idempotencyKey) {
                const idem = await client.query(
                    `SELECT transaction_id, balance_after::numeric AS b FROM wallet_transactions
            WHERE wallet_id = $1 AND idempotency_key = $2 LIMIT 1`,
                    [acc.wallet_id, context.idempotencyKey]
                );
                if (idem.rowCount) {
                    return { walletId: acc.wallet_id, newBalance: Number(idem.rows[0].b).toFixed(2), transactionId: idem.rows[0].transaction_id };
                }
            }

            const after = await this.credit(client, {
                walletId: acc.wallet_id,
                currentBalance: acc.balance,
                amount: rounded,
                reason: context.reason || 'deposit',
                refType: 'deposit',
                refId: context.txId || null,
                idempotencyKey: context.idempotencyKey || null,
            });

            return { walletId: acc.wallet_id, newBalance: Number(after).toFixed(2), transactionId: null };
        });
    }

    // -------------------------------
    // Internal: default transaction
    // -------------------------------
    async _defaultTx(fn) {
        const client = this.db;
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) { }
            throw e;
        }
    }
}

module.exports = { WalletService, WalletError, REQUIRED_TYPES, LOCK_ORDER };
