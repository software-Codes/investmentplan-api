// src/modules/investment/wallet/services/wallet.service.js
'use strict';

/**
 * WalletService
 *
 * Responsibilities
 * - Ensure user wallets (account, trading, referral) exist.
 * - Credit the Account wallet atomically with a ledger entry.
 *
 * Concurrency & Safety
 * - Runs inside an explicit DB transaction.
 * - SELECT ... FOR UPDATE on the wallet row to serialize concurrent updates.
 * - Idempotency guard using wallet_transactions.idempotency_key to prevent double credits.
 *
 * Dependencies
 * - db: object with query(sql, params) and optional tx helpers (see withTransaction below).
 *
 * Notes
 * - Ensure you pass a real "single-connection" client via withTransaction in production
 *   (BEGIN/COMMIT on a pool without pinning the same connection will not be safe).
 */

const REQUIRED_TYPES = ['account', 'trading', 'referral'];

class WalletService {
    /**
     * @param {object} deps
     * @param {any} deps.db - must provide query(text, params)
     * @param {(fn: (client:any)=>Promise<any>)=>Promise<any>} [deps.withTransaction] - optional tx helper; if not provided, a naive BEGIN/COMMIT/ROLLBACK will be used.
     */
    constructor({ db, withTransaction } = {}) {
        if (!db || typeof db.query !== 'function') throw new Error('WalletService requires db.query');
        this.db = db;
        this.withTransaction = withTransaction || (fn => this._defaultTx(fn));
    }

    /**
     * Create the three wallets for a user if they don't exist.
     * Idempotent via unique index (user_id, wallet_type).
     * Uses the provided client (falls back to this.db).
     * @param {string} userId
     * @param {any} client - optional tx client (uses same connection as caller)
     */
    async ensureUserWallets(userId, client = this.db) {
        const q = `
      INSERT INTO wallets (user_id, wallet_type, balance, locked_balance, created_at, updated_at)
      VALUES ($1, 'account', 0, 0, NOW(), NOW()),
             ($1, 'trading', 0, 0, NOW(), NOW()),
             ($1, 'referral', 0, 0, NOW(), NOW())
      ON CONFLICT (user_id, wallet_type) DO NOTHING
      RETURNING wallet_id, wallet_type
    `;
        await client.query(q, [userId]);
    }

    /**
     * Credit the user's Account wallet atomically + ledger (idempotent).
     *
     * @param {string} userId
     * @param {number|string} amountUsd - positive number with at most 2 decimals
     * @param {{reason?:string, txId?:string, source?:'manual'|'auto', idempotencyKey?:string}} context
     * @returns {Promise<{walletId:string, newBalance:string, transactionId:string|null}>}
     */
    async creditAccount(userId, amountUsd, context = {}) {
        // --- amount validation & normalization (2 dp max) ---
        const num = typeof amountUsd === 'string' ? Number(amountUsd) : amountUsd;
        if (!Number.isFinite(num) || !(num > 0)) throw new Error('Amount must be a positive number');
        const rounded = Math.round(num * 100) / 100;
        if (Math.abs(num - rounded) > Number.EPSILON) {
            throw new Error('Amount must have at most 2 decimal places');
        }

        if (context.idempotencyKey && String(context.idempotencyKey).length > 64) {
            throw new Error('idempotencyKey must be <= 64 characters');
        }

        return this.withTransaction(async (client) => {
            // 1) Ensure account wallet exists (use the same tx client)
            await this.ensureUserWallets(userId, client);

            // 2) Lock the account wallet row
            const sel = `
        SELECT wallet_id, balance
        FROM wallets
        WHERE user_id = $1 AND wallet_type = 'account'
        FOR UPDATE
      `;
            const res = await client.query(sel, [userId]);
            if (res.rowCount === 0) throw new Error('Account wallet not found');
            const wallet = res.rows[0];

            // 2a) Idempotency guard: if we've already credited with this key, return existing balance/tx
            if (context.idempotencyKey) {
                const idem = await client.query(
                    `SELECT transaction_id, balance_after
             FROM wallet_transactions
            WHERE wallet_id = $1 AND idempotency_key = $2
            LIMIT 1`,
                    [wallet.wallet_id, context.idempotencyKey]
                );
                if (idem.rowCount) {
                    const existing = idem.rows[0];
                    return {
                        walletId: wallet.wallet_id,
                        newBalance: Number(existing.balance_after).toFixed(2),
                        transactionId: existing.transaction_id,
                    };
                }
            }

            // 3) Compute new balance
            const current = Number(wallet.balance);
            const next = Math.round((current + rounded) * 100) / 100;

            // 4) Update wallet balance
            const upd = `
        UPDATE wallets
           SET balance = $2, updated_at = NOW()
         WHERE wallet_id = $1
      `;
            await client.query(upd, [wallet.wallet_id, next]);

            // 5) Insert immutable ledger row
            const ins = `
        INSERT INTO wallet_transactions
          (wallet_id, direction, amount, balance_after, reason, ref_type, ref_id, idempotency_key, created_at)
        VALUES
          ($1, 'credit', $2, $3, $4, 'deposit', $5, $6, NOW())
        RETURNING transaction_id
      `;
            const params = [
                wallet.wallet_id,
                rounded,
                next,
                context.reason || 'deposit',
                context.txId || null,
                context.idempotencyKey || null,
            ];
            const { rows } = await client.query(ins, params);

            return {
                walletId: wallet.wallet_id,
                newBalance: next.toFixed(2),
                transactionId: rows[0].transaction_id,
            };
        });
    }

    // -------------------------------
    // Internal: default transaction
    // -------------------------------
    async _defaultTx(fn) {
        // NOTE: This naive implementation assumes this.db keeps the same connection across BEGIN/COMMIT.
        // In production, inject a proper withTransaction that checks out a single client from the pool.
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

module.exports = { WalletService, REQUIRED_TYPES };
