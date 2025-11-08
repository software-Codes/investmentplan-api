'use strict';

const cfg = require('../config/wallet.config');

const WALLET_TYPES = Object.freeze(['account', 'trading', 'referral']);

/**
 * Allowed inter-wallet flows.  Represented as "from→to" string keys for quick lookup.
 */
const ALLOWED_FLOWS = Object.freeze({
    'account:trading': true,
    'trading:account': true,
    'referral:account': true,
});

/**
 * Return true if a transfer between two wallet types is permitted.
 * @param {string} from - lower-case wallet type
 * @param {string} to   - lower-case wallet type
 */
function isTransferAllowed(from, to) {
    return !!ALLOWED_FLOWS[`${from}:${to}`];
}

module.exports = {
    WALLET_TYPES,
    isTransferAllowed,
    PRINCIPAL_LOCK_DAYS: cfg.PRINCIPAL_LOCK_DAYS,
    PROFIT_LOCK_DAYS: cfg.PROFIT_LOCK_DAYS,
    MIN_TRADE_USD: cfg.MIN_TRADE_USD,
    MIN_PROFIT_WITHDRAWAL: cfg.MIN_PROFIT_WITHDRAWAL,
    NOTIFY_ENABLED: cfg.NOTIFY_ENABLED,
};
