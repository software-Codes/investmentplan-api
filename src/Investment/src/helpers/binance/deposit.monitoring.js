const { Spot } = require("@binance/connector");
const { logger } = require("../../utils/logger.investment");
const Deposit = require("../../models/deposit/deposit.models");
const BinanceService = require("../../services/binance/binance.services");
const NotificationEmailService = require("../../helpers/email/investment.nodemailer.user");
const crypto = require("crypto");
const { DEPOSIT_STATUS } = require("../../utils/constants.investment");

/**
 * DepositMonitorService
 * Monitors and processes deposits using both polling and webhooks
 * Uses rate limiting and exponential backoff for API calls
 */
class DepositMonitorService {
  constructor() {
    this.binanceClient = new Spot(
      process.env.BINANCE_API_KEY,
      process.env.BINANCE_API_SECRET
    );
    this.adminAddress = process.env.ADMIN_BINANCE_ADDRESS;
    this.webhookSecret = process.env.BINANCE_WEBHOOK_SECRET;
    this.lastCheckTimestamp = Date.now();
    this.POLLING_INTERVAL =
      parseInt(process.env.DEPOSIT_POLLING_INTERVAL) || 60000;
    this.retryAttempts = 0;
    this.MAX_RETRIES = 3;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring deposits with error recovery
   */
  async startMonitoring() {
    try {
      if (this.isMonitoring) {
        logger.warn("Deposit monitor already running");
        return;
      }

      this.isMonitoring = true;
      logger.info("Starting deposit monitor service", {
        adminAddress: this.adminAddress,
        pollingInterval: this.POLLING_INTERVAL,
      });

      await this.validateConfig();
      await this.startPolling();

      logger.info("Deposit monitoring started successfully");
    } catch (error) {
      this.isMonitoring = false;
      logger.error("Failed to start deposit monitoring:", error);
      throw error;
    }
  }

  /**
   * Validate configuration before starting
   */
  async validateConfig() {
    if (!this.adminAddress) {
      throw new Error("Admin address not configured");
    }

    try {
      // Test Binance API connection
      await this.binanceClient.time();
    } catch (error) {
      throw new Error(`Binance API connection failed: ${error.message}`);
    }
  }

  /**
   * Poll for new deposits with exponential backoff retry
   */
  async startPolling() {
    const poll = async () => {
      try {
        const deposits = await this.fetchNewDeposits();

        for (const deposit of deposits) {
          await this.processNewDeposit(deposit);
        }

        this.retryAttempts = 0; // Reset retry counter on success
        this.lastCheckTimestamp = Date.now();
      } catch (error) {
        this.retryAttempts++;
        const backoffTime = Math.min(
          1000 * Math.pow(2, this.retryAttempts),
          30000
        );

        logger.error("Polling failed, will retry", {
          attempt: this.retryAttempts,
          nextRetryIn: backoffTime,
          error: error.message,
        });

        if (this.retryAttempts >= this.MAX_RETRIES) {
          await NotificationEmailService.sendAdminNotification({
            type: "monitor_error",
            message: "Deposit monitoring failed after maximum retries",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    };

    setInterval(poll, this.POLLING_INTERVAL);
  }

  /**
   * Fetch new deposits from Binance
   */
  async fetchNewDeposits() {
    const { data } = await this.binanceClient.depositHistory({
      startTime: this.lastCheckTimestamp,
      coin: "USDT",
    });

    return data.filter(
      (deposit) => deposit.address === this.adminAddress && deposit.status === 1 // Completed deposits only
    );
  }

  /**
   * Process a new deposit with detailed logging
   */
  async processNewDeposit(deposit) {
    const logContext = {
      txId: deposit.txId,
      amount: deposit.amount,
      network: deposit.network,
    };

    try {
      logger.info("Processing new deposit", logContext);

      const existingDeposit = await Deposit.findByTxId(deposit.txId);
      if (existingDeposit) {
        logger.info("Deposit already processed", logContext);
        return;
      }

      const depositRecord = await Deposit.create({
        binanceTxId: deposit.txId,
        amount: deposit.amount,
        status: DEPOSIT_STATUS.PENDING,
        network: deposit.network,
        adminAddress: this.adminAddress,
      });

      const verification = await BinanceService.verifyDeposit(deposit.txId);
      if (!verification.success) {
        logger.warn("Deposit verification failed", {
          ...logContext,
          reason: verification.message,
        });
        return;
      }

      await Deposit.update(depositRecord.deposit_id, {
        status: DEPOSIT_STATUS.COMPLETED,
        verifiedAt: new Date(),
      });

      // Send notifications
      await Promise.all([
        NotificationEmailService.sendAdminNotification({
          type: "new_deposit",
          amount: deposit.amount,
          txId: deposit.txId,
        }),
        this.notifyUser(deposit),
      ]);

      logger.info("Deposit processed successfully", {
        ...logContext,
        depositId: depositRecord.deposit_id,
      });
    } catch (error) {
      logger.error("Failed to process deposit", {
        ...logContext,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature, timestamp, body) {
    const payload = timestamp + JSON.stringify(body);
    const computedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    return computedSignature === signature;
  }

  /**
   * Handle webhook notification
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers["x-binance-signature"];
      const timestamp = req.headers["x-binance-timestamp"];

      if (!this.verifyWebhookSignature(signature, timestamp, req.body)) {
        logger.warn("Invalid webhook signature received");
        return res.status(401).json({ message: "Invalid signature" });
      }

      const { data } = req.body;
      if (data.type === "deposit" && data.address === this.adminAddress) {
        await this.processNewDeposit(data);
      }

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      logger.error("Webhook processing failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    this.isMonitoring = false;
    logger.info("Deposit monitoring stopped");
  }
}

module.exports = new DepositMonitorService();
