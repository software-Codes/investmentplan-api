
const { pool, query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

const { logger } = require("../utils/logger");
const Wallet = require("../../../Investment/src/models/wallets/wallets.models");

class User {


  static async create(userData) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userId = uuidv4();
      const currentDate = new Date().toISOString();
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);
      const userQueryText = `
            INSERT INTO users (
              user_id, 
              full_name, 
              email, 
              phone_number, 
              password_hash, 
              preferred_contact_method, 
              created_at, 
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            RETURNING *
          `;
      const userValues = [
        userId,
        userData.fullName,
        userData.email.toLowerCase(),
        userData.phoneNumber,
        passwordHash,
        userData.preferredContactMethod || "email",
        currentDate,
      ];
      const userResult = await client.query(userQueryText, userValues);
      const walletTypes = ["account", "trading", "referral"];
      for (const type of walletTypes) {
        await client.query(
          `INSERT INTO wallets (
        wallet_id,
        user_id,
        wallet_type,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $4)`,
          [uuidv4(), userId, type, currentDate]
        );
      }

      await client.query("COMMIT");
      logger.info(`Created user and wallets for ID: ${userId}`);
      const { password_hash, ...userWithoutPassword } = userResult.rows[0];
      return userWithoutPassword;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Failed to create user: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }


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
 
  static async changePassword(userId, newPassword) {
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
 
  static async updateProfile(userId, profileData) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (profileData.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(profileData.fullName);
    }

    if (profileData.preferredContactMethod !== undefined) {
      updates.push(`preferred_contact_method = $${paramIndex++}`);
      values.push(profileData.preferredContactMethod);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(userId);

    if (updates.length === 1) {
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
 
  static async validatePassword(providedPassword, storedPasswordHash) {
    return bcrypt.compare(providedPassword, storedPasswordHash);
  }


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
      await this.initializeWallet(userId);
      return {
        account_balance: "0.00",
        trading_balance: "0.00",
        referral_balance: "0.00",
      };
    }

    return res.rows[0];
  }

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

  static async initiateRecovery(recoveryData) {
    if (!recoveryData.email && !recoveryData.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }
    if (!user) {
      throw new Error("No account found with the provided information");
    }
    if (user.account_status !== "active") {
      throw new Error(
        `Account is ${user.account_status}. Please contact support.`
      );
    }
    const OTP = require("./otp.model");
    const otpData = {
      userId: user.user_id,
      email: recoveryData.method === "email" ? user.email : undefined,
      phoneNumber:
        recoveryData.method === "sms" ? user.phone_number : undefined,
      purpose: "account_recovery",
      deliveryMethod: recoveryData.method,
    };
    await OTP.generate(otpData);

    return {
      userId: user.user_id,
      method: recoveryData.method,
      destination:
        recoveryData.method === "email"
          ? this._maskEmail(user.email)
          : this._maskPhoneNumber(user.phone_number),
      message: `Recovery code sent via ${recoveryData.method}`,
    };
  }
 
  static async completeRecovery(recoveryData) {
    if (
      !recoveryData.userId ||
      !recoveryData.otpCode ||
      !recoveryData.newPassword
    ) {
      throw new Error("User ID, OTP code, and new password are required");
    }

    // Verify the OTP
    const OTP = require("./otp.model");
    const isValid = await OTP.verify({
      userId: recoveryData.userId,
      otpCode: recoveryData.otpCode,
      purpose: "account_recovery",
    });

    if (!isValid) {
      throw new Error("Invalid or expired recovery code");
    }

    await this.changePassword(recoveryData.userId, recoveryData.newPassword);

    await this.updateLoginInfo(
      recoveryData.userId,
      recoveryData.ipAddress || null
    );

    return {
      success: true,
      message: "Password has been successfully reset",
    };
  }

  static async updateContactPreferences(userId, preferences) {
    if (!preferences.preferredContactMethod) {
      throw new Error("Preferred contact method is required");
    }

    if (!["email", "sms"].includes(preferences.preferredContactMethod)) {
      throw new Error(
        'Preferred contact method must be either "email" or "sms"'
      );
    }

    const queryText = `
    UPDATE users 
    SET 
      preferred_contact_method = $1,
      updated_at = $2
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
      preferences.preferredContactMethod,
      new Date().toISOString(),
      userId,
    ]);

    if (res.rows.length === 0) {
      throw new Error("User not found");
    }

    return res.rows[0];
  }

  static async createSession(userId, sessionData) {
    const sessionId = uuidv4();
    const currentDate = new Date().toISOString();
    const expiryDate = new Date(
      Date.now() + (sessionData.expiresInDays || 7) * 24 * 60 * 60 * 1000
    ).toISOString();

    const queryText = `
    INSERT INTO user_sessions (
      session_id, 
      user_id, 
      ip_address, 
      user_agent, 
      expires_at, 
      created_at, 
      last_active_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING 
      session_id, 
      user_id, 
      expires_at;
  `;

    const values = [
      sessionId,
      userId,
      sessionData.ipAddress,
      sessionData.userAgent,
      expiryDate,
      currentDate,
      currentDate,
    ];

    try {
      const res = await query(queryText, values);
      return res.rows[0];
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  static async validateSession(sessionId) {
    const queryText = `
      SELECT 
        s.session_id, 
        s.user_id, 
        s.expires_at,
        s.is_active
      FROM user_sessions s
      WHERE s.session_id = $1;
    `;

    const res = await query(queryText, [sessionId]);
    return res.rows[0] || null;
  }

  static async invalidateSession(sessionId) {
    const queryText = `
    UPDATE user_sessions 
    SET 
      is_active = false,
      updated_at = $1
    WHERE session_id = $2
    RETURNING session_id;
  `;

    const res = await query(queryText, [new Date().toISOString(), sessionId]);
    return res.rows.length > 0;
  }

  static async invalidateSession(sessionId) {
    const queryText = `
    UPDATE user_sessions 
    SET 
      is_active = false,
      updated_at = $1
    WHERE session_id = $2
    RETURNING session_id;
  `;

    const res = await query(queryText, [new Date().toISOString(), sessionId]);
    return res.rows.length > 0;
  }


  static async invalidateAllOtherSessions(userId, currentSessionId) {
    let queryText = `
    UPDATE user_sessions 
    SET 
      is_active = false,
      updated_at = $1
    WHERE 
      user_id = $2
  `;
    const values = [new Date().toISOString(), userId];

    if (currentSessionId) {
      queryText += ` AND session_id != $3`;
      values.push(currentSessionId);
    }

    const res = await query(queryText, values);
    return res.rowCount;
  }

  static _maskEmail(email) {
    if (!email) return "";
    const [username, domain] = email.split("@");
    const maskedUsername =
      username.charAt(0) +
      "*".repeat(Math.max(1, username.length - 2)) +
      username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
  }

  static _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return "";
    return (
      phoneNumber.slice(0, 4) +
      "*".repeat(phoneNumber.length - 7) +
      phoneNumber.slice(-3)
    );
  }

  static async getAccountCompletionStatus(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) throw new Error("User not found");

      const KYCDocument = require("./kyc-document.model");
      const kycDocs = await KYCDocument.findByUserId(userId);

      // Get distinct document types
      const submittedTypes = [
        ...new Set(kycDocs.map((doc) => doc.document_type)),
      ];

      // Required document types
      const requiredDocs = ["national_id", "passport", "drivers_license"];

      // Check completion
      const hasAllDocuments = requiredDocs.every((type) =>
        submittedTypes.includes(type)
      );

      return {
        basicVerified: user.email_verified || user.phone_verified,
        documentsSubmitted: kycDocs.length > 0,
        accountComplete: hasAllDocuments,
        requiredDocuments: requiredDocs,
        submittedDocuments: submittedTypes,
        completionPercentage: hasAllDocuments
          ? 100
          : Math.floor((submittedTypes.length / requiredDocs.length) * 100),
      };
    } catch (error) {
      logger.error(`Account completion check failed: ${error.message}`);
      throw new Error("Failed to check account status");
    }
  }

  static async initiatePasswordReset(userId, purpose = "reset_password") {
    const user = await this.findbyEmail(email);
    if (!user) {
      throw new Error("User not found");
    }

    const otpData = {
      userId,
      purpose,
      deliveryMethod:
        user.preferred_contact_method === "email" ? "email" : "sms",
    };

    if (otpData.deliveryMethod === "email") {
      otpData.email = user.email;
    } else {
      otpData.phoneNumber = user.phone_number;
    }

    return await OTP.generate(otpData);
  }

  static async completePasswordReset(userId, otpCode, newPassword) {
    // Verify OTP
    const OTP = require("./otp.model");
    const isValid = await OTP.verify({
      userId: userId,
      otpCode: otpCode,
      purpose: "reset_password",
    });

    if (!isValid) {
      throw new Error("Invalid or expired OTP code");
    }

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

    return {
      success: true,
      message: "Password has been successfully reset",
    };
  }

  static async deleteAccount(userId, password) {
    const userQuery = `
      SELECT password_hash 
      FROM users 
      WHERE user_id = $1;
    `;

    const userResult = await query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const storedPasswordHash = userResult.rows[0].password_hash;

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, storedPasswordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Invalidate all sessions
      await client.query(
        `
        UPDATE user_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1
        `,
        [userId]
      );

      // Reset wallet balances to zero
      await client.query(
        `
        UPDATE wallets
        SET balance = 0.00, locked_balance = 0.00, updated_at = NOW()
        WHERE user_id = $1
        `,
        [userId]
      );

      // Delete KYC documents
      await client.query(
        `
        DELETE FROM kyc_documents 
        WHERE user_id = $1
        `,
        [userId]
      );

      // Delete user records
      const deleteResult = await client.query(
        `
        DELETE FROM users 
        WHERE user_id = $1
        RETURNING user_id
        `,
        [userId]
      );

      await client.query("COMMIT");

      return deleteResult.rows.length > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to delete account: ${error.message}`);
    } finally {
      client.release();
    }
  }

  static async getWalletBalances(userId) {
    const queryText = `
      SELECT 
          account_balance, 
          trading_balance, 
          referral_balance
      FROM users
      WHERE user_id = $1;
  `;

    try {
      const res = await query(queryText, [userId]);

      if (res.rows.length === 0) {
        return {
          account_balance: "0.00",
          trading_balance: "0.00",
          referral_balance: "0.00",
        };
      }

      return res.rows[0];
    } catch (error) {
      throw new Error(`Failed to retrieve wallet balances: ${error.message}`);
    }
  }
  //resetting password
  static async initiatePasswordReset(email, purpose = "reset_password") {
    const user = await this.findbyEmail(email);
    if (!user) {
      throw new Error("User not found");
    }
    const OTP = require("./otp.model");
    const otpData = {
      userId: user.user_id,
      purpose,
      deliveryMethod:
        user.preferred_contact_method === "email" ? "email" : "sms",
    };
    if (otpData.deliveryMethod === "email") {
      otpData.email = user.email;
    } else {
      otpData.phoneNumber = user.phone_number;
    }
    await OTP.generate(otpData);
    return {
      userId: user.user_id,
      method: otpData.deliveryMethod,
      destination:
        otpData.deliveryMethod === "email"
          ? this._maskEmail(user.email)
          : this._maskPhoneNumber(user.phone_number),
      message: `Recovery code sent via ${otpData.deliveryMethod}`,
    };
  }
}

module.exports = User;
