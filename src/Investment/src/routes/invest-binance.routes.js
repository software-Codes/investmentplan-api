const express = require('express');
const router = express.Router();
const auth = require('../../../authentication/src/middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/deposit/address:
 *   get:
 *     summary: Get admin deposit address
 *     tags: [Deposit]
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
 *                 address:
 *                   type: string
 *                   description: USDT TRC20 deposit address
 *                 network:
 *                   type: string
 *                   example: TRC20
 */
router.get('/address', auth, DepositController.getDepositAddress);

/**
 * @swagger
 * /api/v1/deposit/submit:
 *   post:
 *     summary: Submit deposit transaction hash
 *     tags: [Deposit]
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
 *                 description: Binance transaction hash
 *               amount:
 *                 type: number
 *                 description: Deposit amount
 *     responses:
 *       200:
 *         description: Deposit verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 */
router.post('/submit', auth, DepositController.submitDeposit);