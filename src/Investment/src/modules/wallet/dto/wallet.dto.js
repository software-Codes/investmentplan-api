'use strict';

/**
 * DTO helpers shape outgoing JSON so controllers stay tiny.
 */

const { round2 } = require('../utils/wallet.utils');

/**
 * Balance DTO – returns wallet balances in a single object.
 * @param {object} param0
 * @param {number|string} param0.account
 * @param {number|string} param0.trading
 * @param {number|string} param0.tradingLocked
 * @param {number|string} param0.referral
 */
function makeBalanceDTO({ account, trading, tradingLocked, referral }) {
    return {
        account: round2(account),
        trading: {
            total: round2(trading),
            locked: round2(tradingLocked),
            available: round2(trading - tradingLocked),
        },
        referral: round2(referral),
    };
}

/**
 * Transfer response DTO.
 * @param {object} param0
 * @param {string}  param0.transferId
 * @param {string}  param0.from
 * @param {string}  param0.to
 * @param {number}  param0.amount
 * @param {object}  param0.newBalances – object from makeBalanceDTO
 */
function makeTransferDTO({ transferId, from, to, amount, newBalances }) {
    return {
        transferId,
        from,
        to,
        amount: round2(amount),
        balances: newBalances,
        message: `Transferred $${round2(amount)} from ${from} to ${to}.`,
    };
}

module.exports = { makeBalanceDTO, makeTransferDTO };
