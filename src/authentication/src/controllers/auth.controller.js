const User = require('../models/user.model');
const OTP = require('../models/otp.model');
const jwt = require('jsonwebtoken');
const { addTokenToBlacklist } = require('../helpers/blacklist-auth');
const AzureBlobStorageService = require('../services/azure-blob-storage-kyc/azure-blob-storage.service');
const KYCDocument = require('../models/kyc-document.model');
const Wallet = require('../../../Investment/src/models/wallets/wallets.models');

class AuthController {
  static async register(req, res) {
    try {
      const { email, phoneNumber, password, preferredContactMethod } = req.body;

      if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required' });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      const existingPhone = await User.findByPhoneNumber(phoneNumber);
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number already registered' });
      }

      const user = await User.create(req.body);
      const deliveryMethod = preferredContactMethod === 'phone' ? 'sms' : 'email';

      await OTP.generate({
        userId: user.user_id,
        email: deliveryMethod === 'email' ? user.email : null,
        phone: deliveryMethod === 'sms' ? user.phone_number : null,
        purpose: 'registration',
        delivery: deliveryMethod
      });

      return res.status(201).json({
        success: true,
        user: {
          userId: user.user_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number
        },
        message: `Verification code sent via ${deliveryMethod}`
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      if (!user.email_verified && !user.phone_verified) {
        return res.status(403).json({
          success: false,
          message: 'Account not verified',
          userId: user.user_id,
          requiresVerification: true
        });
      }

      if (user.account_status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.account_status}`
        });
      }

      const isPasswordValid = await User.validatePassword(password, user.password_hash);
      if (!isPasswordValid) {
        await User.incrementFailedLoginAttempts(user.user_id);
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      await User.updateLoginInfo(user.user_id, req.ip);

      const session = await User.createSession(user.user_id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const token = this.generateJwtToken(user.user_id, session.session_id);
      const accountCompletion = await User.getAccountCompletionStatus(user.user_id);

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            accountStatus: user.account_status
          },
          session: {
            sessionId: session.session_id,
            expiresAt: session.expires_at
          },
          accountCompletion
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyOtp(req, res) {
    try {
      const { userId, otpCode, purpose } = req.body;

      const isVerified = await OTP.verify({ userId, code: otpCode, purpose });
      if (!isVerified) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (purpose === 'registration') {
        const field = user.preferred_contact_method === 'email' ? 'email_verified' : 'phone_verified';
        await User.updateVerificationStatus(userId, field, true);
        await User.updateAccountStatus(userId, 'active');

        return res.status(200).json({
          success: true,
          message: 'Account verified successfully',
          data: { userId: user.user_id, accountStatus: 'active' }
        });
      }

      return res.status(200).json({ success: true, message: 'OTP verified' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async logout(req, res) {
    try {
      const { sessionId, exp } = req.user;
      const token = req.token;

      await User.invalidateSession(sessionId);
      const tokenExp = exp ? exp - Math.floor(Date.now() / 1000) : 3600;
      addTokenToBlacklist(token, tokenExp);

      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async initiatePasswordReset(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const result = await User.initiatePasswordReset(email);
      return res.status(200).json({
        success: true,
        message: 'Password reset OTP sent',
        data: result
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async completePasswordReset(req, res) {
    try {
      const { userId, otpCode, newPassword } = req.body;
      if (!userId || !otpCode || !newPassword) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      await User.completePasswordReset(userId, otpCode, newPassword);
      return res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const accountCompletion = await User.getAccountCompletionStatus(req.user.userId);
      const wallets = await Wallet.getUserWallets(req.user.userId);

      return res.status(200).json({
        success: true,
        user: {
          userId: user.user_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          accountStatus: user.account_status,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified
        },
        wallets,
        accountCompletion
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      await User.deleteAccount(req.user.userId, password);
      return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Document file is required' });
      }

      const azureService = new AzureBlobStorageService({
        accountName: process.env.AZURE_STORAGE_ACCOUNT,
        accountKey: process.env.AZURE_STORAGE_KEY,
        containerName: process.env.AZURE_KYC_CONTAINER
      });

      const uploadResult = await azureService.uploadDocument({
        userId: req.user.userId,
        documentType: req.body.documentType,
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype
      });

      const docRecord = await KYCDocument.create({
        userId: req.user.userId,
        documentType: req.body.documentType,
        documentCountry: req.body.documentCountry,
        ...uploadResult,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      });

      await User.updateAccountStatus(req.user.userId, 'active');

      return res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        document: {
          id: docRecord.document_id,
          type: docRecord.document_type,
          url: docRecord.blob_storage_url
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUserDocuments(req, res) {
    try {
      const documents = await KYCDocument.findByUserId(req.user.userId);
      return res.json({
        success: true,
        documents: documents.map(doc => ({
          id: doc.document_id,
          type: doc.document_type,
          uploadedAt: doc.uploaded_at
        }))
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
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
