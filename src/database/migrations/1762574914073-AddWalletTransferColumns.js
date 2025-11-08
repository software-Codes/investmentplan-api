const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class AddWalletTransferColumns1762574914073 {
    name = 'AddWalletTransferColumns1762574914073'

    async up(queryRunner) {
        // Add new columns to wallet_transfers
        await queryRunner.query(`
            ALTER TABLE wallet_transfers 
            ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20) DEFAULT 'principal' NOT NULL,
            ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' NOT NULL
        `);

        // Create index for unlock job queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_wallet_transfers_unlock 
            ON wallet_transfers(from_wallet, to_wallet, transfer_type, status, locked_until)
            WHERE unlocked_at IS NULL
        `);

        // Update existing records
        await queryRunner.query(`
            UPDATE wallet_transfers 
            SET transfer_type = 'principal', 
                status = 'active'
            WHERE transfer_type IS NULL
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_wallet_transfers_unlock`);
        await queryRunner.query(`
            ALTER TABLE wallet_transfers 
            DROP COLUMN IF EXISTS transfer_type,
            DROP COLUMN IF EXISTS locked_until,
            DROP COLUMN IF EXISTS unlocked_at,
            DROP COLUMN IF EXISTS status
        `);
    }
}
