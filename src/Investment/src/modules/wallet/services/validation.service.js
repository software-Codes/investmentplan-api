'use strict';

/**
 * ValidationService
 * -----------------
 * Central business-rule checks for inter-wallet transfers.
 * Keeps TransferService readable and enforces a single source of truth.
 */

const { MIN_TRADE_USD } = require('../policies/wallet.policy');
const { WalletError } = require('./wallet.service');

class ValidationService {
    /**
     * Ensure the A→T min amount rule.
     * @param {number} amount
     */
    assertMinForAccountToTrading(amount) {
        if (!(amount >= MIN_TRADE_USD)) {
            throw new WalletError('MIN_TRADE', `Minimum transfer to trading is $${MIN_TRADE_USD.toFixed(2)}`);
        }
    }

    /**
     * Ensure source wallet has at least amount.
     * @param {number} sourceBalance
     * @param {number} amount
     */
    assertSufficient(sourceBalance, amount) {
        if (!(Number(sourceBalance) >= Number(amount))) {
            throw new WalletError('INSUFFICIENT_FUNDS', 'Insufficient funds');
        }
    }

    /**
     * For T→A: only unlocked (profit) can move. available = trading.balance - trading.locked.
     * @param {number} balance
     * @param {number} locked
     * @param {number} amount
     */
    assertTradingHasUnlocked(balance, locked, amount) {
        const available = Math.max(0, Number(balance) - Number(locked));
        if (Number(amount) > available) {
            throw new WalletError('LOCKED_PRINCIPAL', 'Requested amount exceeds unlocked trading funds');
        }
    }
}

module.exports = { ValidationService };
