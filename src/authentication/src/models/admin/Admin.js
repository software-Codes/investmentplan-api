const { pool } = require('../../Config/neon-database');
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

      const emailCheckQuery = `
      SELECT email FROM users WHERE LOWER(email) = $1
    `;
      const emailExists = await client.query(emailCheckQuery, [adminData.email.toLowerCase()]);
      if (emailExists.rows.length > 0) {
        throw new Error('Email already exists in users table');
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
      throw error;
    } finally {
      client.release();
    }
  }


  static async findByEmail(email) {
    try {
      const queryText = `
        SELECT admin_id, full_name, email, password_hash, role, 
               is_active, created_at, updated_at
        FROM admins 
        WHERE email = $1 AND is_active = true
      `;

      const result = await pool.query(queryText, [email.toLowerCase().trim()]);

      return result.rows[0] || null;

    } catch (error) {
      throw error;
    }
  }


  static async validateCredentials(email, password) {
    try {
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
      throw error;
    }
  }




  static async updatePassword(adminId, newPassword) {
    try {
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
      throw error;
    }
  }


  static async findById(adminId) {
    try {
      const queryText = `
      SELECT admin_id, full_name, email, password_hash, role, is_active, created_at, updated_at
      FROM admins 
      WHERE admin_id = $1 AND is_active = true
    `;

      const result = await pool.query(queryText, [adminId]);
      return result.rows[0] || null;

    } catch (error) {
      throw error;
    }
  }


  static async updateProfile(adminId, fields) {
    const allowed = ['full_name'];
    const updates = Object.entries(fields).filter(([key]) => allowed.includes(key));

    if (updates.length === 0) return null;

    const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
    const values = updates.map(([, v]) => v);
    values.push(adminId); // for WHERE clause

    const sql = `
    UPDATE admins
    SET ${setClause}, updated_at = NOW()
    WHERE admin_id = $${values.length}
    RETURNING admin_id, full_name, email, updated_at
  `;

    const result = await pool.query(sql, values);
    return result.rows[0];
  }

  static async updateFullName(adminId, fullName) {
    const queryText = `
    UPDATE admins 
    SET full_name = $1, updated_at = NOW()
    WHERE admin_id = $2 AND is_active = true
    RETURNING admin_id, full_name, updated_at
  `;
    try {
      const result = await pool.query(queryText, [fullName.trim(), adminId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }


}

module.exports = Admin;