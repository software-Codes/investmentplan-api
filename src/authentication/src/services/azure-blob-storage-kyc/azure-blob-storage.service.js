/**
 * @file azure-blob-storage.service.js
 * @description Service for interacting with Azure Blob Storage to manage user documents such as IDs and driver's licenses.
 * This service provides methods to upload documents to a specified Azure Blob Storage container.
 */

const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");

class AzureBlobStorageService {
  /**
   * Initializes the Azure Blob Storage Service with the required account name and container name.
   *
   * @param {string} accountName - The name of the Azure Storage account.
   * @param {string} containerName - The name of the container where documents will be stored.
   */
  constructor(accountName, containerName) {
    this.credential = new DefaultAzureCredential(); // Authenticate using Azure's default credentials
    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      this.credential
    );
    this.containerName = containerName; // The container where documents will be stored
  }

  /**
   * Uploads a document to Azure Blob Storage.
   *
   * This function uploads a document to a specified container in Azure Blob Storage.
   * The document is organized by user ID and document type.
   *
   * @param {string} userId - The unique ID of the user uploading the document.
   * @param {string} documentType - The type of document being uploaded (e.g., "id", "driver_license").
   * @param {Buffer} fileBuffer - The file data to be uploaded as a buffer.
   * @param {string} fileName - The name of the file being uploaded.
   * @returns {Promise<string>} The name of the blob (file path) in Azure Blob Storage.
   * @throws {Error} Throws an error if the upload process fails.
   */
  async uploadDocument(userId, documentType, fileBuffer, fileName) {
    try {
      // Get a reference to the container client
      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName
      );

      // Construct the blob name (path) using user ID, document type, and file name
      const blobName = `${userId}/${documentType}/${fileName}`;

      // Get a reference to the blob client
      const blobClient = containerClient.getBlockBlobClient(blobName);

      // Upload the file buffer to Azure Blob Storage
      await blobClient.uploadData(fileBuffer);

      // Return the blob name (file path) for reference
      return blobName;
    } catch (error) {
      // Throw a detailed error if the upload fails
      throw new Error(
        `Failed to upload document to Azure Blob Storage: ${error.message}`
      );
    }
  }
}

module.exports = AzureBlobStorageService;
