/**
 * @file kyc.routes.js
 * @description Routes for KYC document management
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../../middleware/auth.middleware");
const AuthController = require("../../controllers/auth.controller");

// Configure multer for memory storage (files stored as buffers)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Image files and PDFs are allowed"), false);
    }
  },
});
//handle multer errors
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`,
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

//upload  a new kyc document
router.post(
  "/documents",
  authenticate,
  upload.single("documentFile"),
  handleMulterErrors,
  AuthController.uploadDocument
);
//get verification status of a specific document
router.get(
  "/documents/:documentId",
  authenticate,
  AuthController.getDocumentStatus
);

//get all documents for the authenticated user
router.get("documents", authenticate, AuthController.getUserDocuments);

//webhook endpoint for smile id callbacks
router.post(
  "/verification-callback",
  express.json(),
  AuthController.handleVerificationCallback
);

module.exports = router;
