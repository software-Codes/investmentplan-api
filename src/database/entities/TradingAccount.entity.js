const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'TradingAccount',
  tableName: 'trading_accounts',
  columns: {
    trading_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    initial_amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    current_amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    profit_amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      default: 0
    },
    start_date: {
      type: 'timestamptz',
      nullable: false
    },
    last_compound_date: {
      type: 'timestamptz',
      nullable: false
    },
    status: {
      type: 'enum',
      enum: ['active', 'completed', 'withdrawn'],
      default: 'active'
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
    { columns: ['user_id'] },
    { columns: ['status'] }
  ]
});
