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

    logger.info("All indexes created successfully");
  } catch (error) {
    logger.error(`Error creating indexes: ${error.message}`, { error });
    throw error;
  }
}

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
