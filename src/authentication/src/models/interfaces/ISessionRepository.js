class ISessionRepository {
    /** @returns {Promise<string[]>}  active session IDs */
    findActiveSessions(userId) { }

    /** @returns {Promise<number>}  invalidated count */
    invalidateSessions(sessionIds) { }

    /** @returns {Promise<number>}  invalidated count */
    invalidateAll(userId) { }
}

module.exports = ISessionRepository;
