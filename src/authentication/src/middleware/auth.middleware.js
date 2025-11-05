// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");
const { error } = require("../utils/response.util");
const { isTokenBlacklisted } = require("../helpers/blacklist-auth");
const { query } = require("../../../database/connection");

exports.authenticate = async (req, res, next) => {
  try {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn("Authentication attempt without authorization header");
      return next(
        error("Authorization header is required", 401)
      );
    }

    // 2. Validate header format
    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      logger.warn("Invalid authorization header format");
      return next(
        error("Invalid authorization header format. Use: Bearer <token>", 401)
      );
    }

    // 3. Check token blacklist
    if (isTokenBlacklisted(token)) {
      logger.warn(`Attempt to use revoked token: ${token}`);
      return next(
        error("Session expired. Please log in again.", 401)
      );
    }

    // 4. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyError) {
      // Handle specific verification errors
      logger.error(`JWT verification failed: ${verifyError.message}`);

      const errorMap = {
        TokenExpiredError: "Session expired. Please log in again.",
        JsonWebTokenError: verifyError.message.includes("invalid signature")
          ? "Invalid authentication token"
          : "Malformed authentication token",
        NotBeforeError: "Token not yet valid"
      };

      return next(
        error(errorMap[verifyError.name] || "Invalid authentication token", 401)
      );
    }

    // 5. Check user account status
    const userCheck = await query(
      `SELECT account_status FROM users WHERE user_id = $1`,
      [decoded.userId]
    );

    if (!userCheck.rows[0]) {
      logger.warn(`User not found: ${decoded.userId}`);
      return next(
        error("Account not found. Please log in again.", 401)
      );
    }

    if (userCheck.rows[0].account_status === 'suspended') {
      logger.warn(`Suspended user attempt: ${decoded.userId}`);
      return next(
        error("Your account has been suspended. Please contact support.", 403)
      );
    }

    if (userCheck.rows[0].account_status === 'deactivated') {
      logger.warn(`Deactivated user attempt: ${decoded.userId}`);
      return next(
        error("Your account has been deactivated. Please contact support.", 403)
      );
    }

    // 6. Validate session is active
    const sessionCheck = await query(
      `SELECT is_active, expires_at FROM user_sessions WHERE session_id = $1`,
      [decoded.sessionId]
    );

    if (!sessionCheck.rows[0] || !sessionCheck.rows[0].is_active) {
      logger.warn(`Inactive session attempt: ${decoded.sessionId}`);
      return next(
        error("Session expired. Please log in again.", 401)
      );
    }

    if (new Date(sessionCheck.rows[0].expires_at) < new Date()) {
      logger.warn(`Expired session attempt: ${decoded.sessionId}`);
      return next(
        error("Session expired. Please log in again.", 401)
      );
    }

    // 7. Attach user to request
    req.user = {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      exp: decoded.exp
    };
    req.token = token;

    logger.info(`Authenticated user ${decoded.userId}`);
    next();
  } catch (err) {
    // Handle unexpected errors
    logger.error(`Authentication process failed: ${err.message}`);
    next(
      error("Authentication failed. Please try again.", 500)
    );
  }
};