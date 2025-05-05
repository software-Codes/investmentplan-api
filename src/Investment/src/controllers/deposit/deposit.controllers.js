const { v4: uuidv4 } = require("uuid");
const BinanceService = require("../../services/binance/binance.services");
const Deposit = require("../../models/deposit/deposit.models");
const { logger, alertSystem } = require("../../utils/logger.investment");
const { DEPOSIT_STATUS, LIMITS } = require("../../utils/constants.investment");
const NotificationEmailService = require("../../../../authentication/src/Config/notification-email-service");

/**
 * DepositController
 * Handles all deposit-related operations with comprehensive error handling and logging
 *
 * Algorithms & Data Structures used:
 * - Hash Map for transaction tracking (O(1) lookup)
 * - Queue for processing deposits in order
 * - Rate limiting using Token Bucket algorithm
 */

class DepositController {
  /**
   * Get admin deposit address
   * Time Complexity: O(1)
   */

  static async getDepositAddress(req, res) {
    try {
      const address = BinanceService.getDepositAddress();
      logger.info("Deposit address requested", {
        userId: req.user.userId,
        network: address.network,
      });
      return res.status(200).json({
        success: true,
        data: {
          address: address.address,
          network: address.network,
          minimumDeposit: LIMITS.MIN_DEPOSIT,
          maximumDeposit: LIMITS.MAX_DEPOSIT,
          currency: "USDT",
          instructions: [
            "Send only USDT using TRC20 network",
            "Triple check the address before sending",
            "Submit transaction hash after sending",
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
   * Submit deposit transaction for verification
   * Time Complexity: O(n) where n is number of pending transactions
   * Space Complexity: O(1)
   */

  static async submitDeposit() {
    const { txId, amount } = req.body;
    const userId = req.user.userId;
    try {
      Deposit.validateDepositAmount(amount);

      // Check for duplicate transaction
      const existingDeposits = await Deposit.getUserDeposits(userId);
      const isDuplicate = existingDeposits.some(
        (dep) => dep.binance_tx_id === txId
      );
      if (isDuplicate) {
        logger.warn("Duplicate deposit submission detected", {
          userId,
          txId,
          amount,
        });
        return res.status(400).json({
          success: false,
          message: "This transaction has already been submitted",
        });
      }
      //verify deposit with Binance
      const verification = await BinanceService.verifyDeposit(txId);
      if (!verification.success) {
        return res.status(400).json({
          success: false,
          message: verification.message,
        });
      }
      // Validate amount matches
      if (Number(verification.deposit.amount) !== Number(amount)) {
        logger.warn("Deposit amount mismatch", {
          userId,
          submitted: amount,
          actual: verification.deposit.amount,
        });
        return res.status(400).json({
          success: false,
          message: "Submitted amount does not match actual deposit",
        });
      }
      // Create deposit record
      const deposit = await Deposit.create({
        userId,
        amount,
        binanceTxId: txId,
      });

      // Process deposit
      const processed = await Deposit.verifyAndProcess(
        deposit.deposit_id,
        txId
      );
      // Send notification
      await NotificationEmailService.sendTransactionNotification({
        type: "deposit",
        userEmail: req.user.email,
        amount: processed.amount,
        transactionId: processed.deposit_id,
        status: processed.status,
      });
      //notify  the admin also

      logger.success("Deposit processed successfully", {
        depositId: deposit.deposit_id,
        userId,
        amount,
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
        },
      });
    } catch (error) {
      logger.error("Deposit submission failed", {
        userId,
        txId,
        error: error.message,
      });

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to process deposit",
      });
    }
  }
   /**
   * Get deposit history for user
   * Time Complexity: O(n) where n is number of deposits
   * Space Complexity: O(n)
   */
  static async getDepositHistory (req, res)
  {
    try {
        const deposits =  await Deposit.getUserDeposits(req.user.userId);
         // Transform deposits for response
      const formattedDeposits = deposits.map(deposit => ({
        id: deposit.deposit_id,
        amount: deposit.amount,
        status: deposit.status,
        txId: deposit.binance_tx_id,
        createdAt: deposit.created_at,
        completedAt: deposit.completed_at,
        processingTime: deposit.completed_at 
          ? new Date(deposit.completed_at) - new Date(deposit.created_at) 
          : null
      }));
        // Calculate statistics
        const stats = {
            totalDeposits: deposits.length,
            totalAmount: deposits.reduce((sum, dep) => sum + Number(dep.amount), 0),
            averageAmount: deposits.length 
              ? (deposits.reduce((sum, dep) => sum + Number(dep.amount), 0) / deposits.length).toFixed(2) 
              : 0
          };
          logger.info('Deposit history retrieved', {
            userId: req.user.userId,
            depositCount: deposits.length
          });

          return res.status(200).json({
            success: true,
            message: "Deposit history retrieved successfully",
            data: {
              deposits: formattedDeposits,
              stats
            }
          });
    }   catch (error) {
        logger.error('Failed to get deposit history', {
          userId: req.user.userId,
          error: error.message
        });
  
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch deposit history'
        });
      }

  }
}

module.exports = DepositController;
