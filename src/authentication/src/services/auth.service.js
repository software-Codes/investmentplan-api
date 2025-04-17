// # JWT, session management
/**
 * @file auth.service.js
 * @description Authentication service that integrates User and OTP models for a complete auth flow
 */
const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
/**
 * Authentication service handling user authentication flows
 */

class AuthService {
    /**
  * Register a new user and trigger email/phone verification
  * @param {Object} userData - User registration data
  * @param {string} userData.fullName - User's full name
  * @param {string} userData.email - User's email address
  * @param {string} userData.phoneNumber - User's phone number
  * @param {string} userData.password - User's password
  * @param {string} userData.preferredContactMethod - User's preferred contact method ('email' or 'sms')
  * @returns {Promise<Object>} Registration result with user data
  */
    static async register(userData) {
        try {
            // Create the user
            const user = await User.create(userData);

            // Generate and send OTP based on preferred contact method
            const otpData = {
                userId: user.user_id,
                purpose: 'registration',
                deliveryMethod: userData.preferredContactMethod || 'email',
            };

            // Add the appropriate contact detail based on preferred method
            if (otpData.deliveryMethod === 'email') {
                otpData.email = user.email;
            } else {
                otpData.phoneNumber = user.phone_number;
            }

            // Generate and send the OTP
            await OTP.generate(otpData);

            return {
                success: true,
                user: {
                    userId: user.user_id,
                    fullName: user.full_name,
                    email: user.email,
                    phoneNumber: user.phone_number,
                    preferredContactMethod: user.preferred_contact_method,
                    accountStatus: user.account_status
                },
                message: `Verification code sent via ${otpData.deliveryMethod}`
            };
        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }
    }
}