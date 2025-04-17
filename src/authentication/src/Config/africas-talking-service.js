/**
 * @file otp-sms-service.js
 * @description Service for sending OTP codes via SMS using Africa's Talking API
 */

const africastalking = require('africastalking');

/**
 * SMS service for sending OTPs using Africa's Talking
 */
class OtpSmsService {
    /**
     * Creates and initializes the Africa's Talking SMS service
     * @returns {Object} Initialized SMS service
     * @private
     */
    static _initializeSmsService() {
        // Initialize the SDK with your Africa's Talking credentials
        const africastalkingConfig = {
            apiKey: process.env.AFRICASTALKING_API_KEY,
            username: process.env.AFRICASTALKING_USERNAME
        };

        const africastalkingClient = africastalking(africastalkingConfig);
        return africastalkingClient.SMS;
    }

    /**
     * Sends an OTP code to the specified phone number via SMS
     * @param {string} phoneNumber - Recipient's phone number (with country code)
     * @param {string} otpCode - The OTP code to send
     * @param {string} purpose - The purpose of the OTP (e.g., 'registration', 'login')
     * @returns {Promise<Object>} The result of the SMS sending operation
     * @throws {Error} If the SMS sending fails
     */
    static async sendOtp(phoneNumber, otpCode, purpose) {
        try {
            const smsService = this._initializeSmsService();

            // Create a message based on the purpose
            const message = this._getSmsMessage(otpCode, purpose);

            // Ensure the phone number is properly formatted
            const formattedPhoneNumber = this._formatPhoneNumber(phoneNumber);

            // Send the SMS
            const result = await smsService.send({
                to: formattedPhoneNumber,
                message: message,
                from: process.env.AFRICASTALKING_SENDER_ID || undefined // Use sender ID if available
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to send OTP SMS: ${error.message}`);
        }
    }

    /**
     * Formats the phone number to ensure it includes the country code
     * @param {string} phoneNumber - The phone number to format
     * @returns {string} Properly formatted phone number
     * @private
     */
    static _formatPhoneNumber(phoneNumber) {
        // Remove any spaces, dashes, or parentheses
        let formattedNumber = phoneNumber.replace(/[\s\-()]/g, '');

        // If the number doesn't start with '+', add the default country code (assuming +254 for Kenya)
        if (!formattedNumber.startsWith('+')) {
            // If it starts with '0', replace the leading '0' with the country code
            if (formattedNumber.startsWith('0')) {
                formattedNumber = `+254${formattedNumber.substring(1)}`;
            } else {
                // If it doesn't start with '0', assume it's already without country code
                formattedNumber = `+254${formattedNumber}`;
            }
        }

        return formattedNumber;
    }

    /**
     * Gets the appropriate SMS message based on the OTP purpose
     * @param {string} otpCode - The OTP code to include in the message
     * @param {string} purpose - The purpose of the OTP
     * @returns {string} The SMS message
     * @private
     */
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