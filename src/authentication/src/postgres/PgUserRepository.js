/**
 * Postgres implementation of IUserRepository
 * ------------------------------------------
 *  • Conditional aggregation turns the many-row wallet table into three balance
 *    columns per user, so each user appears exactly once in the result-set.
 *  • deleteUser() wipes every child table shown in your schema screenshot; if you
 *    later add ON DELETE CASCADE FKs you can prune some DELETEs.
 */
const IUserRepository  = require('../models/interfaces/IUserRepository');
const { pool }         = require('../Config/neon-database');
const SqlBuilder       = require('../utils/sqlBuilder.util');
const { buildPaging }  = require('../utils/pagination.util');
const RepositoryError  = require('../errors/RepositoryError');

const BALANCE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      MAX(CASE WHEN w.wallet_type = 'account'  THEN w.balance END) AS account_balance,
      MAX(CASE WHEN w.wallet_type = 'trading'  THEN w.balance END) AS trading_balance,
      MAX(CASE WHEN w.wallet_type = 'referral' THEN w.balance END) AS referral_balance
    FROM wallets w
    WHERE w.user_id = u.user_id
  ) wb ON TRUE
`;

class PgUserRepository extends IUserRepository {
  /* ---------- READ MANY ---------- */
  async findMany(filters = {}, paging = {}) {
    const { limit, offset } = buildPaging(paging);

    const qb = new SqlBuilder()
      .and('LOWER(u.email) LIKE', filters.search ? `%${filters.search.toLowerCase()}%` : undefined)
      .and('u.account_status =',   filters.status);

    const where = qb.toWhere();

    const baseSql = `
      FROM users u
      ${BALANCE_JOIN}
      ${where.sql}
    `;

    const totalRes = await pool.query(`SELECT COUNT(*) ${baseSql}`, where.values);

    const rowsRes  = await pool.query(
      `
        SELECT
          u.user_id, u.full_name, u.email, u.account_status, u.created_at,
          wb.account_balance, wb.trading_balance, wb.referral_balance
        ${baseSql}
        ORDER BY u.created_at DESC
        LIMIT  $${where.values.length + 1}
        OFFSET $${where.values.length + 2}
      `,
      [...where.values, limit, offset],
    );

    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count) };
  }

  /* ---------- READ ONE ---------- */
  async findById(userId) {
    const res = await pool.query(
      `
        SELECT
          u.*, wb.account_balance, wb.trading_balance, wb.referral_balance
        FROM users u
        ${BALANCE_JOIN}
        WHERE u.user_id = $1
      `,
      [userId],
    );
    return res.rows[0] || null;
  }

  /* ---------- UPDATE ---------- */
  async updateStatus(userId, newStatus) {
    const { rowCount } = await pool.query(
      `UPDATE users SET account_status = $1, updated_at = NOW() WHERE user_id = $2`,
      [newStatus, userId],
    );
    if (!rowCount) throw RepositoryError.notFound('User');
  }

  /* ---------- DELETE ---------- */
  async deleteUser(userId, { softDelete = false } = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (softDelete) {
        await client.query(
          `UPDATE users SET account_status = 'deactivated', updated_at = NOW() WHERE user_id = $1`,
          [userId],
        );
      } else {
        // delete from child tables first to satisfy FK constraints
        await client.query(`DELETE FROM wallet_transfers  WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM deposits          WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM withdrawals       WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM trading_accounts  WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM referral_bonuses  WHERE referrer_id = $1 OR referee_id = $1`, [userId]);
        await client.query(`DELETE FROM referrals         WHERE referrer_id = $1 OR referee_id = $1`, [userId]);
        await client.query(`DELETE FROM wallets           WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM kyc_documents     WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM user_sessions     WHERE user_id = $1`, [userId]);

        // finally remove the user
        await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new RepositoryError('Failed to delete user', err);
    } finally {
      client.release();
    }
  }
}

module.exports = PgUserRepository;
