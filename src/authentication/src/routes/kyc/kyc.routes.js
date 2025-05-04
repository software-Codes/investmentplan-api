const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../../middleware/auth.middleware");
const AuthController = require("../../controllers/auth.controller");

/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: KYC verification endpoints
 * 
 * components:
 *   schemas:
 *     KYCDocument:
 *       type: object
 *       properties:
 *         documentId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         documentType:
 *           type: string
 *           enum: [passport, nationalId, drivingLicense, utility]
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         fileUrl:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const allowedDocTypes = ['passport', 'nationalId', 'drivingLicense', 'utility'];
    
    // Validate file type
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPG, PNG and PDF files are allowed'), false);
      return;
    }

    // Validate document type from form data
    if (!req.body.documentType || !allowedDocTypes.includes(req.body.documentType)) {
      cb(new Error('Invalid document type specified'), false);
      return;
    }

    cb(null, true);
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

/**
 * @swagger
 * /api/v1/kyc/documents:
 *   post:
 *     summary: Upload KYC document
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - documentFile
 *               - documentType
 *             properties:
 *               documentFile:
 *                 type: string
 *                 format: binary
 *               documentType:
 *                 type: string
 *                 enum: [passport, nationalId, drivingLicense, utility]
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 document:
 *                   $ref: '#/components/schemas/KYCDocument'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/documents",
  authenticate,
  upload.single('documentFile'),
  handleMulterErrors,
  AuthController.uploadDocument
);

/**
 * @swagger
 * /api/v1/kyc/documents:
 *   get:
 *     summary: Get user's KYC documents
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's KYC documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KYCDocument'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/documents", 
  authenticate, 
  AuthController.getUserDocuments
);

/**
 * @swagger
 * /api/v1/kyc/status:
 *   get:
 *     summary: Get user's KYC verification status
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's KYC status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [none, pending, approved, rejected]
 *                 message:
 *                   type: string
 */
router.get(
  "/status",
  authenticate,
  AuthController.getDocumentStatus
);

module.exports = router;