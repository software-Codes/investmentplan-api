const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Referral',
  tableName: 'referrals',
  columns: {
    referral_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    referrer_id: {
      type: 'uuid',
      nullable: false
    },
    referral_code: {
      type: 'varchar',
      length: 10,
      unique: true,
      nullable: false
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    }
  },
  relations: {
    referrer: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'referrer_id' }
    },
    bonuses: {
      type: 'one-to-many',
      target: 'ReferralBonus',
      inverseSide: 'referral'
    }
  },
  indices: [
    { columns: ['referral_code'] }
  ]
});
