'use strict';

class DepositInstructionsController {
    constructor({ logger } = {}) {
        this.logger = logger || console;
        this.getInstructions = this.getInstructions.bind(this);
    }

    getInstructions(req, res) {
        try {
            const instructions = {
                depositAddress: process.env.DEPOSIT_ADDRESS,
                asset: process.env.DEPOSIT_ASSET || 'USDT',
                networks: (process.env.DEPOSIT_NETWORKS || 'ERC20').split(','),
                minDeposit: Number(process.env.MIN_DEPOSIT_USD || 10),
                minConfirmations: Number(process.env.MIN_CONFIRMATIONS || 12),
                explorerUrl: process.env.EXPLORER_BASE_URL || 'https://etherscan.io/tx/',
                
                steps: [
                    {
                        step: 1,
                        title: 'Withdraw from Binance',
                        description: 'Send USDT from your Binance account to our deposit address',
                        actions: [
                            'Open Binance app or website',
                            'Go to Wallet → Withdraw → Crypto',
                            'Select Coin: USDT',
                            `Paste Address: ${process.env.DEPOSIT_ADDRESS}`,
                            'Select Network: ETH (Ethereum ERC20)',
                            `Enter Amount: Minimum $${process.env.MIN_DEPOSIT_USD || 10} USDT`,
                            'Complete security verification',
                            'Click Withdraw',
                        ],
                    },
                    {
                        step: 2,
                        title: 'Get Transaction Hash',
                        description: 'Copy your transaction hash from Binance',
                        actions: [
                            'Go to Wallet → Transaction History',
                            'Find your USDT withdrawal',
                            'Click on the transaction',
                            'Copy the TxID (starts with 0x...)',
                        ],
                    },
                    {
                        step: 3,
                        title: 'Submit & Get Credited',
                        description: 'Paste the transaction hash and receive instant credit',
                        actions: [
                            'Return to our deposit page',
                            'Paste the transaction hash',
                            'Click Submit',
                            'Your account will be credited instantly',
                        ],
                    },
                ],

                requirements: {
                    platform: 'Binance Only',
                    description: 'All deposits must be made from Binance',
                    network: 'Ethereum (ERC20)',
                    asset: 'USDT',
                    minAmount: `$${process.env.MIN_DEPOSIT_USD || 10}`,
                },

                txHashFormat: {
                    description: 'Valid transaction hash format',
                    format: '0x followed by 64 hexadecimal characters',
                    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                    length: 66,
                    validation: 'Must start with 0x and contain only 0-9 and a-f characters',
                },

                warnings: [
                    {
                        type: 'critical',
                        message: 'Only withdraw from Binance. Other platforms are not supported.',
                    },
                    {
                        type: 'critical',
                        message: 'Network must be Ethereum (ERC20). Wrong network = lost funds.',
                    },
                    {
                        type: 'warning',
                        message: `Minimum deposit: $${process.env.MIN_DEPOSIT_USD || 10} USDT. Lower amounts will be rejected.`,
                    },
                    {
                        type: 'info',
                        message: 'Use "Withdraw via Crypto Network" - NOT Binance Pay or internal transfers.',
                    },
                    {
                        type: 'info',
                        message: 'Each transaction can only be claimed once.',
                    },
                ],

                help: [
                    {
                        question: 'Where do I find my transaction hash?',
                        answer: 'Binance → Wallet → Transaction History → Click on your withdrawal → Copy TxID',
                    },
                    {
                        question: 'How long does it take?',
                        answer: 'Instant! Once you submit the transaction hash, your account is credited immediately if the transaction is confirmed on Binance.',
                    },
                    {
                        question: 'What if my transaction is pending?',
                        answer: 'Wait 3-5 minutes for blockchain confirmation, then submit the transaction hash again.',
                    },
                    {
                        question: 'Can I deposit from other exchanges?',
                        answer: 'No. Only Binance withdrawals are accepted. This ensures instant verification and crediting.',
                    },
                ],

                security: [
                    'Always verify the deposit address matches what is shown in our app',
                    'Double-check the network is Ethereum (ERC20) before sending',
                    'Keep your transaction hash private until you submit it',
                    'Never share your wallet private keys or seed phrases',
                ],

                support: {
                    message: 'Need help? Contact our support team',
                    email: process.env.ADMIN_EMAIL || 'support@yourplatform.com',
                },
            };

            res.json({
                success: true,
                data: instructions,
            });
        } catch (error) {
            this.logger.error('Error fetching deposit instructions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch deposit instructions',
            });
        }
    }
}

module.exports = { DepositInstructionsController };
