'use strict';

const config = require('../config/deposit.config');

/**
 * Normalize supported network id.
 * Currently supports only ERC20 (Ethereum).
 */
function normalizeNetwork(input) {
    const v = String(input || 'ERC20').trim().toUpperCase();
    if (v === 'ETH' || v === 'ETHEREUM' || v === 'ERC-20' || v === 'ERC20') return 'ERC20';
    throw new Error(`Unsupported network: ${input}`);
}

/**
 * Basic Ethereum tx hash validator.
 */
function isValidTxHash(txId, network = 'ERC20') {
    const net = normalizeNetwork(network);
    if (net !== 'ERC20') return false;
    return /^0x[a-fA-F0-9]{64}$/.test(String(txId || '').trim());
}

/**
 * Compare addresses (case-insensitive for ETH). No EIP-55 checksum enforcement here.
 */
function isSameAddress(a, b, network = 'ERC20') {
    const net = normalizeNetwork(network);
    if (net === 'ERC20') {
        return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }
    return false;
}

/**
 * Ensure an amount is a finite, non-negative number with up to 2 decimals.
 */
function sanitizeAmount(input) {
    const n = typeof input === 'string' ? Number(input) : input;
    if (!Number.isFinite(n)) return { valid: false, reason: 'ERR_AMOUNT_NOT_NUMBER' };
    if (n < 0) return { valid: false, reason: 'ERR_AMOUNT_NEGATIVE' };
    const twoDp = Math.round(n * 100) / 100;
    const overTwoDp = Math.abs(n - twoDp) > Number.EPSILON;
    if (overTwoDp) return { valid: false, reason: 'ERR_AMOUNT_TOO_MANY_DECIMALS' };
    return { valid: true, value: twoDp };
}

/**
 * Build blockchain explorer URL for a tx id.
 */
function buildExplorerUrl(txId, network = 'ERC20') {
    const net = normalizeNetwork(network);
    if (net === 'ERC20') return `${config.EXPLORER_BASE_URL.replace(/\/+$/, '')}/${txId}`;
    throw new Error(`No explorer configured for network: ${net}`);
}

/** UTC ISO string (without milliseconds). */
function nowUtcIso() {
    const d = new Date();
    return new Date(Date.UTC(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
    )).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = {
    normalizeNetwork,
    isValidTxHash,
    isSameAddress,
    sanitizeAmount,
    buildExplorerUrl,
    nowUtcIso,
};
