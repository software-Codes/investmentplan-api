//# JWT validation, role checks
/**
 * @file auth.middleware.js
 * @description Middleware for handling user authentication using JWT tokens
 */

const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { error } = require('../utils/response.util');

/**
 * Authenticates a user based on a JWT token provided in the Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.authenticate = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(error(new Error('Authentication token missing'), 'You must provide an authentication token', 401));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Log successful authentication
    logger.info(`User ${decoded.userId} authenticated successfully`);

    next();
  } catch (error) {
    // Log authentication error
    logger.error(`Authentication failed: ${error.message}`);

    // Check if error is related to token expiration
    if (error.name === 'TokenExpiredError') {
      return next(error(new Error('Token expired'), 'Your authentication token has expired. Please log in again.', 401));
    }

    // Handle other JWT errors (invalid signature, etc.)
    return next(error(new Error('Invalid token'), 'The provided token is invalid', 401));
  }
};

/**
 * Checks if a user has a specific role or set of roles
 * @param {string|string[]} roles - Role or array of roles to check
 * @returns {Function} Middleware function
 */
exports.authorize = (roles) => {
  if (!Array.isArray(roles)) {
    roles = [roles];
  }

  return (req, res, next) => {
    try {
      // Check if user has any of the required roles
      const hasRole = roles.some(role => req.user.roles?.includes(role));
      if (!hasRole) {
        return next(error(new Error('Unauthorized'), 'You do not have permission to access this resource', 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};