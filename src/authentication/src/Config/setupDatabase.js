const { query, checkDatabaseConnection } = require('./neon-database');
const { logger } = require('../utils/logger');

/* -------------------------------------------------- */
/*  ENUM TYPES                                         */
/* -------------------------------------------------- */
async function createEnumTypes() {
  try {
    logger.info('Creating custom ENUM types...');
    const enums = [
      { name: 'contact_method_enum', values: "('email', 'phone')" },
      { name: 'account_status_enum', values: "('pending', 'active', 'suspended', 'deactivated')" },
      { name: 'verification_status_enum', values: "('not_submitted', 'pending', 'verified', 'rejected')" },
      { name: 'document_type_enum', values: "('national_id', 'drivers_license', 'passport')" },
      { name: 'otp_purpose_enum', values: "('registration', 'login', 'reset_password', 'withdrawal', 'profile_update')" },
      { name: 'otp_delivery_enum', values: "('email', 'sms')" }
    ];

    for (const t of enums) {
      await query(`
        DO $$ BEGIN
          CREATE TYPE ${t.name} AS ENUM ${t.values};
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    // extra verification_status_enum values
    await query(`
      DO $$ BEGIN
        ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'processing' AFTER 'pending';
        ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'expired'    AFTER 'rejected';
        ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'cancelled'  AFTER 'expired';
      END $$;
    `);

    logger.info('All custom ENUM types created successfully');
  } catch (err) {
    logger.error(`Error creating ENUM types: ${err.message}`, { err });
    throw err;
  }
}

/* -------------------------------------------------- */
/*  TABLES                                            */
/* -------------------------------------------------- */
async function createTables() {
  try {
    logger.info('Creating database tables…');

    /* USERS */
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name               VARCHAR(255)      NOT NULL,
        email                   VARCHAR(255) UNIQUE NOT NULL,
        phone_number            VARCHAR(50)  UNIQUE,
        password_hash           VARCHAR(255)      NOT NULL,
        preferred_contact_method contact_method_enum DEFAULT 'email',
        email_verified          BOOLEAN DEFAULT FALSE,
        phone_verified          BOOLEAN DEFAULT FALSE,
        account_status          account_status_enum DEFAULT 'pending',
        failed_login_attempts   INTEGER DEFAULT 0,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    /* ADMINS */
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        admin_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name    VARCHAR(255)  NOT NULL,
        email        VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role         VARCHAR(100) UNIQUE NOT NULL DEFAULT 'admin',
        is_active    BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    /* KYC DOCUMENTS */
    await query(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        document_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        document_type        document_type_enum NOT NULL,
        document_country     VARCHAR(100),
        verification_reference VARCHAR(255),
        blob_storage_path    VARCHAR(255) NOT NULL,
        blob_storage_url     VARCHAR(255),
        file_name            VARCHAR(255),
        original_file_name   VARCHAR(255),
        file_size            INTEGER,
        file_type            VARCHAR(100),
        uploaded_at          TIMESTAMPTZ NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL,
        updated_at           TIMESTAMPTZ NOT NULL
      );
    `);

    /* OTP RECORDS */
    await query(`
      CREATE TABLE IF NOT EXISTS otp_records (
        otp_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
        email          VARCHAR(255),
        phone_number   VARCHAR(20),
        otp_code       VARCHAR(6) NOT NULL,
        otp_purpose    otp_purpose_enum NOT NULL,
        delivery_method otp_delivery_enum NOT NULL,
        is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
        attempt_count  INTEGER NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL,
        expires_at     TIMESTAMPTZ NOT NULL
      );
    `);

    /* USER SESSIONS */
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
        ip_address     VARCHAR(45),
        user_agent     TEXT,
        expires_at     TIMESTAMPTZ NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL,
        last_active_at TIMESTAMPTZ NOT NULL,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    /* DEPOSITS */
    await query(`
      CREATE TABLE IF NOT EXISTS deposits (
        deposit_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(user_id),
        amount        NUMERIC(12,2) NOT NULL,
        binance_tx_id VARCHAR(255),
        status        VARCHAR(50) DEFAULT 'pending',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at   TIMESTAMPTZ,
        completed_at  TIMESTAMPTZ,
        CONSTRAINT valid_amount CHECK (amount >= 10),
        CONSTRAINT valid_status CHECK (status IN ('pending','processing','completed','failed'))
      );
    `);

    /* REFERRALS */
    await query(`
      CREATE TABLE IF NOT EXISTS referrals (
        referral_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id   UUID REFERENCES users(user_id),
        referral_code VARCHAR(10) UNIQUE NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_referrer UNIQUE (referrer_id)
      );
    `);

    /* REFERRAL BONUSES */
    await query(`
      CREATE TABLE IF NOT EXISTS referral_bonuses (
        bonus_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_id    UUID REFERENCES referrals(referral_id),
        referee_id     UUID REFERENCES users(user_id),
        deposit_amount NUMERIC(12,2) NOT NULL,
        bonus_amount   NUMERIC(12,2) NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_referee UNIQUE (referee_id)
      );
    `);

    /* TRADING ACCOUNTS */
    await query(`
      CREATE TABLE IF NOT EXISTS trading_accounts (
        trading_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID REFERENCES users(user_id),
        initial_amount    NUMERIC(12,2) NOT NULL,
        current_amount    NUMERIC(12,2) NOT NULL,
        profit_amount     NUMERIC(12,2) DEFAULT 0,
        start_date        TIMESTAMPTZ NOT NULL,
        last_compound_date TIMESTAMPTZ NOT NULL,
        status            VARCHAR(50) DEFAULT 'active',
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT valid_status CHECK (status IN ('active','completed','withdrawn'))
      );
    `);

    /* WALLET TRANSFERS */
    await query(`
      CREATE TABLE IF NOT EXISTS wallet_transfers (
        transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(user_id),
        from_wallet VARCHAR(50) NOT NULL,
        to_wallet   VARCHAR(50) NOT NULL,
        amount      NUMERIC(12,2) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT valid_wallet_types CHECK (
          from_wallet IN ('account','trading','referral')
          AND to_wallet IN ('account','trading','referral')
        )
      );
    `);

    /* WITHDRAWALS */
    await query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        withdrawal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(user_id),
        amount        NUMERIC(12,2) NOT NULL,
        wallet_type   VARCHAR(50) NOT NULL,
        binance_address VARCHAR(255) NOT NULL,
        binance_tx_id VARCHAR(255),
        status        VARCHAR(50) DEFAULT 'pending',
        admin_approved BOOLEAN DEFAULT FALSE,
        approved_by   UUID REFERENCES admins(admin_id),
        requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at   TIMESTAMPTZ,
        completed_at  TIMESTAMPTZ,
        CONSTRAINT valid_status CHECK (status IN ('pending','approved','completed','rejected')),
        CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('account','trading','referral'))
      );
    `);

    /* WALLETS */
    await query(`
      CREATE TABLE IF NOT EXISTS wallets (
        wallet_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        wallet_type    VARCHAR(50) NOT NULL,
        balance        NUMERIC(12,2) DEFAULT 0.00,
        locked_balance NUMERIC(12,2) DEFAULT 0.00,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('account','trading','referral')),
        CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_type)
      );
    `);

    logger.info('All tables created successfully');
  } catch (err) {
    logger.error(`Error creating tables: ${err.message}`, { err });
    throw err;
  }
}

/* -------------------------------------------------- */
/*  INDEXES                                           */
/* -------------------------------------------------- */
async function createIndexes() {
  try {
    logger.info('Creating indexes…');

    const indexDDL = [
      // Users
      `CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);`,
      `CREATE INDEX IF NOT EXISTS idx_users_phone       ON users(phone_number);`,
      `CREATE INDEX IF NOT EXISTS idx_users_status      ON users(account_status);`,

      // OTP
      `CREATE INDEX IF NOT EXISTS idx_otp_user_id       ON otp_records(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_otp_email         ON otp_records(email);`,
      `CREATE INDEX IF NOT EXISTS idx_otp_phone_number  ON otp_records(phone_number);`,
      `CREATE INDEX IF NOT EXISTS idx_otp_purpose       ON otp_records(otp_purpose);`,

      // Sessions
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON user_sessions(user_id);`,

      // KYC
      `CREATE INDEX IF NOT EXISTS idx_kyc_ver_ref       ON kyc_documents(verification_reference);`,

      // Admins
      `CREATE INDEX IF NOT EXISTS idx_admins_email      ON admins(email);`,
      `CREATE INDEX IF NOT EXISTS idx_admins_role       ON admins(role);`,
      `CREATE INDEX IF NOT EXISTS idx_admins_active     ON admins(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at);`,

      // Deposits
      `CREATE INDEX IF NOT EXISTS idx_deposits_user_id  ON deposits(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_deposits_bin_tx   ON deposits(binance_tx_id);`,
      `CREATE INDEX IF NOT EXISTS idx_deposits_status   ON deposits(status);`,

      // Referrals
      `CREATE INDEX IF NOT EXISTS idx_referrals_code        ON referrals(referral_code);`,
      `CREATE INDEX IF NOT EXISTS idx_ref_bonus_referral_id ON referral_bonuses(referral_id);`,

      // Trading
      `CREATE INDEX IF NOT EXISTS idx_trading_user_id   ON trading_accounts(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_trading_status    ON trading_accounts(status);`,

      // Wallet transfers
      `CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON wallet_transfers(user_id);`,

      // Withdrawals
      `CREATE INDEX IF NOT EXISTS idx_withdr_user_id    ON withdrawals(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_withdr_status     ON withdrawals(status);`,
      `CREATE INDEX IF NOT EXISTS idx_withdr_req_at     ON withdrawals(requested_at);`,

      // Wallets
      `CREATE INDEX IF NOT EXISTS idx_wallets_user_type ON wallets(user_id, wallet_type);`
    ];

    for (const sql of indexDDL) {
      await query(sql);
    }

    logger.info('All indexes created successfully');
  } catch (err) {
    logger.error(`Error creating indexes: ${err.message}`, { err });
    throw err;
  }
}




/* -------------------------------------------------- */
/*  MASTER RUNNER                                     */
/* -------------------------------------------------- */
async function setupDatabase() {
  try {
    logger.info('Starting database setup…');
    await checkDatabaseConnection();
    await createEnumTypes();
    await createTables();
    await createIndexes();
    logger.success('Database setup completed successfully!');
  } catch (err) {
    logger.error(`Database setup failed: ${err.message}`, { err });
    throw err;
  }
}


module.exports = setupDatabase;
