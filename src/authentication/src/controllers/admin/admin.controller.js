const Admin = require('../../models/admin/Admin');
const OTP = require('../../models/otp.model');
const { success, error, STATUS_CODES } = require('../../utils/response.util');
const { generateAdminToken } = require('../../utils/admin/token.util')
const bcrypt = require('bcrypt')
const { query } = require('../../Config/neon-database')


class AdminController {


  static async register(req, res, next) {
    try {
      const { fullName, email, password, role } = req.body;




      const existingAdmin = await Admin.findByEmail(email);
      if (existingAdmin) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          error(new Error('Admin exists'), 'An admin with this email already exists', STATUS_CODES.BAD_REQUEST)
        );
      }

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
      next(error);
    }
  }



  static async login(req, res, next) {
    try {
      const { email, password } = req.body;


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

      const token = generateAdminToken(admin);


      return res.status(STATUS_CODES.OK).json(
        success(
          {
            token,
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
      next(err);
    }
  }


  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;



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



      return res.status(STATUS_CODES.OK).json(
        success(null, 'Password-reset code sent to your email', STATUS_CODES.OK)
      );

    } catch (err) { next(err); }
  }

  static async resetPassword(req, res, next) {
    try {
      const { email, otpCode, newPassword } = req.body;


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
      next(err);
    }
  }



  static async updateAdminDetails(req, res, next) {
    try {
      const adminId = req.admin?.adminId;
      const { fullName, currentPassword, newPassword } = req.body;

      const admin = await Admin.findById(adminId);


      if (currentPassword && newPassword) {
        const isPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isPasswordValid) {
          return res.status(STATUS_CODES.UNAUTHORIZED).json(
            error(new Error('Invalid current password'), 'Current password is incorrect', STATUS_CODES.UNAUTHORIZED)
          );
        }

        await Admin.updatePassword(adminId, newPassword);
      }

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


  static async getProfile(req, res, next) {
    try {
      const { adminId } = req.admin;


      const admin = await Admin.findById(adminId);


      return res.status(STATUS_CODES.OK).json(
        success(
          {
            adminId: admin.admin_id,
            fullName: admin.full_name,
            email: admin.email,
            role: admin.role,
            createdAt: admin.created_at,
            updatedAt: admin.updated_at,
          },
          'Admin profile fetched successfully',
          STATUS_CODES.OK
        )
      );
    } catch (err) {
      next(err);
    }
  }

 static async deleteAccount(req, res, next) {
  try {
    const { adminId } = req.admin;

    if (!adminId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json(
        error(new Error('Unauthorized'), 'Missing admin identity in token', STATUS_CODES.UNAUTHORIZED)
      );
    }

    const deleted = await Admin.deleteById(adminId);

    if (!deleted) {
      return res.status(STATUS_CODES.NOT_FOUND).json(
        error(new Error('Admin not found'), `Admin not found for ID: ${adminId}`, STATUS_CODES.NOT_FOUND)
      );
    }

    return res.status(STATUS_CODES.NO_CONTENT).send();
 
    
  } catch (err) {
    next(err);
  }
}





}

module.exports = AdminController;