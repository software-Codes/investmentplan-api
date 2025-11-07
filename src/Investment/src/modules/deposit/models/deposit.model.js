'use strict';

const { DepositStatus } = require('../dto/deposit.dto');
const cfg = require('../config/deposit.config');

class DepositError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'DepositError';
        this.code = code;
    }
}

/**
 * Repository expects a pg-like client:
 *   db.query(text, params) -> { rows, rowCount }
 * You can pass a pooled client or a transaction client.
 */
class DepositRepository {
    constructor(db) {
        if (!db || typeof db.query !== 'function') {
            throw new Error('DepositRepository requires a db with query(text, params)');
        }
        this.db = db;
        this.table = 'deposits';
    }

    async findByTxId(txId) {
        const q = `SELECT * FROM ${this.table} WHERE tx_id = $1 LIMIT 1`;
        const { rows } = await this.db.query(q, [txId]);
        return rows[0] || null;
    }

    async createPending({ userId, txId, amountUsd, network = 'ERC20', source = 'manual' }) {
        // Duplicate guard within window
        const dupQ = `
      SELECT deposit_id, created_at
      FROM ${this.table}
      WHERE tx_id = $1
        AND created_at >= NOW() - INTERVAL '${cfg.DUPLICATE_WINDOW_HOURS} hours'
      LIMIT 1
    `;
        const dup = await this.db.query(dupQ, [txId]);
        if (dup.rowCount > 0) {
            throw new DepositError('ERR_DUPLICATE_TXID', 'Transaction already submitted recently');
        }

        const ins = `
      INSERT INTO ${this.table}
        (user_id, tx_id, amount_usd, asset, network, status, source, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
        const { rows } = await this.db.query(ins, [
            userId,
            txId,
            amountUsd,
            'USDT',
            network,
            DepositStatus.PENDING,
            source,
        ]);
        return rows[0];
    }

    async markProcessing(depositId, metadata = undefined) {
        const upd = `
      UPDATE ${this.table}
      SET status = $2,
          updated_at = NOW(),
          metadata = COALESCE($3::jsonb, metadata)
      WHERE deposit_id = $1
        AND status = $4
      RETURNING *
    `;
        const { rows } = await this.db.query(upd, [
            depositId,
            DepositStatus.PROCESSING,
            metadata ? JSON.stringify(metadata) : null,
            DepositStatus.PENDING,
        ]);
        if (!rows[0]) {
            throw new DepositError('ERR_INVALID_TRANSITION', 'Only PENDING -> PROCESSING is allowed');
        }
        return rows[0];
    }

    async markConfirmed(depositId, { verifiedAt = null, creditedAt = null, amountUsd = null, metadata = undefined } = {}) {
        const upd = `
      UPDATE ${this.table}
      SET status = $2,
          amount = COALESCE($3, amount),
          amount_usd = COALESCE($4, amount_usd),
          verified_at = COALESCE($5, NOW()),
          credited_at = COALESCE($6, NOW()),
          updated_at = NOW(),
          metadata = COALESCE($7::jsonb, metadata)
      WHERE deposit_id = $1
        AND status IN ($8, $9)
      RETURNING *
    `;
        const { rows } = await this.db.query(upd, [
            depositId,
            DepositStatus.CONFIRMED,
            amountUsd,
            amountUsd,
            verifiedAt,
            creditedAt,
            metadata ? JSON.stringify(metadata) : null,
            DepositStatus.PENDING,
            DepositStatus.PROCESSING,
        ]);
        if (!rows[0]) {
            throw new DepositError('ERR_INVALID_TRANSITION', 'Only PENDING/PROCESSING -> CONFIRMED is allowed');
        }
        return rows[0];
    }

    async markFailed(depositId, { message = null, metadata = undefined } = {}) {
        const upd = `
      UPDATE ${this.table}
      SET status = $2,
          message = COALESCE($3, message),
          updated_at = NOW(),
          metadata = COALESCE($4::jsonb, metadata)
      WHERE deposit_id = $1
        AND status IN ($5, $6)
      RETURNING *
    `;
        const { rows } = await this.db.query(upd, [
            depositId,
            DepositStatus.FAILED,
            message,
            metadata ? JSON.stringify(metadata) : null,
            DepositStatus.PENDING,
            DepositStatus.PROCESSING,
        ]);
        if (!rows[0]) {
            throw new DepositError('ERR_INVALID_TRANSITION', 'Only PENDING/PROCESSING -> FAILED is allowed');
        }
        return rows[0];
    }

    async listForUser(userId, { page = 1, limit = 20, status = undefined, from = undefined, to = undefined } = {}) {
        const where = ['user_id = $1'];
        const params = [userId];
        let p = 2;

        if (Array.isArray(status) && status.length > 0) {
            where.push(`status = ANY($${p}::text[])`); params.push(status); p++;
        }
        if (from) { where.push(`created_at >= $${p}`); params.push(from); p++; }
        if (to) { where.push(`created_at <= $${p}`); params.push(to); p++; }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `SELECT COUNT(*)::int AS total FROM ${this.table} ${whereSql}`;
        const { rows: countRows } = await this.db.query(countSql, params);
        const total = countRows[0]?.total ?? 0;

        const offset = (page - 1) * limit;
        const listSql = `
      SELECT *
      FROM ${this.table}
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `;
        const { rows } = await this.db.query(listSql, [...params, limit, offset]);

        return { items: rows, total };
    }
}

module.exports = {
    DepositRepository,
    DepositError,
};
