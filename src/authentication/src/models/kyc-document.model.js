const { query } = require("../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const { logger } = require("../utils/logger");

class KYCDocument {
  static async create(documentData) {
    const documentId = uuidv4();
    const currentDate = new Date().toISOString();

    const queryText = `
      INSERT INTO kyc_documents (
        document_id, 
        user_id, 
        document_type, 
        document_country,
        blob_storage_path, 
        blob_storage_url, 
        file_name,
        original_file_name, 
        file_size, 
        file_type, 
        uploaded_at,
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      documentId,
      documentData.userId,
      documentData.documentType,
      documentData.documentCountry,
      documentData.blobStoragePath,
      documentData.blobStorageUrl,
      documentData.fileName,
      documentData.originalFileName,
      documentData.fileSize,
      documentData.fileType,
      currentDate,
      currentDate,
      currentDate
    ];

    try {
      const res = await query(queryText, values);
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to create KYC document: ${error.message}`);
      throw new Error("Failed to save document record");
    }
  }

  static async findByUserId(userId) {
    try {
      const queryText = `
        SELECT * FROM kyc_documents 
        WHERE user_id = $1 
        ORDER BY uploaded_at DESC
      `;
      const res = await query(queryText, [userId]);
      return res.rows;
    } catch (error) {
      logger.error(`Failed to fetch KYC documents: ${error.message}`);
      throw new Error('Failed to retrieve documents');
    }
  }

  static async checkCompletion(userId) {
    try {
      const queryText = `
        SELECT COUNT(DISTINCT document_type) as doc_count
        FROM kyc_documents
        WHERE user_id = $1
      `;
      const res = await query(queryText, [userId]);
      return res.rows[0].doc_count > 0; // Return true if at least one document exists
    } catch (error) {
      logger.error(`Document completion check failed: ${error.message}`);
      throw new Error("Failed to check document completion");
    }
  }
}

module.exports = KYCDocument;