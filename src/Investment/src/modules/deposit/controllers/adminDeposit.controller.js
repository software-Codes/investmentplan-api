'use strict';

class AdminDepositController {
    constructor({ depositService, logger }) {
        if (!depositService) throw new Error('AdminDepositController requires depositService');
        this.svc = depositService;
        this.log = logger || console;
        this.listBinanceDeposits = this.listBinanceDeposits.bind(this);
        this.listUserDeposits = this.listUserDeposits.bind(this);
    }

    async listBinanceDeposits(req, res) {
        try {
            const days = parseInt(req.query.days) || 1000;
            const coin = req.query.coin || 'USDT';
            const network = req.query.network || 'ETH';

            if (days < 1 || days > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Days must be between 1 and 1000',
                });
            }

            const deposits = await this.svc.listBinanceDeposits({ days, coin, network });

            return res.status(200).json({
                success: true,
                message: `Retrieved ${deposits.length} deposits from Binance (last ${days} days)`,
                data: {
                    deposits,
                    summary: {
                        total: deposits.length,
                        claimed: deposits.filter(d => d.claimed).length,
                        unclaimed: deposits.filter(d => !d.claimed).length,
                        totalAmount: deposits.reduce((sum, d) => sum + (d.amount || 0), 0).toFixed(2),
                    },
                    filters: { days, coin, network },
                },
            });
        } catch (err) {
            this.log.error({ err }, 'listBinanceDeposits failed');
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch Binance deposits',
            });
        }
    }

    async listUserDeposits(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const status = req.query.status;
            const userId = req.query.userId;

            if (limit > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Limit cannot exceed 100',
                });
            }

            const result = await this.svc.listAllDeposits({ page, limit, status, userId });

            return res.status(200).json({
                success: true,
                message: `Retrieved ${result.deposits.length} deposits`,
                data: result,
            });
        } catch (err) {
            this.log.error({ err }, 'listUserDeposits failed');
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user deposits',
            });
        }
    }
}

module.exports = { AdminDepositController };
