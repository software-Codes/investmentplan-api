

const { query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const OtpEmailService = require("../Config/nodemailer-service");
const OtpSmsService = require("../Config/africas-talking-service");


class OTP {

  // Private method to invalidate previous OTPs for a user/email/phone and purpose
  static async #invalidate({ userId, email, phone, purpose }) {
    if (userId) {
      await this.invalidatePreviousOTPs(userId, purpose);
    }
    if (email) {
      await this.invalidatePreviousOTPsByEmail(email, purpose);
    }
    if (phone) {
      await this.invalidatePreviousOTPsByPhone(phone, purpose);
    }
  }

  // Private method to send OTP using the specified delivery method
  static async #send({ delivery, destination, code, purpose }) {
    if (delivery === "email") {
      await OtpEmailService.sendOtp(destination, code, purpose);
    } else if (delivery === "sms") {
      await OtpSmsService.sendOtp(destination, code, purpose);
    } else {
      throw new Error(`Unsupported delivery method: ${delivery}`);
    }
  }

   /**
   * Generates and stores an OTP, then sends it by the chosen channel.
   * @param {Object} opts
   * @param {string} [opts.userId]   – FK into users table (optional for admins)
   * @param {string} [opts.email]    – destination email
   * @param {string} [opts.phone]    – destination phone
   * @param {string} opts.purpose    – e.g. 'reset_password'
   * @param {string} opts.delivery   – 'email' | 'sms'
   * @param {number} [opts.ttl=10]   – validity in minutes
   */
  static async generate({ userId = null, email = null, phone = null, purpose, delivery, ttl = 10 }) {
    // clear older unverified OTPs for this identity+purpose
    await this.#invalidate({ userId, email, phone, purpose });

    const code       = crypto.randomInt(100000, 999999).toString();
    const otpId      = uuidv4();
    const expiresAt  = new Date(Date.now() + ttl * 60_000);
    const createdAt  = new Date().toISOString();

    const sql = `
      INSERT INTO otp_records (
        otp_id, user_id, email, phone_number, otp_code,
        otp_purpose, delivery_method, expires_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `;
    const params = [
      otpId, userId, email, phone, code,
      purpose, delivery, expiresAt, createdAt
    ];

    const { rows } = await query(sql, params);

    await this.#send({ delivery, destination: email ?? phone, code, purpose });

    return rows[0];            // useful for tests/logging
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

 static async verify({ userId = null, email = null, phone = null, code, purpose }) {
    const identityCol = userId ? 'user_id'
                     : email  ? 'email'
                     :          'phone_number';
    const identityVal = userId ?? email ?? phone;

    if (!identityVal || !code || !purpose) return false;

    const sql = `
      UPDATE otp_records
      SET is_verified = true, attempt_count = attempt_count + 1
      WHERE ${identityCol} = $1
        AND otp_code       = $2
        AND otp_purpose    = $3
        AND is_verified    = false
        AND expires_at     > NOW()
      RETURNING otp_id
    `;
    const { rows } = await query(sql, [identityVal, code, purpose]);

    return rows.length === 1;
  }



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

    /**
   * Generates and stores an OTP, then sends it by the chosen channel.
   * @param {Object} opts
   * @param {string} [opts.userId]   – FK into users table (optional for admins)
   * @param {string} [opts.email]    – destination email
   * @param {string} [opts.phone]    – destination phone
   * @param {string} opts.purpose    – e.g. 'reset_password'
   * @param {string} opts.delivery   – 'email' | 'sms'
   * @param {number} [opts.ttl=10]   – validity in minutes
   */
  static async generate({ userId = null, email = null, phone = null, purpose, delivery, ttl = 10 }) {
    // clear older unverified OTPs for this identity+purpose
    await this.#invalidate({ userId, email, phone, purpose });

    const code       = crypto.randomInt(100000, 999999).toString();
    const otpId      = uuidv4();
    const expiresAt  = new Date(Date.now() + ttl * 60_000);
    const createdAt  = new Date().toISOString();

    const sql = `
      INSERT INTO otp_records (
        otp_id, user_id, email, phone_number, otp_code,
        otp_purpose, delivery_method, expires_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `;
    const params = [
      otpId, userId, email, phone, code,
      purpose, delivery, expiresAt, createdAt
    ];

    const { rows } = await query(sql, params);

    await this.#send({ delivery, destination: email ?? phone, code, purpose });

    return rows[0];            // useful for tests/logging
  }
}



module.exports = OTP;
