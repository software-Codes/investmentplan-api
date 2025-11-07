// index.js
const createApp = require("./src/app");
const dotenv = require("dotenv");

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

dotenv.config();

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

    const { app, server, initialize, container } = createApp();

    await initialize();

    server.listen(PORT, () => {
      logger.success(`Server running on port ${PORT}`);
      logger.success(`Ready at ${new Date().toISOString()}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);

      const provider = (process.env.DEPOSIT_PROVIDER || "binance").toLowerCase();
      if (provider === "binance" && container?.jobs?.depositMonitor) {
        logger.info("Deposit monitor job started (Binance polling enabled).");
      }

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

startServer().catch((error) => {
  logger.error(`Critical failure during startup: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
