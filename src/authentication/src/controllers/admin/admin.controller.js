/**
 * @file admin.controller.js
 * @description Controller for admin-related operations, including managing users, retrieving user details, and performing administrative actions.
 */

const User = require("../../models/user.model");
const Admin = require("../../models/admin/Admin");
const jwt = require("jsonwebtoken");

class AdminController {
  /**
   * Registers a new admin user.
   *
   * This function validates the provided admin data, checks if an admin with the same email already exists,
   * and creates a new admin account if the email is not already registered.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response containing the newly created admin's details and a success message.
   *
   * @throws {Error} Throws an error if the password is missing, the email is already registered, or if an unexpected error occurs.
   */
  static async registerAdmin(req, res, next) {
    try {
      const adminData = req.body;

      // Validate that a password is provided
      if (!adminData.password) {
        return next(new Error("Password is required"));
      }

      // Check if an admin with the same email already exists
      const existingAdmin = await Admin.findByEmail(adminData.email);
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Admin user already exists",
        });
      }

      // Create a new admin account
      const newAdmin = await Admin.create(adminData);

      // Respond with the newly created admin's details
      return res.status(201).json({
        success: true,
        admin: {
          adminId: newAdmin.admin_id,
          fullName: newAdmin.full_name,
          email: newAdmin.email,
        },
        message: "Admin registered successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to register admin${error.message}`,
      });
      // Pass any errors to the next middleware
      next(error);
    }
  }
  /**
   * Authenticates an admin user and generates a JWT token.
   *
   * This function validates the provided email and password, checks if the admin exists,
   * verifies the password, and generates a JWT token for the authenticated admin.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response containing the JWT token and admin details if authentication is successful.
   *
   * @throws {Error} Throws an error if the email or password is invalid, or if an unexpected error occurs.
   */
  static async adminLogin(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Find admin by email
        const admin = await Admin.findByEmail(email);
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Verify password
        const isPasswordValid = await Admin.validatePassword(password, admin.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { adminId: admin.admin_id, email: admin.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            token,
            admin: {
                adminId: admin.admin_id,
                fullName: admin.full_name,
                email: admin.email,
            },
        });
    } catch (error) {
        next(error);
    }
}
  /**
   * Logs out a specific user by invalidating their session.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response indicating the success or failure of the operation.
   *
   * @throws {Error} Throws an error if the session invalidation fails or if an unexpected error occurs.
   */
  static async logoutUser(req, res, next) {
    try {
      const { userId, sessionId } = req.body;

      // Invalidate the user's session
      const isInvalidated = await User.invalidateSession(sessionId);

      if (!isInvalidated) {
        return res.status(404).json({
          success: false,
          message: "Session not found or already invalidated",
        });
      }

      return res.status(200).json({
        success: true,
        message: "User logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a user's account and all associated data.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response indicating the success or failure of the operation.
   *
   * @throws {Error} Throws an error if the account deletion fails or if an unexpected error occurs.
   */
  static async deleteUser(req, res, next) {
    try {
      const { userId, password } = req.body;

      // Delete the user's account
      const isDeleted = await User.deleteAccount(userId, password);
      if (!isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Failed to delete account",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves detailed information about a specific user.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response containing the user's details, wallet balances, and account completion status.
   *
   * @throws {Error} Throws an error if the user is not found or if an unexpected error occurs.
   */
  static async getUserDetails(req, res, next) {
    try {
      const { userId } = req.params;

      // Retrieve the user's details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Retrieve wallet balances and account completion status
      const walletBalances = await User.getWalletBalances(userId);
      const accountCompletion = await User.getAccountCompletionStatus(userId);

      return res.status(200).json({
        success: true,
        user: {
          userId: user.user_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          preferredContactMethod: user.preferred_contact_method,
          accountStatus: user.account_status,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          createdAt: user.created_at,
          lastLogin: user.last_login_at,
        },
        walletBalances,
        accountCompletion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves a list of all users in the system.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response containing a list of all users.
   *
   * @throws {Error} Throws an error if the query fails or if an unexpected error occurs.
   */
  static async getAllUsers(req, res, next) {
    try {
      const queryText = `
        SELECT 
          user_id, 
          full_name, 
          email, 
          phone_number, 
          preferred_contact_method, 
          email_verified, 
          phone_verified, 
          account_status, 
          created_at, 
          last_login_at
        FROM users;
      `;

      // Execute the query to retrieve all users
      const result = await query(queryText);
      return res.status(200).json({
        success: true,
        users: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }

  //get admin profile
  static async getAdminProfile(req, res, next) {
    try {
      const admin = await Admin.findById(req.admin.adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found"
        });
      }
  
      return res.status(200).json({
        success: true,
        admin: {
          adminId: admin.admin_id,
          fullName: admin.full_name,
          email: admin.email,
          role: admin.role,
          createdAt: admin.created_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
  //get user documents
  static async getUserDocuments(req, res, next) {
    try {
      const { userId } = req.params;
      const documents = await KYCDocument.findByUserId(userId);
  
      return res.status(200).json({
        success: true,
        documents: documents.map(doc => ({
          id: doc.document_id,
          type: doc.document_type,
          url: doc.blob_storage_url,
          uploadedAt: doc.uploaded_at
        }))
      });
    } catch (error) {
      next(error);
    }
  }
  static async updateUserStatus(req, res, next) {
    try {
      const { userId, status } = req.body;
      
      if (!['active', 'suspended', 'deactivated'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value"
        });
      }
  
      await User.updateAccountStatus(userId, status);
  
      return res.status(200).json({
        success: true,
        message: `User status updated to ${status}`
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
