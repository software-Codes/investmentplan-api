const { STATUS_CODES, success, error } = require('../../utils/response.util');
const { AdminActionError } = require('../../errors/errors')
const { logger } = require('../../utils/logger');
const Joi = require('joi');


/**
 * AdminUserController
 * ────────────────────
 * Routes mounted under /api/v1/admin/users
 *
 * NOTE:
 *  • req.admin is populated by adminAuthenticate middleware
 *  • adminAuthenticate should also enforce role === 'super_admin'
 */


class AdminUserController {
    constructor({ adminUserService }) {
        this.svc = adminUserService;

        // Bind ‘this’ for use as express handlers
        this.listUsers = this.listUsers.bind(this);
        this.getUser = this.getUser.bind(this);
        this.blockUser = this.blockUser.bind(this);
        this.unblockUser = this.unblockUser.bind(this);
        this.forceLogoutUser = this.forceLogoutUser.bind(this);
        this.deleteUser = this.deleteUser.bind(this);
    }

    /* ------------ validators (private) ------------- */

    static _validateId(id) {
        const { error } = Joi.string().uuid().required().validate(id);
        if (error) throw new AdminActionError('Invalid UUID supplied', 'VALIDATION');
    }

    /* --------------- handlers ---------------------- */

    /** GET /?page=&size=&status=&search= */
    async listUsers(req, res, next) {
        try {
            const { page, size, status, search } = req.query;
            const result = await this.svc.listUsers({ page, size, status, search });

            return res
                .status(STATUS_CODES.OK)
                .json(success(result, 'Users fetched', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }

    /** GET /:userId */
    async getUser(req, res, next) {
        try {
            const { userId } = req.params;
            AdminUserController._validateId(userId);

            const user = await this.svc.getUserById(userId);
            return res
                .status(STATUS_CODES.OK)
                .json(success(user, 'User fetched', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }

    /** PATCH /:userId/block */
    async blockUser(req, res, next) {
        try {
            const { userId } = req.params;
            AdminUserController._validateId(userId);

            const { reason = '' } = req.body;
            const result = await this.svc.blockUser({
                adminId: req.admin.adminId,
                targetId: userId,
                reason,
            });

            return res
                .status(STATUS_CODES.OK)
                .json(success(result, 'User suspended', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }

    /** PATCH /:userId/unblock */
    async unblockUser(req, res, next) {
        try {
            const { userId } = req.params;
            AdminUserController._validateId(userId);

            const result = await this.svc.unblockUser({
                adminId: req.admin.adminId,
                targetId: userId,
            });

            return res
                .status(STATUS_CODES.OK)
                .json(success(result, 'User re-activated', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }

    /** POST /:userId/force-logout */
    async forceLogoutUser(req, res, next) {
        try {
            const { userId } = req.params;
            AdminUserController._validateId(userId);

            const result = await this.svc.signOutEverywhere({
                adminId: req.admin.adminId,
                targetId: userId,
            });

            return res
                .status(STATUS_CODES.OK)
                .json(success(result, 'All sessions invalidated', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }
    /** DELETE /:userId   (query ?soft=true for soft-delete) */
    async deleteUser(req, res, next) {
        try {
            const { userId } = req.params;
            AdminUserController._validateId(userId);

            const softDelete = req.query.soft === 'true';
            const result = await this.svc.deleteUser({
                adminId: req.admin.adminId,
                targetId: userId,
                softDelete,
            });

            return res
                .status(STATUS_CODES.OK)
                .json(success(result, 'User deleted', STATUS_CODES.OK));
        } catch (err) {
            this._handle(err, res, next);
        }
    }



    /* --------------- private helpers --------------- */
    _handle(err, res, next) {
        /* 404 ──────────────── */
        if (err.code === 'NOT_FOUND') {
            return res
                .status(STATUS_CODES.NOT_FOUND)
                .json(error(err, err.message, STATUS_CODES.NOT_FOUND));
        }

        /* 400 validation / business-rule errors */
        if (err.code === 'VALIDATION') {
            return res
                .status(STATUS_CODES.BAD_REQUEST)
                .json(error(err, err.message, STATUS_CODES.BAD_REQUEST));
        }

        /* 500 delete failures or other internal repo errors */
        if (err instanceof AdminActionError && err.code === 'DELETE_FAILED') {
            return res
                .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
                .json(error(err, 'Failed to delete user', STATUS_CODES.INTERNAL_SERVER_ERROR));
        }

        /* Fall-through: log and pass to global error handler */
        logger.error('Unhandled error in AdminUserController', { err });
        return next(err);
    }

}

module.exports = AdminUserController;