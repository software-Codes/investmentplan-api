const { v4: uuidv4 } = require("uuid");
const {
  pool,
  query,
} = require("../../../../../src/authentication/src/Config/neon-database");
const { logger } = require("../../utils/logger.investment");
const { WALLET_TYPES } = require("../../utils/constants.investment");

//Wallet model to manage wallet operations:

class Wallet {
  /**
   * Create all required wallets for a new user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Created wallet records
   */

  static async createUserWallets(userId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const wallets = [];
      for (const type of Object.values(WALLET_TYPES)) {
        const result = await client.query(
          `INSERT INTO wallets (
                  wallet_id, user_id, wallet_type, created_at, updated_at
                ) VALUES ($1, $2, $3, NOW(), NOW())
                RETURNING *`,
          [uuidv4(), userId, type]
        );
        wallets.push(result.rows[0]);
      }
      await client.query("COMMIT");
      logger.info(`Created wallets for user: ${userId}`);
      return wallets;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to create user wallets: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
    /**
   * Get user's wallet balances
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's wallets
   */
  static async getUserWallets(userId)
  {
    try {
        const result = await query(
            'SELECT * FROM wallets WHERE user_id = $1',
            [userId]
          );
          return result.rows;
        
    }catch (error) {
        logger.error(`Failed to fetch user wallets: ${error.message}`);
        throw error;
      }

  }
    /**
   * Update wallet balance
   * @param {string} userId - User ID
   * @param {string} walletType - Wallet type
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {Promise<Object>} Updated wallet
   */
  static async updateBalance(userId, walletType, amount)
  {
    const client = await pool.connect();
    try {
        await client.query('BEGIN')
        const wallet = await client.query(
            'SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = $2 FOR UPDATE',
            [userId, walletType]
          );
          if (!wallet.rows[0]) {
            throw new Error('Wallet not found');
          }
          if (amount < 0 && wallet.rows[0].balance + amount < 0) {
            throw new Error('Insufficient balance');
          }
          const result = await client.query(
            `UPDATE wallets 
             SET balance = balance + $1,
                 updated_at = NOW()
             WHERE user_id = $2 AND wallet_type = $3
             RETURNING *`,
            [amount, userId, walletType]
          );
          await client.query('COMMIT');
          return result.rows[0];
          
        
    }catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Failed to update wallet balance: ${error.message}`);
        throw error;
      } finally {
        client.release();
      }

  }
}

module.exports = Wallet;
