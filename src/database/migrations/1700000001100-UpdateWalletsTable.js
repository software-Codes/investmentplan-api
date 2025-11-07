// database/migrations/1700000001100-UpdateWalletsTable.js
module.exports = class UpdateWalletsTable1700000001100 {
    name = 'UpdateWalletsTable1700000001100';

    async up(qr) {
        // wallet_type enum
        await qr.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='wallet_type') THEN
        CREATE TYPE wallet_type AS ENUM ('account','trading','referral');
      END IF;
    END$$;`);

        // table
        await qr.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        wallet_type wallet_type NOT NULL,
        balance NUMERIC(18,2) NOT NULL DEFAULT 0,
        locked_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        // upgrade numeric precision idempotently
        await qr.query(`ALTER TABLE wallets ALTER COLUMN balance TYPE NUMERIC(18,2);`);
        await qr.query(`ALTER TABLE wallets ALTER COLUMN locked_balance TYPE NUMERIC(18,2);`);

        // add checks if missing
        await qr.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_wallets_balance_nonneg') THEN
        ALTER TABLE wallets ADD CONSTRAINT chk_wallets_balance_nonneg CHECK (balance >= 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_wallets_locked_balance_nonneg') THEN
        ALTER TABLE wallets ADD CONSTRAINT chk_wallets_locked_balance_nonneg CHECK (locked_balance >= 0);
      END IF;
    END$$;`);

        // unique index
        await qr.query(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename='wallets' AND indexname='uq_wallets_user_type'
      ) THEN
        CREATE UNIQUE INDEX uq_wallets_user_type ON wallets(user_id, wallet_type);
      END IF;
    END$$;`);
    }

    async down(qr) {
        // keep wallets table; rolling back can be destructive—skip drop in down.
    }
};
