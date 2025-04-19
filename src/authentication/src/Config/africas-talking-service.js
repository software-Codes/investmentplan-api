// Config/africas-talking-service.js
const africastalking = require('africastalking');

class OtpSmsService {
    // Initialize the Africa's Talking SMS service once
    static _smsService = null;

    static _initializeSmsService() {
        if (!this._smsService) {
            const africastalkingConfig = {
                apiKey: process.env.AFRICASTALKING_API_KEY,
                username: process.env.AFRICASTALKING_USERNAME
            };

            const africastalkingClient = africastalking(africastalkingConfig);
            this._smsService = africastalkingClient.SMS;
        }
        return this._smsService;
    }

    static async sendOtp(phoneNumber, otpCode, purpose) {
        try {
            const smsService = this._initializeSmsService();

            const message = this._getSmsMessage(otpCode, purpose);
            const formattedPhoneNumber = this._formatPhoneNumber(phoneNumber);

            const result = await smsService.send({
                to: formattedPhoneNumber,
                message: message,
                from: process.env.AFRICASTALKING_SENDER_ID || 'sandbox' // Default sender ID
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to send OTP SMS: ${error.message}`);
        }
    }

    static _formatPhoneNumber(phoneNumber) {
        let formattedNumber = phoneNumber.replace(/[\s\-()]/g, '');
        if (!formattedNumber.startsWith('+')) {
            if (formattedNumber.startsWith('0')) {
                formattedNumber = `+254${formattedNumber.substring(1)}`;
            } else {
                formattedNumber = `+254${formattedNumber}`;
            }
        }
        return formattedNumber;
    }

    static _getSmsMessage(otpCode, purpose) {
        let actionText;

        switch (purpose.toLowerCase()) {
            case 'registration':
                actionText = 'complete your registration';
                break;
            case 'login':
                actionText = 'log into your account';
                break;
            case 'reset_password':
                actionText = 'reset your password';
                break;
            default:
                actionText = 'verify your identity';
        }

        return `Your verification code is: ${otpCode}. Use this code to ${actionText}. It will expire in 10 minutes.`;
    }
}

module.exports = OtpSmsService;