const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateAdminActionsTable1700000000002 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID NOT NULL REFERENCES admins(admin_id) ON DELETE CASCADE,
        target_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON admin_actions(target_user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at)
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_actions CASCADE`);
  }
};
