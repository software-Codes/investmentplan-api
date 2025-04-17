//# OTPs table schema
/**
 * @file otp.model.js
 * @description OTP model for handling one-time passwords for authentication and security operations
 */

const { query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
/**
 * OTP Model - Handles creation, verification, and management of one-time passwords
 */

class OTP {
  /**
   * Generate a new OTP for a user
   * @param {Object} otpData - OTP generation parameters
   * @param {string} [otpData.userId] - User's UUID (if user already exists)
   * @param {string} [otpData.email] - Email address (for non-registered users)
   * @param {string} [otpData.phoneNumber] - Phone number (for non-registered users)
   * @param {string} otpData.purpose - Purpose of OTP (registration, login, etc.)
   * @param {string} otpData.deliveryMethod - Method to deliver OTP (email, sms)
   * @param {number} [otpData.expiryMinutes=10] - OTP expiry time in minutes
   * @returns {Promise<Object>} Generated OTP object
   */

  static async generate(otpData) {
    //generate a 6 code digit otp
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpId = uuidv4();
    const currentDate = new Date();
    const expiryMinutes = otpData.expiryMinutes || 10;
    const expiryDate = new Date(currentDate.getTime() + expiryMinutes * 60000);
    // Build query parameter
    const queryText = `
             INSERT INTO otp_records (
        otp_id,
        user_id,
        email,
        phone_number,
        otp_code,
        otp_purpose,
        delivery_method,
        is_verified,
        attempt_count,
        created_at,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING otp_id, otp_code, delivery_method, created_at, expires_at;
         `;
    const values = [
      otpId,
      otpData.userId || null,
      otpData.email || null,
      otpData.phoneNumber || null,
      otpCode,
      otpData.purpose,
      otpData.deliveryMethod,
      false, // is_verified
      0, // attempt_count
      currentDate.toISOString(),
      expiryDate.toISOString()
    ];
    try {
      //insert otp record
      const res = await query(queryText, values);
      // Invalidate any previous unused OTPs for the same purpose and user/email/phone
      if (otpData.userId) {
        await this.inValidatePreviousOTPs(otpData.userId, otpData.purpose.otpId);
      } else if (otpData.email) {
        await this.inValidatePreviousOTPsByEmail(otpData.email, otp)
      }
      return res.rows[0];

    } catch (error) {
      throw new Error(`Failed to generate  otp${error.message}`)

    }
  }
  /**
 * Verifies a one-time password (OTP) for a user.
 * @param {Object} verifyData - Data required for OTP verification.
 * @param {string} verifyData.otpCode - The OTP code to verify.
 * @param {string} verifyData.purpose - The purpose of the OTP (e.g., login, registration).
 * @param {string} [verifyData.userId] - The user's unique ID (if available).
 * @param {string} [verifyData.email] - The user's email address (if available).
 * @param {string} [verifyData.phoneNumber] - The user's phone number (if available).
 * @returns {Promise<boolean>} Returns `true` if the OTP is successfully verified, otherwise `false`.
 * @throws {Error} Throws an error if required data is missing or if maximum attempts are reached.
 */
  static async verify(verifyData) {
    // Array to store query conditions dynamically
    const conditions = [];

    // Array to store query parameter values
    const values = [verifyData.otpCode, verifyData.purpose];

    // Start parameter index for dynamic query parameters
    let paramIndex = 3;

    // Add condition based on the identifier provided (userId, email, or phoneNumber)
    if (verifyData.userId) {
      conditions.push(`user_id = $${paramIndex++}`); // Add condition for user ID
      values.push(verifyData.userId); // Add user ID to query values
    } else if (verifyData.email) {
      conditions.push(`email = $${paramIndex++}`); // Add condition for email
      values.push(verifyData.email); // Add email to query values
    } else if (verifyData.phoneNumber) {
      conditions.push(`phone_number = $${paramIndex++}`); // Add condition for phone number
      values.push(verifyData.phoneNumber); // Add phone number to query values
    } else {
      // Throw an error if no identifier is provided
      throw new Error('Either userId, email, or phoneNumber must be provided');
    }

    // Add conditions to ensure OTP is not already verified and has not expired
    conditions.push(`is_verified = false`); // OTP must not be verified
    conditions.push(`expires_at > NOW()`); // OTP must not be expired

    // Combine all conditions into a single WHERE clause
    const whereClause = conditions.join(' AND ');

    // Query to check if a valid OTP exists
    const checkQuery = `
    SELECT otp_id, attempt_count 
    FROM otp_records 
    WHERE otp_code = $1 
      AND otp_purpose = $2 
      AND ${whereClause}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

    // Execute the query with the constructed conditions and values
    const checkRes = await query(checkQuery, values);

    // If no valid OTP is found, increment the attempt count and return false
    if (checkRes.rows.length === 0) {
      await this.incrementAttemptCount(verifyData); // Increment attempt count for matching OTP
      return false; // OTP verification failed
    }

    // Extract OTP ID and attempt count from the query result
    const { otp_id, attempt_count } = checkRes.rows[0];

    // Check if the maximum number of verification attempts has been reached
    if (attempt_count >= 5) {
      throw new Error('Maximum verification attempts reached'); // Throw an error if limit is exceeded
    }

    // Query to mark the OTP as verified and increment the attempt count
    const updateQuery = `
    UPDATE otp_records 
    SET is_verified = true, 
        attempt_count = attempt_count + 1
    WHERE otp_id = $1
    RETURNING otp_id;
  `;

    // Execute the update query to mark the OTP as verified
    await query(updateQuery, [otp_id]);

    // Return true to indicate successful verification
    return true;
  }
}
