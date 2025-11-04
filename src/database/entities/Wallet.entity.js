const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Wallet',
  tableName: 'wallets',
  columns: {
    wallet_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    wallet_type: {
      type: 'enum',
      enum: ['account', 'trading', 'referral'],
      nullable: false
    },
    balance: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      default: 0.00
    },
    locked_balance: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      default: 0.00
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    },
    updated_at: {
      type: 'timestamptz',
      updateDate: true
    }
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id' },
      onDelete: 'CASCADE'
    }
  },
  indices: [
    { columns: ['user_id', 'wallet_type'], unique: true }
  ]
});
