const Admin = require("../../models/admin/Admin");
const { logger } = require("../../utils/logger");

exports.superAdminOnly = async (req, res, next) => {
  try {
    const isSuperAdmin = await Admin.isSuperAdmin(req.admin.adminId);
    
    if (!isSuperAdmin) {
      logger.warn(`Non-super admin ${req.admin.adminId} attempted to access restricted endpoint`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }
    
    next();
  } catch (error) {
    logger.error(`Super admin check failed: ${error.message}`);
    next(error);
  }
};