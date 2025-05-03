const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class NotificationEmailService {
    static _createTransporter() {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    /**
     * Send transaction notification email
     * @param {Object} data - Transaction data
     */
    static async sendTransactionNotification(data) {
        try {
            const transporter = this._createTransporter();
            const template = this._getTransactionTemplate(data);

            await transporter.sendMail({
                from: `"Investment Platform" <${process.env.EMAIL_USER}>`,
                to: data.userEmail,
                subject: `Transaction Notification: ${data.type}`,
                html: template
            });

            logger.info(`Transaction notification sent to ${data.userEmail}`);
        } catch (error) {
            logger.error(`Failed to send transaction notification: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send admin notification for pending actions
     * @param {Object} data - Admin notification data
     */
    static async sendAdminNotification(data) {
        try {
            const transporter = this._createTransporter();
            const template = this._getAdminNotificationTemplate(data);

            await transporter.sendMail({
                from: `"Investment Platform Admin" <${process.env.EMAIL_USER}>`,
                to: process.env.ADMIN_EMAIL,
                subject: `Admin Action Required: ${data.type}`,
                html: template
            });

            logger.info(`Admin notification sent for ${data.type}`);
        } catch (error) {
            logger.error(`Failed to send admin notification: ${error.message}`);
            throw error;
        }
    }

    static _getTransactionTemplate(data) {
        const templates = {
            deposit: `
                <h2>Deposit Confirmation</h2>
                <p>Your deposit of $${data.amount} has been confirmed.</p>
                <p>Transaction Details:</p>
                <ul>
                    <li>Amount: $${data.amount}</li>
                    <li>Transaction ID: ${data.transactionId}</li>
                    <li>Date: ${new Date().toLocaleString()}</li>
                    <li>Status: ${data.status}</li>
                </ul>
            `,
            withdrawal: `
                <h2>Withdrawal Request ${data.status}</h2>
                <p>Your withdrawal request for $${data.amount} has been ${data.status}.</p>
                <p>Transaction Details:</p>
                <ul>
                    <li>Amount: $${data.amount}</li>
                    <li>Request ID: ${data.transactionId}</li>
                    <li>Status: ${data.status}</li>
                    ${data.status === 'completed' ? 
                        `<li>Binance Transaction ID: ${data.binanceTxId}</li>` : ''}
                </ul>
            `,
            transfer: `
                <h2>Wallet Transfer Confirmation</h2>
                <p>Your transfer has been completed successfully.</p>
                <p>Transfer Details:</p>
                <ul>
                    <li>Amount: $${data.amount}</li>
                    <li>From: ${data.fromWallet} Wallet</li>
                    <li>To: ${data.toWallet} Wallet</li>
                    <li>Transfer ID: ${data.transactionId}</li>
                </ul>
            `,
            investment: `
                <h2>Investment Update</h2>
                <p>Your investment has been ${data.status}.</p>
                <p>Investment Details:</p>
                <ul>
                    <li>Amount: $${data.amount}</li>
                    <li>Investment ID: ${data.investmentId}</li>
                    <li>Status: ${data.status}</li>
                    ${data.profit ? `<li>Current Profit: $${data.profit}</li>` : ''}
                </ul>
            `
        };

        return this._wrapEmailTemplate(templates[data.type], data.type);
    }

    static _getAdminNotificationTemplate(data) {
        const templates = {
            withdrawal_request: `
                <h2>New Withdrawal Request</h2>
                <p>A new withdrawal request requires your attention.</p>
                <p>Details:</p>
                <ul>
                    <li>User ID: ${data.userId}</li>
                    <li>Amount: $${data.amount}</li>
                    <li>Binance Address: ${data.binanceAddress}</li>
                    <li>Request Time: ${new Date().toLocaleString()}</li>
                </ul>
                <p>Please process this request within 20 minutes.</p>
                <a href="${process.env.ADMIN_DASHBOARD_URL}/withdrawals/${data.withdrawalId}" 
                   style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Process Request
                </a>
            `,
            kyc_verification: `
                <h2>New KYC Verification Required</h2>
                <p>A user has submitted KYC documents for verification.</p>
                <ul>
                    <li>User ID: ${data.userId}</li>
                    <li>Document Type: ${data.documentType}</li>
                    <li>Submission Time: ${new Date().toLocaleString()}</li>
                </ul>
            `
        };

        return this._wrapEmailTemplate(templates[data.type], 'admin');
    }

    static _wrapEmailTemplate(content, type) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px; background-color: #f8f9fa; }
                    .content { padding: 20px; }
                    .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #999; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Investment Platform</h1>
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>If you did not perform this action, please contact support immediately.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = NotificationEmailService;