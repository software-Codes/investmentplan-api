const express = require('express');
const AdminUserRouter = express.Router();
const { adminAuthenticate } = require('../../middleware/admin/adminAuth.middleware');
const AdminUserController = require('../../di/adminUser.ctrl');
/**
 * All routes below require a valid admin JWT.
 * If you have multiple admin roles, add an extra
 * middleware (e.g. requireSuperAdmin) right after
 * adminAuthenticate.
 */

AdminUserRouter.use(adminAuthenticate);

// ───────── READ ────────────────────────────
AdminUserRouter.get('/', AdminUserController.listUsers);          // ?page=&size=&status=&search=
AdminUserRouter.get('/:userId', AdminUserController.getUser);            // details by ID

// ───────── COMMANDS ───────────────────────
AdminUserRouter.patch('/:userId/block', AdminUserController.blockUser);
AdminUserRouter.patch('/:userId/unblock', AdminUserController.unblockUser);
AdminUserRouter.post('/:userId/force-logout', AdminUserController.forceLogoutUser);
    
// soft delete:  DELETE /:id?soft=true
// hard delete:  DELETE /:id
AdminUserRouter.delete('/:userId', AdminUserController.deleteUser);

module.exports = AdminUserRouter;

