const User = require("../models/user.model");
const OTP = require("../models/otp.model");
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");
const { validate } = require("express-validation");
const { error } = require("../utils/response.util");
const { addTokenToBlacklist } = require("../helpers/blacklist-auth");
const AzureBlobStorageService = require("../services/azure-blob-storage-kyc/azure-blob-storage.service");
const KYCDocument = require("../models/kyc-document.model");
const Wallet = require("../../../Investment/src/models/wallets/wallets.models");


class AuthController {

  static async register(req, res, next) {
    try {
      const userData = req.body;

      if (!userData.password) {
        return next(new Error("Password is required"));
      }

      const existingUser = await User.findbyEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `User already exists, please log in to your account with the email: ${existingUser.email}`,
        });
      }
      //check for exist  phone number
      const existingUserPhone = await User.findByPhoneNumber(
        userData.phoneNumber
      );
      if (existingUserPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists to another user",
        });
      }

      const user = await User.create(userData);

      let deliveryMethod, contactDetail;
      if (userData.preferredContactMethod === "email") {
        deliveryMethod = "email";
        contactDetail = user.email;
      } else if (userData.preferredContactMethod === "phone") {
        deliveryMethod = "sms";
        contactDetail = user.phone_number;
      } else {
        return next(new Error("Invalid contact method"));
      }

      const otpData = {
        userId: user.user_id,
        purpose: "registration",
        deliveryMethod: deliveryMethod,
      };

      if (deliveryMethod === "email") {
        otpData.email = contactDetail;
      } else {
        otpData.phoneNumber = contactDetail;
      }

      await OTP.generate(otpData);

      return res.status(201).json({
        success: true,
        user: {
          userId: user.user_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          preferredContactMethod: user.preferred_contact_method,
          accountStatus: user.account_status,
        },
        message: `Verification code sent via ${deliveryMethod} verify your account to be able to login and access the investment platform`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Error occurred during registration: ${error.message}`,
      });

      next(error);
    }
  }
 
  
  // Fixed AuthController login method
  static async login(req, res, next) {
    try {
      const credentials = req.body;
      //find user by email
      const user = await User.findbyEmail(credentials.email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
      // Check if the user has verified their account
      if (!user.email_verified && !user.phone_verified) {
        return res.status(403).json({
          success: false,
          message: "Account not verified. Please verify your account first.",
          userId: user.user_id,
          requiresVerification: true,
        });
      }
      // Check if account is active
      if (user.account_status !== "active") {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.account_status}. Please contact support.`,
        });
      }
      // Verify password
      const isPasswordValid = await User.validatePassword(
        credentials.password,
        user.password_hash
      );
      if (!isPasswordValid) {
        // Increment failed login attempts
        await User.incrementFailedLoginAttempts(user.user_id);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
      // Reset failed login attempts on successful login
      await User.updateLoginInfo(user.user_id, req.ip);
      // Create session and return JWT token
      const session = await User.createSession(user.user_id, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      //Generate JWT token
      const token = AuthController.generateJwtToken(
        user.user_id,
        session.session_id
      );

      // Get account completion status
      const accountCompletion = await User.getAccountCompletionStatus(
        user.user_id
      );

      // FIXED: Return proper data structure that matches frontend expectations
      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            preferredContactMethod: user.preferred_contact_method,
            accountStatus: user.account_status,
            email_verified: user.email_verified,
            phone_verified: user.phone_verified,
          },
          session: {
            sessionId: session.session_id,
            expiresAt: session.expires_at,
          },
          accountCompletion,
        }
        
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: `Error occurred during login ${error.message}`,
      });
    }
  }
 
  static async resendVerification(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.email_verified || user.phone_verified) {
        return res.status(400).json({
          success: false,
          message: "Account is already verified",
        });
      }

      const otpData = {
        userId: user.user_id,
        purpose: "registration",
        deliveryMethod:
          user.preferred_contact_method === "email" ? "email" : "sms",
      };

      if (otpData.deliveryMethod === "email") {
        otpData.email = user.email;
      } else {
        otpData.phoneNumber = user.phone_number;
      }

      await OTP.generate(otpData);

      return res.status(200).json({
        success: true,
        message: `Verification code sent via ${otpData.deliveryMethod}`,
        userId: user.user_id,
      });
    } catch (error) {
      logger.error(`Error in resendVerification: ${error.message}`, { error });
      next(error);
    }
  }

  static async verifyOtp(req, res, next) {
    try {
      const { userId, otpCode, purpose } = req.body;

      const isVerified = await OTP.verify({
        userId,
        otpCode,
        purpose,
      });

      if (!isVerified) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP code",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (purpose === "registration") {
        if (user.preferred_contact_method === "email") {
          await User.updateVerificationStatus(userId, "email_verified", true);
        } else {
          await User.updateVerificationStatus(userId, "phone_verified", true);
        }

        await User.updateAccountStatus(userId, "active");

        return res.status(200).json({
          success: true,
          message: "Account verified successfully. You can now log in.",
          data: {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            preferredContactMethod: user.preferred_contact_method,
            accountStatus: "active",
          },
        });
      } else if (purpose === "reset_password") {
        const tempToken = this.generateJwtToken(userId, null, 300); 

        return res.status(200).json({
          success: true,
          message:
            "OTP verified successfully. You can now reset your password.",
          data: {
            userId: user.user_id,
            tempToken,
          },
        });
      } else {
        const session = await User.createSession(user.user_id, {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        const token = this.generateJwtToken(user.user_id, session.session_id);

        const accountCompletion = await User.getAccountCompletionStatus(
          user.user_id
        );

        return res.status(200).json({
          success: true,
          message: "OTP verified successfully.",
          data: {
            user: {
              userId: user.user_id,
              fullName: user.full_name,
              email: user.email,
              phoneNumber: user.phone_number,
              preferredContactMethod: user.preferred_contact_method,
              accountStatus: user.account_status,
            },
            accountCompletion,
            token,
            session: {
              sessionId: session.session_id,
              expiresAt: session.expires_at,
            },
          },
        });
      }
    } catch (err) {
      logger.error(`Error in verifyOtp: ${err.message}`, { error: err });
      return res.status(500).json({
        success: false,
        message: `error occured while verifying the otp code${err.message}`,
      });
    }
  }

  static async logout(req, res, next) {
    try {
      const sessionId = req.user.sessionId;
      const token = req.token;

      const isInvalidated = await User.invalidateSession(sessionId);

      const tokenExp = req.user.exp
        ? req.user.exp - Math.floor(Date.now() / 1000)
        : 3600;

      addTokenToBlacklist(token, tokenExp);

      if (!isInvalidated) {
        logger.warn(
          `Logout failed: Session not found or already invalidated for sessionId: ${sessionId}`
        );
        return res.status(404).json({
          success: false,
          message: `session invalidated or not found ${error.message}`,
        });
      }

      logger.info(
        `User ${req.user.userId} logged out successfully. Session ID: ${sessionId}`
      );

      return res.status(200).json({
        success: true,
        message: "You have been logged out successfully.",
      });
    } catch (error) {
      logger.error(
        `Logout error for user ${req.user?.userId || "unknown"}: ${error.message
        }`,
        { error }
      );

      return res.status(500).json({
        success: false,
        message: "An error occurred while logging out. Please try again later.",
      });
    }
  }
  static async logoutAllDevices(req, res, next) {
    try {
      const userId = req.user.userId;
      const currentSessionId = req.user.sessionId;

      const result = await User.invalidateAllOtherSessions(
        userId,
        currentSessionId
      );

      return res.status(200).json({
        success: true,
        message: `Successfully logged out from ${result} other devices`,
        invalidatedSessions: result,
      });
    } catch (error) {
      logger.error(`Logout all devices failed: ${error.message}`);
      next(error);
    }
  }


  static async initiateRecovery(recoveryData) {
    try {
      let user;
      if (recoveryData.email) {
        user = await User.findbyEmail(recoveryData.email);
      } else if (recoveryData.phoneNumber) {
        user = await User.findByPhoneNumber(recoveryData.phoneNumber);
      }

      if (!user) {
        throw new Error("No account found with the provided information");
      }

      if (user.account_status !== "active") {
        throw new Error(
          `Account is ${user.account_status}. Please contact support.`
        );
      }

      const otpData = {
        userId: user.user_id,
        purpose: "reset_password",
        deliveryMethod: recoveryData.method,
      };

      if (otpData.deliveryMethod === "email") {
        otpData.email = user.email;
      } else {
        otpData.phoneNumber = user.phone_number;
      }

      await OTP.generate(otpData);

      return {
        success: true,
        userId: user.user_id,
        method: recoveryData.method,
        destination:
          recoveryData.method === "email"
            ? User._maskEmail(user.email)
            : User._maskPhoneNumber(user.phone_number),
        message: `Recovery code sent via ${recoveryData.method}`,
      };
    } catch (error) {
      logger.error(`Recovery initiation failed: ${error.message}`);
      throw new Error(`Recovery initiation failed: ${error.message}`);
    }
  }


  static async completeRecovery(recoveryData) {
    try {
      const isVerified = await OTP.verify({
        otpCode: recoveryData.otpCode,
        purpose: "reset_password",
        userId: recoveryData.userId,
      });

      if (!isVerified) {
        throw new Error("Invalid or expired recovery code");
      }

      // Update password
      await User.changePassword(recoveryData.userId, recoveryData.newPassword);

      // Update login info
      await User.updateLoginInfo(recoveryData.userId, recoveryData.ipAddress);

      return {
        success: true,
        message: "Password has been successfully reset",
      };
    } catch (error) {
      logger.error(`Recovery completion failed: ${error.message}`);
      throw new Error(`Recovery completion failed: ${error.message}`);
    }
  }

  /**
   * Generate JWT token for authenticated sessions
   * @param {string} userId - User's unique ID
   * @param {string} sessionId - Session ID
   * @returns {string} JWT token
   * @private
   */
  static generateJwtToken(userId, sessionId) {
    const payload = {
      userId,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: "HS256",
    });
  }

  /**
   * Validate JWT token and return user data
   * @param {string} token - JWT token to validate
   * @returns {Promise<Object>} Decoded token payload
   */
  static async validateJwtToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      logger.error(`Token validation failed: ${error.message}`);
      throw new Error("Invalid or expired token");
    }
  }
  /**
   * Initiates the password reset process by generating an OTP.
   *
   * This function validates the provided user ID, generates an OTP for password reset,
   * and sends it to the user's preferred contact method (email or phone).
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response with the result of the operation.
   *
   * @throws {Error} Throws an error if the user ID is missing or if the password reset initiation fails.
   */
  static async initiatePasswordReset(req, res, next) {
    try {
      const { email, phoneNumber } = req.body;

      // Validate that the user ID is provided
      if (!email && !phoneNumber) {
        return next(new Error(" email, or phone number is required"));
      }

      // Initiate the password reset process
      const result = await User.initiatePasswordReset(email, phoneNumber);

      // Respond with success and OTP delivery details
      return res.status(200).json({
        success: true,
        message:
          "Password reset initiated. OTP sent to your preferred contact method.",
        data: {
          userId: result.userId,
          method: result.method,
          destination: result.destination,
        },
      });
    } catch (error) {
      // Pass the error to the next middleware
      next(error);
    }
  }

  /**
   * Completes the password reset process by verifying the OTP and updating the password.
   *
   * This function validates the provided user ID, OTP code, and new password.
   * It verifies the OTP and updates the user's password in the database.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Sends a JSON response with the result of the operation.
   *
   * @throws {Error} Throws an error if any required fields are missing or if the password reset process fails.
   */
  static async completePasswordReset(req, res, next) {
    try {
      const { userId, otpCode, newPassword } = req.body;

      // Validate that all required fields are provided
      if (!userId || !otpCode || !newPassword) {
        return next(new Error("Missing required fields"));
      }

      // Complete the password reset process
      const result = await User.completePasswordReset(
        userId,
        otpCode,
        newPassword
      );

      // Respond with success
      return res.status(200).json({
        success: true,
        message: "Password reset successfully.Login again",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `could not reset your password: ${error.message}`,
      });
      // Pass the error to the next middleware
      next(error);
    }
  }

  //get user details
  static async getCurrentUser(req, res, next) {
    try {
      const userId = req.user.userId;

      // Get user info
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get account completion status
      const accountCompletion = await User.getAccountCompletionStatus(userId);

      // Get user wallets
      const wallets = await Wallet.getUserWallets(userId);

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
        wallets,
        accountCompletion,
      });
    } catch (error) {
      next(error);
    }
  }
  //delete user account
  static async deleteAccount(req, res, next) {
    try {
      const { userId } = req.user;
      const { password } = req.body;

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
      logger.error(`Error deleting account: ${error.message}`);
      next(error); // Ensure this is only called if no response has been sent
    }
  }
  // In auth.controller.js add these methods
  static async uploadDocument(req, res, next) {
    try {
      const { user } = req;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Document file is required",
          acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
          maxSize: "5MB",
        });
      }

      const documentFile = req.file;

      // Initialize Azure service
      const azureService = new AzureBlobStorageService({
        accountName: process.env.AZURE_STORAGE_ACCOUNT,
        accountKey: process.env.AZURE_STORAGE_KEY,
        containerName: process.env.AZURE_KYC_CONTAINER,
      });

      // Upload document to Azure
      const uploadResult = await azureService.uploadDocument({
        userId: user.userId,
        documentType: req.body.documentType,
        fileBuffer: documentFile.buffer,
        fileName: documentFile.originalname,
        contentType: documentFile.mimetype,
      });

      // Save document record to database
      const docRecord = await KYCDocument.create({
        userId: user.userId,
        documentType: req.body.documentType,
        documentCountry: req.body.documentCountry,
        ...uploadResult,
        fileSize: documentFile.size,
        fileType: documentFile.mimetype,
      });

      // Mark account as active immediately after document upload
      await User.updateAccountStatus(user.userId, "active");

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully. Your account is now active.",
        document: {
          id: docRecord.document_id,
          type: docRecord.document_type,
          url: docRecord.blob_storage_url,
        },
      });
    } catch (error) {
      logger.error(`Document upload failed: ${error.message}`);
      next(error);
    }
  }
  static async getDocumentStatus(req, res, next) {
    try {
      const KYCDocument = require("../models/kyc-document.model");
      const document = await KYCDocument.findById(req.params.documentId);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      res.json({
        success: true,
        document: {
          status: document.verification_status,
          type: document.document_type,
          verifiedAt: document.verified_at,
          notes: document.verification_notes,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserDocuments(req, res, next) {
    try {
      const KYCDocument = require("../models/kyc-document.model");
      const documents = await KYCDocument.findByUserId(req.user.userId);

      res.json({
        success: true,
        documents: documents.map((doc) => ({
          id: doc.document_id,
          type: doc.document_type,
          status: doc.verification_status,
          uploadedAt: doc.uploaded_at,
          verifiedAt: doc.verified_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
