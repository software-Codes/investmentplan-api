// # /signup, /login, /verify-otp

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {
    authenticate,
    authorize
} = require("../middleware/auth.middleware");
const validationMiddleware = require("../middleware/validation.middleware");
const  rateLimiter = require("../middleware/rate-limiter");

// Apply general rate limiting to all routes
router.use(rateLimiter.apiLimiter);


// Registration route with validation and rate limiting
router.post(
    '/register',
    validationMiddleware.validateRegistration,
    rateLimiter.otpLimiter,
    authController.register
  );

  // Login route with validation and rate limiting
router.post(
    '/login',
    validationMiddleware.validateLogin,
    rateLimiter.loginLimiter,
    authController.login
  );

  // OTP verification route with validation
router.post(
    '/verify-otp',
    validationMiddleware.validateOtpVerification,
    authController.verifyOtp
  );

  // Logout route protected by authentication
router.post(
    '/logout',
    authenticate,
    authController.logout
  );

  // Password recovery routes
router.post(
    '/initiate-recovery',
    validationMiddleware.validateLogin,
    authController.initiateRecovery
  );

  router.post(
    '/complete-recovery',
    validationMiddleware.validateOtpVerification,
    authController.completeRecovery
  );

  module.exports = router();