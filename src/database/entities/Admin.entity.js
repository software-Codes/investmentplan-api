const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Admin',
  tableName: 'admins',
  columns: {
    admin_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    full_name: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    email: {
      type: 'varchar',
      length: 255,
      unique: true,
      nullable: false
    },
    password_hash: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    role: {
      type: 'varchar',
      length: 100,
      default: 'admin',
      nullable: false
    },
    is_active: {
      type: 'boolean',
      default: true
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
  indices: [
    { columns: ['email'] },
    { columns: ['role'] },
    { columns: ['is_active'] }
  ]
});
