const { v4: uuidv4 } = require("uuid");
const BinanceService = require("../../services/binance/binance.services");
const Deposit = require("../../models/deposit/deposit.models");
const { logger } = require("../../utils/logger.investment");
const { DEPOSIT_STATUS, LIMITS } = require("../../utils/constants.investment");
const NotificationEmailService = require("../../../../authentication/src/Config/notification-email-service");
const DepositMonitorService = require("../../helpers/binance/deposit.monitoring");

/**
 * DepositController
 * Handles all deposit-related operations with comprehensive error handling,
 * real-time notifications, and payment verification.
 *
 * Implementation follows the technical architecture outlined in README.md
 */
class DepositController {
  /**
   * Get admin deposit address
   * @algorithm Time Complexity: O(1)
   */
  static async getDepositAddress(req, res) {
    try {
      const address = BinanceService.getDepositAddress();

      // Start monitoring for this user's deposits
      await DepositMonitorService.startMonitoring();

      logger.info("Deposit address requested", {
        userId: req.user.userId,
        network: address.network,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: {
          address: address.address,
          network: address.network,
          minimumDeposit: LIMITS.MIN_DEPOSIT,
          maximumDeposit: LIMITS.MAX_DEPOSIT,
          currency: "USDT",
          expectedProcessingTime: "5-15 minutes",
          instructions: [
            "Send only USDT using TRC20 network",
            "Triple check the address before sending",
            "Submit transaction hash immediately after sending",
            "Keep transaction hash for reference",
          ],
        },
      });
    } catch (error) {
      logger.error("Failed to get deposit address", {
        userId: req.user.userId,
        error: error.message,
      });
      return res.status(500).json({
        success: false,
        message: "Failed to get deposit address",
      });
    }
  }

  /**
   * Submit and verify deposit transaction
   * @algorithm Time Complexity: O(n) where n is number of pending transactions
   * @algorithm Space Complexity: O(1)
   */
  static async submitDeposit(req, res) {
    const { txId, amount } = req.body;
    const userId = req.user.userId;

    const logContext = {
      userId,
      txId,
      amount,
      timestamp: new Date().toISOString(),
    };

    try {
      // Validate deposit amount
      Deposit.validateDepositAmount(amount);

      // Check for duplicate transaction
      const existingDeposit = await Deposit.findByTxId(txId);
      if (existingDeposit) {
        logger.warn("Duplicate deposit submission detected", logContext);
        return res.status(400).json({
          success: false,
          message: "This transaction has already been submitted",
        });
      }

      // Create pending deposit record
      const depositRecord = await Deposit.create({
        userId,
        amount,
        binanceTxId: txId,
        status: DEPOSIT_STATUS.PENDING,
      });

      // Start verification process
      const verification = await BinanceService.verifyDeposit(txId);

      if (!verification.success) {
        logger.warn("Deposit verification failed", {
          ...logContext,
          reason: verification.message,
        });
        return res.status(400).json({
          success: false,
          message: verification.message,
        });
      }

      // Validate amount matches
      if (
        Math.abs(Number(verification.deposit.amount) - Number(amount)) > 0.01
      ) {
        logger.warn("Deposit amount mismatch", {
          ...logContext,
          actual: verification.deposit.amount,
        });
        return res.status(400).json({
          success: false,
          message: "Submitted amount does not match actual deposit",
        });
      }

      // Process the deposit
      const processed = await Deposit.verifyAndProcess(
        depositRecord.deposit_id,
        txId
      );

      // Send notifications
      await Promise.all([
        // Notify user
        NotificationEmailService.sendTransactionNotification({
          type: "deposit",
          userEmail: req.user.email,
          amount: processed.amount,
          transactionId: processed.deposit_id,
          status: processed.status,
        }),
        // Notify admin for large deposits
        amount >= LIMITS.LARGE_DEPOSIT_THRESHOLD &&
          NotificationEmailService.sendAdminNotification({
            type: "large_deposit",
            amount,
            userId,
            txId,
          }),
      ]);

      logger.info("Deposit processed successfully", {
        ...logContext,
        depositId: processed.deposit_id,
        status: processed.status,
      });

      return res.status(200).json({
        success: true,
        message: "Deposit processed successfully",
        data: {
          depositId: processed.deposit_id,
          amount: processed.amount,
          status: processed.status,
          createdAt: processed.created_at,
          completedAt: processed.completed_at,
          estimatedCrediting: new Date(Date.now() + 15 * 60000).toISOString(),
        },
      });
    } catch (error) {
      logger.error("Deposit submission failed", {
        ...logContext,
        error: error.message,
      });

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to process deposit",
      });
    }
  }

  /**
   * Get detailed deposit history with statistics
   * @algorithm Time Complexity: O(n) where n is number of deposits
   * @algorithm Space Complexity: O(n)
   */
  static async getDepositHistory(req, res) {
    try {
      const deposits = await Deposit.getUserDeposits(req.user.userId);

      // Transform deposits for response
      const formattedDeposits = deposits.map((deposit) => ({
        id: deposit.deposit_id,
        amount: deposit.amount,
        status: deposit.status,
        txId: deposit.binance_tx_id,
        createdAt: deposit.created_at,
        completedAt: deposit.completed_at,
        processingTime: deposit.completed_at
          ? Math.round(
              (new Date(deposit.completed_at) - new Date(deposit.created_at)) /
                1000
            )
          : null,
        network: deposit.network,
      }));

      // Calculate statistics
      const stats = {
        totalDeposits: deposits.length,
        totalAmount: deposits.reduce((sum, dep) => sum + Number(dep.amount), 0),
        averageAmount: deposits.length
          ? (
              deposits.reduce((sum, dep) => sum + Number(dep.amount), 0) /
              deposits.length
            ).toFixed(2)
          : 0,
        fastestProcessing: Math.min(
          ...deposits.map((d) =>
            d.completed_at
              ? (new Date(d.completed_at) - new Date(d.created_at)) / 1000
              : Infinity
          )
        ),
        pendingDeposits: deposits.filter(
          (d) => d.status === DEPOSIT_STATUS.PENDING
        ).length,
      };

      logger.info("Deposit history retrieved", {
        userId: req.user.userId,
        depositCount: deposits.length,
        totalAmount: stats.totalAmount,
      });

      return res.status(200).json({
        success: true,
        message: "Deposit history retrieved successfully",
        data: {
          deposits: formattedDeposits,
          stats,
          pagination: {
            total: deposits.length,
            limit: 50,
            hasMore: deposits.length >= 50,
          },
        },
      });
    } catch (error) {
      logger.error("Failed to get deposit history", {
        userId: req.user.userId,
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to fetch deposit history",
      });
    }
  }
}

module.exports = DepositController;
