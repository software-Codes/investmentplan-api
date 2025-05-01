require('dotenv').config();
const Admin = require('../src/authentication/src/models/admin/Admin');
const { logger } = require('../src/authentication/src/utils/logger');

async function createSuperAdmin() {
  try {
    const superAdminData = {
      fullName: process.env.SUPER_ADMIN_NAME,
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD
    };

    if (!superAdminData.email || !superAdminData.password) {
      throw new Error('Super admin credentials not provided in environment variables');
    }

    const superAdmin = await Admin.createSuperAdmin(superAdminData);
    logger.info('Super admin created successfully');
    console.log('Super admin created:', {
      adminId: superAdmin.admin_id,
      email: superAdmin.email,
      role: superAdmin.role
    });
    process.exit(0);
  } catch (error) {
    logger.error(`Failed to create super admin: ${error.message}`);
    process.exit(1);
  }
}

createSuperAdmin();