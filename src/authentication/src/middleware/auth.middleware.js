// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");
const { error } = require("../utils/response.util");
const {
  addTokenToBlacklist,
  isTokenBlacklisted,
} = require("../helpers/blacklist-auth");

exports.authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next(
        error(
          new Error("Authentication token missing"),
          "You must provide an authentication token",
          401
        )
      );
    }

    // Check if token is blacklisted
    const isBlacklisted = isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next(
        error(
          new Error("Token revoked"),
          "Your session has been revoked. Please log in again.",
          401
        )
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Add the token to the request for potential blacklisting in logout
    req.token = token;

    // Log successful authentication
    logger.info(`User ${decoded.userId} authenticated successfully`);

    next();
  } catch (error) {
    // Log authentication error
    logger.error(`Authentication failed: ${error.message}`);

    // Check if error is related to token expiration
    if (error.name === "TokenExpiredError") {
      return next(
        error(
          new Error("Token expired"),
          "Your authentication token has expired. Please log in again.",
          401
        )
      );
    }

    // Handle other JWT errors (invalid signature, etc.)
    return next(
      error(new Error("Invalid token"), "The provided token is invalid", 401)
    );
  }
};
