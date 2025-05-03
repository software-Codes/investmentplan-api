const { query, checkDatabaseConnection } = require("./neon-database");
const { logger } = require("../utils/logger");

async function createEnumTypes() {
  try {
    logger.info("Creating custom ENUM types...");
    const enums = [
      {
        name: "contact_method_enum",
        values: "('email', 'phone')",
      },
      {
        name: "account_status_enum",
        values: "('pending', 'active', 'suspended', 'deactivated')",
      },
      {
        name: "verification_status_enum",
        values: "('not_submitted', 'pending', 'verified', 'rejected')",
      },
      {
        name: "document_type_enum",
        values: "('national_id', 'drivers_license', 'passport')",
      },
      {
        name: "otp_purpose_enum",
        values:
          "('registration', 'login', 'reset_password', 'withdrawal', 'profile_update')",
      },
      {
        name: "otp_delivery_enum",
        values: "('email', 'sms')",
      },
    ];

    // Create all enum types first
    for (const enumType of enums) {
      await query(`
        DO $$ 
        BEGIN
          CREATE TYPE ${enumType.name} AS ENUM ${enumType.values};
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    // Add new values to verification_status_enum after initial creation
    await query(`
      DO $$ 
      BEGIN
        ALTER TYPE verification_status_enum ADD VALUE 'processing' AFTER 'pending';
        ALTER TYPE verification_status_enum ADD VALUE 'expired' AFTER 'rejected';
        ALTER TYPE verification_status_enum ADD VALUE 'cancelled' AFTER 'expired';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    logger.info("All custom ENUM types created successfully");
  } catch (error) {
    logger.error(`Error creating ENUM types: ${error.message}`, { error });
    throw error;
  }
}

async function createTables() {
  try {
    logger.info("Creating database tables...");

    await query(`
      CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone_number VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          preferred_contact_method contact_method_enum NOT NULL DEFAULT 'email',
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
          account_status account_status_enum NOT NULL DEFAULT 'pending',
          failed_login_attempts INTEGER NOT NULL DEFAULT 0,
          last_login_at TIMESTAMP WITH TIME ZONE,
          last_login_ip VARCHAR(45),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    // Add this to your createTables function

    await query(`
  CREATE TABLE IF NOT EXISTS admins (
    admin_id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_super_admin BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
`);

    await query(`
  CREATE TABLE IF NOT EXISTS kyc_documents (
    document_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_country VARCHAR(100),
    verification_reference VARCHAR(255),
    blob_storage_path VARCHAR(255) NOT NULL,
    blob_storage_url VARCHAR(255),
    file_name VARCHAR(255),
    original_file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(100),
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
`);

    await query(`
      CREATE TABLE IF NOT EXISTS otp_records (
          otp_id UUID PRIMARY KEY,
          user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          email VARCHAR(255),
          phone_number VARCHAR(20),
          otp_code VARCHAR(6) NOT NULL,
          otp_purpose otp_purpose_enum NOT NULL,
          delivery_method otp_delivery_enum NOT NULL,
          is_verified BOOLEAN NOT NULL DEFAULT FALSE,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
          session_id UUID PRIMARY KEY,
          user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          ip_address VARCHAR(45),
          user_agent TEXT,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          last_active_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    await query(
      `
      CREATE TABLE IF NOT EXISTS deposits (
  deposit_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  amount NUMERIC(12, 2) NOT NULL,
  binance_tx_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_amount CHECK (amount >= 10),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);
      `
    );
    //investment tables
    //1.referrals
    await query(`
  CREATE TABLE IF NOT EXISTS referrals (
    referral_id UUID PRIMARY KEY,
    referrer_id UUID REFERENCES users(user_id),
    referral_code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_referrer UNIQUE (referrer_id)
  );
      `);
    // referral bonuses
    await query(`
  CREATE TABLE IF NOT EXISTS referral_bonuses (
    bonus_id UUID PRIMARY KEY,
    referral_id UUID REFERENCES referrals(referral_id),
    referee_id UUID REFERENCES users(user_id),
    deposit_amount NUMERIC(12, 2) NOT NULL,
    bonus_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_referee UNIQUE (referee_id)
  );
        `);

    //trading
    // referral bonuses
    await query(`
    CREATE TABLE IF NOT EXISTS referral_bonuses (
      bonus_id UUID PRIMARY KEY,
      referral_id UUID REFERENCES referrals(referral_id),
      referee_id UUID REFERENCES users(user_id),
      deposit_amount NUMERIC(12, 2) NOT NULL,
      bonus_amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_referee UNIQUE (referee_id)
    );
          `);
    // Trading accounts table
    await query(`
CREATE TABLE IF NOT EXISTS trading_accounts (
  trading_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  initial_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL,
  profit_amount NUMERIC(12, 2) DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  last_compound_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'withdrawn'))
);
          `);
    // Wallet transfers table
    await query(`
CREATE TABLE IF NOT EXISTS wallet_transfers (
  transfer_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  from_wallet VARCHAR(50) NOT NULL,
  to_wallet VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_wallet_types CHECK (
    from_wallet IN ('account', 'trading', 'referral') AND
    to_wallet IN ('account', 'trading', 'referral')
  )
);
          `);
    //withdrawals tables
    await query(`
CREATE TABLE IF NOT EXISTS withdrawals (
  withdrawal_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  amount NUMERIC(12, 2) NOT NULL,
  wallet_type VARCHAR(50) NOT NULL,
  binance_address VARCHAR(255) NOT NULL,
  binance_tx_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  admin_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES admins(admin_id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('account', 'trading', 'referral'))
);
                      `);
    //wallets tables
    await query(`
                  CREATE TABLE IF NOT EXISTS wallets (
    wallet_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    wallet_type VARCHAR(50) NOT NULL,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    locked_balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('account', 'trading', 'referral')),
    CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_type)
);
                                              `);

    logger.info("All tables created successfully");
  } catch (error) {
    logger.error(`Error creating tables: ${error.message}`, { error });
    throw error;
  }
}

async function createIndexes() {
  try {
    logger.info("Creating indexes...");

    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_records(user_id);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_records(email);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_records(phone_number);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_records(otp_purpose);`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);`
    );

    await query(
      `CREATE INDEX IF NOT EXISTS idx_kyc_verification_reference ON kyc_documents(verification_reference);`
    );
    // deposits tables
    await query(`CREATE INDEX idx_deposits_user_id ON deposits(user_id);`);
    await query(
      `CREATE INDEX idx_deposits_binance_tx_id ON deposits(binance_tx_id);`
    );
    await query(`CREATE INDEX idx_deposits_status ON deposits(status);`);
    //referaals
    await query(`CREATE INDEX idx_referrals_code ON referrals(referral_code);`);
    await query(
      `CREATE INDEX idx_referral_bonuses_referral_id ON referral_bonuses(referral_id);`
    );
    //trading
    await query(`CREATE INDEX idx_trading_user_id ON trading_accounts(user_id);
`);
    await query(
      `CREATE INDEX idx_trading_status ON trading_accounts(status);
`
    );
    await query(
      `CREATE INDEX idx_transfers_user_id ON wallet_transfers(user_id);`
    );

    //withdrawals
    await query(
      `CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);`
    );
    await query(`CREATE INDEX idx_withdrawals_status ON withdrawals(status);`);
    await query(
      `CREATE INDEX idx_withdrawals_requested_at ON withdrawals(requested_at);`
    );
    //wallets
    await query(
      `CREATE INDEX idx_wallets_user_type ON wallets(user_id, wallet_type);`
    );

    logger.info("All indexes created successfully");
  } catch (error) {
    logger.error(`Error creating indexes: ${error.message}`, { error });
    throw error;
  }
}

// -- Add locked_balance to wallets table
// ALTER TABLE wallets 
// ADD COLUMN IF NOT EXISTS locked_balance NUMERIC(12, 2) DEFAULT 0.00;

// -- Update withdrawals table with new columns
// ALTER TABLE withdrawals 
// ADD COLUMN IF NOT EXISTS processing_deadline TIMESTAMPTZ,
// ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES admins(admin_id),
// ADD COLUMN IF NOT EXISTS binance_address VARCHAR(255) NOT NULL,
// ADD COLUMN IF NOT EXISTS binance_tx_id VARCHAR(255),
// ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
// ADD COLUMN IF NOT EXISTS admin_approval_needed BOOLEAN DEFAULT true,
// ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

// -- Add constraints
// ALTER TABLE withdrawals
// ADD CONSTRAINT valid_withdrawal_status 
// CHECK (status IN ('pending', 'approved', 'completed', 'cancelled', 'failed')),
// ADD CONSTRAINT valid_withdrawal_amount 
// CHECK (amount >= 10);

// -- Create indexes for better performance
// CREATE INDEX IF NOT EXISTS idx_withdrawals_status_deadline 
// ON withdrawals(status, processing_deadline);

// CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status 
// ON withdrawals(user_id, status);

// CREATE INDEX IF NOT EXISTS idx_wallets_locked_balance 
// ON wallets(user_id, wallet_type, locked_balance);

// -- Add trigger to automatically set processing deadline
// CREATE OR REPLACE FUNCTION set_withdrawal_deadline()
// RETURNS TRIGGER AS $$
// BEGIN
//     NEW.processing_deadline := NEW.requested_at + INTERVAL '20 minutes';
//     RETURN NEW;
// END;
// $$ LANGUAGE plpgsql;

// CREATE TRIGGER set_withdrawal_deadline_trigger
// BEFORE INSERT ON withdrawals
// FOR EACH ROW
// EXECUTE FUNCTION set_withdrawal_deadline();

async function setupDatabase() {
  try {
    logger.info("Starting database setup...");
    await checkDatabaseConnection();
    await createEnumTypes();
    await createTables();
    await createIndexes();
    logger.success("Database setup completed successfully!");
  } catch (error) {
    logger.error(`Database setup failed: ${error.message}`, { error });
    throw error;
  }
}

module.exports = setupDatabase;
