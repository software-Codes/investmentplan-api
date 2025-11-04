/**
 * @file neon-database.js
 * @description Neon PostgreSQL database connection with debugging and proper export.
 */

const pkg = require("pg");
const dotenv = require("dotenv");

const { Pool } = pkg;

// Load environment variables from .env file
dotenv.config();

// Database connection string
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://Investement_owner:npg_j2tFJnb5RSxV@ep-long-truth-a8afy746-pooler.eastus2.azure.neon.tech/Investement?sslmode=require";

// Create a connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Add debugging events
pool.on("connect", () => {
  console.log("Database connection established successfully.");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client:", err);
  process.exit(-1); // Exit the process on database connection error
});

// Simple query wrapper with timing for debugging
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Executed query", {
      text,
      duration: `${duration}ms`,
      rows: res.rowCount,
    });
    return res;
  } catch (error) {
    console.error("Query error:", error.message);
    throw error;
  }
};

// Function to check database connection
const checkDatabaseConnection = async () => {
  try {
    await pool.query("SELECT 1"); // Simple query to check connection
    console.log("Database connection verified successfully.");
  } catch (error) {
    console.error("Database connection verification failed:", error.message);
    throw error;
  }
};

// Export the pool, query function, and connection check
module.exports ={
  pool,
  query,
  checkDatabaseConnection,
};
