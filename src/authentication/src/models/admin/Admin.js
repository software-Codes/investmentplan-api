const { pool, query } = require("../../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const { logger } = require("../../utils/logger");

class Admin {
  static async create(adminData) {
    const adminId = uuidv4();
    const currentDate = new Date().toISOString();
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    const queryText = `
      INSERT INTO admins (
        admin_id,
        full_name,
        email,
        password_hash,
        role,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      adminId,
      adminData.fullName,
      adminData.email.toLowerCase(),
      hashedPassword,
      adminData.role || 'admin',
      currentDate,
      currentDate
    ];

    try {
      const res = await query(queryText, values);
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to create admin: ${error.message}`);
      throw new Error('Failed to create admin account');
    }
  }

  static async findByEmail(email) {
    const queryText = 'SELECT * FROM admins WHERE email = $1';
    const res = await query(queryText, [email.toLowerCase()]);
    return res.rows[0];
  }

  static async validatePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async findById(adminId) {
    const queryText = 'SELECT * FROM admins WHERE admin_id = $1';
    const res = await query(queryText, [adminId]);
    return res.rows[0];
  }
  static async createSuperAdmin(adminData) {
    const adminId = uuidv4();
    const currentDate = new Date().toISOString();
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    const queryText = `
      INSERT INTO admins (
        admin_id,
        full_name,
        email,
        password_hash,
        role,
        is_super_admin,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      adminId,
      adminData.fullName,
      adminData.email.toLowerCase(),
      hashedPassword,
      'super_admin',
      true,
      currentDate,
      currentDate
    ];

    try {
      const res = await query(queryText, values);
      const { password_hash, ...adminWithoutPassword } = res.rows[0];
      return adminWithoutPassword;
    } catch (error) {
      logger.error(`Failed to create super admin: ${error.message}`);
      throw new Error('Failed to create super admin account');
    }
  }

  static async isSuperAdmin(adminId) {
    try {
      const queryText = 'SELECT is_super_admin FROM admins WHERE admin_id = $1';
      const res = await query(queryText, [adminId]);
      return res.rows[0]?.is_super_admin || false;
    } catch (error) {
      logger.error(`Failed to check super admin status: ${error.message}`);
      return false;
    }
  }
}

module.exports = Admin;