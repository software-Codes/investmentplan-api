'use strict';

/**
 * WebhookHandler:
 *
 * A lightweight Express-compatible handler for "deposit events" delivered
 * via a proxy integration (since Binance doesn't provide native webhooks).
 *
 * Expected payload shape (example):
 * {
 *   "type": "deposit",
 *   "txId": "0xabc...",
 *   "amount": "100.00",
 *   "asset": "USDT",
 *   "network": "ETH",
 *   "status": "SUCCESS",  // or PENDING
 *   "address": "0xAdminDepositAddress",
 *   "insertTime": 1730966400000
 * }
 *
 * Security:
 * - HMAC signature in header: X-Webhook-Signature = hex(hmacSHA256(body, WEBHOOK_SECRET))
 * - Time-based replay check via X-Webhook-Timestamp (optional; recommended)
 */

const crypto = require('crypto');
const pino = require('pino');
const cfg = require('../config/deposit.config');

/**
 * @param {object} deps
 * @param {import('../services/deposit.service').DepositService} deps.depositService
 * @param {string} deps.webhookSecret
 * @param {import('pino').Logger} [deps.logger]
 */
function createWebhookHandler({ depositService, webhookSecret, logger }) {
    const log = logger || pino({ name: 'DepositWebhook' });

    const verifySignature = (raw, sig) => {
        if (!webhookSecret) return false;
        const h = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
        return typeof sig === 'string' && sig.toLowerCase() === h.toLowerCase();
    };

    /**
     * Express-style handler: (req, res) => void
     */
    return async function webhookHandler(req, res) {
        try {
            const raw = req.rawBody || req.bodyRaw || JSON.stringify(req.body || {});
            const sig = req.headers['x-webhook-signature'] || req.headers['X-Webhook-Signature'];
            if (!verifySignature(raw, sig)) {
                log.warn('Invalid webhook signature');
                return res.status(401).json({ error: 'invalid_signature' });
            }

            const evt = typeof req.body === 'object' ? req.body : JSON.parse(raw);
            if (!evt || evt.type !== 'deposit' || !evt.txId) {
                return res.status(400).json({ error: 'invalid_payload' });
            }

            // Safety check: ensure event is for our configured address (if present)
            if (evt.address && String(evt.address).toLowerCase() !== String(cfg.DEPOSIT_ADDRESS).toLowerCase()) {
                log.warn({ evt }, 'Webhook address mismatch');
                return res.status(202).json({ accepted: true }); // ignore silently
            }

            const result = await depositService.verifyAndConfirm({ txId: evt.txId });
            return res.status(200).json({ ok: true, txId: evt.txId, status: result?.status || 'unknown' });
        } catch (err) {
            log.error({ err }, 'Webhook processing failed');
            return res.status(500).json({ error: 'internal_error' });
        }
    };
}

module.exports = { createWebhookHandler };
