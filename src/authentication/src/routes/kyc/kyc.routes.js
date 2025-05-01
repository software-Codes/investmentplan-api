const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../../middleware/auth.middleware");
const AuthController = require("../../controllers/auth.controller");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG and PDF files are allowed'), false);
    }
  }
});

// Handle multer errors
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === "LIMIT_FILE_SIZE" 
        ? "File too large. Maximum size is 5MB."
        : `File upload error: ${err.message}`
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

// Routes
router.post(
  "/documents",
  authenticate,
  upload.single('documentFile'),
  handleMulterErrors,
  AuthController.uploadDocument
);

router.get(
  "/documents", 
  authenticate, 
  AuthController.getUserDocuments
);

module.exports = router;