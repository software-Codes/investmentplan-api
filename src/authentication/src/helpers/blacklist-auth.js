const blacklist = new Map();

const addTokenToBlacklist = (token, expiresInSeconds = 3600) => {
    const expiry = Date.now() + expiresInSeconds * 1000;
    blacklist.set(token, expiry);

    // Automatically remove the token when it expires
    setTimeout(() => {
        blacklist.delete(token);
    }, expiresInSeconds * 1000);
};

const isTokenBlacklisted = (token) => {
    return blacklist.has(token) && blacklist.get(token) > Date.now();
};

module.exports = { addTokenToBlacklist, isTokenBlacklisted };