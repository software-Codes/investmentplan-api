const { query } = require('../../../database/connection');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const OtpEmailService = require('../Config/nodemailer-service');
const OtpSmsService = require('../Config/africas-talking-service');

class OTP {
  static async generate({ userId = null, email = null, phone = null, purpose, delivery, ttl = 10 }) {
    await this.#invalidate({ userId, email, phone, purpose });

    const code = crypto.randomInt(100000, 999999).toString();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + ttl * 60000);

    await query(
      `INSERT INTO otp_records (otp_id, user_id, email, phone_number, otp_code, otp_purpose, delivery_method, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [otpId, userId, email, phone, code, purpose, delivery, expiresAt]
    );

    await this.#send({ delivery, destination: email || phone, code, purpose });
    return { otpId, code };
  }

  static async verify({ userId = null, email = null, phone = null, code, purpose }) {
    const identityCol = userId ? 'user_id' : email ? 'email' : 'phone_number';
    const identityVal = userId || email || phone;

    if (!identityVal || !code || !purpose) return false;

    const res = await query(
      `UPDATE otp_records SET is_verified = true, attempt_count = attempt_count + 1
       WHERE ${identityCol} = $1 AND otp_code = $2 AND otp_purpose = $3 
       AND is_verified = false AND expires_at > NOW()
       RETURNING otp_id`,
      [identityVal, code, purpose]
    );

    return res.rowCount === 1;
  }

  static async #invalidate({ userId, email, phone, purpose }) {
    if (userId) {
      await query(
        `UPDATE otp_records SET is_verified = true, expires_at = NOW()
         WHERE user_id = $1 AND otp_purpose = $2 AND is_verified = false AND expires_at > NOW()`,
        [userId, purpose]
      );
    }
    if (email) {
      await query(
        `UPDATE otp_records SET is_verified = true, expires_at = NOW()
         WHERE email = $1 AND otp_purpose = $2 AND is_verified = false AND expires_at > NOW()`,
        [email, purpose]
      );
    }
    if (phone) {
      await query(
        `UPDATE otp_records SET is_verified = true, expires_at = NOW()
         WHERE phone_number = $1 AND otp_purpose = $2 AND is_verified = false AND expires_at > NOW()`,
        [phone, purpose]
      );
    }
  }

  static async #send({ delivery, destination, code, purpose }) {
    if (delivery === 'email') {
      await OtpEmailService.sendOtp(destination, code, purpose);
    } else if (delivery === 'sms') {
      await OtpSmsService.sendOtp(destination, code, purpose);
    } else {
      throw new Error(`Unsupported delivery method: ${delivery}`);
    }
  }
}

module.exports = OTP;
