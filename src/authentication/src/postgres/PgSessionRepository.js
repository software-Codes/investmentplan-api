const ISessionRepository = require('../models/interfaces/ISessionRepository');
const { pool } = require('../Config/neon-database');
const RepositoryError = require('../errors/RepositoryError');

class PgSessionRepository extends ISessionRepository {
    async findActiveSessions(userId) {
        const { rows } = await pool.query(
            `SELECT session_id FROM user_sessions WHERE user_id = $1 AND is_active = true`,
            [userId],
        );
        return rows.map(r => r.session_id);
    }

    async invalidateSessions(sessionIds) {
        if (!sessionIds.length) return 0;
        const { rowCount } = await pool.query(
            `UPDATE user_sessions SET is_active = false, updated_at = NOW()
       WHERE session_id = ANY($1::uuid[])`,
            [sessionIds],
        );
        return rowCount;
    }

    async invalidateAll(userId) {
        const { rowCount } = await pool.query(
            `UPDATE user_sessions SET is_active = false, updated_at = NOW()
       WHERE user_id = $1`,
            [userId],
        );
        if (!rowCount) throw RepositoryError.notFound('Sessions');
        return rowCount;
    }

}

module.exports = PgSessionRepository;

//Data structure: The user_sessions table acts like a set keyed by session_id.
//  Mass-invalidate exploits PostgreSQL’s set operations (ANY($1::uuid[])) for O(m) 
// where m = #sessions updated (one disk pass).
