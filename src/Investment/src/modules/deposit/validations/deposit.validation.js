'use strict';

const { z } = require('zod');
const cfg = require('../config/deposit.config');
const { isValidTxHash, normalizeNetwork, sanitizeAmount } = require('../utils/txUtils');

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AmountSchema = z.union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((n) => Number.isFinite(n), { message: 'ERR_AMOUNT_NOT_NUMBER' })
    .refine((n) => n >= cfg.MIN_DEPOSIT_USD, { message: 'ERR_AMOUNT_BELOW_MIN' })
    .refine((n) => (cfg.MAX_DEPOSIT_USD ? n <= cfg.MAX_DEPOSIT_USD : true), { message: 'ERR_AMOUNT_ABOVE_MAX' })
    .refine((n) => !sanitizeAmount(n).reason, { message: 'ERR_AMOUNT_TOO_MANY_DECIMALS' })
    .transform((n) => Math.round(n * 100) / 100);

const NetworkSchema = z
    .string()
    .optional()
    .transform((v) => normalizeNetwork(v || 'ERC20'))
    .refine((net) => cfg.SUPPORTED_NETWORKS.includes(net), { message: 'ERR_NETWORK_UNSUPPORTED' });

const SubmitDepositRequestSchema = z.object({
    txId: z
        .string()
        .trim()
        .refine((tx) => isValidTxHash(tx, 'ERC20'), { message: 'ERR_TXID_INVALID' }),
    amountUsd: AmountSchema,
    network: NetworkSchema,
    note: z.string().trim().max(256).optional(),
});

const ListDepositsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
        .array(z.enum(['PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED']))
        .optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
}).refine((q) => (q.from && q.to ? new Date(q.from) <= new Date(q.to) : true), {
    message: 'ERR_RANGE_INVALID',
    path: ['from'],
});

function validateSubmitDepositRequest(body, headers = {}) {
    const parsed = SubmitDepositRequestSchema.parse(body);
    const idemKey = headers['idempotency-key'] || headers['Idempotency-Key'] || headers['IDEMPOTENCY-KEY'];
    if (idemKey !== undefined) {
        if (typeof idemKey !== 'string' || !uuidV4.test(idemKey)) {
            throw new z.ZodError([
                { code: 'custom', message: 'ERR_IDEMPOTENCY_KEY_INVALID', path: ['headers', 'Idempotency-Key'] },
            ]);
        }
    }
    return { ...parsed, idempotencyKey: idemKey };
}

function validateListDepositsQuery(query) {
    return ListDepositsQuerySchema.parse(query);
}

module.exports = {
    validateSubmitDepositRequest,
    validateListDepositsQuery,
    schemas: {
        SubmitDepositRequestSchema,
        ListDepositsQuerySchema,
    },
};
