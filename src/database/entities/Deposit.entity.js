const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Deposit',
  tableName: 'deposits',
  columns: {
    deposit_id: {
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
    binance_tx_id: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    status: {
      type: 'enum',
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    },
    verified_at: {
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
    }
  },
  indices: [
    { columns: ['user_id'] },
    { columns: ['binance_tx_id'] },
    { columns: ['status'] }
  ]
});
