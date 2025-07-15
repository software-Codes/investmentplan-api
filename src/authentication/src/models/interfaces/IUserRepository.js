/**
 * A data-access contract for user-profile operations.
 * Single Responsibility → only user metadata, no sessions, no wallets.
 */

class IUserRepository {

    /** @returns {Promise<{rows: any[], total: number}>} */
    findMany(filters, pagination) { }
    /** @returns {Promise<Object|null>} */

    findById(userId) { }
    /** @returns {Promise<void>} */

    updateStatus(userId, newStatus) { }
    /** @returns {Promise<void>}  (true soft delete, false hard) */
    deleteUser(userId, { softDelete }) { }


}

module.exports = IUserRepository;