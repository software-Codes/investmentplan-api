const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../../authentication/src/middleware/auth.middleware');
const DepositController = require('../../controllers/deposit/deposit.controllers');

router.get('/address', authenticate, DepositController.getDepositAddress);
router.post('/submit', authenticate, DepositController.submitDeposit);
router.get('/history', authenticate, DepositController.getDepositHistory);
// router.get('/status', authenticate, DepositController.g);

module.exports = router;