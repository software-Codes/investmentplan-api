'use strict';

/**
 * Deposit configuration (env-driven, validated at load).
 * Fail-fast on misconfiguration.
 */

const env = (key, def = undefined) => {
    const v = process.env[key];
    return v === undefined || v === '' ? def : v;
};

const toNumber = (v, def = undefined) => {
    if (v === undefined || v === null || v === '') return def;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Invalid numeric value: ${v}`);
    return n;
};

const parseNetworks = (raw) =>
    String(raw || 'ERC20')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

const cfg = {
    SUPPORTED_ASSET: env('DEPOSIT_ASSET', 'USDT'),
    SUPPORTED_NETWORKS: parseNetworks(env('DEPOSIT_NETWORKS', 'ERC20')),
    DEPOSIT_ADDRESS: env('DEPOSIT_ADDRESS'), // REQUIRED
    MIN_DEPOSIT_USD: toNumber(env('MIN_DEPOSIT_USD'), 10),
    MAX_DEPOSIT_USD: toNumber(env('MAX_DEPOSIT_USD'), undefined),
    MIN_CONFIRMATIONS: toNumber(env('MIN_CONFIRMATIONS'), 12),
    DUPLICATE_WINDOW_HOURS: toNumber(env('DEPOSIT_DUP_WINDOW_HOURS'), 168),
    PROVIDER: (env('DEPOSIT_PROVIDER', 'binance') || 'binance').toLowerCase(), // binance|etherscan|alchemy
    PROVIDER_TIMEOUT_MS: toNumber(env('DEPOSIT_PROVIDER_TIMEOUT_MS'), 10000),
    PROVIDER_RETRIES: toNumber(env('DEPOSIT_PROVIDER_RETRIES'), 3),
    POLL_INTERVAL_SEC: toNumber(env('DEPOSIT_POLL_INTERVAL_SEC'), 30),
    EXPLORER_BASE_URL: env('EXPLORER_BASE_URL', 'https://etherscan.io/tx/'),
};

(function validate(c) {
    if (!c.DEPOSIT_ADDRESS) throw new Error('DEPOSIT_ADDRESS is required');
    if (!Array.isArray(c.SUPPORTED_NETWORKS) || c.SUPPORTED_NETWORKS.length === 0) {
        throw new Error('DEPOSIT_NETWORKS must include at least one network (e.g., ERC20)');
    }
    if (!c.SUPPORTED_NETWORKS.includes('ERC20')) {
        throw new Error('ERC20 must be included in SUPPORTED_NETWORKS for this release');
    }
    if (!(c.MIN_DEPOSIT_USD >= 1)) throw new Error('MIN_DEPOSIT_USD must be >= 1');
    if (c.MAX_DEPOSIT_USD !== undefined && !(c.MAX_DEPOSIT_USD >= c.MIN_DEPOSIT_USD)) {
        throw new Error('MAX_DEPOSIT_USD must be >= MIN_DEPOSIT_USD');
    }
    if (!(c.DUPLICATE_WINDOW_HOURS >= 0)) {
        throw new Error('DEPOSIT_DUP_WINDOW_HOURS must be >= 0');
    }
    if (!c.EXPLORER_BASE_URL.endsWith('/')) {
        // normalize for url builder
        c.EXPLORER_BASE_URL = c.EXPLORER_BASE_URL + '/';
    }
})(cfg);

module.exports = Object.freeze(cfg);
