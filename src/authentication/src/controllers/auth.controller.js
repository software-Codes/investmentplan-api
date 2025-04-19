const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

/**
 * @file auth.service.js
 * @description Authentication service that integrates User and OTP models for a complete auth flow
 */
class AuthController {
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
    static async register(req, res, next) {
        try {
            const userData = req.body;

            if (!userData.password) {
                return next(new Error('Password is required'));
            }

            const existingUser = await User.findbyEmail(userData.email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists'
                });
            }

            const user = await User.create(userData);

            let deliveryMethod, contactDetail;
            if (userData.preferredContactMethod === 'email') {
                deliveryMethod = 'email';
                contactDetail = user.email;
            } else if (userData.preferredContactMethod === 'phone') {
                deliveryMethod = 'sms';
                contactDetail = user.phone_number;
            } else {
                return next(new Error('Invalid contact method'));
            }

            const otpData = {
                userId: user.user_id,
                purpose: 'registration',
                deliveryMethod: deliveryMethod,
            };

            if (deliveryMethod === 'email') {
                otpData.email = contactDetail;
            } else {
                otpData.phoneNumber = contactDetail;
            }

            await OTP.generate(otpData);

            return res.status(201).json({
                success: true,
                user: {
                    userId: user.user_id,
                    fullName: user.full_name,
                    email: user.email,
                    phoneNumber: user.phone_number,
                    preferredContactMethod: user.preferred_contact_method,
                    accountStatus: user.account_status
                },
                message: `Verification code sent via ${deliveryMethod}`
            });
        } catch (error) {
            next(error);
        }
    }
    /**
     * Authenticate user credentials and handle OTP verification if required
     * @param {Object} credentials - User login credentials
     * @param {string} credentials.email - User's email address
     * @param {string} credentials.password - User's password
     * @param {string} [credentials.otpCode] - OTP code (if OTP is required)
     * @param {string} [credentials.ipAddress] - User's IP address
     * @param {string} [credentials.userAgent] - User's browser/device information
     * @returns {Promise<Object>} Authentication result with user data and token
     */
    static async login(credentials) {
        try {
            // Find user by email
            const user = await User.findbyEmail(credentials.email);
            if (!user) {
                throw new Error('Invalid email or password');
            }

            // Check if account is active
            if (user.account_status !== 'active') {
                throw new Error(`Account is ${user.account_status}. Please contact support.`);
            }

            // Verify password
            const isPasswordValid = await User.validatePassword(credentials.password, user.password_hash);
            if (!isPasswordValid) {
                // Increment failed login attempts
                await User.incrementFailedLoginAttempts(user.user_id);
                throw new Error('Invalid email or password');
            }

            // Reset failed login attempts on successful login
            await User.updateLoginInfo(user.user_id, credentials.ipAddress);

            // Check if OTP is required for login
            const isOtpRequired = user.preferred_contact_method !== 'none' && !user.email_verified && !user.phone_verified;

            if (isOtpRequired) {
                // Generate OTP for login verification
                const otpData = {
                    userId: user.user_id,
                    purpose: 'login',
                    deliveryMethod: user.preferred_contact_method
                };

                if (otpData.deliveryMethod === 'email') {
                    otpData.email = user.email;
                } else {
                    otpData.phoneNumber = user.phone_number;
                }

                await OTP.generate(otpData);

                return {
                    success: true,
                    requiresOtp: true,
                    user: {
                        userId: user.user_id,
                        fullName: user.full_name,
                        email: user.email,
                        phoneNumber: user.phone_number,
                        preferredContactMethod: user.preferred_contact_method,
                        accountStatus: user.account_status
                    },
                    message: `Login OTP sent via ${otpData.deliveryMethod}`
                };
            } else {
                // Create session and return JWT token
                const session = await User.createSession(user.user_id, {
                    ipAddress: credentials.ipAddress,
                    userAgent: credentials.userAgent
                });

                // Generate JWT token
                const token = this.generateJwtToken(user.user_id, session.session_id);

                return {
                    success: true,
                    requiresOtp: false,
                    user: {
                        userId: user.user_id,
                        fullName: user.full_name,
                        email: user.email,
                        phoneNumber: user.phone_number,
                        preferredContactMethod: user.preferred_contact_method,
                        accountStatus: user.account_status
                    },
                    token,
                    session: {
                        sessionId: session.session_id,
                        expiresAt: session.expires_at
                    }
                };
            }
        } catch (error) {
            logger.error(`Login failed: ${error.message}`);
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    /**
     * Verify OTP code for login or other operations
     * @param {Object} otpData - OTP verification data
     * @param {string} otpData.userId - User's unique ID
     * @param {string} otpData.otpCode - OTP code to verify
     * @param {string} otpData.purpose - Purpose of the OTP (e.g., 'login', 'reset_password')
     * @param {string} [otpData.ipAddress] - User's IP address
     * @param {string} [otpData.userAgent] - User's browser/device information
     * @returns {Promise<Object>} Verification result with token and session
     */
    static async verifyOtp(otpData) {
        try {
            // Verify OTP
            const isVerified = await OTP.verify({
                otpCode: otpData.otpCode,
                purpose: otpData.purpose,
                userId: otpData.userId
            });

            if (!isVerified) {
                throw new Error('Invalid or expired OTP code');
            }

            // Find user
            const user = await User.findById(otpData.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create session and return JWT token
            const session = await User.createSession(user.user_id, {
                ipAddress: otpData.ipAddress,
                userAgent: otpData.userAgent
            });

            // Generate JWT token
            const token = this.generateJwtToken(user.user_id, session.session_id);

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
                token,
                session: {
                    sessionId: session.session_id,
                    expiresAt: session.expires_at
                }
            };
        } catch (error) {
            logger.error(`OTP verification failed: ${error.message}`);
            throw new Error(`OTP verification failed: ${error.message}`);
        }
    }

    /**
     * Logout user by invalidating session
     * @param {string} sessionId - Session ID to invalidate
     * @returns {Promise<Object>} Logout result
     */
    static async logout(sessionId) {
        try {
            const isInvalidated = await User.invalidateSession(sessionId);
            if (!isInvalidated) {
                throw new Error('Session not found or already invalidated');
            }

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            logger.error(`Logout failed: ${error.message}`);
            throw new Error(`Logout failed: ${error.message}`);
        }
    }

    /**
     * Logout from all sessions except current one
     * @param {string} userId - User's unique ID
     * @param {string} currentSessionId - Current session ID to preserve
     * @returns {Promise<Object>} Logout result with count of invalidated sessions
     */
    static async logoutAll(userId, currentSessionId) {
        try {
            const count = await User.invalidateAllOtherSessions(userId, currentSessionId);
            return {
                success: true,
                message: `Invalidated ${count} sessions`,
                invalidatedSessions: count
            };
        } catch (error) {
            logger.error(`Logout all failed: ${error.message}`);
            throw new Error(`Logout all failed: ${error.message}`);
        }
    }

    /**
     * Initiate password recovery process
     * @param {Object} recoveryData - Recovery initiation data
     * @param {string} recoveryData.email - User's email address
     * @param {string} [recoveryData.phoneNumber] - User's phone number
     * @param {string} recoveryData.method - Recovery method ('email' or 'sms')
     * @returns {Promise<Object>} Recovery initiation result
     */
    static async initiateRecovery(recoveryData) {
        try {
            // Find user by email or phone number
            let user;
            if (recoveryData.email) {
                user = await User.findbyEmail(recoveryData.email);
            } else if (recoveryData.phoneNumber) {
                user = await User.findByPhoneNumber(recoveryData.phoneNumber);
            }

            if (!user) {
                throw new Error('No account found with the provided information');
            }

            // Check if account is active
            if (user.account_status !== 'active') {
                throw new Error(`Account is ${user.account_status}. Please contact support.`);
            }

            // Generate OTP for recovery
            const otpData = {
                userId: user.user_id,
                purpose: 'reset_password',
                deliveryMethod: recoveryData.method
            };

            if (otpData.deliveryMethod === 'email') {
                otpData.email = user.email;
            } else {
                otpData.phoneNumber = user.phone_number;
            }

            await OTP.generate(otpData);

            return {
                success: true,
                userId: user.user_id,
                method: recoveryData.method,
                destination: recoveryData.method === 'email'
                    ? User._maskEmail(user.email)
                    : User._maskPhoneNumber(user.phone_number),
                message: `Recovery code sent via ${recoveryData.method}`
            };
        } catch (error) {
            logger.error(`Recovery initiation failed: ${error.message}`);
            throw new Error(`Recovery initiation failed: ${error.message}`);
        }
    }

    /**
     * Complete password recovery by verifying OTP and setting new password
     * @param {Object} recoveryData - Recovery completion data
     * @param {string} recoveryData.userId - User's unique ID
     * @param {string} recoveryData.otpCode - OTP code received by the user
     * @param {string} recoveryData.newPassword - New password to set
     * @param {string} [recoveryData.ipAddress] - User's IP address
     * @returns {Promise<Object>} Recovery completion result
     */
    static async completeRecovery(recoveryData) {
        try {
            // Verify OTP
            const isVerified = await OTP.verify({
                otpCode: recoveryData.otpCode,
                purpose: 'reset_password',
                userId: recoveryData.userId
            });

            if (!isVerified) {
                throw new Error('Invalid or expired recovery code');
            }

            // Update password
            await User.changePassword(recoveryData.userId, recoveryData.newPassword);

            // Update login info
            await User.updateLoginInfo(recoveryData.userId, recoveryData.ipAddress);

            return {
                success: true,
                message: 'Password has been successfully reset'
            };
        } catch (error) {
            logger.error(`Recovery completion failed: ${error.message}`);
            throw new Error(`Recovery completion failed: ${error.message}`);
        }
    }

    /**
     * Generate JWT token for authenticated sessions
     * @param {string} userId - User's unique ID
     * @param {string} sessionId - Session ID
     * @returns {string} JWT token
     * @private
     */
    static generateJwtToken(userId, sessionId) {
        const payload = {
            userId,
            sessionId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };

        return jwt.sign(payload, process.env.JWT_SECRET, {
            algorithm: 'HS256'
        });
    }

    /**
     * Validate JWT token and return user data
     * @param {string} token - JWT token to validate
     * @returns {Promise<Object>} Decoded token payload
     */
    static async validateJwtToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded;
        } catch (error) {
            logger.error(`Token validation failed: ${error.message}`);
            throw new Error('Invalid or expired token');
        }
    }
}

module.exports = AuthController;