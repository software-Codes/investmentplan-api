const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'WalletTransfer',
  tableName: 'wallet_transfers',
  columns: {
    transfer_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    from_wallet: {
      type: 'enum',
      enum: ['account', 'trading', 'referral'],
      nullable: false
    },
    to_wallet: {
      type: 'enum',
      enum: ['account', 'trading', 'referral'],
      nullable: false
    },
    amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    transfer_type: {
      type: 'enum',
      enum: ['principal', 'profit'],
      default: 'principal',
      nullable: false
    },
    locked_until: {
      type: 'timestamptz',
      nullable: true
    },
    unlocked_at: {
      type: 'timestamptz',
      nullable: true
    },
    status: {
      type: 'enum',
      enum: ['active', 'unlocked', 'cancelled'],
      default: 'active',
      nullable: false
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    }
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id' }
    }
  },
  indices: [
    { columns: ['user_id'] }
  ]
});
