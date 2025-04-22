/**
 * @file Admin.js
 * @description This file contains the `Admin` model, which provides methods for managing admin accounts in the database.
 * It includes functionality for creating admins, finding admins by email, and validating passwords.
 */

const { pool, query } = require("../../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

class Admin {
  /**
   * Creates a new admin account in the database.
   *
   * This function generates a unique admin ID, hashes the provided password, and inserts the admin's details
   * into the `admins` table. If the email is already registered, it throws an error.
   *
   * @param {Object} adminData - The data for the new admin.
   * @param {string} adminData.fullName - The full name of the admin.
   * @param {string} adminData.email - The email address of the admin.
   * @param {string} adminData.password - The password for the admin account.
   * @returns {Promise<Object>} The newly created admin's details, including `admin_id`, `full_name`, `email`, and `created_at`.
   * @throws {Error} Throws an error if the email is already registered or if the database operation fails.
   */
  static async create(adminData) {
    const adminId = uuidv4();
    const currentDate = new Date().toISOString();

    // Hash the admin password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

    const queryText = `
        INSERT INTO admins (
            admin_id,
            full_name,
            email,
            password_hash,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING admin_id, full_name, email, created_at;
    `;

    const values = [
        adminId,
        adminData.fullName,
        adminData.email.toLowerCase(),
        passwordHash,
        currentDate,
        currentDate,
    ];

    try {
        const res = await query(queryText, values);
        return res.rows[0];
    } catch (error) {
        if (error.code === "23505") {
            if (error.detail.includes("email")) {
                throw new Error("Email address already registered");
            }
        }
        throw new Error(`Failed to create admin: ${error.message}`);
    }
}
  /**
   * Finds an admin by their email address.
   *
   * This function queries the `admins` table to retrieve the admin's details based on their email address.
   * If no admin is found, it returns `null`.
   *
   * @param {string} email - The email address of the admin to find.
   * @returns {Promise<Object|null>} The admin's details if found, or `null` if no admin exists with the provided email.
   */
  static async findByEmail(email) {
    const queryText = `
        SELECT 
            admin_id,
            full_name,
            email,
            password_hash
        FROM admins 
        WHERE email = $1;
    `;
    const res = await query(queryText, [email.toLowerCase()]);
    return res.rows[0] || null;
}

  /**
   * Validates an admin's password.
   *
   * This function compares the provided password with the stored password hash using bcrypt.
   *
   * @param {string} providedPassword - The password provided by the admin during login.
   * @param {string} storedPasswordHash - The hashed password stored in the database.
   * @returns {Promise<boolean>} Returns `true` if the password is valid, otherwise `false`.
   */
  static async validatePassword(providedPassword, storedPasswordHash) {
    return bcrypt.compare(providedPassword, storedPasswordHash); // Compare the provided password with the stored hash
  }
}

module.exports = Admin;
