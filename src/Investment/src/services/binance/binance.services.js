/**
 * @file binance.config.js
 * @description Service for interacting with Binance API for deposits, withdrawals, and transaction status.
 */

const { Spot } = require("@binance/connector");
const { logger } = require("../../utils/logger.investment");
const NotificationEmailService = require("../../../../authentication/src/Config/notification-email-service");

/**
 * BinanceService
 * Handles all Binance API interactions for the investment platform.
 */

class BinanceService {
  /**
   * Initializes the Binance Spot API client.
   * Uses API credentials from environment variables.
   */
  constructor() {
    this.client = new Spot(
      process.env.BINANCE_API_KEY,
      process.env.BINANCE_API_SECRET
    );
    this.network = process.env.BINANCE_NETWORK || "TRC20"; // Default to TRC20 for USDT
  }
  /**
   * Get the fixed admin-controlled deposit address.
   * @returns {Object} Deposit address and network.
   * @algorithm O(1) - Directly returns from config/env.
   */
  getDepositAddress() {
    // In a real-world scenario, this could be fetched from a secure config or DB.
    return {
      address: process.env.ADMIN_BINANCE_ADDRESS,
      network: this.network,
      message:
        "Send only USDT (TRC20) to this address. Double-check before sending.",
    };
  }
  /**
   * Verify a deposit transaction by transaction hash.
   * @param {string} txId - The transaction hash provided by the user.
   * @returns {Promise<Object>} Verification result.
   * @algorithm O(n) - Scans deposit history for matching txId.
   * @dsa Array scan (Binance API returns array of deposits).
   */
  async verifyDeposit(txId) {
    try {
      const history = await this.client.depositHistory({ coin: "USDT" });
      // O(n) scan for the transaction hash
      const deposit = history.data.find(
        (item) => String(item.txId) === String(txId) && item.status === 1
      );
      if (deposit) {
        logger.info(`Deposit verified: ${txId}`);
        return {
          success: true,
          deposit,
          message: "Deposit verified and confirmed on Binance.",
        };
      } else {
        logger.warn(`Deposit not found or not confirmed: ${txId}`);
        return {
          success: false,
          message:
            "Deposit not found or not confirmed yet. Please check your transaction hash and try again.",
        };
      }
    } catch (error) {
      logger.error(`Failed to verify deposit ${txId}: ${error.message}`);
      return {
        success: false,
        message: "Failed to verify deposit. Please try again later.",
        error: error.message,
      };
    }
  }
  /**
   * Initiate a withdrawal to a specified Binance address.
   * @param {Object} data - Withdrawal data.
   * @param {string} data.address - Recipient's Binance address.
   * @param {number} data.amount - Amount to withdraw.
   * @param {string} data.withdrawalId - Unique withdrawal ID for tracking.
   * @param {string} data.userEmail - Email of the user (for notification).
   * @returns {Promise<Object>} Withdrawal result.
   * @algorithm O(1) - Single API call to Binance.
   */
  async withdrawFunds() {
    try {
      const response = await this.client.withdraw(
        "USDT",
        data.address,
        data.amount,
        {
          network: this.network,
          withdrawOrderId: data.withdrawalId,
        }
      );

      logger.info(
        `Withdrawal initiated: ${response.data.id} for user ${data.userEmail}`
      );
      // Notify user of withdrawal initiation
      await NotificationEmailService.sendTransactionNotification({
        type: "withdrawal",
        userEmail: data.userEmail,
        amount: data.amount,
        transactionId: response.data.id,
        status: "processing",
      });
      return {
        success: true,
        withdrawalId: response.data.id,
        message:
          "Withdrawal initiated successfully. You will be notified once it is completed.",
      };
    } catch (error) {
      logger.error(
        `Withdrawal failed for user ${data.userEmail}: ${error.message}`
      );
      // Optionally notify user of failure
      await NotificationEmailService.sendTransactionNotification({
        type: "withdrawal",
        userEmail: data.userEmail,
        amount: data.amount,
        transactionId: data.withdrawalId,
        status: "failed",
      });
      return {
        success: false,
        message: "Withdrawal failed. Please try again later.",
        error: error.message,
      };
    }
  }
  /**
   * Get the status of a withdrawal transaction.
   * @param {string} txId - The Binance withdrawal transaction ID.
   * @returns {Promise<Object>} Transaction status result.
   * @algorithm O(n) - Scans withdrawal history for matching txId.
   * @dsa Array scan.
   */
  async getTransactionStatus() {
    try {
      const history = await this.client.withdrawHistory({ coin: "USDT" });
      // O(n) scan for the transaction id
      const tx = history.data.find((item) => String(item.id) === String(txId));
      if (tx) {
        logger.info(`Transaction status for ${txId}: ${tx.status}`);
        return {
          success: true,
          status: tx.status,
          tx,
        };
      } else {
        logger.warn(`Transaction not found: ${txId}`);
        return {
          success: false,
          message: "Transaction not found.",
        };
      }
    } catch (error) {
      logger.error(
        `Failed to get transaction status for ${txId}: ${error.message}`
      );
      return {
        success: false,
        message: "Failed to get transaction status.",
        error: error.message,
      };
    }
  }
}

module.exports = new BinanceService();
