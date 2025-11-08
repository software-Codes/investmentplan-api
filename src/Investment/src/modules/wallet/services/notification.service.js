'use strict';

const nodemailer = require('nodemailer');
const { NOTIFY_ENABLED } = require('../policies/wallet.policy');

class NotificationService {
    constructor({ db, logger = console } = {}) {
        this.db = db;
        this.log = logger;
        this.transporter = this._createTransporter();
    }

    _createTransporter() {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendTransfer(userId, payload) {
        if (!NOTIFY_ENABLED) return;

        try {
            const { rows } = await this.db.query(
                'SELECT full_name, email FROM users WHERE user_id = $1',
                [userId]
            );
            if (!rows.length) return;

            const user = rows[0];
            const subject = `✅ Wallet Transfer Completed`;
            const html = this._getTransferTemplate({ userName: user.full_name, ...payload });

            await this.transporter.sendMail({
                from: `"Investment Platform" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject,
                html
            });

            this.log.info({ userId, transferId: payload.transferId }, 'Transfer notification sent');
        } catch (err) {
            this.log.warn({ err, userId }, 'Transfer notification failed');
        }
    }

    _getTransferTemplate({ userName, from, to, amount, transferId, balances, lockedUntil }) {
        const lockInfo = lockedUntil ? `<p><strong>Lock Period:</strong> Funds locked until ${new Date(lockedUntil).toLocaleDateString()}</p>` : '';
        
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #2196F3; }
        .amount { font-size: 32px; font-weight: bold; color: #2196F3; text-align: center; margin: 20px 0; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .details-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; }
        .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>✅ Transfer Completed</h2>
        </div>
        
        <p>Hello ${userName},</p>
        <p>Your wallet transfer has been completed successfully.</p>
        
        <div class="amount">$${Number(amount).toFixed(2)}</div>
        
        <div class="details">
            <div class="details-row">
                <span class="label">From:</span> ${from.charAt(0).toUpperCase() + from.slice(1)} Wallet
            </div>
            <div class="details-row">
                <span class="label">To:</span> ${to.charAt(0).toUpperCase() + to.slice(1)} Wallet
            </div>
            <div class="details-row">
                <span class="label">Transfer ID:</span> ${transferId}
            </div>
            <div class="details-row">
                <span class="label">Account Balance:</span> $${balances.account.toFixed(2)}
            </div>
            <div class="details-row">
                <span class="label">Trading Balance:</span> $${balances.trading.toFixed(2)} (Locked: $${balances.tradingLocked.toFixed(2)})
            </div>
            <div class="details-row">
                <span class="label">Referral Balance:</span> $${balances.referral.toFixed(2)}
            </div>
        </div>
        
        ${lockInfo}
        
        <div class="footer">
            <p>This is an automated message. Please do not reply.</p>
            <p>© ${new Date().getFullYear()} Investment Platform</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

module.exports = { NotificationService };
