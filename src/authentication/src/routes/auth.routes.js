// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRegistration, validateLogin, validateOtpVerification } = require('../middleware/validation.middleware');
const { loginLimiter, otpLimiter, apiLimiter } = require('../middleware/rate-limiter');

// Apply general rate limiting to all routes
router.use(apiLimiter);

// Registration route with validation and rate limiting
router.post(
    '/register',
    validateRegistration,
    otpLimiter,
    (req, res, next) => {
        authController.register(req, res, next);
    }
);

// Login route with validation and rate limiting
router.post(
    '/login',
    validateLogin,
    loginLimiter,
    (req, res, next) => {
        authController.login(req, res, next);
    }
);
router.post(
  '/resend-verification',
  otpLimiter,
  (req, res, next) => {
    authController.resendVerification(req, res, next);
  }
);
// OTP verification route with validation
router.post(
    '/verify-otp',
    validateOtpVerification,
    (req, res, next) => {
        authController.verifyOtp(req, res, next);
    }
);

// Logout route protected by authentication
router.post(
    '/logout',
    (req, res, next) => {
        authController.logout(req, res, next);
    }
);

// Password recovery routes
router.post(
    '/initiate-recovery',
    validateLogin,
    (req, res, next) => {
        authController.initiateRecovery(req, res, next);
    }
);

router.post(
    '/complete-recovery',
    validateOtpVerification,
    (req, res, next) => {
        authController.completeRecovery(req, res, next);
    }
);

// Password reset routes
router.post(
    '/initiate-password-reset',
    (req, res, next) => {
      authController.initiatePasswordReset(req, res, next);
    }
  );
  
  router.post(
    '/complete-password-reset',
    (req, res, next) => {
      authController.completePasswordReset(req, res, next);
    }
  );

module.exports = router;