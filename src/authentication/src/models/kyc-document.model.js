const { query } = require('../../../database/connection');
const { v4: uuidv4 } = require('uuid');

class KYCDocument {
  static async create(documentData) {
    const documentId = uuidv4();
    const now = new Date().toISOString();

    const res = await query(
      `INSERT INTO kyc_documents (
        document_id, user_id, document_type, document_country, blob_storage_path, 
        blob_storage_url, file_name, original_file_name, file_size, file_type, 
        uploaded_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        documentId, documentData.userId, documentData.documentType, documentData.documentCountry,
        documentData.blobStoragePath, documentData.blobStorageUrl, documentData.fileName,
        documentData.originalFileName, documentData.fileSize, documentData.fileType,
        now, now, now
      ]
    );

    return res.rows[0];
  }

  static async findByUserId(userId) {
    const res = await query(
      `SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async findById(documentId) {
    const res = await query(
      `SELECT * FROM kyc_documents WHERE document_id = $1`,
      [documentId]
    );
    return res.rows[0] || null;
  }
}

module.exports = KYCDocument;
