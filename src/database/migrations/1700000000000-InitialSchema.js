const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class InitialSchema1700000000000 {
    name = 'InitialSchema1700000000000'

    async up(queryRunner) {
        // Create ENUM types
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE contact_method_enum AS ENUM ('email', 'phone');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE account_status_enum AS ENUM ('pending', 'active', 'suspended', 'deactivated');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE document_type_enum AS ENUM ('national_id', 'drivers_license', 'passport');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE otp_purpose_enum AS ENUM ('registration', 'login', 'reset_password', 'withdrawal', 'profile_update');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE otp_delivery_enum AS ENUM ('email', 'sms');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE wallet_type_enum AS ENUM ('account', 'trading', 'referral');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE deposit_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE withdrawal_status_enum AS ENUM ('pending', 'approved', 'completed', 'rejected');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE trading_status_enum AS ENUM ('active', 'completed', 'withdrawn');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        // Create users table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(50) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                preferred_contact_method contact_method_enum DEFAULT 'email',
                email_verified BOOLEAN DEFAULT FALSE,
                phone_verified BOOLEAN DEFAULT FALSE,
                account_status account_status_enum DEFAULT 'pending',
                failed_login_attempts INTEGER DEFAULT 0,
                last_login_at TIMESTAMPTZ,
                last_login_ip VARCHAR(45),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Create admins table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admins (
                admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(100) NOT NULL DEFAULT 'admin',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Create wallets table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                wallet_type wallet_type_enum NOT NULL,
                balance NUMERIC(12,2) DEFAULT 0.00,
                locked_balance NUMERIC(12,2) DEFAULT 0.00,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_type)
            );
        `);

        // Create otp_records table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS otp_records (
                otp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                email VARCHAR(255),
                phone_number VARCHAR(20),
                otp_code VARCHAR(6) NOT NULL,
                otp_purpose otp_purpose_enum NOT NULL,
                delivery_method otp_delivery_enum NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                attempt_count INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );
        `);

        // Create user_sessions table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                last_active_at TIMESTAMPTZ NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            );
        `);

        // Create kyc_documents table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS kyc_documents (
                document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                document_type document_type_enum NOT NULL,
                document_country VARCHAR(100),
                verification_reference VARCHAR(255),
                blob_storage_path VARCHAR(255) NOT NULL,
                blob_storage_url VARCHAR(255),
                file_name VARCHAR(255),
                original_file_name VARCHAR(255),
                file_size INTEGER,
                file_type VARCHAR(100),
                uploaded_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );
        `);

        // Create deposits table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS deposits (
                deposit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id),
                amount NUMERIC(12,2) NOT NULL CHECK (amount >= 10),
                binance_tx_id VARCHAR(255),
                status deposit_status_enum DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                verified_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ
            );
        `);

        // Create withdrawals table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                withdrawal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id),
                amount NUMERIC(12,2) NOT NULL,
                wallet_type wallet_type_enum NOT NULL,
                binance_address VARCHAR(255) NOT NULL,
                binance_tx_id VARCHAR(255),
                status withdrawal_status_enum DEFAULT 'pending',
                admin_approved BOOLEAN DEFAULT FALSE,
                approved_by UUID REFERENCES admins(admin_id),
                requested_at TIMESTAMPTZ DEFAULT NOW(),
                approved_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ
            );
        `);

        // Create referrals table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                referral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                referrer_id UUID REFERENCES users(user_id),
                referral_code VARCHAR(10) UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_referrer UNIQUE (referrer_id)
            );
        `);

        // Create referral_bonuses table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS referral_bonuses (
                bonus_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                referral_id UUID REFERENCES referrals(referral_id),
                referee_id UUID REFERENCES users(user_id),
                deposit_amount NUMERIC(12,2) NOT NULL,
                bonus_amount NUMERIC(12,2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_referee UNIQUE (referee_id)
            );
        `);

        // Create trading_accounts table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS trading_accounts (
                trading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id),
                initial_amount NUMERIC(12,2) NOT NULL,
                current_amount NUMERIC(12,2) NOT NULL,
                profit_amount NUMERIC(12,2) DEFAULT 0,
                start_date TIMESTAMPTZ NOT NULL,
                last_compound_date TIMESTAMPTZ NOT NULL,
                status trading_status_enum DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Create wallet_transfers table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS wallet_transfers (
                transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(user_id),
                from_wallet wallet_type_enum NOT NULL,
                to_wallet wallet_type_enum NOT NULL,
                amount NUMERIC(12,2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_records(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_records(email);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_records(phone_number);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_records(otp_purpose);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kyc_ver_ref ON kyc_documents(verification_reference);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposits_bin_tx ON deposits(binance_tx_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trading_user_id ON trading_accounts(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trading_status ON trading_accounts(status);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON wallet_transfers(user_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_type ON wallets(user_id, wallet_type);`);
    }

    async down(queryRunner) {
        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE IF EXISTS wallet_transfers CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS trading_accounts CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS referral_bonuses CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS referrals CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS withdrawals CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS deposits CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS kyc_documents CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS user_sessions CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS otp_records CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS wallets CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS admins CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);

        // Drop ENUM types
        await queryRunner.query(`DROP TYPE IF EXISTS trading_status_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS withdrawal_status_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS deposit_status_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS wallet_type_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS otp_delivery_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS otp_purpose_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS document_type_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS account_status_enum;`);
        await queryRunner.query(`DROP TYPE IF EXISTS contact_method_enum;`);
    }
}
