const { v4: uuidv4 } = require("uuid");
const {
  pool,
  query,
} = require("../../../../../src/authentication/src/Config/neon-database");
const { logger } = require("../../utils/logger.investment");
const { WALLET_TYPES } = require("../../utils/constants.investment");
const { cli } = require("winston/lib/winston/config");

class Withdrawal {
  /**
   * Create a new withdrawal request
   * @param {Object} data - Withdrawal request data
   * @returns {Promise<Object>} Created withdrawal record
   */
  /**
   * Validate withdrawal eligibility
   * @param {string} userId - User ID
   * @param {number} amount - Amount to withdraw
   * @returns {Promise<Object>} Validation result
   */
  static async validateWithdrawalEligibility(userId, amount) {
    try {
      // Get user's active investments
      const investment = await query(
        `
        SELECT 
          investment_id,
          amount as principal,
          profit,
          start_date,
          NOW() - start_date as duration
        FROM investments 
        WHERE user_id = $1 
        AND status = 'active'
      `,
        [userId]
      );

      if (!investment.rows[0]) {
        throw new Error("No active investment found");
      }
      const { principal, profit, duration } = investment.rows[0];
      const daysElapsed = Math.floor(duration / (1000 * 60 * 60 * 24));
      // Check if trying to withdraw more than available
      if (amount > principal + profit) {
        throw new Error("Withdrawal amount exceeds available balance");
      }
      // If amount includes principal
      if (amount > profit) {
        if (daysElapsed < 30) {
          throw new Error("Principal can only be withdrawn after 30 days");
        }
      } else {
        // If withdrawing only profit
        if (daysElapsed < 7) {
          throw new Error("Profit can only be withdrawn after 7 days");
        }
      }
      return { eligible: true };
    } catch (error) {
      logger.error(`Withdrawal eligibility check failed: ${error.message}`);
      throw error;
    }
  }

  static async createWithdrawalRequest() {
    const client = pool.connect();
    try {
      await client.query("BEGIN");
      // Verify withdrawal from account wallet only
      if (data.walletType !== WALLET_TYPES.ACCOUNT) {
        throw new Error("Withdrawals are only allowed from account wallet");
      }
      // Check wallet balance
      const wallet = await client.query(
        "SELECT balance FROM wallets WHERE user_id = $1 AND wallet_type = $2",
        [data.userId, WALLET_TYPES.ACCOUNT]
      );
      if (!wallet.rows[0] || wallet.rows[0].balance < data.amount) {
        throw new Error("Insufficient balance in account wallet");
      }

      // Lock the funds
      await client.query(
        `UPDATE wallets 
         SET balance = balance - $1,
             locked_balance = COALESCE(locked_balance, 0) + $1
         WHERE user_id = $2 AND wallet_type = $3`,
        [data.amount, data.userId, WALLET_TYPES.ACCOUNT]
      );
      // Create withdrawal request
      const withdrawalId = uuidv4();
      const queryText = `
           INSERT INTO withdrawals (
             withdrawal_id,
             user_id,
             amount,
             withdrawal_type,
             binance_address,
             status,
             admin_approval_needed,
             requested_at,
             processing_deadline
           ) VALUES ($1, $2, $3, $4, $5, 'pending', true, NOW(), NOW() + INTERVAL '20 minutes')
           RETURNING *
         `;
      const withdrawalType =
        data.amount <= data.profitAmount ? "profit" : "principal";
      const result = await client.query(queryText, [
        withdrawalId,
        data.userId,
        data.amount,
        withdrawalType,
        data.binanceAddress,
      ]);
      await client.query("COMMIT");
      logger.info(
        `${withdrawalType} withdrawal request created: ${withdrawalId}`
      );
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to create withdrawal request: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Admin approval for withdrawal
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} adminId - Admin ID
   * @returns {Promise<Object>} Updated withdrawal record
   */
  static async approveWithdrawal(withdrawalId, adminId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Check if within 20-minute window
      const withdrawal = await client.query(
        `SELECT * FROM withdrawals 
         WHERE withdrawal_id = $1 
         AND status = 'pending'
         AND NOW() <= processing_deadline`,
        [withdrawalId]
      );
      if (!withdrawal.rows[0]) {
        throw new Error("Withdrawal not found or processing deadline passed");
      }
      // Update withdrawal status
      const result = await client.query(
        `UPDATE withdrawals 
             SET status = 'approved',
                 admin_id = $2,
                 approved_at = NOW()
             WHERE withdrawal_id = $1
             RETURNING *`,
        [withdrawalId, adminId]
      );
      await client.query("COMMIT");
      logger.info(`Withdrawal ${withdrawalId} approved by admin ${adminId}`);
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to approve withdrawal: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Get pending withdrawals for admin
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of pending withdrawals
   */
  static async getPendingWithdrawals(filters = {}) {
    try {
      let queryText = `
        SELECT w.*, u.email as user_email
        FROM withdrawals w
        JOIN users u ON w.user_id = u.user_id
        WHERE w.status = 'pending'
        AND NOW() <= w.processing_deadline
      `;

      if (filters.minAmount) {
        queryText += " AND w.amount >= $1";
      }
      queryText += " ORDER BY w.requested_at ASC";
      const values = filters.minAmount ? [filters.minAmount] : [];
      const result = await query(queryText, values);
      return result.rows;
    } catch (error) {}
  }
  catch(error) {
    logger.error(`Failed to fetch pending withdrawals: ${error.message}`);
    throw error;
  }

  /**
   * Get user's withdrawal history
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of withdrawals
   */
  static async getUserWithdrawals(userId) {
    try {
      const queryText = `
        SELECT * FROM withdrawals 
        WHERE user_id = $1 
        ORDER BY requested_at DESC
      `;
      const result = await query(queryText, [userId]);
      return result.rows;
    } catch (error) {
      logger.error(`Failed to fetch user withdrawals: ${error.message}`);
      throw error;
    }
  }
  /**
   * Cancel withdrawal request
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cancelled withdrawal
   */
  static async cancelWithdrawal() {
    try {
      const client = await pool.connect();
      await client.query("BEGIN");
      const withdrawal = await client.query(
        `SELECT * FROM withdrawals 
         WHERE withdrawal_id = $1 
         AND user_id = $2 
         AND status = 'pending'`,
        [withdrawalId, userId]
      );
      if (!withdrawal.rows[0]) {
        throw new Error("Withdrawal not found or already processed");
      }

      // Return funds to wallet
      await client.query(
        `UPDATE wallets 
         SET balance = balance + $1,
             locked_balance = locked_balance - $1
         WHERE user_id = $2 AND wallet_type = $3`,
        [withdrawal.rows[0].amount, userId, WALLET_TYPES.ACCOUNT]
      );
      // Update withdrawal status
      const result = await client.query(
        `UPDATE withdrawals 
     SET status = 'cancelled',
         cancelled_at = NOW()
     WHERE withdrawal_id = $1
     RETURNING *`,
        [withdrawalId]
      );
      await client.query("COMMIT");
      logger.info(`Withdrawal ${withdrawalId} cancelled`);
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to cancel withdrawal: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Withdrawal;
