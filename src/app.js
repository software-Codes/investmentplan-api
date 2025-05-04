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
const database = require("./authentication/src/Config/neon-database");
const setupDatabase = require("./authentication/src/Config/setupDatabase");
const authRoutes = require("../src/authentication/src/routes/auth.routes"); // Import auth routes
const adminRoutes = require("./authentication/src/routes/admin/admin.routes");
const kycRoutes = require("./authentication/src/routes/kyc/kyc.routes")
const swaggerUi = require('swagger-ui-express');
const swaggerSpec =  require("./swagger.config")
// const { validateRegistration, validateLogin } = require("../src/authentication/src/middleware/validation.middleware"); // Import validation middleware
// const { loginLimiter, apiLimiter, otpLimiter } = require("../src/authentication/src/middleware/rate-limiter"); // Import rate limiting middleware

/**
 * Validate required environment variables with safe defaults
 */
function validateEnv() {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required env var: JWT_SECRET");
    }
    console.warn("[WARN] JWT_SECRET not set - generating development secret");
    process.env.JWT_SECRET = crypto.randomBytes(64).toString("hex");
  }

  if (!process.env.CORS_ORIGIN) {
    console.warn("[WARN] CORS_ORIGIN not set - defaulting to localhost:3000");
    process.env.CORS_ORIGIN = "http://localhost:3000";
  }
}

/**
 * Create and configure Express application
 */
const createApp = () => {
  const app = express();
  const server = http.createServer(app);

  // src/app.js (updated listRoutes function)
  /**
   * List all registered routes with enhanced safety checks
   */
  function listRoutes() {
    const routes = [];

    // Check if router stack exists
    if (!app._router || !Array.isArray(app._router.stack)) {
      console.warn("[WARN] Router stack not initialized");
      return routes;
    }

    app._router.stack.forEach((layer) => {
      if (!layer) return;

      // Handle direct routes
      if (layer.route) {
        try {
          const methods = Object.keys(layer.route.methods).map((m) =>
            m.toUpperCase()
          );
          routes.push({
            path: layer.route.path,
            methods,
          });
        } catch (error) {
          console.error("[ERROR] Error processing route layer:", error);
        }
      }
      // Handle router-mounted routes
      else if (layer.name === "router" && layer.handle) {
        try {
          const router = layer.handle;
          if (router.stack && Array.isArray(router.stack)) {
            router.stack.forEach((handler) => {
              if (handler && handler.route) {
                const methods = Object.keys(handler.route.methods).map((m) =>
                  m.toUpperCase()
                );
                routes.push({
                  path: handler.route.path,
                  methods,
                });
              }
            });
          }
        } catch (error) {
          console.error("[ERROR] Error processing router layer:", error);
        }
      }
    });

    return routes;
  }
  /**
   * Configure application middleware
   */
  function setupMiddleware() {
    app.use(cookieParser());
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
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    );
    app.use(helmet());
    app.use(compression());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    if (process.env.NODE_ENV === "development") {
      const morgan = require("morgan");
      app.use(morgan("dev"));
    }
  }

  /**
   * Register application routes
   */
  function setupRoutes() {
    app.get("/health", (req, res) =>
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
      })
    );

    app.get("/", (req, res) => {
      res.json({ availableRoutes: listRoutes() });
    });

    // Register authentication routes with middleware
    app.use("/api/v1/auth", authRoutes);
  }
  const corsOptions = {
    origin: [process.env.CORS_ORIGIN, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  };
  
  app.use(cors(corsOptions));
  
  // apis for the admin
  app.use("/api/v1/admin", adminRoutes);
  //apis for document kyc verification
  app.use("/api/v1/kyc", kycRoutes)
  //documentation apis
// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Neptune Platform API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true
  }
}));

  /**
   * Handle 404 errors
   */
  function notFoundHandler(req, res) {
    res.status(404).json({ error: "Not Found" });
  }

  /**
   * Central error handler
   */
  function errorHandler(err, req, res, next) {
    console.error("[ERROR]", err);
    if (err.name === "UnauthorizedError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }

  /**
   * Initialize application components
   */
  async function initialize() {
    try {
      // Validate environment variables
      validateEnv();

      // // Database initialization
      // console.log("\n[Database] Initializing database schema...");
      // await setupDatabase();
      // console.log("[Database] Schema initialized successfully");

      // // Establish database connection
      // await database.checkDatabaseConnection();
      // console.log("[Database] Connection verified\n");

      // Configure application
      setupMiddleware();
      setupRoutes();

      // Error handling
      app.use(notFoundHandler);
      app.use(errorHandler);

      // Development logging
      if (process.env.NODE_ENV === "development") {
        console.log("[Application] Available routes:");
        listRoutes().forEach((route) => {
          console.log(`  ${route.methods.join(", ").padEnd(15)} ${route.path}`);
        });
        console.log("");
      }

      return app;
    } catch (error) {
      console.error("\n[FATAL] Application initialization failed:");
      console.error(error.stack);
      process.exit(1);
    }
  }

  return { app, server, initialize };
};

module.exports = createApp;
