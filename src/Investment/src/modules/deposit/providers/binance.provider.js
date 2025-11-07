'use strict';

/**
 * BinanceProvider:
 * A small adapter around @binance/connector that exposes
 * the exact methods we need (and nothing more).
 *
 * Why: Keeps our service clean, testable (mockable), and provider-agnostic later.
 */

const { Spot } = require('@binance/connector');

const DEFAULT_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class BinanceProvider {
    /**
     * @param {object} opts
     * @param {string} opts.apiKey
     * @param {string} opts.apiSecret
     * @param {number} [opts.recvWindow]
     * @param {number} [opts.timeout] - request timeout ms
     * @param {import('pino').Logger} [opts.logger]
     */
    constructor({ apiKey, apiSecret, recvWindow = 5000, timeout = 10000, logger }) {
        this.client = new Spot(apiKey, apiSecret, { recvWindow, timeout });
        this.logger = logger || console;
    }

    /**
     * Get a single deposit by txId by scanning recent deposit history.
     * Binance "Get Deposit History (supporting network)": /sapi/v1/capital/deposit/hisrec
     * No direct txId filter is provided, so we pull a window and match locally.
     *
     * @param {object} params
     * @param {string} params.txId - blockchain tx hash
     * @param {string} [params.coin='USDT']
     * @param {string} [params.network='ETH'] - Binance network code (ETH for ERC20)
     * @param {number} [params.lookbackMs] - default 7 days
     * @returns {Promise<null|{
     *   txId:string, amount:number, coin:string, network:string, address:string,
     *   status:string, insertTime:number
     * }>}
     */
    async getDepositByTxId({ txId, coin = 'USDT', network = 'ETH', lookbackMs = DEFAULT_LOOKBACK_MS }) {
        const endTime = Date.now();
        const startTime = endTime - Math.max(lookbackMs, 60_000);

        // Binance returns status as integer (0=pending,1=success,6=credited but cannot withdraw)
        const mapStatus = (s) => {
            if (s === 1) return 'SUCCESS';
            if (s === 0) return 'PENDING';
            if (s === 6) return 'CREDITED';
            return String(s);
        };

        // Paginate up to a sensible limit (avoid unbounded scans)
        let deposits = [];
        let currentStart = startTime;
        const pageSpan = 1000 * 60 * 60 * 24; // 1d pages
        for (let i = 0; i < 10; i++) {
            const thisEnd = Math.min(currentStart + pageSpan, endTime);
            try {
                const { data } = await this.client.depositHistory({
                    coin,
                    startTime: currentStart,
                    endTime: thisEnd,
                    // network param exists, but not all accounts require it; include for specificity
                    network,
                });
                if (Array.isArray(data)) {
                    deposits = deposits.concat(
                        data.map((d) => ({
                            txId: d.txId,
                            amount: Number(d.amount),
                            coin: d.coin,
                            network: d.network,
                            address: d.address,
                            status: mapStatus(d.status),
                            insertTime: d.insertTime, // ms epoch
                        })),
                    );
                }
            } catch (err) {
                this.logger.warn({ err }, 'Binance depositHistory window failed');
            }
            currentStart = thisEnd + 1;
            if (currentStart > endTime) break;
        }

        const match = deposits.find((d) => (d.txId || '').toLowerCase() === txId.toLowerCase());
        return match || null;
    }

    /**
     * List recent deposits since a timestamp for polling monitor job.
     * @param {object} params
     * @param {number} params.sinceMs - epoch ms
     * @param {string} [params.coin='USDT']
     * @param {string} [params.network='ETH']
     * @returns {Promise<Array>}
     */
    async listRecentDeposits({ sinceMs, coin = 'USDT', network = 'ETH' }) {
        try {
            const { data } = await this.client.depositHistory({
                coin,
                startTime: sinceMs,
                endTime: Date.now(),
                network,
            });
            return Array.isArray(data)
                ? data.map((d) => ({
                    txId: d.txId,
                    amount: Number(d.amount),
                    coin: d.coin,
                    network: d.network,
                    address: d.address,
                    status: d.status === 1 ? 'SUCCESS' : d.status === 0 ? 'PENDING' : String(d.status),
                    insertTime: d.insertTime,
                }))
                : [];
        } catch (err) {
            this.logger.error({ err }, 'Binance listRecentDeposits failed');
            return [];
        }
    }
}

module.exports = { BinanceProvider };
