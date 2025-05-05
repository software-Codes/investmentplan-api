const express = require('express');
const router = express.Router();
const WebhookController = require('../../controllers/webhook/webhook.controller');

router.post('/binance', WebhookController.handleWebhook);


module.exports = router;