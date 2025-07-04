
    const STATUS_CODES = {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500
    };


    exports.success = (data, message, statusCode = STATUS_CODES.OK) => {
        return {
            success: true,
            data,
            message,
            timestamp: new Date().toISOString(),
            statusCode
        };
    };


    exports.error = (error, userMessage, statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR) => {
        return {
            success: false,
            error: {
                message: userMessage,
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : null
            },
            timestamp: new Date().toISOString(),
            statusCode
        };
    };

    exports.STATUS_CODES = STATUS_CODES;