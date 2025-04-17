//email otp sending
/**
 * @file otp-email-service.js
 * @description Service for sending OTP codes via email using nodemailer
 */

const nodemailer = require('nodemailer');

/**
 * Email service for sending OTPs
 */
class OtpEmailService {
    /**
     * Creates a new transporter instance with the given configuration
     * @returns {nodemailer.Transporter} Configured nodemailer transporter
     * @private
     */
    static _createTransporter() {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    /**
     * Sends an OTP code to the specified email address
     * @param {string} email - Recipient's email address
     * @param {string} otpCode - The OTP code to send
     * @param {string} purpose - The purpose of the OTP (e.g., 'registration', 'login')
     * @returns {Promise<Object>} The result of the email sending operation
     * @throws {Error} If the email sending fails
     */
    static async sendOtp(email, otpCode, purpose) {
        try {
            const transporter = this._createTransporter();

            // Create a purpose-specific subject and message
            const subject = this._getSubject(purpose);
            const htmlContent = this._getEmailTemplate(otpCode, purpose);

            // Send the email
            const result = await transporter.sendMail({
                from: `"Security Team" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: subject,
                html: htmlContent,
                text: `Your OTP code is: ${otpCode}. This code will expire in 10 minutes.`
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to send OTP email: ${error.message}`);
        }
    }

    /**
     * Gets the appropriate email subject based on the OTP purpose
     * @param {string} purpose - The purpose of the OTP
     * @returns {string} The email subject
     * @private
     */
    static _getSubject(purpose) {
        switch (purpose.toLowerCase()) {
            case 'registration':
                return 'Complete Your Registration';
            case 'login':
                return 'Login Verification Code';
            case 'reset_password':
                return 'Password Reset Code';
            default:
                return 'Your Verification Code';
        }
    }

    /**
     * Generates an HTML email template with the OTP code
     * @param {string} otpCode - The OTP code to include in the email
     * @param {string} purpose - The purpose of the OTP
     * @returns {string} HTML content for the email
     * @private
     */
    static _getEmailTemplate(otpCode, purpose) {
        let actionText;

        switch (purpose.toLowerCase()) {
            case 'registration':
                actionText = 'complete your registration';
                break;
            case 'login':
                actionText = 'log into your account';
                break;
            case 'reset_password':
                actionText = 'reset your password';
                break;
            default:
                actionText = 'verify your identity';
        }

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .header {
            text-align: center;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            letter-spacing: 5px;
            color: #2c3e50;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            text-align: center;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Verification Code</h2>
          </div>
          
          <p>Hello,</p>
          
          <p>Please use the following One-Time Password (OTP) to ${actionText}. This code will expire in 10 minutes.</p>
          
          <div class="otp-code">${otpCode}</div>
          
          <p>If you did not request this code, please ignore this email. Someone may have entered your email address by mistake.</p>
          
          <p>Thank you,<br>The Security Team</p>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }
}

module.exports = OtpEmailService;