const { query } = require("../../Config/neon-database");
const { v4: uuidv4 } = require("uuid");
const { logger } = require("../../utils/logger");

class KYC {
  /**
   * Submit or update KYC documents for a user
   * @param {string} userId - User's UUID
   * @param {Object} documentData - Document data
   * @param {string} documentData.documentType - Document type (e.g., "national_id")
   * @param {string} documentData.documentNumber - Document number
   * @param {string} documentData.documentCountry - Country of issuance
   * @param {string} documentData.blobStoragePath - Path to stored document
   * @returns {Promise<Object>} KYC document record
   */
  static async submitDocuments(userId, documentData) {
    const documentId = uuidv4();
    const currentDate = new Date().toISOString();
    const queryText = `
    INSERT INTO kyc_documents (
      document_id,
      user_id,
      document_type,
      document_number,
      document_country,
      blob_storage_path,
      verification_status,
      uploaded_at,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id, document_type) DO UPDATE
    SET 
      document_number = EXCLUDED.document_number,
      document_country = EXCLUDED.document_country,
      blob_storage_path = EXCLUDED.blob_storage_path,
      verification_status = EXCLUDED.verification_status,
      updated_at = EXCLUDED.updated_at
    RETURNING *;
  `;
    const values = [
      documentId,
      userId,
      documentData.documentType,
      documentData.documentNumber,
      documentData.documentCountry,
      documentData.blobStoragePath,
      "pending",
      currentDate,
      currentDate,
      currentDate,
    ];
    try {
      const res = await query(queryText, values);
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to submit documents: ${error.message}`, { error });
      throw error;
    }
  }
  /**
   * Get KYC documents for a user
   * @param {string} userId - User's UUID
   * @returns {Promise<Object[]>} Array of KYC documents
   */
  static async getDocuments(userId) {
    const queryText = `
          SELECT * FROM kyc_documents WHERE user_id = $1;
        `;

    try {
      const res = await query(queryText, [userId]);
      return res.rows;
    } catch (error) {
      logger.error(`Failed to get documents: ${error.message}`, { error });
      throw error;
    }
  }
  /**
   * Update KYC verification status
   * @param {string} documentId - KYC document ID
   * @param {string} status - New verification status ("verified", "rejected")
   * @param {string} notes - Verification notes
   * @returns {Promise<Object>} Updated KYC document
   */
  static async updateVerificationStatus(documentId, status, notes) {
    const validStatuses = ["verified", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid verification status");
    }

    const queryText = `
      UPDATE kyc_documents
      SET 
        verification_status = $1,
        verification_notes = $2,
        updated_at = $3
      WHERE document_id = $4
      RETURNING *;
    `;

    const values = [status, notes, new Date().toISOString(), documentId];

    try {
      const res = await query(queryText, values);
      if (res.rows.length === 0) {
        throw new Error("Document not found");
      }
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to update document status: ${error.message}`, {
        error,
      });
      throw error;
    }
  }
}

module.exports = KYC;
