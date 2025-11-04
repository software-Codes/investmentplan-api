const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'OTPRecord',
  tableName: 'otp_records',
  columns: {
    otp_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: true
    },
    email: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    phone_number: {
      type: 'varchar',
      length: 20,
      nullable: true
    },
    otp_code: {
      type: 'varchar',
      length: 6,
      nullable: false
    },
    otp_purpose: {
      type: 'enum',
      enum: ['registration', 'login', 'reset_password', 'withdrawal', 'profile_update'],
      nullable: false
    },
    delivery_method: {
      type: 'enum',
      enum: ['email', 'sms'],
      nullable: false
    },
    is_verified: {
      type: 'boolean',
      default: false
    },
    attempt_count: {
      type: 'integer',
      default: 0
    },
    created_at: {
      type: 'timestamptz',
      nullable: false
    },
    expires_at: {
      type: 'timestamptz',
      nullable: false
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
    { columns: ['user_id'] },
    { columns: ['email'] },
    { columns: ['phone_number'] },
    { columns: ['otp_purpose'] }
  ]
});
