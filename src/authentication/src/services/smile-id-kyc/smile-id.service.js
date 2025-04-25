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

    // Set server value based on environment (0 for test, 1 for production)
    const serverValue = environment === "production" ? "1" : "0";

    // Initialize Smile Identity SDK with the correct parameters according to documentation
    this.WebApi = new SmileIdentityCore.WebApi(
      partnerId,
      callbackUrl || "",
      apiKey,
      serverValue
    );

    this.config = {
      apiKey,
      partnerId,
      callbackUrl,
      environment,
      serverValue,
    };

    logger.info(
      `Smile ID service initialized in ${environment} environment (server: ${serverValue})`
    );
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

      if (!data.documentNumber || data.documentNumber.trim() === "") {
        throw new Error(
          "Document number (id_number) is required for verification"
        );
      }

      // Create required tracking parameters
      const partnerParams = {
        user_id: data.userId,
        job_id: `doc_verify_${Date.now()}`,
        job_type: jobType,
      };

      // Create the ID info object
      const idInfo = {
        country: data.countryCode,
        id_type: data.documentType,
        id_number: data.documentNumber,
      };

      logger.info(`ID info for verification: ${JSON.stringify(idInfo)}`);

      // Prepare image details
      let imageDetails = [];
      let imageContent;

      if (Buffer.isBuffer(data.documentImage)) {
        imageContent = data.documentImage.toString("base64");
      } else if (typeof data.documentImage === "string") {
        imageContent = data.documentImage;
      } else {
        throw new Error(
          "Document image must be provided as Buffer or base64 string"
        );
      }

      // Use image_type_id 3 for base64 encoded front of ID document
      imageDetails.push({
        image_type_id: 3,
        image: imageContent,
      });

      // Set options for the job
      const options = {
        return_job_status: true,
        return_history: false,
        return_image_links: false,
      };

      // Add callback URL if provided
      if (this.config.callbackUrl) {
        options.callback_url = this.config.callbackUrl;
      }

      // Submit the job
      const response = await this.WebApi.submit_job(
        partnerParams,
        imageDetails,
        idInfo,
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

      const response = await this.WebApi.get_job_status({
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
