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

const authRoutes = require("./authentication/src/routes/auth.routes");
const adminRoutes = require("./authentication/src/routes/admin/admin.routes");
const adminUserRoutes = require("./authentication/src/routes/admin/admin-users.routes");
const kycRoutes = require("./authentication/src/routes/kyc/kyc.routes");

require('../instrument');

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

  function setupRoutes() {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    
    app.get("/health", (req, res) =>
      res.json({ status: "healthy", timestamp: new Date().toISOString() })
    );

    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/admin", adminRoutes);
    app.use("/api/v1/admin/users", adminUserRoutes);
    app.use("/api/v1/kyc", kycRoutes);
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

  return { app, server, initialize };
};

module.exports = createApp;
