// database/migrations/1700000001101-CreateWalletTransactionsTable.js
module.exports = class CreateWalletTransactionsTable1700000001101 {
    name = 'CreateWalletTransactionsTable1700000001101';

    async up(qr) {
        await qr.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='wallet_tx_direction') THEN
        CREATE TYPE wallet_tx_direction AS ENUM ('credit','debit');
      END IF;
    END$$;`);

        await qr.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_id UUID NOT NULL REFERENCES wallets(wallet_id) ON DELETE CASCADE,
        direction wallet_tx_direction NOT NULL,
        amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
        balance_after NUMERIC(18,2) NOT NULL,
        reason VARCHAR(64),
        ref_type VARCHAR(64),
        ref_id VARCHAR(255),
        idempotency_key VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        await qr.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='wallet_transactions' AND indexname='idx_wtx_wallet_created') THEN
        CREATE INDEX idx_wtx_wallet_created ON wallet_transactions(wallet_id, created_at);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='wallet_transactions' AND indexname='idx_wtx_ref') THEN
        CREATE INDEX idx_wtx_ref ON wallet_transactions(ref_type, ref_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='wallet_transactions' AND indexname='idx_wtx_idem') THEN
        CREATE INDEX idx_wtx_idem ON wallet_transactions(idempotency_key);
      END IF;
    END$$;`);
    }

    async down(qr) {
        await qr.query(`DROP TABLE IF EXISTS wallet_transactions;`);
        await qr.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname='wallet_tx_direction') THEN
        DROP TYPE wallet_tx_direction;
      END IF;
    END$$;`);
    }
};
