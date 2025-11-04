const { pool, query } = require('../../../../database/connection');
const { v4: uuidv4 } = require('uuid');

class Wallet {
  static async getUserWallets(userId) {
    const res = await query(
      `SELECT * FROM wallets WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  static async updateBalance(userId, walletType, amount) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wallet = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = $2 FOR UPDATE`,
        [userId, walletType]
      );

      if (!wallet.rows[0]) throw new Error('Wallet not found');
      if (amount < 0 && wallet.rows[0].balance + amount < 0) {
        throw new Error('Insufficient balance');
      }

      const res = await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
         WHERE user_id = $2 AND wallet_type = $3 RETURNING *`,
        [amount, userId, walletType]
      );

      await client.query('COMMIT');
      return res.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Wallet;
