class AdminActionError extends Error{
    constructor(message, code = 'ADMIN_ACTION_ERROR'){
        super(message);
        this.code = code;
    }
}

module.exports = {AdminActionError};