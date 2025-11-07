'use strict';

/**
 * DepositMonitorJob
 *
 * A polling job that queries Binance for recent deposits and tries to
 * resolve any PENDING/PROCESSING claims in our DB.
 *
 * Strategy:
 * - Keep a "since" cursor (in ms epoch) to avoid reprocessing old data.
 * - Fetch recent deposits from Binance every POLL_INTERVAL_SEC.
 * - For each provider deposit, if a matching tx_id exists in our DB and is not CONFIRMED:
 *     -> call DepositService.verifyAndConfirm(txId, userId)
 * - Log unclaimed provider deposits for admin review (optional).
 *
 * Notes:
 * - Because our entity requires user_id, this job does not auto-create records.
 * - If you later store unassigned provider deposits, you can add a "staging" table for reconciliation.
 */

const pino = require('pino');
const cfg = require('../config/deposit.config');
const { BinanceProvider } = require('../providers/binance.provider');

class DepositMonitorJob {
    /**
     * @param {object} deps
     * @param {import('../services/deposit.service').DepositService} deps.depositService
     * @param {BinanceProvider} deps.binance
     * @param {import('pino').Logger} [deps.logger]
     * @param {number} [deps.lookbackMs]
     */
    constructor({ depositService, binance, logger, lookbackMs = 1000 * 60 * 60 * 24 }) {
        this.depositService = depositService;
        this.binance = binance;
        this.logger = logger || pino({ name: 'DepositMonitorJob' });
        this._timer = null;
        this._cursorMs = Date.now() - lookbackMs; // start with 24h lookback
        this._isRunning = false;
    }

    start() {
        if (this._timer) return;
        this.logger.info('Starting DepositMonitorJob...');
        const intervalMs = (cfg.POLL_INTERVAL_SEC || 30) * 1000;
        this._timer = setInterval(() => this._tick().catch((e) => this.logger.error(e, 'monitor tick error')), intervalMs);
        // fire once immediately
        this._tick().catch((e) => this.logger.error(e, 'monitor first tick error'));
    }

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
        this.logger.info('Stopped DepositMonitorJob');
    }

    async _tick() {
        if (this._isRunning) return;
        this._isRunning = true;
        try {
            const deposits = await this.binance.listRecentDeposits({ sinceMs: this._cursorMs, coin: 'USDT', network: 'ETH' });
            if (deposits.length === 0) {
                this.logger.debug('No recent provider deposits');
                this._cursorMs = Date.now(); // advance cursor
                return;
            }

            this.logger.info({ count: deposits.length }, 'Fetched recent provider deposits');

            for (const d of deposits) {
                try {
                    // We don't know userId here, but verifyAndConfirm can use record.user_id
                    await this.depositService.verifyAndConfirm({ txId: d.txId });
                } catch (err) {
                    this.logger.warn({ err, txId: d.txId }, 'Failed to verifyAndConfirm provider deposit');
                }
                // Keep cursor moving forward based on observed insertTime
                if (typeof d.insertTime === 'number') {
                    this._cursorMs = Math.max(this._cursorMs, d.insertTime);
                }
            }
        } finally {
            // ensure we always move past current time to avoid tight loop
            this._cursorMs = Math.max(this._cursorMs, Date.now() - 1000);
            this._isRunning = false;
        }
    }
}

module.exports = { DepositMonitorJob };
