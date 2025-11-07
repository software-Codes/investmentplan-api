'use strict';

/**
 * DTOs for request/response shapes.
 * These are plain factories to keep controllers clean and consistent.
 */

const DepositStatus = Object.freeze({
    PENDING: 'pending',
    PROCESSING: 'processing',
    CONFIRMED: 'completed',
    FAILED: 'failed',
});

function makeSubmitDepositResponse({ deposit, explorerUrl }) {
    const status = (deposit.status || '').toLowerCase();
    return {
        depositId: deposit.deposit_id,
        status: deposit.status,
        message:
            status === 'pending'
                ? 'Deposit submitted. Awaiting verification.'
                : status === 'processing'
                    ? 'Deposit is being verified.'
                    : status === 'completed'
                        ? 'Deposit verified and credited.'
                        : 'Deposit failed.',
        txId: deposit.tx_id,
        network: deposit.network,
        amountUsd: Number(deposit.amount_usd || 0),
        explorerUrl,
        nextAction:
            status === 'completed'
                ? 'none'
                : 'wait_for_verification',
    };
}

function makeDepositListItem(row) {
    return {
        depositId: row.deposit_id,
        txId: row.tx_id,
        amountUsd: Number(row.amount_usd || 0),
        network: row.network,
        status: row.status,
        verifiedAt: row.verified_at || null,
        createdAt: row.created_at,
        message: row.message || null,
    };
}

function makeListDepositsResponse(items, page, limit, total) {
    const hasNext = page * limit < total;
    return {
        items,
        pageInfo: { page, limit, total, hasNext },
    };
}

module.exports = {
    DepositStatus,
    makeSubmitDepositResponse,
    makeDepositListItem,
    makeListDepositsResponse,
};
