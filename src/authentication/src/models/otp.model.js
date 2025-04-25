/**
 * @file otp.model.js
 * @description OTP model for handling one-time passwords for authentication and security operations
 */

const { query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const OtpEmailService = require("../Config/nodemailer-service");
const OtpSmsService = require("../Config/africas-talking-service");

/**
 * OTP Model - Handles creation, verification, and management of one-time passwords
 */
class OTP {
  /**
   * Generates a new OTP (One-Time Password) for a user.
   * Invalidates any previous unused OTPs for the same purpose and identifier (userId, email, or phoneNumber).
   * Stores the new OTP in the database and sends it to the user via the specified delivery method.
   *
   * @param {Object} otpData - Data required to generate the OTP.
   * @param {string} [otpData.userId] - The unique ID of the user (if registered).
   * @param {string} [otpData.email] - The email address of the user (if applicable).
   * @param {string} [otpData.phoneNumber] - The phone number of the user (if applicable).
   * @param {string} otpData.purpose - The purpose of the OTP (e.g., registration, login).
   * @param {string} otpData.deliveryMethod - The method to deliver the OTP (e.g., email, sms).
   * @param {number} [otpData.expiryMinutes=10] - The expiry time of the OTP in minutes (default is 10 minutes).
   * @returns {Promise<Object>} The generated OTP record from the database.
   * @throws {Error} Throws an error if OTP generation or database operation fails.
   */
  // models/OTP.js

  static async generate(otpData) {
    // Invalidate previous OTPs for the same purpose and identifier
    if (otpData.userId) {
      await this.invalidatePreviousOTPs(otpData.userId, otpData.purpose);
    } else if (otpData.email) {
      await this.invalidatePreviousOTPsByEmail(otpData.email, otpData.purpose);
    } else if (otpData.phoneNumber) {
      await this.invalidatePreviousOTPsByPhone(
        otpData.phoneNumber,
        otpData.purpose
      );
    }

    // Generate a new OTP code (6-digit random number)
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Generate a unique ID for the OTP record
    const otpId = uuidv4();

    // Set the expiry time for the OTP (default is 10 minutes)
    const expiryMinutes = otpData.expiryMinutes || 10;
    const expiryDate = new Date(Date.now() + expiryMinutes * 60000); // Current time + expiryMinutes

    // Set the current timestamp
    const currentDate = new Date().toISOString();

    // SQL query to insert the new OTP record into the database
    const queryText = `
    INSERT INTO otp_records (
      otp_id, user_id, email, phone_number, otp_code, otp_purpose, 
      delivery_method, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

    // Values to be inserted into the database
    const values = [
      otpId, // Unique OTP ID
      otpData.userId || null, // User ID (if applicable)
      otpData.email || null, // Email address (if applicable)
      otpData.phoneNumber || null, // Phone number (if applicable)
      otpCode, // Generated OTP code
      otpData.purpose, // Purpose of the OTP
      otpData.deliveryMethod, // Delivery method (email or sms)
      expiryDate, // Expiry date and time
      currentDate, // Current timestamp
    ];

    try {
      // Execute the query to insert the OTP record
      const res = await query(queryText, values);

      // Send the OTP to the user via the specified delivery method
      await this.sendOTP(
        otpData.deliveryMethod,
        otpData.email || otpData.phoneNumber,
        otpCode,
        otpData.purpose
      );

      // Return the generated OTP record
      return res.rows[0];
    } catch (error) {
      // Throw an error if OTP generation or database operation fails
      throw new Error(`Failed to generate OTP: ${error.message}`);
    }
  }
  /**
   * Sends the generated OTP to the user via the specified delivery method
   *
   * @param {string} method - The delivery method ('email' or 'sms')
   * @param {string} destination - The email address or phone number to send the OTP to
   * @param {string} code - The OTP code to send
   * @param {string} purpose - The purpose of the OTP (e.g., 'registration', 'login')
   * @returns {Promise<void>} Resolves when the OTP is successfully sent
   * @throws {Error} Throws an error if the OTP sending fails
   */
  // models/OTP.js
  static async sendOTP(method, destination, code, purpose) {
    try {
      if (method === "email") {
        await OtpEmailService.sendOtp(destination, code, purpose);
      } else if (method === "sms") {
        await OtpSmsService.sendOtp(destination, code, purpose);
      } else {
        throw new Error(`Unsupported delivery method: ${method}`);
      }
    } catch (error) {
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
  }
/**
 * Verifies a one-time password (OTP) for a user.
 * @param {Object} verifyData - Data required for OTP verification.
 * @param {string} verifyData.userId - The user's unique ID.
 * @param {string} verifyData.otpCode - The OTP code to verify.
 * @param {string} verifyData.purpose - The purpose of the OTP (e.g., login, registration).
 * @returns {Promise<boolean>} Returns `true` if the OTP is successfully verified, otherwise `false`.
 * @throws {Error} Throws an error if required data is missing or if maximum attempts are reached.
 */
static async verify({ userId, otpCode, purpose }) {
  // Basic validation
  if (!userId || !otpCode || !purpose) {
    throw new Error("Missing required fields for OTP verification");
  }

  // Query to check if the OTP exists and hasn't expired
  const queryText = `
    SELECT otp_id, attempt_count
    FROM otp_records
    WHERE user_id = $1
      AND otp_code = $2
      AND otp_purpose = $3
      AND is_verified = false
      AND expires_at > NOW()
  `;

  const values = [userId, otpCode, purpose];

  try {
    const result = await query(queryText, values);

    if (result.rows.length === 0) {
      // Increment attempt count even for invalid/expired OTPs
      await this.incrementAttemptCount(userId, otpCode, purpose);
      return false;
    }

    const { otp_id, attempt_count } = result.rows[0];

    // Check if maximum attempts have been reached
    if (attempt_count >= 5) {
      throw new Error("Maximum verification attempts reached");
    }

    // Mark the OTP as verified
    const updateQuery = `
      UPDATE otp_records
      SET is_verified = true, attempt_count = attempt_count + 1
      WHERE otp_id = $1
      RETURNING otp_id
    `;

    await query(updateQuery, [otp_id]);

    return true;
  } catch (error) {
    throw new Error(`OTP verification failed: ${error.message}`);
  }
}

/**
 * Increments the attempt count for an OTP.
 * @param {string} userId - The user's unique ID.
 * @param {string} otpCode - The OTP code.
 * @param {string} purpose - The purpose of the OTP.
 * @returns {Promise<void>} Resolves when the operation is complete.
 */
static async incrementAttemptCount(userId, otpCode, purpose) {
  const queryText = `
    UPDATE otp_records
    SET attempt_count = attempt_count + 1
    WHERE user_id = $1
      AND otp_code = $2
      AND otp_purpose = $3
      AND expires_at > NOW()
  `;

  const values = [userId, otpCode, purpose];

  try {
    await query(queryText, values);
  } catch (error) {
    throw new Error(`Failed to increment OTP attempt count: ${error.message}`);
  }
}

  /**
   * Increments the attempt count for a matching OTP.
   * This is called when an incorrect OTP is provided.
   *
   * @param {Object} verifyData - Data used to find the OTP.
   * @param {string} verifyData.otpCode - The OTP code.
   * @param {string} verifyData.purpose - The purpose of the OTP.
   * @param {string} [verifyData.userId] - The user's unique ID.
   * @param {string} [verifyData.email] - The user's email address.
   * @param {string} [verifyData.phoneNumber] - The user's phone number.
   * @returns {Promise<void>} Resolves when the operation is complete.
   */
  static async incrementAttemptCount(verifyData) {
    // Implement the logic to increment attempt count
    // This is a placeholder as the implementation was not provided in the original code
  }

  /**
   * Invalidates all previous unused OTPs for a specific user and purpose.
   * Marks the OTPs as verified and sets their expiration time to the current time.
   *
   * @param {string} userId - The unique ID of the user.
   * @param {string} purpose - The purpose of the OTP (e.g., login, registration).
   * @returns {Promise<void>} Resolves when the operation is complete.
   */
  static async invalidatePreviousOTPs(userId, purpose) {
    const queryText = `
    UPDATE otp_records
    SET is_verified = true, expires_at = NOW()
    WHERE user_id = $1
      AND otp_purpose = $2
      AND is_verified = false
      AND expires_at > NOW()
  `;
    await query(queryText, [userId, purpose]);
  }

  /**
   * Invalidates all previous unused OTPs for a specific email and purpose.
   * Marks the OTPs as verified and sets their expiration time to the current time.
   *
   * @param {string} email - The email address associated with the OTPs.
   * @param {string} purpose - The purpose of the OTP (e.g., login, registration).
   * @returns {Promise<void>} Resolves when the operation is complete.
   */
  static async invalidatePreviousOTPsByEmail(email, purpose) {
    const queryText = `
    UPDATE otp_records
    SET is_verified = true, expires_at = NOW()
    WHERE email = $1
      AND otp_purpose = $2
      AND is_verified = false
      AND expires_at > NOW()
  `;
    await query(queryText, [email, purpose]);
  }

  /**
   * Invalidates all previous unused OTPs for a specific phone number and purpose.
   * Marks the OTPs as verified and sets their expiration time to the current time.
   *
   * @param {string} phoneNumber - The phone number associated with the OTPs.
   * @param {string} purpose - The purpose of the OTP (e.g., login, registration).
   * @returns {Promise<void>} Resolves when the operation is complete.
   */
  static async invalidatePreviousOTPsByPhone(phoneNumber, purpose) {
    const queryText = `
    UPDATE otp_records
    SET is_verified = true, expires_at = NOW()
    WHERE phone_number = $1
      AND otp_purpose = $2
      AND is_verified = false
      AND expires_at > NOW()
  `;
    await query(queryText, [phoneNumber, purpose]);
  }
}

module.exports = OTP;
