// database/migrations/1700000000003-CreateDepositsTable.js
const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateDepositsTable1700000000003 {
    name = 'CreateDepositsTable1700000000003';

    async up(queryRunner) {
        // enums
        await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_status') THEN
        CREATE TYPE deposit_status AS ENUM ('pending','processing','confirmed','failed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_source') THEN
        CREATE TYPE deposit_source AS ENUM ('manual','auto');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_network') THEN
        CREATE TYPE deposit_network AS ENUM ('ERC20');
      END IF;
    END$$;`);

        // table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        deposit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        tx_id VARCHAR(255) NOT NULL UNIQUE,
        amount_usd NUMERIC(18,2) NOT NULL CHECK (amount_usd >= 0),
        asset VARCHAR(16) NOT NULL DEFAULT 'USDT',
        network deposit_network NOT NULL DEFAULT 'ERC20',
        status deposit_status NOT NULL DEFAULT 'pending',
        source deposit_source NOT NULL DEFAULT 'manual',
        verified_at TIMESTAMPTZ,
        credited_at TIMESTAMPTZ,
        message VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        // bring older schemas up-to-date (rename + add columns if needed)
        // rename old binance_tx_id -> tx_id
        await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='deposits' AND column_name='binance_tx_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='deposits' AND column_name='tx_id'
        )
        THEN
          ALTER TABLE deposits RENAME COLUMN binance_tx_id TO tx_id;
        END IF;
      END$$;
    `);

        // add missing columns (idempotent)
        const addCol = async (name, ddl) => {
            await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='deposits' AND column_name='${name}'
          ) THEN
            ALTER TABLE deposits ADD COLUMN ${ddl};
          END IF;
        END$$;
      `);
        };

        await addCol('amount_usd', `amount_usd NUMERIC(18,2) NOT NULL DEFAULT 0`);
        await addCol('asset', `asset VARCHAR(16) NOT NULL DEFAULT 'USDT'`);
        await addCol('network', `network deposit_network NOT NULL DEFAULT 'ERC20'`);
        await addCol('source', `source deposit_source NOT NULL DEFAULT 'manual'`);
        await addCol('verified_at', `verified_at TIMESTAMPTZ`);
        await addCol('credited_at', `credited_at TIMESTAMPTZ`);
        await addCol('message', `message VARCHAR(255)`);
        await addCol('metadata', `metadata JSONB`);
        await addCol('updated_at', `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

        // ensure tx_id unique index exists
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename='deposits' AND indexname='uq_deposits_tx_id'
        ) THEN
          CREATE UNIQUE INDEX uq_deposits_tx_id ON deposits(tx_id);
        END IF;
      END$$;
    `);

        // other helpful indexes
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename='deposits' AND indexname='idx_deposits_user_id'
        ) THEN
          CREATE INDEX idx_deposits_user_id ON deposits(user_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename='deposits' AND indexname='idx_deposits_status'
        ) THEN
          CREATE INDEX idx_deposits_status ON deposits(status);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename='deposits' AND indexname='idx_deposits_created_at'
        ) THEN
          CREATE INDEX idx_deposits_created_at ON deposits(created_at);
        END IF;
      END$$;
    `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS deposits CASCADE;`);
        await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_status') THEN DROP TYPE deposit_status; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_source') THEN DROP TYPE deposit_source; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_network') THEN DROP TYPE deposit_network; END IF;
    END$$;`);
    }
};
