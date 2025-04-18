/**
 * @file validation.middleware.js
 * @description Middleware for validating request input using express-validator
 */

const { body, validationResult } = require('express-validator');
const { error } = require('../utils/response.util');

/**
 * Validates registration input
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateRegistration = [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('phoneNumber')
        .matches(/^\+?[0-9]{10,15}$/)
        .withMessage('Invalid phone number format. Must be between 10-15 digits, can start with +'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('preferredContactMethod').isIn(['email', 'sms']).withMessage('Invalid contact method'),
    (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('Validation errors:', errors.array());
                return next(error(new Error('Validation failed'), errors.array(), 400));
            }
            next();
        } catch (error) {
            next(error);
        }
    }
];

/**
 * Validates login input
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateLogin = [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(error(new Error('Validation failed'), errors.array(), 400));
            }
            next();
        } catch (error) {
            next(error);
        }
    }
];

/**
 * Validates OTP verification input
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateOtpVerification = [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('otpCode').notEmpty().isLength({ min: 6, max: 6 }).withMessage('Invalid OTP code'),
    body('purpose').notEmpty().withMessage('Purpose is required'),
    (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(error(new Error('Validation failed'), errors.array(), 400));
            }
            next();
        } catch (error) {
            next(error);
        }
    }
];