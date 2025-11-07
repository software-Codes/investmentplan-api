// src/modules/investment/deposit/controllers/deposit.controller.js
'use strict';

/**
 * DepositController
 *
 * Endpoints:
 * - POST /deposit/submit         (auth: user)   -> submit txhash, system verifies & credits if confirmed
 * - GET  /deposit/status/:txId   (auth: user)   -> re-verify now (fresh pull) and return current status
 *
 * Notes:
 * - We do NOT accept an amount from the client; we fetch it from Binance.
 * - Responses are consistent and UX-friendly with actionable next steps.
 */

class DepositController {
    /**
     * @param {object} deps
     * @param {import('../services/deposit.service').DepositService} deps.depositService
     * @param {import('pino').Logger} [deps.logger]
     */
    constructor({ depositService, logger }) {
        if (!depositService) throw new Error('DepositController requires depositService');
        this.svc = depositService;
        this.log = logger || console;

        this.submit = this.submit.bind(this);
        this.status = this.status.bind(this);
    }

    // POST /deposit/submit
    async submit(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id;
            const { txId } = req.body || {};

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            if (!txId || typeof txId !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'txId is required and must be a string',
                    code: 'ERR_TXID_REQUIRED',
                });
            }

            const result = await this.svc.submitDeposit({ userId, txId: txId.trim() });

            // Friendly message depending on status
            const status = String(result.status || '').toLowerCase();
            const tips = status === 'completed'
                ? 'Deposit verified and credited to your Account Wallet.'
                : status === 'processing'
                    ? 'We found your deposit on Binance and are waiting for confirmations.'
                    : 'Submitted. We\'ll verify the transaction shortly.';

            return res.status(status === 'completed' ? 200 : 202).json({
                success: true,
                message: tips,
                data: result,
            });
        } catch (err) {
            const code = err?.code || 'ERR_SUBMIT_DEPOSIT';
            const msg = err?.message || 'Unable to submit deposit. Please try again.';

            const http = (code === 'ERR_TXID_INVALID') ? 400
                : (code === 'ERR_TXID_ALREADY_CLAIMED') ? 409
                    : (code === 'ERR_TXID_NOT_FOUND') ? 404
                        : (code === 'ERR_ADDRESS_MISMATCH') ? 400
                            : (code === 'ERR_PENDING_CONFIRMATION') ? 202
                                : (code === 'ERR_PROVIDER_STATUS') ? 422
                                    : (code === 'ERR_AMOUNT_OUT_OF_RANGE') ? 400
                                        : 422;

            // Expected business errors - log as info/warn, not error
            const expectedErrors = ['ERR_TXID_INVALID', 'ERR_TXID_ALREADY_CLAIMED', 'ERR_TXID_NOT_FOUND', 
                                   'ERR_ADDRESS_MISMATCH', 'ERR_PENDING_CONFIRMATION', 'ERR_AMOUNT_OUT_OF_RANGE'];
            if (expectedErrors.includes(code)) {
                this.log.info({ code, txId: req.body?.txId }, msg);
            } else {
                this.log.error({ err, code }, 'submit deposit failed');
            }
            return res.status(http).json({ success: false, message: msg, code });
        }
    }

    // GET /deposit/status/:txId
    async status(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id;
            const txId = req.params.txId;

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            if (!txId) {
                return res.status(400).json({ success: false, message: 'txId is required', code: 'ERR_TXID_REQUIRED' });
            }

            // Re-verify now to give the freshest view
            const verified = await this.svc.verifyAndConfirm({ txId, userId });

            if (!verified) {
                return res.status(404).json({
                    success: false,
                    message: 'No deposit claim found for this txId. Submit it first.',
                    code: 'ERR_DEPOSIT_NOT_FOUND',
                });
            }

            const status = String(verified.status || '').toLowerCase();
            const tips = status === 'completed'
                ? 'Deposit verified and credited.'
                : status === 'processing'
                    ? 'On-chain transaction detected. Waiting for confirmations.'
                    : status === 'failed'
                        ? 'Deposit failed verification. Check the tx hash and try again.'
                        : 'Submitted. Awaiting verification.';

            return res.status(200).json({
                success: true,
                message: tips,
                data: {
                    depositId: verified.deposit_id,
                    status: verified.status,
                    txId,
                    amountUsd: verified.amount_usd || null,
                },
            });
        } catch (err) {
            this.log.error({ err }, 'get status failed');
            return res.status(500).json({ success: false, message: 'Could not fetch status. Try again later.' });
        }
    }
}

module.exports = { DepositController };
