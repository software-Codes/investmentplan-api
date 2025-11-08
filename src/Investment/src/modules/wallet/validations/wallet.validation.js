'use strict';

/**
 * Zod schemas for wallet requests.
 * Separating schemas keeps controllers light and testable.
 */

const { z } = require('zod');
const { WALLET_TYPES, isTransferAllowed, MIN_TRADE_USD } = require('../policies/wallet.policy');
const { round2 } = require('../utils/wallet.utils');

const WalletTypeSchema = z.enum(WALLET_TYPES.map((x) => x));

const AmountSchema = z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n > 0, 'ERR_AMOUNT')
    .transform(round2);                         // ensure ≤2dp & numeric

/**
 * POST /wallet/transfer  body validation
 */
const TransferBodySchema = z.object({
    from: WalletTypeSchema,
    to: WalletTypeSchema,
    amount: AmountSchema,
    idempotencyKey: z.string().trim().max(64).optional(),
}).superRefine((data, ctx) => {
    // business-rule checks
    if (!isTransferAllowed(data.from, data.to)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ERR_FLOW_NOT_ALLOWED', path: ['from'] });
    }
    // min trade for account→trading
    if (data.from === 'account' && data.to === 'trading' && data.amount < MIN_TRADE_USD) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `ERR_MIN_TRADE_${MIN_TRADE_USD}`,
            path: ['amount'],
        });
    }
});

function validateTransferBody(body) {
    return TransferBodySchema.parse(body);
}

module.exports = { validateTransferBody, TransferBodySchema };
