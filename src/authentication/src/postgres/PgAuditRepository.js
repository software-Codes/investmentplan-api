

const { pool } = require('../Config/neon-database'); // adjust path if needed

class PgAuditRepository {
  /**
   * Persist an admin action.
   *
   * @param {Object}  options
   * @param {string}  options.adminId        ID of the admin performing the action
   * @param {string}  options.targetUserId   ID of the user affected
   * @param {string}  options.action         e.g. 'BLOCK_USER', 'UNBLOCK_USER'
   */
  async log({ adminId, targetUserId, action }) {
    await pool.query(
      `INSERT INTO admin_actions
     (log_id, admin_id, target_user_id, action, created_at)
   VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [adminId, targetUserId, action]
    );
  }
}

module.exports = PgAuditRepository;
