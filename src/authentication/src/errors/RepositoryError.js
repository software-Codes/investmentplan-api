class RepositoryError extends Error {
    static notFound(entity = 'Resource') {
        return new RepositoryError(`${entity} not found`, 'NOT_FOUND');
    }
    constructor(message, code = 'REPOSITORY_ERROR') {
        super(message);
        this.code = code;
    }
}
module.exports = RepositoryError;
