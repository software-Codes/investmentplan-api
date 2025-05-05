const WebhookService = require("../../webhooks/");
const { logger } = require("../../utils/logger.investment");

class WebhookController {
  static async handleWebhook(req, res) {
    try {
      const signature = req.headers["x-binance-signature"];
      const timestamp = req.headers["x-binance-timestamp"];
      const rawBody = req.rawBody; // You'll need body-parser raw handler
      // Verify webhook signature
      if (!WebhookService.verifySignature(signature, timestamp, rawBody)) {
        logger.warn("Invalid webhook signature received");
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Process the webhook event
      await WebhookService.processEvent(req.body);
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      logger.error("Webhook processing failed:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  }
}


module.exports = WebhookController;