// # Users table schema
/**
 * @file user.model.js
 * @description User model for the investment platform with comprehensive schema for authentication and account management
 */

const { pool, query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const AzureBlobStorageService = require("../services/azure-blob-storage-kyc/azure-blob-storage.service");
const SmileIDService = require("../services/smile-id-kyc/smile-id.service");
const { logger } = require("../utils/logger");
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

    // Hash the user password
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
      userData.preferredContactMethod || "email", // Ensure "phone_number" is accepted
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
        // Unique violation
        if (error.detail.includes("email")) {
          throw new Error("Email address already registered");
        } else if (error.detail.includes("phone_number")) {
          throw new Error("Phone number already registered");
        }
      }
      throw new Error(`Failed to create the user: ${error.message}`);
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
  /**
   * Submits KYC documents for verification and storage
   *
   * @param {string} userId - The unique ID of the user
   * @param {Object} documentData - Document metadata
   * @param {string} documentData.documentType - Document type (national_id, passport, drivers_license)
   * @param {string} documentData.documentNumber - Document number/ID
   * @param {string} documentData.documentCountry - ISO country code
   * @param {Buffer} fileBuffer - The document file as a buffer
   * @param {string} fileName - Original file name
   * @param {string} contentType - File MIME type
   * @returns {Promise<Object>} Submitted document data
   */
  static async submitKycDocument(
    userId,
    documentData,
    fileBuffer,
    fileName,
    contentType
  ) {
    logger.info(`Processing KYC document submission for user: ${userId}`);

    try {
      // Validate input parameters
      if (!userId || !documentData || !fileBuffer) {
        throw new Error("Missing required parameters for document submission");
      }

      // Validate document type against enum values
      const validDocTypes = ["national_id", "drivers_license", "passport"];
      if (!validDocTypes.includes(documentData.documentType)) {
        throw new Error(
          `Invalid document type. Must be one of: ${validDocTypes.join(", ")}`
        );
      }

      // Initialize services with environment variables
      const smileIDService = new SmileIDService({
        apiKey: process.env.SMILE_ID_API_KEY,
        partnerId: process.env.SMILE_ID_PARTNER_ID,
        callbackUrl: process.env.SMILE_ID_CALLBACK_URL,
        environment: process.env.SMILE_ID_ENVIRONMENT || "test",
      });

      const blobStorage = new AzureBlobStorageService({
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
        accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
        containerName: process.env.AZURE_KYC_CONTAINER_NAME || "kyc-documents",
      });

      // 1. Upload document to Azure Blob Storage
      const uploadResult = await blobStorage.uploadDocument({
        userId,
        documentType: documentData.documentType,
        fileBuffer,
        fileName,
        contentType,
      });

      logger.info(
        `Document uploaded to blob storage: ${uploadResult.blobStoragePath}`
      );

      // 2. Submit document to Smile ID for verification
      const smileDocumentType = this._mapToSmileIDDocumentType(
        documentData.documentType
      );
      // Verify that documentData.documentNumber is properly set
      if (
        !documentData.documentNumber ||
        documentData.documentNumber.trim() === ""
      ) {
        throw new Error("Document number is required for verification");
      }

      // When calling smileIDService.verifyDocument, ensure documentNumber is passed
      const verificationData = {
        userId,
        countryCode: documentData.documentCountry,
        documentType: smileDocumentType,
        documentNumber: documentData.documentNumber, // Make sure this is being set correctly
        documentImage: fileBuffer,
      };
      logger.info(
        `Verification data: ${JSON.stringify({
          userId: verificationData.userId,
          countryCode: verificationData.countryCode,
          documentType: verificationData.documentType,
          documentNumber: verificationData.documentNumber, // Log to verify it's present
        })}`
      );

      const verificationResponse = await smileIDService.verifyDocument(
        verificationData
      );

      if (!verificationResponse || !verificationResponse.job_id) {
        throw new Error("Invalid verification response from Smile ID");
      }

      logger.info(
        `Document verification initiated with Smile ID, job ID: ${verificationResponse.job_id}`
      );

      // 3. Store document details in database
      const documentId = uuidv4();
      const currentDate = new Date().toISOString();

      // Check if user already has a document of this type
      const existingDoc = await query(
        `SELECT document_id FROM kyc_documents 
         WHERE user_id = $1 AND document_type = $2 
         LIMIT 1`,
        [userId, documentData.documentType]
      );

      let result;

      if (existingDoc.rows.length > 0) {
        // Update existing document
        const updateQuery = `
          UPDATE kyc_documents SET
            document_number = $1,
            document_country = $2,
            blob_storage_path = $3,
            blob_storage_url = $4,
            verification_status = $5,
            verification_reference = $6,
            verification_method = $7,
            uploaded_at = $8,
            updated_at = $9
          WHERE user_id = $10 AND document_type = $11
          RETURNING *;
        `;

        const updateValues = [
          documentData.documentNumber,
          documentData.documentCountry,
          uploadResult.blobStoragePath,
          uploadResult.blobStorageUrl,
          "pending",
          verificationResponse.job_id,
          "smile_id",
          currentDate,
          currentDate,
          userId,
          documentData.documentType,
        ];

        result = await query(updateQuery, updateValues);
        logger.info(`Updated existing KYC document record for user ${userId}`);
      } else {
        // Insert new document
        const insertQuery = `
          INSERT INTO kyc_documents (
            document_id,
            user_id,
            document_type,
            document_number,
            document_country,
            blob_storage_path,
            blob_storage_url,
            verification_status,
            verification_reference,
            verification_method,
            uploaded_at,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *;
        `;

        const insertValues = [
          documentId,
          userId,
          documentData.documentType,
          documentData.documentNumber,
          documentData.documentCountry,
          uploadResult.blobStoragePath,
          uploadResult.blobStorageUrl,
          "pending",
          verificationResponse.job_id,
          "smile_id",
          currentDate,
          currentDate,
          currentDate,
        ];

        result = await query(insertQuery, insertValues);
        logger.info(`Created new KYC document record for user ${userId}`);
      }

      // Return the document data
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to submit KYC document: ${error.message}`, {
        error,
      });
      throw new Error(`Document submission failed: ${error.message}`);
    }
  }

  /**
   * Checks the verification status of a KYC document
   *
   * @param {string} userId - User ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} - Document with updated verification status
   */
  static async checkDocumentVerificationStatus(userId, documentId) {
    try {
      // Get document details from database
      const docResult = await query(
        `SELECT * FROM kyc_documents WHERE document_id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (docResult.rows.length === 0) {
        throw new Error("Document not found");
      }

      const document = docResult.rows[0];

      // Skip verification check if already verified or rejected
      if (["verified", "rejected"].includes(document.verification_status)) {
        return document;
      }

      // Initialize Smile ID service
      const smileIDService = new SmileIDService({
        apiKey: process.env.SMILE_ID_API_KEY,
        partnerId: process.env.SMILE_ID_PARTNER_ID,
        environment: process.env.SMILE_ID_ENVIRONMENT || "test",
      });

      // Check verification status
      const verificationResult = await smileIDService.getVerificationStatus(
        userId,
        document.verification_reference
      );

      // Map Smile ID status to our status
      let newStatus = "pending";
      let verificationNotes = null;

      if (verificationResult.ResultCode === "1012") {
        newStatus = "verified";
      } else if (
        ["1013", "1014", "1015"].includes(verificationResult.ResultCode)
      ) {
        newStatus = "rejected";
        verificationNotes =
          verificationResult.ResultText || "Verification failed";
      }

      // Update document status in database
      const updateQuery = `
        UPDATE kyc_documents SET
          verification_status = $1,
          verification_notes = $2,
          verified_at = $3,
          updated_at = $4
        WHERE document_id = $5
        RETURNING *;
      `;

      const currentDate = new Date().toISOString();
      const verifiedAt = newStatus === "verified" ? currentDate : null;

      const updateResult = await query(updateQuery, [
        newStatus,
        verificationNotes,
        verifiedAt,
        currentDate,
        documentId,
      ]);

      logger.info(
        `Updated document verification status to ${newStatus} for document ${documentId}`
      );

      return updateResult.rows[0];
    } catch (error) {
      logger.error(
        `Failed to check document verification status: ${error.message}`,
        { error }
      );
      throw new Error(`Verification status check failed: ${error.message}`);
    }
  }

  /**
   * Get all KYC documents for a user
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - User's documents
   */
  static async getUserDocuments(userId) {
    try {
      const result = await query(
        `SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Failed to get user documents: ${error.message}`, { error });
      throw new Error(`Could not retrieve user documents: ${error.message}`);
    }
  }

  /**
   * Maps our document types to Smile ID document types
   *
   * @param {string} internalType - Our internal document type
   * @returns {string} - Smile ID document type
   * @private
   */
  static _mapToSmileIDDocumentType(internalType) {
    const mapping = {
      national_id: "ID_CARD",
      drivers_license: "DRIVERS_LICENSE",
      passport: "PASSPORT",
    };

    return mapping[internalType] || "ID_CARD";
  }
  /**
   * Initiates the account recovery process for a user
   * @param {Object} recoveryData - Data for account recovery
   * @param {string} [recoveryData.email] - User's email address
   * @param {string} [recoveryData.phoneNumber] - User's phone number
   * @param {string} recoveryData.method - Recovery method ('email' or 'sms')
   * @returns {Promise<Object>} Recovery process result
   * @throws {Error} If recovery initiation fails
   */
  static async initiateRecovery(recoveryData) {
    // Verify that either email or phone number is provided
    if (!recoveryData.email && !recoveryData.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }
    // If user not found, throw an error
    if (!user) {
      throw new Error("No account found with the provided information");
    }
    // Check if the account is active
    if (user.account_status !== "active") {
      throw new Error(
        `Account is ${user.account_status}. Please contact support.`
      );
    }
    // Generate an OTP for account recovery
    const OTP = require("./otp.model");
    const otpData = {
      userId: user.user_id,
      email: recoveryData.method === "email" ? user.email : undefined,
      phoneNumber:
        recoveryData.method === "sms" ? user.phone_number : undefined,
      purpose: "account_recovery",
      deliveryMethod: recoveryData.method,
    };
    // Generate and send the OTP
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
  /**
   * Completes the account recovery process by setting a new password
   * @param {Object} recoveryData - Data for completing account recovery
   * @param {string} recoveryData.userId - User's unique ID
   * @param {string} recoveryData.otpCode - OTP code received by the user
   * @param {string} recoveryData.newPassword - New password to set
   * @returns {Promise<Object>} Recovery completion result
   * @throws {Error} If recovery completion fails
   */
  static async completeRecovery(recoveryData) {
    // Verify that all required fields are provided
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

    // Change the user's password
    await this.changePassword(recoveryData.userId, recoveryData.newPassword);

    // Update the last login information
    await this.updateLoginInfo(
      recoveryData.userId,
      recoveryData.ipAddress || null
    );

    return {
      success: true,
      message: "Password has been successfully reset",
    };
  }
  /**
   * Updates user contact preferences
   * @param {string} userId - User's unique ID
   * @param {Object} preferences - User preferences
   * @param {string} preferences.preferredContactMethod - Preferred contact method ('email' or 'sms')
   * @returns {Promise<Object>} Updated user object
   */
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
  /**
   * Creates a new session for a user
   * @param {string} userId - User's unique ID
   * @param {Object} sessionData - Session data
   * @param {string} sessionData.ipAddress - User's IP address
   * @param {string} sessionData.userAgent - User's browser/device information
   * @param {number} [sessionData.expiresInDays=7] - Session expiration in days
   * @returns {Promise<Object>} Created session object
   */
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
  /**
   * Validates a user session
   * @param {string} sessionId - Session ID to validate
   * @returns {Promise<Object|null>} Session data if valid, null if invalid or expired
   */
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
  /**
   * Invalidates a user session (logout)
   * @param {string} sessionId - Session ID to invalidate
   * @returns {Promise<boolean>} True if session was invalidated, false otherwise
   */
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
  /**
   * Invalidates a user session (logout)
   * @param {string} sessionId - Session ID to invalidate
   * @returns {Promise<boolean>} True if session was invalidated, false otherwise
   */
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

  /**
   * Invalidates all sessions for a user except the current one
   * @param {string} userId - User's unique ID
   * @param {string} [currentSessionId] - Current session ID to preserve (optional)
   * @returns {Promise<number>} Number of sessions invalidated
   */
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

    // If currentSessionId is provided, don't invalidate it
    if (currentSessionId) {
      queryText += ` AND session_id != $3`;
      values.push(currentSessionId);
    }

    const res = await query(queryText, values);
    return res.rowCount;
  }
  /**
   * Helper method to mask email address for privacy
   * @param {string} email - Email address to mask
   * @returns {string} Masked email address
   * @private
   */
  static _maskEmail(email) {
    if (!email) return "";
    const [username, domain] = email.split("@");
    const maskedUsername =
      username.charAt(0) +
      "*".repeat(Math.max(1, username.length - 2)) +
      username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Helper method to mask phone number for privacy
   * @param {string} phoneNumber - Phone number to mask
   * @returns {string} Masked phone number
   * @private
   */
  static _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return "";
    return (
      phoneNumber.slice(0, 4) +
      "*".repeat(phoneNumber.length - 7) +
      phoneNumber.slice(-3)
    );
  }

  /**
   * Gets the account completion status including verification and KYC document status
   * @param {string} userId - User's unique ID
   * @returns {Promise<Object>} Account completion details
   */

  static async getAccountCompletionStatus(userId) {
    try {
      //first get the users basic information
      const userQuery = `
      SELECT 
         email_verified,
         phone_verified,
         account_status
      FROM users
      WHERE user_id = $1
         
      `;
      const userResult = await query(userQuery, [userId]);
      if (userResult.rows.length === 0) {
        throw new Error("User not found");
      }
      const user = userResult.rows[0];

      // Query KYC documents with detailed status
      const kycQuery = `
      SELECT 
          document_type, 
          verification_status,
          CASE 
              WHEN verification_status = 'verified' THEN true
              ELSE false
          END as is_verified
      FROM kyc_documents
      WHERE user_id = $1;
  `;
      const kycResult = await query(kycQuery, [userId]);
      // Check required document types
      const requiredDocTypes = ["national_id", "passport", "drivers_license"];
      const submittedDocTypes = kycResult.rows.map((doc) => doc.document_type);
      // Check which required docs are missing
      const missingDocTypes = requiredDocTypes.filter(
        (docType) => !submittedDocTypes.includes(docType)
      );
      // Check if at least one document is verified
      const hasVerifiedDoc = kycResult.rows.some((doc) => doc.is_verified);
      // Calculate overall status
      const isContactVerified = user.email_verified || user.phone_verified;
      const hasSubmittedDocs = kycResult.rows.length > 0;
      // Calculate completion percentage (25% for contact verification, 75% for documents)
      let completionPercentage = 0;
      if (isContactVerified) completionPercentage += 25;
      if (hasSubmittedDocs) {
        // Add up to 75% based on document count and verification
        const maxDocsNeeded = 1; // Only requiring one valid document
        const docsSubmittedPercentage =
          (Math.min(kycResult.rows.length, maxDocsNeeded) / maxDocsNeeded) * 50;
        completionPercentage += docsSubmittedPercentage;

        if (hasVerifiedDoc) completionPercentage += 25;
      }
      return {
        isVerified: isContactVerified,
        accountStatus: user.account_status,
        kycStatus: {
          hasSubmittedDocuments: hasSubmittedDocs,
          hasVerifiedDocuments: hasVerifiedDoc,
          submittedDocuments: kycResult.rows.map((doc) => ({
            type: doc.document_type,
            status: doc.verification_status,
          })),
          missingDocumentTypes: missingDocTypes,
          requiresAtLeastOneDocument:
            missingDocTypes.length === requiredDocTypes.length,
        },
        completionPercentage: Math.round(completionPercentage),
        isComplete:
          isContactVerified &&
          hasVerifiedDoc &&
          user.account_status === "active",
      };
    } catch (error) {
      throw new Error(
        `Failed to get account completion status: ${error.message}`
      );
    }
  }
  /**
   * Initiates the password reset process by generating a new OTP.
   * @param {string} userId - The user's unique ID.
   * @param {string} purpose - The purpose of the OTP (e.g., 'reset_password').
   * @returns {Promise<Object>} The generated OTP record.
   */
  static async initiatePasswordReset(userId, purpose = "reset_password") {
    // Find user
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate new OTP
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

  /**
   * Completes the password reset process by verifying the OTP and updating the password.
   * @param {string} userId - The user's unique ID.
   * @param {string} otpCode - The OTP code received by the user.
   * @param {string} newPassword - The new password to set.
   * @returns {Promise<Object>} Result indicating success or failure.
   */
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
  /**
   * Deletes a user account and all associated data.
   *
   * This function performs the following steps:
   * 1. Verifies the user's password to ensure the request is authorized.
   * 2. Invalidates all active sessions for the user by marking them as inactive.
   * 3. Resets the user's wallet balances (account, trading, and referral) to zero.
   * 4. Deletes the user's KYC (Know Your Customer) documents from the database.
   * 5. Deletes the user's account record from the database.
   *
   * The operation is performed within a database transaction to ensure atomicity.
   * If any step fails, the transaction is rolled back to maintain data integrity.
   *
   * @param {string} userId - The unique ID of the user whose account is to be deleted.
   * @param {string} password - The user's password for verification.
   * @returns {Promise<boolean>} Returns `true` if the account was successfully deleted, otherwise `false`.
   * @throws {Error} Throws an error if the user is not found, the password is invalid, or the deletion process fails.
   */
  static async deleteAccount(userId, password) {
    // First, get the user to verify password
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

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Invalidate all sessions
      await client.query(
        `
            UPDATE user_sessions 
            SET is_active = false, updated_at = $1
            WHERE user_id = $2
        `,
        [new Date().toISOString(), userId]
      );

      // Reset wallet balances to zero
      await client.query(
        `
            UPDATE users
            SET 
                account_balance = 0.00,
                trading_balance = 0.00,
                referral_balance = 0.00,
                updated_at = $1
            WHERE user_id = $2
        `,
        [new Date().toISOString(), userId]
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
  /**
   * Retrieves the wallet balances for a user.
   *
   * This function fetches the account, trading, and referral balances for a user from the database.
   * If the user is not found, it returns default balances of zero for all wallet categories.
   *
   * @param {string} userId - The unique ID of the user whose wallet balances are to be retrieved.
   * @returns {Promise<Object>} An object containing the wallet balances:
   * - `account_balance`: The user's account balance as a string.
   * - `trading_balance`: The user's trading balance as a string.
   * - `referral_balance`: The user's referral balance as a string.
   * @throws {Error} Throws an error if the database query fails.
   */
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
      // Execute the query to fetch wallet balances
      const res = await query(queryText, [userId]);

      if (res.rows.length === 0) {
        // If no user is found, return default zero balances
        return {
          account_balance: "0.00",
          trading_balance: "0.00",
          referral_balance: "0.00",
        };
      }

      // Return the wallet balances from the database
      return res.rows[0];
    } catch (error) {
      // Log and rethrow the error for further handling
      throw new Error(`Failed to retrieve wallet balances: ${error.message}`);
    }
  }
  //resetting password
  static async initiatePasswordReset(userId, purpose = "reset_password") {
    //find the user
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    //generate the new otp
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
