/**
 * @file response.util.js
 * @description Utility functions to generate standardized API responses
 */

// Status code constants
const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
};

/**
 * Generates a successful response object
 * @param {any} data - Response data (can be null)
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} - Formatted success response
 */
exports.success = (data, message, statusCode = STATUS_CODES.OK) => {
    return {
        success: true,
        data,
        message,
        timestamp: new Date().toISOString(),
        statusCode
    };
};

/**
 * Generates an error response object
 * @param {Error} error - Error object
 * @param {string} userMessage - User-friendly error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @returns {Object} - Formatted error response
 */
exports.error = (error, userMessage, statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR) => {
    return {
        success: false,
        error: {
            message: userMessage,
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        timestamp: new Date().toISOString(),
        statusCode
    };
};

// Export status codes for general use
exports.STATUS_CODES = STATUS_CODES;