const { v4: uuidv4 } = require("uuid");
const {
  pool,
  query,
} = require("../../../../../src/authentication/src/Config/neon-database");
const { logger } = require("../../utils/logger.investment");
const { WALLET_TYPES } = require("../../utils/constants.investment");

class Trading {
  /**
   * Transfer funds between wallets
   * @param {string} userId - User ID
   * @param {string} fromWallet - Source wallet type
   * @param {string} toWallet - Destination wallet type
   * @param {number} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  static async transferFunds(userId, fromWallet, toWallet, amount) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Check source wallet balance
      const sourceWallet = await client.query(
        "SELECT balance FROM wallets WHERE user_id = $1 AND wallet_type = $2",
        [userId, fromWallet]
      );
      if (!sourceWallet.rows[0] || sourceWallet.rows[0].balance < amount) {
        throw new Error("Insufficient balance for transfer");
      }
      // Deduct from source wallet
      await client.query(
        `UPDATE wallets 
             SET balance = balance - $1
             WHERE user_id = $2 AND wallet_type = $3`,
        [amount, userId, fromWallet]
      );
      // Add to destination wallet
      await client.query(
        `UPDATE wallets 
         SET balance = balance + $1
         WHERE user_id = $2 AND wallet_type = $3`,
        [amount, userId, toWallet]
      );
      // Record transfer transaction
      const transferId = uuidv4();
      await client.query(
        `INSERT INTO wallet_transfers (
             transfer_id,
             user_id,
             from_wallet,
             to_wallet,
             amount,
             created_at
           ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [transferId, userId, fromWallet, toWallet, amount]
      );
      await client.query("COMMIT");
      logger.info(`Transfer completed successfully: ${transferId}`);
      return { transferId, amount, fromWallet, toWallet };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Transfer failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Start trading with specified amount
   * @param {string} userId - User ID
   * @param {number} amount - Amount to start trading
   * @returns {Promise<Object>} Trading record
   */
  static async startTrading(userId, amount) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Verify minimum trading amount
      if (amount < 10) {
        throw new Error("Minimum trading amount is $10");
      }
      // Check trading wallet balance
      const wallet = await client.query(
        "SELECT balance FROM wallets WHERE user_id = $1 AND wallet_type = $2",
        [userId, WALLET_TYPES.TRADING]
      );
      if (!wallet.rows[0] || wallet.rows[0].balance < amount) {
        throw new Error("Insufficient balance in trading wallet");
      }
      // Create trading record
      const tradingId = uuidv4();
      const result = await client.query(
        `INSERT INTO trading_accounts (
          trading_id,
          user_id,
          initial_amount,
          current_amount,
          profit_amount,
          start_date,
          last_compound_date,
          status
        ) VALUES ($1, $2, $3, $3, 0, NOW(), NOW(), 'active')
        RETURNING *`,
        [tradingId, userId, amount]
      );

      await client.query("COMMIT");
      logger.info(
        `Trading startedcheck your profit after 7 days for withdrawal : ${tradingId}`
      );
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to start trading: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Calculate and compound daily profits
   * @param {string} tradingId - Trading account ID
   * @returns {Promise<Object>} Updated trading record
   */
  static async calculateDailyProfit(tradingId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const trading = await client.query(
        "SELECT * FROM trading_accounts WHERE trading_id = $1 AND status = $2",
        [tradingId, "active"]
      );
      if (!trading.rows[0]) {
        throw new Error("Trading account not found or inactive");
      }
      const dailyRate = 0.0025; // 0.25%
      const profit = trading.rows[0].current_amount * dailyRate;
      const result = await client.query(
        `UPDATE trading_accounts 
         SET current_amount = current_amount + $1,
             profit_amount = profit_amount + $1,
             last_compound_date = NOW()
         WHERE trading_id = $2
         RETURNING *`,
        [profit, tradingId]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Trading;
