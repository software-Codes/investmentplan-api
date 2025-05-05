const { body, param } = require('express-validator');
const { LIMITS } = require('../../utils/constants.investment');

const validateDepositSubmission = [
  body('txId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction ID format'),
    
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: LIMITS.MIN_DEPOSIT, max: LIMITS.MAX_DEPOSIT })
    .withMessage(`Amount must be between ${LIMITS.MIN_DEPOSIT} and ${LIMITS.MAX_DEPOSIT}`),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateDepositSubmission
};