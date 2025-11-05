const User = require('../models/user.model');
const OTP = require('../models/otp.model');
const jwt = require('jsonwebtoken');
const { addTokenToBlacklist } = require('../helpers/blacklist-auth');
const SupabaseStorageService = require('../services/supabase-storage.service');
const KYCDocument = require('../models/kyc-document.model');
const Wallet = require('../../../Investment/src/models/wallets/wallets.models');

class AuthController {
  // Step 1: Register user
  static async register(req, res) {
    try {
      const { email, phoneNumber, password, fullName } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and full name are required'
        });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please login instead.'
        });
      }

      if (phoneNumber) {
        const existingPhone = await User.findByPhoneNumber(phoneNumber);
        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: 'This phone number is already registered'
          });
        }
      }

      const user = await User.create({ ...req.body, preferredContactMethod: 'email' });

      await OTP.generate({
        userId: user.user_id,
        email: user.email,
        purpose: 'registration',
        delivery: 'email'
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully! Please check your email for verification code.',
        data: {
          userId: user.user_id,
          email: user.email,
          nextStep: 'verify_email'
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to create account. Please try again later.'
      });
    }
  }

  // Step 2: Verify email with OTP
  static async verifyEmail(req, res) {
    try {
      const { userId, otpCode } = req.body;

      if (!userId || !otpCode) {
        return res.status(400).json({
          success: false,
          message: 'User ID and verification code are required'
        });
      }

      const isVerified = await OTP.verify({
        userId,
        code: otpCode,
        purpose: 'registration'
      });

      if (!isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code. Please request a new one.'
        });
      }

      await User.updateVerificationStatus(userId, 'email_verified', true);

      const user = await User.findById(userId);

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! Please upload your verification documents to complete registration.',
        data: {
          userId: user.user_id,
          email: user.email,
          emailVerified: true,
          nextStep: 'upload_documents'
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Verification failed. Please try again.'
      });
    }
  }

  // Step 3: Upload KYC document
  static async uploadDocument(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a document (ID, Passport, or Driver\'s License)'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.email_verified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before uploading documents'
        });
      }

      const storageService = new SupabaseStorageService();

      const uploadResult = await storageService.uploadDocument({
        userId: userId,
        documentType: req.body.documentType,
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype
      });

      const docRecord = await KYCDocument.create({
        userId: userId,
        documentType: req.body.documentType,
        documentCountry: req.body.documentCountry || 'Unknown',
        ...uploadResult,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      });

      await User.updateAccountStatus(userId, 'active');

      return res.status(201).json({
        success: true,
        message: 'Document uploaded successfully! Your account is now active. You can login.',
        data: {
          documentId: docRecord.document_id,
          documentType: docRecord.document_type,
          accountStatus: 'active',
          nextStep: 'login'
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Document upload failed. Please try again.'
      });
    }
  }

  // Step 4: Login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check email verification
      if (!user.email_verified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          data: {
            userId: user.user_id,
            nextStep: 'verify_email'
          }
        });
      }

      // Check KYC documents
      const kycDocs = await KYCDocument.findByUserId(user.user_id);
      if (kycDocs.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Please upload your verification documents before logging in',
          data: {
            userId: user.user_id,
            nextStep: 'upload_documents'
          }
        });
      }

      // Check account status
      if (user.account_status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Your account is ${user.account_status}. Please contact support.`
        });
      }

      // Validate password
      const isPasswordValid = await User.validatePassword(password, user.password_hash);
      if (!isPasswordValid) {
        await User.incrementFailedLoginAttempts(user.user_id);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Create session
      await User.updateLoginInfo(user.user_id, req.ip);
      const session = await User.createSession(user.user_id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const token = AuthController.generateJwtToken(user.user_id, session.session_id);
      const wallets = await Wallet.getUserWallets(user.user_id);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: token,
          tokenType: 'Bearer',
          expiresIn: 604800,
          user: {
            id: user.user_id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            accountStatus: user.account_status,
            emailVerified: user.email_verified,
            kycStatus: kycDocs.length > 0 ? 'submitted' : 'pending',
            createdAt: user.created_at
          },
          wallets: {
            account: wallets.find(w => w.wallet_type === 'account') ? {
              balance: parseFloat(wallets.find(w => w.wallet_type === 'account').balance || 0),
              locked: parseFloat(wallets.find(w => w.wallet_type === 'account').locked_balance || 0)
            } : null,
            trading: wallets.find(w => w.wallet_type === 'trading') ? {
              balance: parseFloat(wallets.find(w => w.wallet_type === 'trading').balance || 0),
              locked: parseFloat(wallets.find(w => w.wallet_type === 'trading').locked_balance || 0)
            } : null,
            referral: wallets.find(w => w.wallet_type === 'referral') ? {
              balance: parseFloat(wallets.find(w => w.wallet_type === 'referral').balance || 0),
              locked: parseFloat(wallets.find(w => w.wallet_type === 'referral').locked_balance || 0)
            } : null
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Login failed. Please try again.'
      });
    }
  }

  // Resend verification email
  static async resendVerification(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      await OTP.generate({
        userId: user.user_id,
        email: user.email,
        purpose: 'registration',
        delivery: 'email'
      });

      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to resend verification code'
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const { sessionId } = req.user;
      const token = req.token;

      await User.invalidateSession(sessionId);
      const tokenExp = req.user.exp ? req.user.exp - Math.floor(Date.now() / 1000) : 3600;
      addTokenToBlacklist(token, tokenExp);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  // Get current user
  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const wallets = await Wallet.getUserWallets(req.user.userId);
      const kycDocs = await KYCDocument.findByUserId(req.user.userId);

      return res.status(200).json({
        success: true,
        data: {
          user: {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            profilePhoto: user.profile_photo_url,
            accountStatus: user.account_status,
            emailVerified: user.email_verified,
            createdAt: user.created_at
          },
          wallets: wallets.map(w => ({
            type: w.wallet_type,
            balance: parseFloat(w.balance || 0),
            lockedBalance: parseFloat(w.locked_balance || 0)
          })),
          kycDocuments: kycDocs.length
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user data'
      });
    }
  }

  // Password reset - initiate
  static async initiatePasswordReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const result = await User.initiatePasswordReset(email);

      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent',
        data: { userId: result.userId }
      });
    } catch (error) {
      // Don't reveal if user exists for security
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent'
      });
    }
  }

  // Password reset - complete
  static async completePasswordReset(req, res) {
    try {
      const { userId, otpCode, newPassword } = req.body;

      if (!userId || !otpCode || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'User ID, verification code, and new password are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      await User.completePasswordReset(userId, otpCode, newPassword);

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      });
    } catch (error) {
      if (error.message === 'Invalid or expired OTP') {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Password reset failed. Please try again.'
      });
    }
  }

  // Update profile (PUT - optional fields with photo)
  static async updateProfile(req, res) {
    try {
      const { fullName, phoneNumber } = req.body;
      const updates = {};

      if (fullName) updates.full_name = fullName;
      if (phoneNumber) updates.phone_number = phoneNumber;

      // Handle photo upload if provided
      if (req.file) {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: 'Only JPG and PNG images are allowed for profile photo'
          });
        }

        const storageService = new SupabaseStorageService();
        const uploadResult = await storageService.uploadProfilePhoto({
          userId: req.user.userId,
          fileBuffer: req.file.buffer,
          fileName: req.file.originalname,
          contentType: req.file.mimetype
        });

        updates.profile_photo_url = uploadResult.publicUrl;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update. Provide fullName, phoneNumber, or photo'
        });
      }

      const updatedUser = await User.updateProfile(req.user.userId, updates);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.user_id,
            fullName: updatedUser.full_name,
            email: updatedUser.email,
            phoneNumber: updatedUser.phone_number,
            profilePhoto: updatedUser.profile_photo_url,
            accountStatus: updatedUser.account_status
          }
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update profile'
      });
    }
  }

  // Delete account
  static async deleteAccount(req, res) {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      await User.deleteAccount(req.user.userId, password);

      const tokenExp = req.user.exp ? req.user.exp - Math.floor(Date.now() / 1000) : 3600;
      addTokenToBlacklist(req.token, tokenExp);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Invalid password') {
        return res.status(401).json({
          success: false,
          message: 'Invalid password. Account deletion failed.'
        });
      }
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account. Please try again.'
      });
    }
  }

  // Get user documents
  static async getUserDocuments(req, res) {
    try {
      const documents = await KYCDocument.findByUserId(req.user.userId);

      return res.json({
        success: true,
        data: {
          documents: documents.map(doc => ({
            id: doc.document_id,
            type: doc.document_type,
            uploadedAt: doc.uploaded_at
          }))
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch documents'
      });
    }
  }

  static generateJwtToken(userId, sessionId) {
    return jwt.sign(
      {
        userId,
        sessionId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' }
    );
  }
}

module.exports = AuthController;
