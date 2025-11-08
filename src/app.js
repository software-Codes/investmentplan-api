// src/app.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger.config");
const Sentry = require("@sentry/node");

// ── Existing feature routes
const authRoutes = require("./authentication/src/routes/auth.routes");
const adminRoutes = require("./authentication/src/routes/admin/admin.routes");
const adminUserRoutes = require("./authentication/src/routes/admin/admin-users.routes");
const kycRoutes = require("./authentication/src/routes/kyc/kyc.routes");

// ── Deposit module
const { createDepositRouter } = require("./Investment/src/modules/deposit/routes/deposit.routes");
const { createAdminDepositRouter } = require("./Investment/src/modules/deposit/routes/adminDeposit.routes");
const { DepositService } = require("./Investment/src/modules/deposit/services/deposit.service");
const { BinanceProvider } = require("./Investment/src/modules/deposit/providers/binance.provider");
const { WalletService } = require("./Investment/src/modules/wallet/services/wallet.service");
const { AdminDepositSyncJob } = require("./Investment/src/modules/deposit/jobs/adminDepositSync.job");

// ── Wallet module
const { createWalletRouter } = require("./Investment/src/modules/wallet/routes/wallet.routes");
const { createAdminWalletRouter } = require("./Investment/src/modules/wallet/routes/adminWallet.routes");
const { TransferService } = require("./Investment/src/modules/wallet/services/transfer.service");
const { NotificationService } = require("./Investment/src/modules/wallet/services/notification.service");
const { AuditService } = require("./Investment/src/modules/wallet/services/audit.service");
const { WalletUnlockJob } = require("./Investment/src/modules/wallet/jobs/walletUnlock.job");


// ── Auth middlewares (protect routes)
const { authenticate } = require("./authentication/src/middleware/auth.middleware");
const { adminAuthenticate } = require("./authentication/src/middleware/admin/adminAuth.middleware");

// ── DB connection
const { pool } = require("./database/connection");

require("../instrument");

/** Validate env early so the app fails fast in prod */
function validateEnv() {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required env var: JWT_SECRET");
    }
    console.warn("[WARN] JWT_SECRET not set - generating development secret");
    process.env.JWT_SECRET = crypto.randomBytes(64).toString("hex");
  }
}

const createApp = () => {
  const app = express();
  const server = http.createServer(app);

  const container = {
    services: {},
    jobs: {},
  };



  function setupMiddleware() {
    app.use(helmet());
    app.use(compression());
    app.use(cookieParser());
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      })
    );
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(
      session({
        secret: process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
        },
      })
    );

    if (process.env.NODE_ENV === "development") {
      const morgan = require("morgan");
      app.use(morgan("dev"));
    }
  }



  function setupDepositModule() {
    const binance = new BinanceProvider({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      timeout: Number(process.env.DEPOSIT_PROVIDER_TIMEOUT_MS || 10000),
      logger: console,
    });

    const withTransaction = async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    };

    const walletService = new WalletService({ db: pool, withTransaction });
    const depositService = new DepositService({
      db: pool,
      walletService,
      binance,
      logger: console,
    });

    const depositRouter = createDepositRouter({
      depositService,
      authenticate,
      logger: console,
    });

    const adminDepositRouter = createAdminDepositRouter({
      depositService,
      adminAuthenticate,
      logger: console,
    });

    // Admin background sync job - verifies pending deposits (only in production)
    const syncEnabled = process.env.ADMIN_SYNC_ENABLED !== 'false' && process.env.NODE_ENV === 'production';
    if (syncEnabled) {
      const syncJob = new AdminDepositSyncJob({
        depositService,
        binance,
        logger: console,
        intervalMs: Number(process.env.ADMIN_SYNC_INTERVAL_MS || 60000), // 1 minute default
      });
      syncJob.start();
      container.jobs.adminDepositSync = syncJob;
      console.log('[INFO] AdminDepositSyncJob started');
    } else {
      console.log('[INFO] AdminDepositSyncJob disabled (set NODE_ENV=production and ADMIN_SYNC_ENABLED=true to enable)');
    }

    container.services.depositService = depositService;
    container.services.walletService = walletService;
    container.services.binance = binance;

    app.use("/api/v1/deposit", depositRouter);
    app.use("/api/v1/admin/deposits", adminDepositRouter);
  }

  function setupWalletModule() {
    const withTransaction = async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    };

    const walletService = new WalletService({ db: pool, withTransaction });
    const notificationService = new NotificationService({ db: pool, logger: console });
    const auditService = new AuditService({ db: pool, logger: console });

    const transferService = new TransferService({
      db: pool,
      walletService,
      notificationService,
      auditService,
      withTransaction,
      logger: console,
    });

    // User wallet routes
    const walletRouter = createWalletRouter({
      transferService,
      walletService,
      authenticate,
      logger: console,
    });

    // Admin wallet routes
    const adminWalletRouter = createAdminWalletRouter({
      walletService,
      adminAuthenticate,
      logger: console,
    });

    // Start wallet unlock cron job (runs every 5 minutes)
    const unlockJob = new WalletUnlockJob({
      db: pool,
      walletService,
      logger: console,
    });
    unlockJob.start();
    container.jobs.walletUnlock = unlockJob;
    console.log('[INFO] WalletUnlockJob started (runs every 5 minutes)');

    container.services.walletService = walletService;
    container.services.transferService = transferService;
    container.services.notificationService = notificationService;
    container.services.auditService = auditService;

    app.use("/api/v1/wallet", walletRouter);
    app.use("/api/v1/admin/wallet", adminWalletRouter);
  }


  function setupRoutes() {
    // Docs & health
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/health", (req, res) =>
      res.json({ status: "healthy", timestamp: new Date().toISOString() })
    );

    // Existing areas
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/admin", adminRoutes);
    app.use("/api/v1/admin/users", adminUserRoutes);
    app.use("/api/v1/kyc", kycRoutes);

    // Deposit module
    setupDepositModule();
    // Wallet module
    setupWalletModule();
  }

  function notFoundHandler(req, res) {
    res.status(404).json({ success: false, message: "Not Found" });
  }

  function errorHandler(err, req, res, next) {
    console.error("[ERROR]", err);
    if (err.name === "UnauthorizedError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }

  async function initialize() {
    try {
      validateEnv();
      setupMiddleware();
      setupRoutes();
      app.use(notFoundHandler);
      app.use(errorHandler);
      Sentry.setupExpressErrorHandler(app);

      return app;
    } catch (error) {
      console.error("[FATAL] Application initialization failed:", error.stack);
      process.exit(1);
    }
  }

  return { app, server, initialize, container };
};

module.exports = createApp;
