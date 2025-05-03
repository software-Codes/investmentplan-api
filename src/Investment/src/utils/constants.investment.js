const WALLET_TYPES = {
  ACCOUNT: "account",
  TRADING: "trading",
  REFERRAL: "referral",
};

const DEPOSIT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};
const TRANSACTION_TYPES = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  INVESTMENT: "investment",
  REFERRAL: "referral",
};
const LIMITS = {
  MIN_DEPOSIT: 10,
  MIN_INVESTMENT: 10,
  MAX_DEPOSIT: 100000,
};
const CURRENCY = {
  DEFAULT: "USDT",
  NETWORK: "TRC20",
};
const REFERRAL = {
  BONUS_PERCENTAGE: 0.10, // 10%
  CODE_LENGTH: 8,
  MINIMUM_WITHDRAWAL: 10
};

module.exports = {
  WALLET_TYPES,
  DEPOSIT_STATUS,
  TRANSACTION_TYPES,
  LIMITS,
  CURRENCY,
  REFERRAL,
};
