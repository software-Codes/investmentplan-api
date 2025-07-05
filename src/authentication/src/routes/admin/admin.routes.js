
const express = require('express');
const router = express.Router();

const {
  adminAuthenticate,
} = require('../../middleware/admin/adminAuth.middleware');

const AdminController = require('../../controllers/admin/admin.controller');


router.post('/auth/register',                 AdminController.register);
router.post('/auth/login',                    AdminController.login);
router.post('/auth/request-password-reset',   AdminController.requestPasswordReset);
router.post('/auth/reset-password',           AdminController.resetPassword);


router.use(adminAuthenticate);

router.patch('/me', AdminController.updateAdminDetails);
router.get('/me', AdminController.getProfile)



module.exports = router;
