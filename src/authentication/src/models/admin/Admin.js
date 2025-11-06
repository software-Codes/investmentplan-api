const { pool } = require('../../Config/supabase-database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class Admin {
  constructor() {
    this.tableName = 'admins';
    this.saltRounds = 12;
  }

  static async create(adminData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Validate required fields
      if (!adminData.fullName?.trim()) {
        throw new Error('Full name is required');
      }

      if (!adminData.email?.trim()) {
        throw new Error('Email is required');
      }

      if (!adminData.password?.trim()) {
        throw new Error('Password is required');
      }

      // Check if email already exists in users table
      const emailCheckQuery = `
        SELECT email FROM users WHERE LOWER(email) = $1
      `;
      const emailExists = await client.query(emailCheckQuery, [adminData.email.toLowerCase()]);
      if (emailExists.rows.length > 0) {
        throw new Error('Email already exists in users table');
      }

      // Check if email already exists in admins table
      const adminEmailCheckQuery = `
        SELECT email FROM admins WHERE LOWER(email) = $1
      `;
      const adminEmailExists = await client.query(adminEmailCheckQuery, [adminData.email.toLowerCase()]);
      if (adminEmailExists.rows.length > 0) {
        throw new Error('Email already exists in admins table');
      }

      const adminId = uuidv4();
      const currentTimestamp = new Date().toISOString();
      const passwordHash = await bcrypt.hash(adminData.password, 12);

      const insertQuery = `
        INSERT INTO admins (
          admin_id, full_name, email, password_hash, role, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING admin_id, full_name, email, role, created_at, updated_at
      `;

      const values = [
        adminId,
        adminData.fullName.trim(),
        adminData.email.toLowerCase().trim(),
        passwordHash,
        adminData.role || 'admin',
        currentTimestamp
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Admin creation error:', error);
      
      // Re-throw with more specific error messages
      if (error.message.includes('duplicate key') || 
          error.message.includes('already exists')) {
        throw new Error('Email already exists');
      }
      
      if (error.message.includes('violates check constraint')) {
        throw new Error('Invalid data provided');
      }
      
      if (error.message.includes('required')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw new Error('Failed to create admin account');
    } finally {
      client.release();
    }
  }

  static async findByEmail(email) {
    try {
      if (!email?.trim()) {
        throw new Error('Email is required');
      }

      const queryText = `
        SELECT admin_id, full_name, email, password_hash, role, 
               is_active, created_at, updated_at
        FROM admins 
        WHERE LOWER(email) = $1 AND is_active = true
      `;

      const result = await pool.query(queryText, [email.toLowerCase().trim()]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('Find admin by email error:', error);
      throw new Error('Failed to find admin by email');
    }
  }

  static async validateCredentials(email, password) {
    try {
      if (!email?.trim()) {
        throw new Error('Email is required');
      }

      if (!password?.trim()) {
        throw new Error('Password is required');
      }

      const admin = await this.findByEmail(email);

      if (!admin) {
        return { isValid: false, admin: null };
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

      if (!isPasswordValid) {
        return { isValid: false, admin: null };
      }

      const { password_hash, ...adminWithoutPassword } = admin;
      return { isValid: true, admin: adminWithoutPassword };

    } catch (error) {
      console.error('Credential validation error:', error);
      throw new Error('Failed to validate credentials');
    }
  }

  static async updatePassword(adminId, newPassword) {
    try {
      if (!adminId?.trim()) {
        throw new Error('Admin ID is required');
      }

      if (!newPassword?.trim()) {
        throw new Error('New password is required');
      }

      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      const currentTimestamp = new Date().toISOString();

      const queryText = `
        UPDATE admins 
        SET password_hash = $1, updated_at = $2
        WHERE admin_id = $3 AND is_active = true
        RETURNING admin_id, full_name, email, role, updated_at
      `;

      const result = await pool.query(queryText, [
        passwordHash,
        currentTimestamp,
        adminId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Admin not found or inactive');
      }

      return result.rows[0];

    } catch (error) {
      console.error('Password update error:', error);
      
      if (error.message.includes('required') || 
          error.message.includes('characters long') ||
          error.message.includes('not found')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw new Error('Failed to update password');
    }
  }

  static async findById(adminId) {
    try {
      if (!adminId?.trim()) {
        throw new Error('Admin ID is required');
      }

      const queryText = `
        SELECT admin_id, full_name, email, password_hash, role, 
               is_active, created_at, updated_at
        FROM admins 
        WHERE admin_id = $1 AND is_active = true
      `;

      const result = await pool.query(queryText, [adminId]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('Find admin by ID error:', error);
      throw new Error('Failed to find admin by ID');
    }
  }

  static async updateProfile(adminId, fields) {
    try {
      if (!adminId?.trim()) {
        throw new Error('Admin ID is required');
      }

      const allowed = ['full_name'];
      const updates = Object.entries(fields).filter(([key]) => allowed.includes(key));

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
      const values = updates.map(([, v]) => v);
      values.push(adminId);

      const sql = `
        UPDATE admins
        SET ${setClause}, updated_at = NOW()
        WHERE admin_id = $${values.length} AND is_active = true
        RETURNING admin_id, full_name, email, updated_at
      `;

      const result = await pool.query(sql, values);
      
      if (result.rows.length === 0) {
        throw new Error('Admin not found or inactive');
      }
      
      return result.rows[0];

    } catch (error) {
      console.error('Profile update error:', error);
      
      if (error.message.includes('required') || 
          error.message.includes('not found') ||
          error.message.includes('valid fields')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw new Error('Failed to update profile');
    }
  }

  static async updateFullName(adminId, fullName) {
    try {
      if (!adminId?.trim()) {
        throw new Error('Admin ID is required');
      }

      if (!fullName?.trim()) {
        throw new Error('Full name is required');
      }

      const queryText = `
        UPDATE admins 
        SET full_name = $1, updated_at = NOW()
        WHERE admin_id = $2 AND is_active = true
        RETURNING admin_id, full_name, updated_at
      `;

      const result = await pool.query(queryText, [fullName.trim(), adminId]);
      
      if (result.rows.length === 0) {
        throw new Error('Admin not found or inactive');
      }
      
      return result.rows[0];

    } catch (error) {
      console.error('Full name update error:', error);
      
      if (error.message.includes('required') || 
          error.message.includes('not found')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw new Error('Failed to update full name');
    }
  }

  static async deleteById(adminId) {
    try {
      if (!adminId?.trim()) {
        throw new Error('Admin ID is required');
      }

      const queryText = `
        DELETE FROM admins
        WHERE admin_id = $1
        RETURNING admin_id
      `;

      const result = await pool.query(queryText, [adminId]);

      if (result.rowCount === 0) {
        return null;
      }

      return result.rows[0];

    } catch (error) {
      console.error('Delete admin error:', error);
      throw new Error('Failed to delete admin');
    }
  }
}

module.exports = Admin;