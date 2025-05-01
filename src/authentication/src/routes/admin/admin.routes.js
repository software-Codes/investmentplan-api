/**
 * @file admin.routes.js
 * @description Defines routes for admin-related operations, including login, user management, and retrieving user details.
 */
/**
 * @openapi
 * /api/v1/admin/login:
 *   post:
 *     tags: [Admin]
 *     summary: Admin login
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
 * /api/v1/admin/logout-user:
 *   post:
 *     tags: [Admin]
 *     summary: Logout a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged out successfully
 *       404:
 *         description: Session not found
 */

/**
 * @openapi
 * /api/v1/admin/delete-user:
 *   post:
 *     tags: [Admin]
 *     summary: Delete a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Failed to delete user
 */

/**
 * @openapi
 * /api/v1/admin/user-details/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       404:
 *         description: User not found
 */

/**
 * @openapi
 * /api/v1/admin/all-users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       400:
 *         description: Failed to retrieve users
 */
const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/admin.controller");
const {
  adminAuthenticate,
} = require("../../middleware/admin/adminAuth.middleware");
const {superAdminOnly} = require("../../middleware/admin/super-admin.middleware")

// Admin login route
router.post("/login", adminController.adminLogin);

router.post("/register", 
  adminAuthenticate, 
  // Add a super-admin check middleware
  (req, res, next) => {
    if (req.admin.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: "Only super admins can register new admins"
      });
    }
    next();
  },
  adminController.registerAdmin
);
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

// Update user status
router.post("/update-user-status", adminAuthenticate, adminController.updateUserStatus);
// Get user documents
router.get("/user-documents/:userId", adminAuthenticate, adminController.getUserDocuments);

// Get admin profile
router.get("/profile", adminAuthenticate, adminController.getAdminProfile);
router.post("/create-admin", 
  adminAuthenticate, 
  superAdminOnly,
  adminController.registerAdmin
);

router.get("/admin-list", 
  adminAuthenticate, 
  superAdminOnly,
  // adminController.getAllAdmins
);

router.post("/revoke-admin", 
  adminAuthenticate, 
  superAdminOnly,
  // adminController.revokeAdmin
);
router.post("/create-super-admin", 
  adminAuthenticate, 
  superAdminOnly,
  // adminController.createSuperAdmin
);

module.exports = router;


