const Admin = require('../../models/admin/Admin');
const OTP = require('../../models/otp.model');
const { logger } = require('../../utils/logger');
const { success, error, STATUS_CODES } = require('../../utils/response.util');
const { generateAdminToken } = require('../../utils/admin/token.util')
const bcrypt = require('bcrypt')
const {query} = require('../../Config/neon-database')


class AdminController {

  /**
   * Admin Registration
   * Algorithm: Input Validation → Uniqueness Check → Database Transaction
   * Time Complexity: O(1) - Fixed database operations
   * Space Complexity: O(1) - Fixed memory allocation
   */
  static async register(req, res, next) {
    try {
      const { fullName, email, password, role } = req.body;

      if (!fullName || !email || !password) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Missing required fields'), 'Full name, email, and password are required', STATUS_CODES.BAD_REQUEST)
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Invalid email format'), 'Please provide a valid email address', STATUS_CODES.BAD_REQUEST)
        );
      }

      if (password.length < 8) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Weak password'), 'Password must be at least 8 characters long', STATUS_CODES.BAD_REQUEST)
        );
      }

      const existingAdmin = await Admin.findByEmail(email);
      if (existingAdmin) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Admin exists'), 'An admin with this email already exists', STATUS_CODES.BAD_REQUEST)
        );
      }

      // Check against users table
      const userExists = await query(
        `SELECT user_id FROM users WHERE LOWER(email) = $1`,
        [email.toLowerCase()]
      );
      if (userExists.rows.length > 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Email conflict'), 'This email is already used by a user account', STATUS_CODES.BAD_REQUEST)
        );
      }

      const adminData = {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: role || 'admin'
      };

      const newAdmin = await Admin.create(adminData);

      logger.info('Admin registration successful', {
        adminId: newAdmin.admin_id,
        email: newAdmin.email,
        role: newAdmin.role
      });

      return res.status(STATUS_CODES.CREATED).json(
        success(
          {
            adminId: newAdmin.admin_id,
            fullName: newAdmin.full_name,
            email: newAdmin.email,
            role: newAdmin.role,
            createdAt: newAdmin.created_at
          },
          'Admin account created successfully.',
          STATUS_CODES.CREATED
        )
      );

    } catch (error) {
      logger.error('Admin registration failed', { error: error.message });
      next(error);
    }
  }


  /**
   * Admin Login
   * Algorithm: Credential Validation → OTP Generation → Response
   * Time Complexity: O(1) - Fixed validation steps
   * Space Complexity: O(1) - Fixed memory allocation
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // ─── Basic input guard ────────────────────────────────
      if (!email || !password) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(
            new Error('Missing credentials'),
            'Email and password are required',
            STATUS_CODES.BAD_REQUEST
          )
        );
      }

      // ─── Credential check ────────────────────────────────
      const { isValid, admin } = await Admin.validateCredentials(email, password);

      if (!isValid) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          error(
            new Error('Invalid credentials'),
            'Invalid email or password',
            STATUS_CODES.UNAUTHORIZED
          )
        );
      }

      // ─── Token generation ────────────────────────────────
      const token = generateAdminToken(admin);

      logger.info('Admin login successful', { adminId: admin.admin_id, email: admin.email });

      return res.status(STATUS_CODES.OK).json(
        success(
          {
            token,                               // <-- Bearer token
            admin: {
              adminId: admin.admin_id,
              fullName: admin.full_name,
              email: admin.email,
              role: admin.role
            }
          },
          'Login successful',
          STATUS_CODES.OK
        )
      );

    } catch (err) {
      logger.error('Admin login failed', { error: err.message });
      next(err);
    }
  }

  /**
   * Password Reset Request
   * Algorithm: Email Validation → OTP Generation → Response
   * Time Complexity: O(1) - Fixed validation steps
   * Space Complexity: O(1) - Fixed memory allocation
   */
  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      // Validate email
      if (!email) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Missing email'), 'Email is required for password reset', STATUS_CODES.BAD_REQUEST)
        );
      }

      // Check if admin exists
      const admin = await Admin.findByEmail(email);
      if (!admin) {                         // don’t leak existence
        return res.status(STATUS_CODES.OK).json(
          success(null, 'If this email exists, you will receive a reset code', STATUS_CODES.OK)
        );
      }
      await OTP.generate({
        email: admin.email,
        purpose: 'reset_password',
        delivery: 'email'
      });

      logger.info('Password reset OTP sent', {
        adminId: admin.admin_id,
        email: admin.email
      });

      logger.info('Reset OTP sent', { adminId: admin.admin_id, email: admin.email });
      return res.status(STATUS_CODES.OK).json(
        success(null, 'Password-reset code sent to your email', STATUS_CODES.OK)
      );

    } catch (err) { next(err); }
  }

  /**
   * Reset Password
   * Algorithm: OTP Validation → Password Update → Response
   * Time Complexity: O(1) - Fixed validation and update steps
   * Space Complexity: O(1) - Fixed memory allocation
   */
  // controllers/admin/admin.controller.js
  static async resetPassword(req, res, next) {
    try {
      const { email, otpCode, newPassword } = req.body;

      if (!email || !otpCode || !newPassword) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Missing fields'), 'Email, OTP code, and new password are required', STATUS_CODES.BAD_REQUEST)
        );
      }

      if (newPassword.length < 8) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Weak password'), 'New password must be at least 8 characters long', STATUS_CODES.BAD_REQUEST)
        );
      }

      const admin = await Admin.findByEmail(email);
      if (!admin) {
        return res.status(STATUS_CODES.NOT_FOUND).json(
          error(new Error('Admin not found'), 'No admin found with this email', STATUS_CODES.NOT_FOUND)
        );
      }

      const isValidOtp = await OTP.verify({
        email: admin.email,
        code: otpCode,
        purpose: 'reset_password'
      });

      if (!isValidOtp) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Invalid OTP'), 'The OTP code is invalid or expired', STATUS_CODES.BAD_REQUEST)
        );
      }

      const updated = await Admin.updatePassword(admin.admin_id, newPassword);

      return res.status(STATUS_CODES.OK).json(
        success(
          {
            adminId: updated.admin_id,
            email: updated.email,
            updatedAt: updated.updated_at
          },
          'Your password has been reset successfully',
          STATUS_CODES.OK
        )
      );
    } catch (err) {
      logger.error('Password reset failed', { error: err.message });
      next(err);
    }
  }



  static async updateAdminDetails(req, res, next) {
    try {
      const adminId = req.admin?.adminId; // from JWT
      const { fullName, currentPassword, newPassword } = req.body;

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(STATUS_CODES.NOT_FOUND).json(
          error(new Error('Admin not found'), 'Admin not found', STATUS_CODES.NOT_FOUND)
        );
      }

      // If password update is requested
      if (currentPassword && newPassword) {
        const isPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isPasswordValid) {
          return res.status(STATUS_CODES.UNAUTHORIZED).json(
            error(new Error('Invalid current password'), 'Current password is incorrect', STATUS_CODES.UNAUTHORIZED)
          );
        }

        await Admin.updatePassword(adminId, newPassword);
      }

      // If fullName update is requested
      if (fullName) {
        await Admin.updateFullName(adminId, fullName);
      }

      return res.status(STATUS_CODES.OK).json(
        success({ adminId }, 'Admin profile updated successfully', STATUS_CODES.OK)
      );
    } catch (err) {
      next(err);
    }
  }



}

module.exports = AdminController;