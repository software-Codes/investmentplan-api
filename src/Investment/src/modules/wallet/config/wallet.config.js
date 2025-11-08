'use strict';

/**
 * Wallet Config
 * -------------
 * Centralised environment + default values used by the wallet module.
 * All values are frozen so downstream code can’t mutate global config.
 */

const env = (key, fallback = undefined) => {
    const v = process.env[key];
    return v === undefined || v === '' ? fallback : v;
};

const toInt = (raw, fallback) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
};

const cfg = {
    PRINCIPAL_LOCK_DAYS: toInt(env('PRINCIPAL_LOCK_DAYS', 30), 30),
    PROFIT_LOCK_DAYS: toInt(env('PROFIT_LOCK_DAYS', 7), 7),
    MIN_TRADE_USD: Number(env('MIN_TRADE_USD', 10)),
    MIN_PROFIT_WITHDRAWAL: Number(env('MIN_PROFIT_WITHDRAWAL', 0)),
    NOTIFY_ENABLED: (env('WALLET_NOTIFICATIONS_ENABLED', 'true') + '').toLowerCase() === 'true',
};

if (!(cfg.MIN_TRADE_USD > 0)) throw new Error('MIN_TRADE_USD must be > 0');
if (!(cfg.PRINCIPAL_LOCK_DAYS >= 0)) throw new Error('PRINCIPAL_LOCK_DAYS must be >= 0');
if (!(cfg.PROFIT_LOCK_DAYS >= 0)) throw new Error('PROFIT_LOCK_DAYS must be >= 0');

module.exports = Object.freeze(cfg);
