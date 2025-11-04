const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    user_id: {
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
    phone_number: {
      type: 'varchar',
      length: 50,
      unique: true,
      nullable: true
    },
    password_hash: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    preferred_contact_method: {
      type: 'enum',
      enum: ['email', 'phone'],
      default: 'email'
    },
    email_verified: {
      type: 'boolean',
      default: false
    },
    phone_verified: {
      type: 'boolean',
      default: false
    },
    account_status: {
      type: 'enum',
      enum: ['pending', 'active', 'suspended', 'deactivated'],
      default: 'pending'
    },
    failed_login_attempts: {
      type: 'integer',
      default: 0
    },
    last_login_at: {
      type: 'timestamptz',
      nullable: true
    },
    last_login_ip: {
      type: 'varchar',
      length: 45,
      nullable: true
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
    wallets: {
      type: 'one-to-many',
      target: 'Wallet',
      inverseSide: 'user',
      cascade: true
    },
    sessions: {
      type: 'one-to-many',
      target: 'UserSession',
      inverseSide: 'user',
      cascade: true
    },
    kycDocuments: {
      type: 'one-to-many',
      target: 'KYCDocument',
      inverseSide: 'user',
      cascade: true
    },
    otpRecords: {
      type: 'one-to-many',
      target: 'OTPRecord',
      inverseSide: 'user',
      cascade: true
    }
  },
  indices: [
    { columns: ['email'] },
    { columns: ['phone_number'] },
    { columns: ['account_status'] }
  ]
});
