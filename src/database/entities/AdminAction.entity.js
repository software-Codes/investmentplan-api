const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'AdminAction',
  tableName: 'admin_actions',
  columns: {
    action_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    admin_id: {
      type: 'uuid',
      nullable: false
    },
    target_user_id: {
      type: 'uuid',
      nullable: true
    },
    action: {
      type: 'varchar',
      length: 50,
      nullable: false
    },
    details: {
      type: 'jsonb',
      nullable: true
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    }
  },
  relations: {
    admin: {
      type: 'many-to-one',
      target: 'Admin',
      joinColumn: { name: 'admin_id' },
      onDelete: 'CASCADE'
    },
    targetUser: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'target_user_id' },
      onDelete: 'SET NULL'
    }
  },
  indices: [
    { columns: ['admin_id'] },
    { columns: ['target_user_id'] },
    { columns: ['created_at'] }
  ]
});
