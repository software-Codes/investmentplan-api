const crypto = require('crypto');
const {logger} = require('../utils/logger.investment');
const DepositMonitorService = require('../helpers/binance/deposit.monitoring');

class WebhookService
{
    constructor() {
        this.webhookSecret = process.env.BINANCE_WEBHOOK_SECRET;
      }
        /**
   * Verify Binance webhook signature
   * @param {string} signature - Webhook signature from headers
   * @param {string} timestamp - Webhook timestamp
   * @param {string} body - Raw request body
   */
        verifySignature(signature, timestamp, body) {
            const payload = timestamp + body;
            const computedSignature = crypto
              .createHmac('sha256', this.webhookSecret)
              .update(payload)
              .digest('hex');
            
            return computedSignature === signature;
          }
            /**
   * Process webhook event
   * @param {Object} event - Webhook event data
   */
  async processEvent(event) {
    switch (event.type) {
      case 'DEPOSIT':
        await DepositMonitorService.processNewDeposit(event.data);
        break;
      // Add other event types as needed
      default:
        logger.warn(`Unhandled webhook event type: ${event.type}`);
    }
  }

}

module.exports = new WebhookService();