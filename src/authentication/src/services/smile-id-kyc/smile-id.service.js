/**
 * @file smile-id.service.js
 * @description Service for interacting with the Smile Identity API for KYC (Know Your Customer) verification.
 * This service provides methods to initiate a verification process and retrieve the status of a verification.
 */

const smileIdentity = require("smile-identity-core");

class smileIDService {
  /**
   * Initializes the Smile ID Service with the required API key and application ID.
   *
   * @param {string} apiKey - The API key provided by Smile Identity.
   * @param {string} appId - The application ID provided by Smile Identity.
   */
  constructor(apiKey, appId) {
    this.smileIdentity = new smileIdentity({ apiKey, appId });
  }

  /**
   * Initiates a KYC verification process using Smile Identity.
   *
   * @param {Object} verificationData - The data required to initiate the verification process.
   * @returns {Promise<Object>} The response from the Smile Identity API containing verification details.
   * @throws {Error} Throws an error if the verification process fails.
   */
  async initiateVerification(verificationData) {
    try {
      const response = await this.smileIdentity.initiateVerification(
        verificationData
      );
      return response;
    } catch (error) {
      throw new Error(`Smile ID verification failed: ${error.message}`);
    }
  }

  /**
   * Retrieves the status of a previously initiated KYC verification.
   *
   * @param {string} verificationId - The unique ID of the verification process.
   * @returns {Promise<Object>} The response from the Smile Identity API containing the verification status.
   * @throws {Error} Throws an error if the status retrieval process fails.
   */
  async getVerificationStatus(verificationId) {
    try {
      const response = await this.smileIdentity.getVerificationStatus(
        verificationId
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to get verification status: ${error.message}`);
    }
  }
}

module.exports = smileIDService;