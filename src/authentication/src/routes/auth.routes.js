// routes/auth.routes.js

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               preferredContactMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized
 */

/**
 * @openapi
 * /api/v1/auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification OTP resent successfully
 *       400:
 *         description: Bad request
 */

/**
 * @openapi
 * /api/v1/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               otpCode:
 *                 type: string
 *               purpose:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       404:
 *         description: Session not found
 */

/**
 * @openapi
 * /api/v1/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout from all sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out from all sessions
 */

/**
 * @openapi
 * /api/v1/auth/initiate-recovery:
 *   post:
 *     tags: [Auth]
 *     summary: Initiate password recovery
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               method:
 *                 type: string
 *     responses:
 *       200:
 *         description: Recovery initiated successfully
 *       400:
 *         description: Bad request
 */

/**
 * @openapi
 * /api/v1/auth/complete-recovery:
 *   post:
 *     tags: [Auth]
 *     summary: Complete password recovery
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               otpCode:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               ipAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired OTP
 */

/**
 * @openapi
 * /api/v1/auth/initiate-password-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Initiate password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset initiated
 *       400:
 *         description: Bad request
 */

/**
 * @openapi
 * /api/v1/auth/complete-password-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Complete password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               otpCode:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset completed successfully
 *       400:
 *         description: Invalid or expired OTP
 */

/**
 * @openapi
 * /api/v1/auth/delete-account:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete user account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Failed to delete account
 */

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       404:
 *         description: User not found
 */
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {
  validateRegistration,
  validateLogin,
  validateOtpVerification,
} = require("../middleware/validation.middleware");
const {
  loginLimiter,
  otpLimiter,
  apiLimiter,
} = require("../middleware/rate-limiter");
const { authenticate } = require("../middleware/auth.middleware");
const multer = require("multer");
const upload = multer({storage: multer.memoryStorage() })

// Apply general rate limiting to all routes
router.use(apiLimiter);

// Registration route with validation and rate limiting
router.post("/register", validateRegistration, otpLimiter, (req, res, next) => {
  authController.register(req, res, next);
});

// Login route with validation and rate limiting
router.post("/login", validateLogin, loginLimiter, (req, res, next) => {
  authController.login(req, res, next);
});
router.post("/resend-verification", otpLimiter, (req, res, next) => {
  authController.resendVerification(req, res, next);
});
// OTP verification route with validation
router.post("/verify-otp", validateOtpVerification, (req, res, next) => {
  authController.verifyOtp(req, res, next);
});

// Logout route protected by authentication
router.post(
  "/logout",
  authenticate, // Changed from authMiddleware to authenticate
  (req, res, next) => {
    authController.logout(req, res, next);
  }
);
router.post("/logout-all", authenticate, (req, res, next) => {
  authController.logoutAllDevices(req, res, next);
});

// Password recovery routes
router.post("/initiate-recovery", validateLogin, (req, res, next) => {
  authController.initiateRecovery(req, res, next);
});

router.post("/complete-recovery", validateOtpVerification, (req, res, next) => {
  authController.completeRecovery(req, res, next);
});

// Password reset routes
router.post("/initiate-password-reset", (req, res, next) => {
  authController.initiatePasswordReset(req, res, next);
});

router.post("/complete-password-reset", (req, res, next) => {
  authController.completePasswordReset(req, res, next);
});
//deleting account
router.delete("/delete-account", authenticate, (req, res, next) => {
  authController.deleteAccount(req, res, next);
});
//get user details
router.get("/me", authenticate, (req, res, next) => {
  authController.getCurrentUser(req, res, next);
});
// //submit kyc documents
// router.post(
//   '/upload-documents',
//   authenticate,
//   upload.single('document'),
//   authController.uploadDocuments
// );

module.exports = router;
