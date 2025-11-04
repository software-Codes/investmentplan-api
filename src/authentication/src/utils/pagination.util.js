function buildPaging({ page = 1, size = 50 } = {}) {
    const limit = Math.max(1, Math.min(size, 100));
    const offset = (Math.max(page, 1) - 1) * limit;
    return { limit, offset };
}
module.exports = { buildPaging };