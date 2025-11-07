'use strict';

/**
 * DTOs for request/response shapes.
 * These are plain factories to keep controllers clean and consistent.
 */

const DepositStatus = Object.freeze({
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
});

function makeSubmitDepositResponse({ deposit, explorerUrl }) {
    return {
        depositId: deposit.id,
        status: deposit.status,
        message:
            deposit.status === DepositStatus.PENDING
                ? 'Deposit submitted. Awaiting verification.'
                : deposit.status === DepositStatus.PROCESSING
                    ? 'Deposit is being verified.'
                    : deposit.status === DepositStatus.CONFIRMED
                        ? 'Deposit verified and credited.'
                        : 'Deposit failed.',
        txId: deposit.txId,
        network: deposit.network,
        amountUsd: Number(deposit.amountUsd),
        explorerUrl,
        nextAction:
            deposit.status === DepositStatus.CONFIRMED
                ? 'none'
                : 'wait_for_verification',
    };
}

function makeDepositListItem(row) {
    return {
        depositId: row.id,
        txId: row.tx_id || row.txId,
        amountUsd: Number(row.amount_usd ?? row.amountUsd),
        network: row.network,
        status: row.status,
        verifiedAt: row.verified_at || row.verifiedAt || null,
        createdAt: row.created_at || row.createdAt,
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
