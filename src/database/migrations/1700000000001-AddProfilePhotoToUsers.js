const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class AddProfilePhotoToUsers1700000000001 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS profile_photo_url
    `);
  }
};
