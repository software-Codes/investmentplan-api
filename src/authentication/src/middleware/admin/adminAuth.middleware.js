/**
 * @file adminAuth.middleware.js
 * @description Middleware for authenticating admin users using JWT tokens.
 * This middleware ensures that only authenticated admins can access protected routes.
 */

const jwt = require('jsonwebtoken');
const { logger } = require("../../utils/logger");
const Admin = require("../../models/admin/Admin");

/**
 * Middleware to authenticate admin users.
 *
 * This function extracts the JWT token from the `Authorization` header, verifies it,
 * and attaches the decoded admin information to the request object. If the token is missing,
 * invalid, or expired, it throws an appropriate error.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void}
 *
 * @throws {Error} Throws an error if the token is missing, invalid, or expired.
 */
exports.adminAuthenticate = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            // If no token is provided, pass an error to the next middleware
            return next(new Error('Authentication token missing'));
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded; // Attach the decoded admin information to the request object

        // Log successful authentication
        logger.info(`Admin ${decoded.adminId} authenticated successfully`);

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        // Log the authentication error
        logger.error(`Admin authentication failed: ${error.message}`);

        // Check if the error is related to token expiration
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Token expired'));
        }

        // Handle other JWT errors (e.g., invalid signature)
        return next(new Error('Invalid token'));
    }
};