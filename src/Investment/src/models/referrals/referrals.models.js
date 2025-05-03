const { v4: uuidv4 } = require("uuid");
const {
  pool,
  query,
} = require("../../../../../src/authentication/src/Config/neon-database");
const { logger } = require("../../utils/logger.investment");
const { WALLET_TYPES } = require("../../utils/constants.investment");

class Referral {
  /**
   * Generate and save referral code for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created referral record
   */
  static async generateReferralCode(userId) {
    try {
      const referralCode = this.generateUniqueCode();
      const referralId = uuidv4();
      const queryText = `
        INSERT INTO referrals (
          referral_id,
          referrer_id,
          referral_code,
          created_at
        ) VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      const result = await query(queryText, [referralId, userId, referralCode]);
      logger.info(`Referral code generated for user: ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to generate referral code: ${error.message}`);
      throw new Error("Failed to generate referral code");
    }
  }
  /**
   * Process referral bonus when a new user makes their first deposit
   * @param {string} refereeId - New user ID
   * @param {string} referralCode - Referral code used
   * @param {number} depositAmount - First deposit amount
   */
  static async processReferralBonus(refereeId, referralCode, depositAmount) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      //find referrer
      const referral = await client.query(
        "SELECT * FROM referrals WHERE referral_code = $1",
        [referralCode]
      );
      if (!referral.rows[0]) {
        throw new Error("Invalid referral code");
      }
      const referrerId = referral.rows[0].referrer_id;
      const bonusAmount = depositAmount * 0.1; // 10% bonus
      // Credit referral bonus to referrer's wallet
      await client.query(
        `UPDATE wallets 
             SET balance = balance + $1
             WHERE user_id = $2 AND wallet_type = $3`,
        [bonusAmount, referrerId, WALLET_TYPES.REFERRAL]
      );
      // Record referral bonus
      await client.query(
        `INSERT INTO referral_bonuses (
              bonus_id,
              referral_id,
              referee_id,
              deposit_amount,
              bonus_amount,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          referral.rows[0].referral_id,
          refereeId,
          depositAmount,
          bonusAmount,
        ]
      );

      await client.query("COMMIT");
      logger.info(`Referral bonus processed for referrer: ${referrerId}`);
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to process referral bonus: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Get referral statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Referral statistics
   */
  static async getReferralStats(users) {
    try {
      const queryText = `
          SELECT 
            COUNT(DISTINCT rb.referee_id) as total_referrals,
            COALESCE(SUM(rb.bonus_amount), 0) as total_earnings,
            COALESCE(SUM(CASE WHEN w.status = 'completed' THEN rb.bonus_amount ELSE 0 END), 0) as withdrawn_earnings
          FROM referrals r
          LEFT JOIN referral_bonuses rb ON r.referral_id = rb.referral_id
          LEFT JOIN withdrawals w ON w.user_id = r.referrer_id AND w.wallet_type = $2
          WHERE r.referrer_id = $1
        `;

      const result = await query(queryText, [userId, WALLET_TYPES.REFERRAL]);
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to fetch referral stats: ${error.message}`);
      throw new Error("Failed to fetch referral statistics");
    }
  }
  /**
   * Generate a unique referral code
   * @private
   * @returns {string} Unique referral code
   */
  static generateUniqueCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }
}


module.exports = Referral;