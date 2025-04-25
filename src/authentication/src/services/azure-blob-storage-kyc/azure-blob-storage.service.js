/**
 * @file azure-blob-storage.service.js
 * @description Service for interacting with Azure Blob Storage to manage user KYC documents
 */

const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const { logger } = require("../../utils/logger");
const crypto = require("crypto");

class AzureBlobStorageService {
  /**
   * Initializes the Azure Blob Storage Service
   *
   * @param {Object} config - Configuration object
   * @param {string} config.accountName - Azure Storage account name
   * @param {string} config.accountKey - Azure Storage account key
   * @param {string} config.containerName - Blob container name
   */
  constructor(config) {
    const { accountName, accountKey, containerName } = config;
    if (!accountName || !accountKey || !containerName) {
      throw new Error(
        "Azure Blob Storage requires account name, account key, and container name"
      );
    }
    // Create a shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(
      accountName,
      accountKey
    );
    // Create the BlobServiceClient
    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    this.containerName = containerName;
    this.accountName = accountName;

    logger.info(
      `Azure Blob Storage service initialized for container: ${containerName}`
    );
  }
  /**
   * Uploads a KYC document to Azure Blob Storage
   *
   * @param {Object} options - Upload options
   * @param {string} options.userId - The user ID
   * @param {string} options.documentType - Document type (e.g., passport, national_id)
   * @param {Buffer} options.fileBuffer - The file buffer to upload
   * @param {string} options.fileName - Original file name
   * @param {string} options.contentType - File MIME type
   * @returns {Promise<Object>} - Upload result with path and URL
   */
  async uploadDocument({
    userId,
    documentType,
    fileBuffer,
    fileName,
    contentType,
  }) {
    try {
      if (!userId || !documentType || !fileBuffer) {
        throw new Error("Missing required parameters for document upload");
      }
      // Get container client
      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName
      );
      // Create container if it doesn't exist
      try {
        await containerClient.createIfNotExists();
        logger.info(
          `Container ${this.containerName} checked/created successfully`
        );
      } catch (containerError) {
        logger.warn(`Container creation attempted: ${containerError.message}`);
      }
      // Generate a unique file name to prevent overwrites
      const timestamp = new Date().getTime();
      const fileExtension = fileName.split(".").pop();
      const randomString = crypto.randomBytes(8).toString("hex");
      const secureFileName = `${timestamp}-${randomString}.${fileExtension}`;
      // Construct blob path with user ID and document type
      const blobName = `${userId}/${documentType}/${secureFileName}`;
      // Get a blob client
      const blobClient = containerClient.getBlockBlobClient(blobName);
      // Upload file with proper content type
      await blobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: contentType || this._determineContentType(fileName),
        },
      });
      // Generate a SAS URL with temporary access (30 minutes)
      const sasUrl = await this._generateSasUrl(blobName, 30);
      logger.info(
        `Document uploaded successfully to blob storage: ${blobName}`
      );
      return {
        blobStoragePath: blobName,
        blobStorageUrl: sasUrl,
        fileName: secureFileName,
        originalFileName: fileName,
      };
    } catch (error) {
      logger.error(
        `Failed to upload document to Azure Blob Storage: ${error.message}`,
        { error }
      );
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }
  /**
   * Generate a SAS URL for a blob with temporary access
   *
   * @param {string} blobName - Full blob path
   * @param {number} expiryMinutes - Number of minutes until expiry
   * @returns {string} - SAS URL
   * @private
   */
  async _generateSasUrl(blobName, expiryMinutes = 30) {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName
      );
      const blobClient = containerClient.getBlobClient(blobName);

      // Create a SAS token that expires in expiryMinutes
      const expiresOn = new Date();
      expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

      const sasOptions = {
        expiresOn,
        permissions: "r", // Read-only permissions
      };

      // Use the correct method to generate SAS URL
      return await blobClient.generateSasUrl(sasOptions);
    } catch (error) {
      logger.error(`Failed to generate SAS URL: ${error.message}`);
      return null;
    }
  }
  /**
   * Determine content type based on file extension
   *
   * @param {string} fileName - File name with extension
   * @returns {string} - MIME type
   * @private
   */
  _determineContentType(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();

    const mimeTypes = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      tiff: "image/tiff",
      tif: "image/tiff",
      bmp: "image/bmp",
    };

    return mimeTypes[extension] || "application/octet-stream";
  }
}
module.exports = AzureBlobStorageService;
