const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Withdrawal',
  tableName: 'withdrawals',
  columns: {
    withdrawal_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    wallet_type: {
      type: 'enum',
      enum: ['account', 'trading', 'referral'],
      nullable: false
    },
    binance_address: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    binance_tx_id: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    status: {
      type: 'enum',
      enum: ['pending', 'approved', 'completed', 'rejected'],
      default: 'pending'
    },
    admin_approved: {
      type: 'boolean',
      default: false
    },
    approved_by: {
      type: 'uuid',
      nullable: true
    },
    requested_at: {
      type: 'timestamptz',
      createDate: true
    },
    approved_at: {
      type: 'timestamptz',
      nullable: true
    },
    completed_at: {
      type: 'timestamptz',
      nullable: true
    }
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id' }
    },
    admin: {
      type: 'many-to-one',
      target: 'Admin',
      joinColumn: { name: 'approved_by' }
    }
  },
  indices: [
    { columns: ['user_id'] },
    { columns: ['status'] },
    { columns: ['requested_at'] }
  ]
});
