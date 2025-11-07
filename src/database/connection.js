const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

pool.on('connect', () => {
  console.log('Database connection established');
});

const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
};

module.exports = { pool, query };
