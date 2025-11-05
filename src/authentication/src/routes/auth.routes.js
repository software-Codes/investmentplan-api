const express = require('express');
const router = express.Router();
const multer = require('multer');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG and PDF files are allowed'), false);
    }
    cb(null, true);
  }
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Public routes
router.post('/register', AuthController.register);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerification);
router.post('/upload-document', upload.single('document'), handleUploadError, AuthController.uploadDocument);
router.post('/login', AuthController.login);
router.post('/password-reset/initiate', AuthController.initiatePasswordReset);
router.post('/password-reset/complete', AuthController.completePasswordReset);

// Protected routes
router.get('/me', authenticate, AuthController.getCurrentUser);
router.put('/profile', authenticate, upload.single('photo'), handleUploadError, AuthController.updateProfile);
router.delete('/account', authenticate, AuthController.deleteAccount);
router.post('/logout', authenticate, AuthController.logout);
router.get('/documents', authenticate, AuthController.getUserDocuments);

module.exports = router;
