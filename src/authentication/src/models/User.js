// # Users table schema
/**
 * @file user.model.js
 * @description User model for the investment platform with comprehensive schema for authentication and account management
 */

const { pool, query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
/**
 * User model - Handles all user-related database operations
 */
class User {
  /**
   * Create a new user in the database
   * @param {Object} userData - User data for registration
   * @param {string} userData.fullName - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} userData.phoneNumber - User's phone number
   * @param {string} userData.password - User's password (will be hashed)
   * @param {string} userData.preferredContactMethod - User's preferred contact method (email/phone)
   * @returns {Promise<Object>} Created user object (without password)
   * @throws {Error} If user creation fails
   */

  static async create(userData) {
    const userId = uuidv4();
    const currentDate = new Date().toISOString();

    //hash the  user password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);
    const queryText = `
    INSERT INTO users (
      user_id, 
      full_name, 
      email, 
      phone_number, 
      password_hash, 
      preferred_contact_method, 
      email_verified, 
      phone_verified, 
      account_status, 
      failed_login_attempts, 
      created_at, 
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING 
      user_id, 
      full_name, 
      email, 
      phone_number, 
      preferred_contact_method, 
      email_verified, 
      phone_verified, 
      account_status, 
      created_at;
  `;
    const values = [
      userId,
      userData.fullName,
      userData.email.toLowerCase(),
      userData.phoneNumber,
      passwordHash,
      userData.preferredContactMethod || "email",
      false, // email_verified
      false, // phone_verified
      "pending", // account_status
      0, // failed_login_attempts
      currentDate,
      currentDate,
    ];
    try {
      const res = await query(queryText, values);
      return res.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        //unique violation
        if (error.detail.includes("email")) {
          throw new Error("Email address already registered");
        } else if (error.detail.includes("phone_number")) {
          throw new Error("Phone number already registered");
        }
      }
      throw new Error(`failed to create the user ${error.message}`);
    }
  }
  /**
   * Find a user by their email address
   * @param {string} email - User's email address
   * @returns {Promise<Object|null>} User object if found, null otherwise
   */

  static async findbyEmail(email) {
    const queryText = `
        SELECT 
          user_id, 
          full_name, 
          email, 
          phone_number, 
          password_hash, 
          preferred_contact_method, 
          email_verified, 
          phone_verified, 
          account_status, 
          failed_login_attempts, 
          last_login_at, 
          created_at, 
          updated_at
        FROM users 
        WHERE email = $1;
      `;
    const res = await query(queryText, [email.toLowerCase()]);
    return res.rows[0] || null;
  }
  /**
   * Find a user by their phone number
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object|null>} User object if found, null otherwise
   */
  static async findByPhoneNumber(phoneNumber) {
    const queryText = `
      SELECT 
        user_id, 
        full_name, 
        email, 
        phone_number, 
        password_hash, 
        preferred_contact_method, 
        email_verified, 
        phone_verified, 
        account_status, 
        failed_login_attempts, 
        last_login_at, 
        created_at, 
        updated_at
      FROM users 
      WHERE phone_number = $1;
    `;

    const res = await query(queryText, [phoneNumber]);
    return res.rows[0] || null;
  }
  /**
   * Find a user by their ID
   * @param {string} userId - User's UUID
   * @returns {Promise<Object|null>} User object if found, null otherwise
   */
  static async findById(userId) {
    const queryText = `
          SELECT 
            user_id, 
            full_name, 
            email, 
            phone_number, 
            preferred_contact_method, 
            email_verified, 
            phone_verified, 
            account_status, 
            failed_login_attempts, 
            last_login_at, 
            created_at, 
            updated_at
          FROM users 
          WHERE user_id = $1;
        `;

    const res = await query(queryText, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Update a user's verification status
   * @param {string} userId - User's UUID
   * @param {string} field - Field to update ('email_verified' or 'phone_verified')
   * @param {boolean} value - New verification status
   * @returns {Promise<Object>} Updated user object
   */
  static async updateVerificationStatus(userId, field, value) {
    const validFields = ["email_verified", "phone_verified"];
    if (!validFields.includes(field)) {
      throw new Error("Invalid field for verification update");
    }

    const queryText = `
          UPDATE users 
          SET ${field} = $1, updated_at = $2
          WHERE user_id = $3
          RETURNING 
            user_id, 
            full_name, 
            email, 
            phone_number, 
            preferred_contact_method, 
            email_verified, 
            phone_verified, 
            account_status;
        `;

    const res = await query(queryText, [
      value,
      new Date().toISOString(),
      userId,
    ]);

    if (res.rows.length === 0) {
      throw new Error("User not found");
    }

    return res.rows[0];
  }
  /**
   * Update a user's account status
   * @param {string} userId - User's UUID
   * @param {string} status - New account status ('pending', 'active', 'suspended', 'deactivated')
   * @returns {Promise<Object>} Updated user object
   */
  static async updateAccountStatus(userId, status) {
    const validStatuses = ["pending", "active", "suspended", "deactivated"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid account status");
    }

    const queryText = `
          UPDATE users 
          SET account_status = $1, updated_at = $2
          WHERE user_id = $3
          RETURNING 
            user_id, 
            full_name, 
            email, 
            phone_number, 
            preferred_contact_method, 
            email_verified, 
            phone_verified, 
            account_status;
        `;

    const res = await query(queryText, [
      status,
      new Date().toISOString(),
      userId,
    ]);

    if (res.rows.length === 0) {
      throw new Error("User not found");
    }

    return res.rows[0];
  }
  /**
   * Update a user's login information after successful login
   * @param {string} userId - User's UUID
   * @param {string} ipAddress - User's IP address
   * @returns {Promise<void>}
   */
  static async updateLoginInfo(userId, ipAddress) {
    const queryText = `
      UPDATE users 
      SET 
        last_login_at = $1, 
        last_login_ip = $2, 
        failed_login_attempts = 0,
        updated_at = $1
      WHERE user_id = $3;
    `;

    const currentDate = new Date().toISOString();
    await query(queryText, [currentDate, ipAddress, userId]);
  }
  /**
   * Increment failed login attempts for a user
   * @param {string} userId - User's UUID
   * @returns {Promise<number>} New failed login attempts count
   */
  static async incrementFailedLoginAttempts(userId) {
    const queryText = `
      UPDATE users 
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        updated_at = $1
      WHERE user_id = $2
      RETURNING failed_login_attempts;
    `;

    const res = await query(queryText, [new Date().toISOString(), userId]);

    if (res.rows.length === 0) {
      throw new Error("User not found");
    }

    return res.rows[0].failed_login_attempts;
  }
  /**
   * Change a user's password
   * @param {string} userId - User's UUID
   * @param {string} newPassword - New password (will be hashed)
   * @returns {Promise<void>}
   */
  static async changePassword(userId, newPassword) {
    // Hash the new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const queryText = `
          UPDATE users 
          SET 
            password_hash = $1,
            updated_at = $2
          WHERE user_id = $3;
        `;

    const res = await query(queryText, [
      passwordHash,
      new Date().toISOString(),
      userId,
    ]);

    if (res.rowCount === 0) {
      throw new Error("User not found");
    }
  }
  /**
   * Update a user's profile information
   * @param {string} userId - User's UUID
   * @param {Object} profileData - Profile data to update
   * @param {string} [profileData.fullName] - User's full name
   * @param {string} [profileData.preferredContactMethod] - User's preferred contact method
   * @returns {Promise<Object>} Updated user object
   */
  static async updateProfile(userId, profileData) {
    // Build the query dynamically based on which fields are provided
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Add each field to be updated
    if (profileData.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(profileData.fullName);
    }

    if (profileData.preferredContactMethod !== undefined) {
      updates.push(`preferred_contact_method = $${paramIndex++}`);
      values.push(profileData.preferredContactMethod);
    }

    // Add the timestamp and user ID
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(userId);

    // If no updates were provided, throw an error
    if (updates.length === 1) {
      // Only the timestamp was added
      throw new Error("No fields to update");
    }

    const queryText = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE user_id = $${paramIndex}
      RETURNING 
        user_id, 
        full_name, 
        email, 
        phone_number, 
        preferred_contact_method, 
        email_verified, 
        phone_verified, 
        account_status;
    `;

    const res = await query(queryText, values);

    if (res.rows.length === 0) {
      throw new Error("User not found");
    }

    return res.rows[0];
  }
  /**
   * Validate a user's password
   * @param {string} providedPassword - Password to validate
   * @param {string} storedPasswordHash - Stored password hash from database
   * @returns {Promise<boolean>} Whether the password is valid
   */
  static async validatePassword(providedPassword, storedPasswordHash) {
    return bcrypt.compare(providedPassword, storedPasswordHash);
  }

  /**
   * Get a user's wallet balances
   * @param {string} userId - User's UUID
   * @returns {Promise<Object>} Wallet balances object
   */
  static async getWalletBalances(userId) {
    const queryText = `
      SELECT 
        account_balance, 
        trading_balance, 
        referral_balance
      FROM user_wallets
      WHERE user_id = $1;
    `;

    const res = await query(queryText, [userId]);

    if (res.rows.length === 0) {
      // If no wallet record exists, create one with zero balances
      await this.initializeWallet(userId);
      return {
        account_balance: "0.00",
        trading_balance: "0.00",
        referral_balance: "0.00",
      };
    }

    return res.rows[0];
  }
  /**
   * Initialize a wallet for a new user
   * @param {string} userId - User's UUID
   * @returns {Promise<void>}
   * @private
   */
  static async initializeWallet(userId) {
    const queryText = `
      INSERT INTO user_wallets (
        user_id, 
        account_balance, 
        trading_balance, 
        referral_balance, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO NOTHING;
    `;

    const currentDate = new Date().toISOString();
    await query(queryText, [
      userId,
      "0.00",
      "0.00",
      "0.00",
      currentDate,
      currentDate,
    ]);
  }
  /**
   * Get user statistics including KYC status and account activity
   * @param {string} userId - User's UUID
   * @returns {Promise<Object>} User statistics object
   */
  static async getUserStats(userId) {
    const queryText = `
          SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.phone_number,
            u.email_verified,
            u.phone_verified,
            u.account_status,
            u.created_at,
            u.last_login_at,
            COALESCE(w.account_balance, '0.00') as account_balance,
            COALESCE(w.trading_balance, '0.00') as trading_balance,
            COALESCE(w.referral_balance, '0.00') as referral_balance,
            COALESCE(k.verification_status, 'not_submitted') as kyc_status,
            COALESCE(k.verified_at, NULL) as kyc_verified_at,
            (SELECT COUNT(*) FROM transactions WHERE user_id = u.user_id) as transaction_count,
            (SELECT COUNT(*) FROM referrals WHERE referrer_id = u.user_id) as referral_count
          FROM 
            users u
          LEFT JOIN 
            user_wallets w ON u.user_id = w.user_id
          LEFT JOIN 
            kyc_documents k ON u.user_id = k.user_id
          WHERE 
            u.user_id = $1;
        `;
        const res = await query(queryText, [userId]);
        return res.rows[0] || null;
  }
}
