

const { pool } = require('../Config/neon-database'); // adjust path if needed

class PgAuditRepository {
  /**
   * Persist an admin action.
   *
   * @param {Object}  options
   * @param {string}  options.adminId        ID of the admin performing the action
   * @param {string}  options.targetUserId   ID of the user affected
   * @param {string}  options.action         e.g. 'BLOCK_USER', 'UNBLOCK_USER'
   * @param {Object}  [options.meta={}]      Extra JSON payload (reason, count…)
   */
  async log({ adminId, targetUserId, action, meta = {} }) {
    await pool.query(
      `INSERT INTO admin_actions
         (log_id, admin_id, target_user_id, action, meta, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [adminId, targetUserId, action, meta],
    );
  }
}

module.exports = PgAuditRepository;
