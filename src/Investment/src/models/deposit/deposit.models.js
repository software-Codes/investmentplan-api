const { v4: uuidv4 } = require("uuid");
const {
  pool,
  query,
} = require("../../../../../src/authentication/src/Config/neon-database");
const { logger } = require("../../utils/logger.investment");
const {
  WALLET_TYPES,
  DEPOSIT_STATUS,
  TRANSACTION_TYPES,
  LIMITS,
  CURRENCY,
} = require("../../utils/constants.investment");

class Deposit {
  /**
   * Create a new deposit record
   * @param {Object} depositData - Deposit information
   * @returns {Promise<Object>} Created deposit record
   */

  static async create(depositData) {
    const depositId = uuidv4();
    const currentDate = new Date().toISOString();

    try {
      const queryText = `
            INSERT INTO deposits (
              deposit_id,
              user_id,
              amount,
              binance_tx_id,
              status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `;

      const values = [
        depositId,
        depositData.userId,
        depositData.amount,
        depositData.binanceTxId,
        DEPOSIT_STATUS.PENDING,
        currentDate,
      ];
      const result = await query(queryText, values);
      ``;
      logger.info(`New deposit created: ${depositId}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to create deposit: ${error.message}`);
      throw new Error("Failed to create deposit record");
    }
  }
  /**
   * Verify and process a deposit
   * @param {string} depositId - Deposit ID to verify
   * @param {string} binanceTxId - Binance transaction ID
   * @returns {Promise<Object>} Updated deposit record
   */
  static async verifyAndProcess() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      //update deposit status
      const deposit = await client.query(
        `UPDATE deposits 
            SET status = $1, 
                binance_tx_id = $2,
                verified_at = NOW()
            WHERE deposit_id = $3 AND status = $4
            RETURNING *`,
        [
          DEPOSIT_STATUS.PROCESSING,
          binanceTxId,
          depositId,
          DEPOSIT_STATUS.PENDING,
        ]
      );
      if (!deposit.rows[0]) {
        throw new Error("Deposit not found or already processed");
      }
      // 2. Credit user's account wallet
      await client.query(
        `UPDATE wallets 
            SET balance = balance + $1
            WHERE user_id = $2 AND wallet_type = $3`,
        [deposit.rows[0].amount, deposit.rows[0].user_id, WALLET_TYPES.ACCOUNT]
      );
      // 3. Mark deposit as completed
      const completedDeposit = await client.query(
        `UPDATE deposits 
            SET status = $1,
                completed_at = NOW()
            WHERE deposit_id = $2
            RETURNING *`,
        [DEPOSIT_STATUS.COMPLETED, depositId]
      );
      await client.query("COMMIT");
      logger.info(`Deposit ${depositId} processed successfully`);
      return completedDeposit.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Deposit processing failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Get deposit history for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of deposit records
   */

  static async getUserDeposits(userId) {
    try {
      const queryText = `
      SELECT * FROM deposits 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;

      const result = await query(queryText, [userId]);
      return result.rows;
    } catch (error) {
      logger.error(`Failed to fetch user deposits: ${error.message}`);
      throw new Error("Failed to fetch deposit history");
    }
  }
    /**
   * Validate deposit amount
   * @param {number} amount - Deposit amount
   * @returns {boolean} True if valid
   * @throws {Error} If invalid amount
   */
  static validateDepositAmount(amount)
  {
    if (amount < LIMITS.MIN_DEPOSIT) {
      throw new Error(`Minimum deposit amount is $${LIMITS.MIN_DEPOSIT}`);
    }
    if (amount > LIMITS.MAX_DEPOSIT) {
      throw new Error(`Maximum deposit amount is $${LIMITS.MAX_DEPOSIT}`);
    }
    return true;

  }
   /**
   * Check for duplicate transaction
   * @param {string} binanceTxId - Binance transaction ID
   * @returns {Promise<boolean>} True if duplicate exists
   */
  static async checkDuplicateTransaction(binanceTxId)
  {
    try {
      const result = await query(
        'SELECT EXISTS(SELECT 1 FROM deposits WHERE binance_tx_id = $1)',
        [binanceTxId]
      );
      return result.rows[0].exists;
      
    } catch (error) {
      logger.error(`Duplicate check failed: ${error.message}`);
      throw new Error('Failed to check for duplicate transaction');
      
    }

  }
}

module.exports = Deposit;
