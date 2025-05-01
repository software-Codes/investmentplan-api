// const SmileIdentityCore = require("smile-identity-core");
// const { logger } = require("../../utils/logger");

// class SmileIDService {
//   /**
//    * Initializes the Smile ID Service with the required credentials
//    *
//    * @param {Object} config - Configuration object
//    * @param {string} config.apiKey - The API key provided by Smile Identity
//    * @param {string} config.partnerId - The partner ID provided by Smile Identity
//    * @param {string} config.callbackUrl - Optional callback URL for verification results
//    * @param {string} config.environment - API environment ('test' or 'production')
//    */
//   constructor(config) {
//     const { apiKey, partnerId, callbackUrl, environment = "test" } = config;

//     if (!apiKey || !partnerId) {
//       throw new Error("Smile ID API key and Partner ID are required");
//     }

//     // Set server value based on environment (0 for test, 1 for production)
//     const serverValue = environment === "production" ? 1 : 0;

//     // Initialize Smile Identity SDK with the correct parameters according to documentation
//     this.WebApi = new SmileIdentityCore.WebApi(
//       partnerId,
//       callbackUrl || "",
//       apiKey,
//       serverValue
//     );

//     this.config = {
//       apiKey,
//       partnerId,
//       callbackUrl,
//       environment,
//       serverValue,
//     };

//     logger.info(
//       `Smile ID service initialized in ${environment} environment (server: ${serverValue})`
//     );
//   }

//   /**
//    * Performs document verification using Smile Identity's Document Verification API
//    *
//    * @param {Object} data - Document verification data
//    * @param {string} data.userId - User ID in your system
//    * @param {string} data.countryCode - ISO country code (e.g., 'NG', 'KE')
//    * @param {string} data.documentType - Type of document (PASSPORT, ID_CARD, etc.)
//    * @param {string} data.documentNumber - The ID number on the document
//    * @param {Buffer|string} data.selfieImage - Selfie image buffer or base64 string
//    * @param {Buffer|string} data.documentImage - Front document image buffer or base64 string
//    * @param {Buffer|string} data.documentBackImage - Back document image buffer or base64 string (optional)
//    * @returns {Promise<Object>} - Verification result
//    */
//   async verifyDocument(data) {
//     try {
//       logger.info(`Starting document verification for user: ${data.userId}`);

//       if (!data.documentNumber || data.documentNumber.trim() === "") {
//         throw new Error("Document number is required for verification");
//       }

//       if (!data.selfieImage) {
//         throw new Error("Selfie image is required for verification");
//       }

//       // Create required tracking parameters for Smile ID API
//       const partnerParams = {
//         user_id: data.userId,
//         job_id: `doc_verify_${Date.now()}`,
//         job_type: 6, // Document Verification with ID card
//       };

//       // Create the ID info object
//       const idInfo = {
//         country: data.countryCode,
//         id_type: data.documentType,
//         id_number: data.documentNumber,
//       };

//       logger.info(`ID info for verification: ${JSON.stringify(idInfo)}`);

//       // Prepare image details for the Smile ID API
//       let imageDetails = [];

//       // Process selfie image
//       imageDetails.push(this.processImage(data.selfieImage, 0)); // 0 = selfie

//       // Process document front image
//       imageDetails.push(this.processImage(data.documentImage, 1)); // 1 = id card front

//       // Process document back image if available
//       if (data.documentBackImage) {
//         imageDetails.push(this.processImage(data.documentBackImage, 5)); // 5 = id card back
//       }

//       logger.info(`Prepared ${imageDetails.length} images for verification`);

//       // Set options for the job
//       const options = {
//         return_job_status: true,
//         return_history: true,
//         return_images: false, // Set to false to reduce response payload size
//       };

//       // Add callback URL if provided
//       if (this.config.callbackUrl) {
//         options.callback_url = this.config.callbackUrl;
//       }

//       // Submit the verification job using the SDK
//       // The SDK will handle adding source_sdk, signature, timestamp, etc.
//       const response = await this.WebApi.submit_job(
//         partnerParams,
//         imageDetails,
//         idInfo,
//         options
//       );

//       logger.info(`Document verification initiated for user ${data.userId}`);
//       return response;
//     } catch (error) {
//       logger.error(`Smile ID verification failed: ${error.message}`, { error });
//       throw new Error(`Document verification failed: ${error.message}`);
//     }
//   }

//   /**
//    * Helper function to process image data for Smile ID API
//    * 
//    * @param {Buffer|string} image - Image as Buffer or base64 string
//    * @param {number} imageTypeId - Image type ID (0=selfie, 1=ID front, 5=ID back)
//    * @returns {Object} Formatted image object for Smile ID API
//    */
//   processImage(image, imageTypeId) {
//     if (Buffer.isBuffer(image)) {
//       return {
//         image_type_id: imageTypeId,
//         image: image.toString("base64"),
//       };
//     } else if (typeof image === "string") {
//       if (image.startsWith("data:image/")) {
//         // Extract the base64 part from data URI
//         return { 
//           image_type_id: imageTypeId, 
//           image: image.split(",")[1]
//         };
//       } else {
//         // Validate base64 string
//         if (!/^[A-Za-z0-9+/=]+$/.test(image)) {
//           throw new Error(`Invalid base64 format for image type ${imageTypeId}`);
//         }
//         return { 
//           image_type_id: imageTypeId, 
//           image: image 
//         };
//       }
//     }
//     throw new Error(`Invalid image format for image type ${imageTypeId}`);
//   }

//   /**
//    * Retrieves the status of a verification job
//    *
//    * @param {string} userId - User ID used in the verification
//    * @param {string} jobId - Job ID returned from verification initiation
//    * @returns {Promise<Object>} - Verification status
//    */
//   async getVerificationStatus(userId, jobId) {
//     try {
//       logger.info(
//         `Getting verification status for user ${userId}, job ${jobId}`
//       );

//       const response = await this.WebApi.get_job_status({
//         user_id: userId,
//         job_id: jobId,
//       });

//       logger.info(`Retrieved verification status for job ${jobId}`);
//       return response;
//     } catch (error) {
//       logger.error(`Failed to get verification status: ${error.message}`, {
//         error,
//       });
//       throw new Error(`Failed to get verification status: ${error.message}`);
//     }
//   }
// }

// module.exports = SmileIDService;
