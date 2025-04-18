//OTP/deposit rate limiting

/**
 * @file rate.limiter.js
 * @description Middleware for implementing rate limiting to prevent abuse
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

/**
 * Creates a rate limiter for login attempts
 * @returns {Function} Rate limiter middleware
 */
exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Too many login attempts from this IP. Please try again later.'
    },
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many login attempts from this IP. Please try again later.'
        });
    }
});

/**
 * Creates a rate limiter for API endpoints
 * @returns {Function} Rate limiter middleware
 */
exports.apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try again later.'
    },
    handler: (req, res) => {
        logger.warn(`API rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many requests from this IP. Please try again later.'
        });
    }
});

/**
 * Creates a rate limiter for OTP requests
 * @returns {Function} Rate limiter middleware
 */
exports.otpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 3, // Limit each IP to 3 OTP requests per windowMs
    message: {
        success: false,
        message: 'Too many OTP requests. Please wait and try again.'
    },
    handler: (req, res) => {
        logger.warn(`OTP rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many OTP requests. Please wait and try again.'
        });
    }
});