const { query, checkDatabaseConnection } = require("./neon-database");
const constants = require("../utils/constants");

// ANSI escape codes for colored logging
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m'
};

const logger = {
  info: (message) => console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (message) => console.error(`${colors.red}[ERROR]${colors.reset} ${message}`)
};

async function createEnumTypes() {
  try {
    logger.info('Creating custom ENUM types...');

    // Create ENUM types using raw SQL formatting
    await query(`
      CREATE TYPE contact_method_enum AS ENUM ('${constants.CONTACT_METHODS.join("', '")}')
    `);

    await query(`
      CREATE TYPE account_status_enum AS ENUM ('${constants.ACCOUNT_STATUSES.join("', '")}')
    `);

    await query(`
      CREATE TYPE verification_status_enum AS ENUM ('${constants.VERIFICATION_STATUSES.join("', '")}')
    `);

    await query(`
      CREATE TYPE document_type_enum AS ENUM ('${constants.DOCUMENT_TYPES.join("', '")}')
    `);

    await query(`
      CREATE TYPE otp_purpose_enum AS ENUM ('${constants.OTP_PURPOSES.join("', '")}')
    `);

    await query(`
      CREATE TYPE otp_delivery_enum AS ENUM ('${constants.OTP_DELIVERY.join("', '")}')
    `);

    logger.success('All custom ENUM types created successfully');
  } catch (error) {
    logger.error(`Error creating ENUM types: ${error.message}`);
    throw error;
  }
}

async function createTables() {
  try {
    logger.info('Creating database tables...');

    // Use the exact SQL schema from your original file
    const schemaSQL = `
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

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);

      CREATE TABLE IF NOT EXISTS kyc_documents (
          document_id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          document_type document_type_enum NOT NULL,
          document_number VARCHAR(100),
          document_country VARCHAR(100),
          blob_storage_path VARCHAR(255) NOT NULL,
          blob_storage_url VARCHAR(255),
          verification_status verification_status_enum NOT NULL DEFAULT 'pending',
          verification_method VARCHAR(50),
          verification_reference VARCHAR(100),
          verification_notes TEXT,
          uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
          verified_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

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

      CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_records(email);
      CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_records(phone_number);
      CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_records(otp_purpose);
    `;

    await query(schemaSQL);
    logger.success('All tables created successfully');
  } catch (error) {
    logger.error(`Error creating tables: ${error.message}`);
    throw error;
  }
}

async function setupDatabase() {
  try {
    logger.info('Starting database setup...');

    // Verify database connection first
    await checkDatabaseConnection();

    // Create enums first
    await createEnumTypes();

    // Create tables and indexes
    await createTables();

    logger.success('Database setup completed successfully!');
  } catch (error) {
    logger.error(`Database setup failed: ${error.message}`);
    throw error;
  }
}

module.exports = setupDatabase;