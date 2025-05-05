const express = require("express");
const router = express.Router();
const {
  authenticate,
} = require("../../../../authentication/src/middleware/auth.middleware");
const DepositController = require("../../controllers/deposit/deposit.controllers");
const {
  validateDepositSubmission,
} = require("../../middleware/validation/deposit.validation");
const { depositLimiter } = require("../../middleware/rate-limiter/rate-limiter");

/**
 * @swagger
 * tags:
 *   name: Deposits
 *   description: Deposit management endpoints
 */

/**
 * @swagger
 * /api/v1/deposit/address:
 *   get:
 *     summary: Get admin deposit address
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin deposit address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     network:
 *                       type: string
 *                     minimumDeposit:
 *                       type: number
 *                     maximumDeposit:
 *                       type: number
 */
router.get(
  "/address",
  authenticate,
  depositLimiter,
  DepositController.getDepositAddress
);

/**
 * @swagger
 * /api/v1/deposit/submit:
 *   post:
 *     summary: Submit a deposit transaction
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - txId
 *               - amount
 *             properties:
 *               txId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Deposit submitted successfully
 *       400:
 *         description: Invalid request or verification failed
 */
router.post(
  "/submit",
  authenticate,
  depositLimiter,
  validateDepositSubmission,
  DepositController.submitDeposit
);

/**
 * @swagger
 * /api/v1/deposit/history:
 *   get:
 *     summary: Get user's deposit history
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Deposit history retrieved successfully
 */
router.get("/history", authenticate, DepositController.getDepositHistory);

/**
 * @swagger
 * /api/v1/deposit/status/{depositId}:
 *   get:
 *     summary: Get deposit status by ID
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deposit status retrieved successfully
 */
router.get(
  "/status/:depositId",
  authenticate,
  DepositController.getDepositStatus
);

/**
 * @swagger
 * /api/v1/deposit/verify/{txId}:
 *   get:
 *     summary: Verify deposit transaction
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction verification status
 */
router.get(
  "/verify/:txId",
  authenticate,
  depositLimiter,
  DepositController.verifyDeposit
);

module.exports = router;
