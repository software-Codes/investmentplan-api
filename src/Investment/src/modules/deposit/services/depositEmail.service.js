'use strict';

const nodemailer = require('nodemailer');

class DepositEmailService {
    constructor({ db }) {
        this.db = db;
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

    /**
     * Send deposit confirmation email to user
     */
    async sendUserDepositConfirmation({ userEmail, userName, amount, txId, depositId }) {
        const subject = '✅ Deposit Confirmed - Funds Credited';
        const html = this._getUserDepositTemplate({ userName, amount, txId, depositId });

        await this.transporter.sendMail({
            from: `"Investment Platform" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject,
            html,
            text: `Your deposit of $${amount} USDT has been confirmed and credited to your account. Transaction: ${txId}`
        });
    }

    /**
     * Send deposit notification to admin
     */
    async sendAdminDepositNotification({ userEmail, userName, amount, txId, depositId, userId }) {
        // Get all active admin emails from database
        const { rows } = await this.db.query(
            'SELECT email FROM admins WHERE is_active = true'
        );
        
        const adminEmails = rows.map(r => r.email);
        
        // Fallback to env var if no admins in DB
        if (adminEmails.length === 0) {
            adminEmails.push(process.env.ADMIN_EMAIL || process.env.EMAIL_USER);
        }

        const subject = '💰 New Deposit Received';
        const html = this._getAdminDepositTemplate({ userEmail, userName, amount, txId, depositId, userId });

        // Send to all active admins
        await this.transporter.sendMail({
            from: `"Investment Platform" <${process.env.EMAIL_USER}>`,
            to: adminEmails.join(','),
            subject,
            html,
            text: `New deposit: ${userName} (${userEmail}) deposited $${amount} USDT. TX: ${txId}`
        });
    }

    _getUserDepositTemplate({ userName, amount, txId, depositId }) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #4CAF50; }
        .success-icon { font-size: 48px; color: #4CAF50; }
        .amount { font-size: 36px; font-weight: bold; color: #4CAF50; text-align: center; margin: 20px 0; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; word-break: break-all; }
        .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #999; }
        .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h2>Deposit Confirmed!</h2>
        </div>
        
        <p>Hello ${userName},</p>
        
        <p>Great news! Your deposit has been successfully confirmed and credited to your account.</p>
        
        <div class="amount">$${amount} USDT</div>
        
        <div class="details">
            <div class="details-row">
                <span class="label">Status:</span>
                <span class="value" style="color: #4CAF50; font-weight: bold;">✓ Completed</span>
            </div>
            <div class="details-row">
                <span class="label">Amount:</span>
                <span class="value">$${amount} USDT</span>
            </div>
            <div class="details-row">
                <span class="label">Deposit ID:</span>
                <span class="value">${depositId}</span>
            </div>
            <div class="details-row">
                <span class="label">Transaction Hash:</span>
                <span class="value">${txId.substring(0, 20)}...${txId.substring(txId.length - 10)}</span>
            </div>
        </div>
        
        <p>Your funds are now available in your Account Wallet and ready to use.</p>
        
        <center>
            <a href="https://etherscan.io/tx/${txId}" class="button" target="_blank">View on Blockchain</a>
        </center>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Thank you for choosing our platform!</p>
        
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} Investment Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    _getAdminDepositTemplate({ userEmail, userName, amount, txId, depositId, userId }) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #2196F3; }
        .icon { font-size: 48px; }
        .amount { font-size: 32px; font-weight: bold; color: #2196F3; text-align: center; margin: 20px 0; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; word-break: break-all; }
        .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">💰</div>
            <h2>New Deposit Received</h2>
        </div>
        
        <p>A new deposit has been successfully processed and credited.</p>
        
        <div class="amount">$${amount} USDT</div>
        
        <div class="details">
            <div class="details-row">
                <span class="label">User:</span>
                <span class="value">${userName}</span>
            </div>
            <div class="details-row">
                <span class="label">Email:</span>
                <span class="value">${userEmail}</span>
            </div>
            <div class="details-row">
                <span class="label">User ID:</span>
                <span class="value">${userId}</span>
            </div>
            <div class="details-row">
                <span class="label">Amount:</span>
                <span class="value">$${amount} USDT</span>
            </div>
            <div class="details-row">
                <span class="label">Deposit ID:</span>
                <span class="value">${depositId}</span>
            </div>
            <div class="details-row">
                <span class="label">Transaction Hash:</span>
                <span class="value">${txId}</span>
            </div>
            <div class="details-row">
                <span class="label">Status:</span>
                <span class="value" style="color: #4CAF50; font-weight: bold;">✓ Completed & Credited</span>
            </div>
        </div>
        
        <p><strong>Action Required:</strong> None - Deposit automatically verified and credited.</p>
        
        <p>View transaction: <a href="https://etherscan.io/tx/${txId}" target="_blank">Etherscan</a></p>
        
        <div class="footer">
            <p>Admin Notification - Investment Platform</p>
            <p>© ${new Date().getFullYear()} Investment Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

module.exports = { DepositEmailService };
