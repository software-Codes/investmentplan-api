const jwt = require('jsonwebtoken');
const { logger } = require('../../utils/logger');
const { STATUS_CODES, error } = require('../../utils/response.util');

/**
 * Middleware to authenticate admin using Bearer token
 */
exports.adminAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json(
                error(
                    new Error('Unauthorized'),
                    'Missing or malformed Authorization header',
                    STATUS_CODES.UNAUTHORIZED
                )
            );
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = {
            adminId: decoded.sub, 
            email: decoded.email,
            role: decoded.role,
            type: decoded.type
        };
        logger.info(`Admin ${decoded.adminId} authenticated successfully`);


        next();
    } catch (err) {
        const message =
            err.name === 'TokenExpiredError'
                ? 'Authentication token expired'
                : 'Invalid authentication token';

        logger.error('Admin authentication failed', { error: err.message });

        return res.status(STATUS_CODES.UNAUTHORIZED).json(
            error(err, message, STATUS_CODES.UNAUTHORIZED)
        );
    }
};
