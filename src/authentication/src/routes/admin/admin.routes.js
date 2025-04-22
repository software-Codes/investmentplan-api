/**
 * @file admin.routes.js
 * @description Defines routes for admin-related operations, including login, user management, and retrieving user details.
 */

const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/admin.controller");
const {
  adminAuthenticate,
} = require("../../middleware/admin/adminAuth.middleware");

// Admin login route
router.post("/login", adminController.adminLogin);

// Admin registration route (protected)
router.post("/register", adminAuthenticate, adminController.registerAdmin);

// Middleware to authenticate admin routes
router.use(adminAuthenticate);

/**
 * @route POST /admin/logout-user
 * @description Logs out a specific user by invalidating their session.
 * @access Protected (Admin only)
 */
router.post("/logout-user", adminController.logoutUser);

/**
 * @route POST /admin/delete-user
 * @description Deletes a user's account and all associated data.
 * @access Protected (Admin only)
 */
router.post("/delete-user", adminController.deleteUser);

/**
 * @route GET /admin/user-details/:userId
 * @description Retrieves detailed information about a specific user.
 * @access Protected (Admin only)
 */
router.get("/user-details/:userId", adminController.getUserDetails);

/**
 * @route GET /admin/all-users
 * @description Retrieves a list of all users in the system.
 * @access Protected (Admin only)
 */
router.get("/all-users", adminController.getAllUsers);

module.exports = router;
