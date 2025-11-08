'use strict';

const crypto = require('crypto');

/**
 * Round a number to 2 decimal places (bankers-safe: avoid FP quirks).
 * @param {number|string} v
 * @returns {number}
 */
function round2(v) {
    const n = typeof v === 'string' ? Number(v) : v;
    return Math.round(n * 100) / 100;
}

/**
 * Return ISO8601 string without ms for cleaner logs.
 */
function isoNow() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generate a lowercase, 32-byte hex idempotency key.
 * Caller may prefix it (e.g. "wallet:") if orchestration requires.
 */
function genIdempotencyKey() {
    return crypto.randomBytes(16).toString('hex');
}

module.exports = { round2, isoNow, genIdempotencyKey };
