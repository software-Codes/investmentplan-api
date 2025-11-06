

const { pool } = require('../Config/supabase-database'); // adjust path if needed

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
     (admin_id, target_user_id, action)
   VALUES ($1, $2, $3)`,
      [adminId, targetUserId, action]
    );
  }
}

module.exports = PgAuditRepository;
