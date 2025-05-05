const rateLimit = require('express-rate-limit');

const depositLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many deposit requests, please try again later.'
  }
});

module.exports = {
  depositLimiter
};