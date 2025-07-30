const { AdminActionError } = require('../../errors/errors')

class AdminUserService {
    /**
   * @param {IUserRepository}    userRepo
   * @param {ISessionRepository} sessionRepo
   * @param {PgAuditRepository}  auditRepo
   */

    constructor({ userRepo, sessionRepo, auditRepo }) {
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
        this.auditRepo = auditRepo;
    }
    /** ---------------  READ  ---------------- */
    /**
 * Fetch a page of users, optionally filtered by status/search.
 * @returns {Promise<{items:any[], total:number, page:number, size:number}>}
 */
    async listUsers({ page = 1, size = 50, status, search }) {
        const { rows, total } = await this.userRepo.findMany(
            { status, search },
            { page, size },
        );
        return { items: rows, total, page, size };
    }


    /**
     * @throws NOT_FOUND via RepositoryError
     */
    async getUserById(userId) {
        return this.userRepo.findById(userId);
    }


    /** ---------------  COMMANDS  ------------ */

    /**
     * Block (suspend) a user.
     */
    async blockUser({ adminId, targetId}) {
        await this.userRepo.updateStatus(targetId, 'suspended');

        await this.auditRepo.log({
            adminId,
            targetUserId: targetId,
            action: 'BLOCK_USER',
        });
        return { userId: targetId, newStatus: 'suspended' };
    }

    /**
   * Reactivate a blocked user.
   */
    async unblockUser({ adminId, targetId }) {
        await this.userRepo.updateStatus(targetId, 'active');
        await this.auditRepo.log({
            adminId,
            targetUserId: targetId,
            action: 'UNBLOCK_USER',
        });
        return { userId: targetId, newStatus: 'active' };
    }

    /**
 * Force-sign-out *all* sessions for a user.
 * Returns number of invalidated sessions.
 */
    async signOutEverywhere({ adminId, targetId }) {
        const invalidated = await this.sessionRepo.invalidateAll(targetId);
        await this.auditRepo.log({
            adminId,
            targetUserId: targetId,
            action: 'FORCE_LOGOUT',
        });
        return { userId: targetId, invalidated };
    }

    /**
     * Hard-delete user & all child records, or mark deactivated when softDelete=true
     *
     * @throws AdminActionError
     */
    async deleteUser({ adminId, targetId, softDelete = false }) {
        try {
            await this.userRepo.deleteUser(targetId, { softDelete });

            await this.auditRepo.log({
                adminId,
                targetUserId: targetId,
                action: softDelete ? 'SOFT_DELETE' : 'HARD_DELETE',
            });

            return { userId: targetId, deleted: true, softDelete };
        } catch (err) {
            /* Map repository problems to domain-level errors */
            if (err.code === 'NOT_FOUND') {
                throw new AdminActionError('User not found', 'NOT_FOUND');
            }
            /* Anything else is an unexpected failure inside the repo/DB */
            throw new AdminActionError(err.message, 'DELETE_FAILED');
        }
    }



}

module.exports = AdminUserService;