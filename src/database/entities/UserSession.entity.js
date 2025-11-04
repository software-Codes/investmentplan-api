const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserSession',
  tableName: 'user_sessions',
  columns: {
    session_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    ip_address: {
      type: 'varchar',
      length: 45,
      nullable: true
    },
    user_agent: {
      type: 'text',
      nullable: true
    },
    expires_at: {
      type: 'timestamptz',
      nullable: false
    },
    created_at: {
      type: 'timestamptz',
      nullable: false
    },
    last_active_at: {
      type: 'timestamptz',
      nullable: false
    },
    is_active: {
      type: 'boolean',
      default: true
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
    { columns: ['user_id'] }
  ]
});
