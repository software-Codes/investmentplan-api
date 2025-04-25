/**
 * @file smile-id.service.js
 * @description Service for interacting with the Smile Identity API for KYC verification.
 */

const SmileIdentityCore = require("smile-identity-core");
const { logger } = require("../../utils/logger");

class SmileIDService {
  /**
   * Initializes the Smile ID Service with the required credentials
   *
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - The API key provided by Smile Identity
   * @param {string} config.partnerId - The partner ID provided by Smile Identity
   * @param {string} config.callbackUrl - Optional callback URL for verification results
   * @param {string} config.environment - API environment ('test' or 'production')
   */
  constructor(config) {
    const { apiKey, partnerId, callbackUrl, environment = "test" } = config;

    if (!apiKey || !partnerId) {
      throw new Error("Smile ID API key and Partner ID are required");
    }
    this.config = {
      apiKey,
      partnerId: parseInt(partnerId, 10),
      callbackUrl,
      environment,
    };
    // Initialize Smile Identity SDK
    this.WebApi = new SmileIdentityCore.WebApi(
      this.config.partnerId,
      this.config.apiKey,
      this.config.environment
    );
    logger.info("Smile Id service initialized");
  }
  /**
   * Performs document verification using Smile Identity's Document Verification API
   *
   * @param {Object} data - Document verification data
   * @param {string} data.userId - User ID in your system
   * @param {string} data.countryCode - ISO country code (e.g., 'NG', 'KE')
   * @param {string} data.documentType - Type of document (ID_CARD, PASSPORT, etc.)
   * @param {string} data.documentNumber - The ID number on the document
   * @param {Buffer|string} data.documentImage - Document image buffer or base64 string
   * @returns {Promise<Object>} - Verification result
   */
  async verifyDocument(data) {
    try {
      logger.info(`Starting document verification for user: ${data.userId}`);
      const jobType = 5; // Document Verification job type

      // Prepare job parameters
      const jobParams = {
        user_id: data.userId,
        job_id: `doc_verify_${Date.now()}`,
        job_type: jobType,
      };
      // Prepare ID info
      const idInfo = {
        country: data.countryCode,
        id_type: data.documentType,
        id_number: data.documentNumber,
      };
      // Prepare image(s)
      let images = {};
      if (Buffer.isBuffer(data.documentImage)) {
        // Convert buffer to base64
        images.id_card = data.documentImage.toString("base64");
      } else if (typeof data.documentImage === "string") {
        // Assume it's already base64
        images.id_card = data.documentImage;
      } else {
        throw new Error(
          "Document image must be provided as Buffer or base64 string"
        );
      }
      // Prepare optional callback
      const options = {};
      if (this.config.callbackUrl) {
        options.callback_url = this.config.callbackUrl;
      } // Submit for verification
      const response = await this.WebApi.submitJob(
        jobParams,
        idInfo,
        images,
        options
      );
      logger.info(`Document verification initiated for user ${data.userId}`);
      return response;
    } catch (error) {
      logger.error(`Smile ID verification failed: ${error.message}`, { error });
      throw new Error(`Document verification failed: ${error.message}`);
    }
  }
  /**
   * Retrieves the status of a verification job
   *
   * @param {string} userId - User ID used in the verification
   * @param {string} jobId - Job ID returned from verification initiation
   * @returns {Promise<Object>} - Verification status
   */
  async getVerificationStatus(userId, jobId) {
    try {
      logger.info(
        `Getting verification status for user ${userId}, job ${jobId}`
      );

      const response = await this.WebApi.getJobStatus({
        user_id: userId,
        job_id: jobId,
      });
      logger.info(`Retrieved verification status for job ${jobId}`);
      return response;
    } catch (error) {
      logger.error(`Failed to get verification status: ${error.message}`, {
        error,
      });
      throw new Error(`Failed to get verification status: ${error.message}`);
    }
  }
}

module.exports = SmileIDService;