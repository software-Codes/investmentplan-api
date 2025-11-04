const { pool, query } = require('../../../database/connection');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class User {
  static async create(userData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userId = uuidv4();
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      const userResult = await client.query(
        `INSERT INTO users (user_id, full_name, email, phone_number, password_hash, preferred_contact_method)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, userData.fullName, userData.email.toLowerCase(), userData.phoneNumber, passwordHash, userData.preferredContactMethod || 'email']
      );

      const walletTypes = ['account', 'trading', 'referral'];
      for (const type of walletTypes) {
        await client.query(
          `INSERT INTO wallets (wallet_id, user_id, wallet_type) VALUES ($1, $2, $3)`,
          [uuidv4(), userId, type]
        );
      }

      await client.query('COMMIT');
      
      const { password_hash, ...user } = userResult.rows[0];
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByEmail(email) {
    const res = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return res.rows[0] || null;
  }

  static async findByPhoneNumber(phoneNumber) {
    const res = await query(
      `SELECT * FROM users WHERE phone_number = $1`,
      [phoneNumber]
    );
    return res.rows[0] || null;
  }

  static async findById(userId) {
    const res = await query(
      `SELECT user_id, full_name, email, phone_number, preferred_contact_method, 
              email_verified, phone_verified, account_status, created_at 
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  static async updateVerificationStatus(userId, field, value) {
    const validFields = ['email_verified', 'phone_verified'];
    if (!validFields.includes(field)) {
      throw new Error('Invalid verification field');
    }

    const res = await query(
      `UPDATE users SET ${field} = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *`,
      [value, userId]
    );
    
    if (!res.rows[0]) throw new Error('User not found');
    return res.rows[0];
  }

  static async updateAccountStatus(userId, status) {
    const validStatuses = ['pending', 'active', 'suspended', 'deactivated'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid account status');
    }

    const res = await query(
      `UPDATE users SET account_status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *`,
      [status, userId]
    );
    
    if (!res.rows[0]) throw new Error('User not found');
    return res.rows[0];
  }

  static async updateLoginInfo(userId, ipAddress) {
    await query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, 
       failed_login_attempts = 0, updated_at = NOW() WHERE user_id = $2`,
      [ipAddress, userId]
    );
  }

  static async incrementFailedLoginAttempts(userId) {
    const res = await query(
      `UPDATE users SET failed_login_attempts = failed_login_attempts + 1, 
       updated_at = NOW() WHERE user_id = $1 RETURNING failed_login_attempts`,
      [userId]
    );
    
    if (!res.rows[0]) throw new Error('User not found');
    return res.rows[0].failed_login_attempts;
  }

  static async changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const res = await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
      [passwordHash, userId]
    );
    
    if (res.rowCount === 0) throw new Error('User not found');
  }

  static async validatePassword(providedPassword, storedPasswordHash) {
    return bcrypt.compare(providedPassword, storedPasswordHash);
  }

  static async createSession(userId, sessionData) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const res = await query(
      `INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, expires_at, created_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [sessionId, userId, sessionData.ipAddress, sessionData.userAgent, expiresAt]
    );
    
    return res.rows[0];
  }

  static async invalidateSession(sessionId) {
    const res = await query(
      `UPDATE user_sessions SET is_active = false WHERE session_id = $1 RETURNING session_id`,
      [sessionId]
    );
    return res.rowCount > 0;
  }

  static async invalidateAllOtherSessions(userId, currentSessionId) {
    const res = await query(
      `UPDATE user_sessions SET is_active = false 
       WHERE user_id = $1 AND session_id != $2`,
      [userId, currentSessionId]
    );
    return res.rowCount;
  }

  static async getAccountCompletionStatus(userId) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const kycDocs = await query(
      `SELECT DISTINCT document_type FROM kyc_documents WHERE user_id = $1`,
      [userId]
    );

    return {
      basicVerified: user.email_verified || user.phone_verified,
      documentsSubmitted: kycDocs.rows.length > 0,
      accountComplete: kycDocs.rows.length >= 1,
      completionPercentage: kycDocs.rows.length > 0 ? 100 : 50
    };
  }

  static async initiatePasswordReset(email) {
    const user = await this.findByEmail(email);
    if (!user) throw new Error('User not found');

    const OTP = require('./otp.model');
    await OTP.generate({
      userId: user.user_id,
      email: user.email,
      purpose: 'reset_password',
      delivery: 'email'
    });

    return {
      userId: user.user_id,
      method: 'email',
      message: 'Recovery code sent via email'
    };
  }

  static async completePasswordReset(userId, otpCode, newPassword) {
    const OTP = require('./otp.model');
    const isValid = await OTP.verify({
      userId,
      code: otpCode,
      purpose: 'reset_password'
    });

    if (!isValid) throw new Error('Invalid or expired OTP');

    await this.changePassword(userId, newPassword);
    return { success: true, message: 'Password reset successfully' };
  }

  static async deleteAccount(userId, password) {
    const user = await query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
    if (!user.rows[0]) throw new Error('User not found');

    const isValid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isValid) throw new Error('Invalid password');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE user_sessions SET is_active = false WHERE user_id = $1`, [userId]);
      await client.query(`UPDATE wallets SET balance = 0, locked_balance = 0 WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM kyc_documents WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = User;
