// database/entities/Deposit.entity.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Deposit',
  tableName: 'deposits',
  columns: {
    deposit_id: { type: 'uuid', primary: true, generated: 'uuid' },

    user_id: { type: 'uuid', nullable: false },

    // Generic tx_id (not Binance-specific) so we can support other providers later
    tx_id: { type: 'varchar', length: 255, nullable: false, unique: true },

    // Store in USD with 2dp (aligns with reporting & downstream wallets)
    amount_usd: { type: 'decimal', precision: 18, scale: 2, nullable: false },

    // Keep asset and network explicit for future-proofing
    asset: { type: 'varchar', length: 16, default: 'USDT' },
    network: { type: 'enum', enum: ['ERC20'], default: 'ERC20' },

    status: {
      type: 'enum',
      enum: ['pending', 'processing', 'confirmed', 'failed'],
      default: 'pending',
    },

    source: {
      type: 'enum',
      enum: ['manual', 'auto'], // manual=user submit; auto=monitor/webhook
      default: 'manual',
    },

    verified_at: { type: 'timestamptz', nullable: true },
    credited_at: { type: 'timestamptz', nullable: true },

    message: { type: 'varchar', length: 255, nullable: true }, // short failure/notes
    metadata: { type: 'jsonb', nullable: true }, // provider payload (confirmations, etc.)

    created_at: { type: 'timestamptz', createDate: true },
    updated_at: { type: 'timestamptz', updateDate: true },
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id' },
    },
  },
  indices: [
    { columns: ['user_id'] },
    { columns: ['status'] },
    { columns: ['created_at'] },
    // tx_id is already unique via column option; adding explicit index improves query plans
    { columns: ['tx_id'], unique: true },
  ],
  // optional DB-level guard (generic ≥ 0; business-level min is enforced in service/validation)
  checks: [{ expression: '(amount_usd >= 0)' }],
});
