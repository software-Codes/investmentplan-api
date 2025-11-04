const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ReferralBonus',
  tableName: 'referral_bonuses',
  columns: {
    bonus_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    referral_id: {
      type: 'uuid',
      nullable: false
    },
    referee_id: {
      type: 'uuid',
      nullable: false
    },
    deposit_amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    bonus_amount: {
      type: 'decimal',
      precision: 12,
      scale: 2,
      nullable: false
    },
    created_at: {
      type: 'timestamptz',
      createDate: true
    }
  },
  relations: {
    referral: {
      type: 'many-to-one',
      target: 'Referral',
      joinColumn: { name: 'referral_id' }
    },
    referee: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'referee_id' }
    }
  },
  indices: [
    { columns: ['referral_id'] },
    { columns: ['referee_id'], unique: true }
  ]
});
