// database/entities/WalletTransaction.entity.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'WalletTransaction',
    tableName: 'wallet_transactions',
    columns: {
        transaction_id: { type: 'uuid', primary: true, generated: 'uuid' },
        wallet_id: { type: 'uuid', nullable: false },
        direction: { type: 'enum', enum: ['credit', 'debit'], nullable: false },
        amount: { type: 'decimal', precision: 18, scale: 2, nullable: false },
        balance_after: { type: 'decimal', precision: 18, scale: 2, nullable: false },
        reason: { type: 'varchar', length: 64, nullable: true },         // e.g., 'deposit', 'transfer'
        ref_type: { type: 'varchar', length: 64, nullable: true },        // e.g., 'deposit'
        ref_id: { type: 'varchar', length: 255, nullable: true },         // e.g., deposit_id or txId
        idempotency_key: { type: 'varchar', length: 64, nullable: true }, // optional dedupe
        created_at: { type: 'timestamptz', createDate: true },
    },
    relations: {
        wallet: { type: 'many-to-one', target: 'Wallet', joinColumn: { name: 'wallet_id' }, onDelete: 'CASCADE' },
    },
    indices: [
        { columns: ['wallet_id', 'created_at'] },
        { columns: ['idempotency_key'], unique: false },
        { columns: ['ref_type', 'ref_id'] },
    ],
    checks: [
        { expression: '(amount > 0)' },
    ],
});
