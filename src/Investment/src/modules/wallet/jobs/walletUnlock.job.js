'use strict';

const cron = require('node-cron');
const { PRINCIPAL_LOCK_DAYS } = require('../policies/wallet.policy');
const { WalletService } = require('../services/wallet.service');

/**
 * WalletUnlockJob
 * ---------------
 * Cron-based job that releases matured principal from Trading locked_balance.
 * Runs every 5 minutes to check for transfers that have reached their 30-day lock period.
 * Unlocks based on exact locked_until timestamp (30 days from user's investment time).
 */

class WalletUnlockJob {
    constructor({ db, walletService, logger = console }) {
        this.db = db;
        this.wallets = walletService;
        this.log = logger;
        this.task = null;
        this.isRunning = false;
    }

    /**
     * Start cron job (runs every 5 minutes)
     * @param {string} schedule - Cron expression (default: every 5 minutes)
     */
    start(schedule = '*/5 * * * *') {
        if (this.task) {
            this.log.warn('WalletUnlockJob already running');
            return this;
        }

        this.task = cron.schedule(schedule, async () => {
            if (this.isRunning) {
                this.log.warn('WalletUnlockJob: Previous run still in progress, skipping');
                return;
            }
            await this.run().catch(err => this.log.error({ err }, 'WalletUnlockJob failed'));
        });

        this.log.info({ schedule }, 'WalletUnlockJob started (runs every 5 minutes)');
        return this;
    }

    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            this.log.info('WalletUnlockJob stopped');
        }
    }

    async run() {
        if (PRINCIPAL_LOCK_DAYS <= 0) return;
        if (this.isRunning) return;

        this.isRunning = true;
        const startTime = Date.now();

        try {
            // Find matured principal transfers (locked_until has passed)
            const { rows } = await this.db.query(
                `SELECT transfer_id, user_id, amount::numeric AS amount, locked_until
                 FROM wallet_transfers
                 WHERE from_wallet = 'account'
                   AND to_wallet = 'trading'
                   AND transfer_type = 'principal'
                   AND status = 'active'
                   AND locked_until <= NOW()
                   AND unlocked_at IS NULL
                 ORDER BY locked_until
                 LIMIT 100`
            );

            if (rows.length === 0) {
                this.log.info('WalletUnlockJob: No transfers to unlock');
                return;
            }

            let unlocked = 0;
            let failed = 0;

            for (const tr of rows) {
                try {
                    await this._unlockOne(tr);
                    unlocked++;
                } catch (err) {
                    failed++;
                    this.log.warn({ err, transfer: tr }, 'Failed to unlock transfer');
                }
            }

            const duration = Date.now() - startTime;
            this.log.info({ 
                total: rows.length, 
                unlocked, 
                failed, 
                durationMs: duration 
            }, 'WalletUnlockJob: Cycle complete');
        } finally {
            this.isRunning = false;
        }
    }

    async _unlockOne({ transfer_id, user_id, amount }) {
        await this.wallets.withTransaction(async (client) => {
            // Lock trading wallet
            const trading = await this.wallets.getWalletForUpdate(client, user_id, 'trading');

            // Reduce locked by amount (never below 0)
            const delta = -Math.min(Number(trading.locked_balance), Number(amount));
            await this.wallets.adjustTradingLock(client, user_id, delta);

            // Mark as unlocked
            await client.query(
                `UPDATE wallet_transfers 
                 SET unlocked_at = NOW(), status = 'unlocked' 
                 WHERE transfer_id = $1`,
                [transfer_id]
            );

            this.log.info({ transfer_id, user_id, amount }, 'Principal unlocked');
        });
    }
}

module.exports = { WalletUnlockJob };
