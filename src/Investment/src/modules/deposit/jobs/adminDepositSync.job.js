'use strict';

/**
 * AdminDepositSyncJob
 * 
 * Background job that syncs Binance deposits with database
 * Runs periodically to update pending deposits
 * Only processes deposits that are in pending/processing state
 */

class AdminDepositSyncJob {
    constructor({ depositService, binance, logger, intervalMs = 60000 }) {
        this.depositService = depositService;
        this.binance = binance;
        this.logger = logger || console;
        this.intervalMs = intervalMs;
        this.timer = null;
        this.isRunning = false;
        this._syncing = false;
    }

    start() {
        if (this.isRunning) {
            this.logger.warn('AdminDepositSyncJob already running');
            return;
        }

        this.isRunning = true;
        this.logger.info(`Starting AdminDepositSyncJob (interval: ${this.intervalMs}ms)`);
        
        // Run immediately
        this._sync();
        
        // Then run on interval
        this.timer = setInterval(() => this._sync(), this.intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        this.logger.info('AdminDepositSyncJob stopped');
    }

    async _sync() {
        // Prevent concurrent syncs
        if (this._syncing) {
            this.logger.warn('AdminDepositSyncJob: Sync already in progress, skipping');
            return;
        }

        this._syncing = true;
        try {
            this.logger.info('AdminDepositSyncJob: Starting sync...');
            
            // Get all pending/processing deposits from database with timeout protection
            const { deposits } = await Promise.race([
                this.depositService.listAllDeposits({
                    page: 1,
                    limit: 100,
                    status: undefined,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database query timeout')), 10000)
                )
            ]);

            const pendingDeposits = deposits.filter(d => 
                d.status === 'pending' || d.status === 'processing'
            );

            if (pendingDeposits.length === 0) {
                this.logger.info('AdminDepositSyncJob: No pending deposits to sync');
                return;
            }

            this.logger.info(`AdminDepositSyncJob: Found ${pendingDeposits.length} pending deposits`);

            // Try to verify each pending deposit (limit to 10 per sync to avoid overload)
            const toProcess = pendingDeposits.slice(0, 10);
            let verified = 0;
            
            for (const deposit of toProcess) {
                try {
                    const result = await this.depositService.verifyAndConfirm({
                        txId: deposit.txId,
                        userId: deposit.userId,
                    });

                    if (result && result.status === 'completed') {
                        verified++;
                        this.logger.info(`AdminDepositSyncJob: Verified deposit ${deposit.depositId}`);
                    }
                } catch (err) {
                    this.logger.warn({ depositId: deposit.depositId, error: err.message }, 'Failed to verify deposit');
                }
            }

            this.logger.info(`AdminDepositSyncJob: Sync complete. Verified ${verified}/${toProcess.length} deposits`);
        } catch (err) {
            this.logger.error({ error: err.message }, 'AdminDepositSyncJob: Sync failed');
        } finally {
            this._syncing = false;
        }
    }
}

module.exports = { AdminDepositSyncJob };
