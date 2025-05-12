/**
 * @file index.js
 * @description Entry point for the application. Handles server initialization and error monitoring.
 */

const createApp = require("./src/app");
const dotenv = require("dotenv");

// ANSI escape codes for colored output
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

// Configure environment variables
dotenv.config();

// Set up colored console output
const logger = {
  info: (message) =>
    console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`),
  success: (message) =>
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (message) =>
    console.error(`${colors.red}[ERROR]${colors.reset} ${message}`),
  warn: (message) =>
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${message}`),
};

const PORT = process.env.PORT || 4000;
const ENVIRONMENT = process.env.NODE_ENV || "development";

async function startServer() {
  try {
    logger.info(`Starting application in ${ENVIRONMENT} mode...`);

    // Create app instance
    const { app, server, initialize } = createApp();

    // Initialize application components
    await initialize();

    // Start listening for requests
    server.listen(PORT, () => {
      logger.success(`Server running on port ${PORT}`);
      logger.success(`Ready at ${new Date().toISOString()}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);

      if (ENVIRONMENT === "development") {
        logger.info(`Available routes: http://localhost:${PORT}`);
      }
    });

    return server;
  } catch (error) {
    logger.error(`Failed to initialize application: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Global error handlers
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received - shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received - shutting down gracefully");
  process.exit(0);
});

// Start the application
startServer().catch((error) => {
  logger.error(`Critical failure during startup: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
