// src/app.js
require("dotenv").config();                      // 1. Load .env into process.env
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const database = require("./authentication/src/Config/neon-database");
const crypto = require("crypto");

/**
 * Validate that all required env vars are set, or provide safe defaults.
 * Single responsibility: environment validation. :contentReference[oaicite:2]{index=2}
 */
function validateEnv() {
  // JWT_SECRET: use provided, or auto‑generate a strong random one in dev
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required env var: JWT_SECRET");
    }
    console.warn(
      "[WARN] JWT_SECRET not set—auto‑generating a development secret."
    );
    process.env.JWT_SECRET = crypto.randomBytes(64).toString("hex");
  }

  // CORS_ORIGIN: default to localhost:3000
  if (!process.env.CORS_ORIGIN) {
    console.warn(
      "[WARN] CORS_ORIGIN not set—defaulting to http://localhost:3000"
    );
    process.env.CORS_ORIGIN = "http://localhost:3000";
  }
}

/**
 * Build and return an Express app + HTTP server.
 */
const createApp = () => {
  const app = express();
  const server = http.createServer(app);

  /**
   * List all registered routes (path + methods).
   * Safely checks for layer.handle.stack to avoid undefined errors. :contentReference[oaicite:3]{index=3}
   */
  function listRoutes() {
    const routes = [];
    app._router.stack.forEach((layer) => {
      // Directly registered routes
      if (layer.route) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase());
        routes.push({ path: layer.route.path, methods });
      }
      // Router‑mounted routes
      else if (
        layer.name === "router" &&
        layer.handle &&
        Array.isArray(layer.handle.stack)
      ) {
        layer.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods)
              .map((m) => m.toUpperCase());
            routes.push({ path: handler.route.path, methods });
          }
        });
      }
    });
    return routes;
  }

  /**
   * Set up all middleware in small, focused functions.
   */
  function setupMiddleware() {
    // Parse cookies
    app.use(cookieParser());

    // Session management (uses JWT_SECRET)
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

    // CORS with credentials
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    );

    // Standard security headers
    app.use(helmet());

    // Gzip compression
    app.use(compression());

    // Body parsing
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging in dev
    if (process.env.NODE_ENV === "development") {
      const morgan = require("morgan");
      app.use(morgan("dev"));
    }
  }

  /**
   * Define all application routes.
   */
  function setupRoutes() {
    // Health check
    app.get("/health", (req, res) =>
      res.json({ status: "healthy", timestamp: new Date().toISOString() })
    );

    // List all routes (with methods)
    app.get("/", (req, res) => {
      res.json({ availableRoutes: listRoutes() });
    });

    // ... mount other routers here, e.g.:
    // app.use("/auth", require("./authentication/routes"));
  }

  /**
   * 404 handler for any unmatched routes.
   */
  function notFoundHandler(req, res) {
    res.status(404).json({ error: "Not Found" });
  }

  /**
   * Centralized error handler.
   */
  function errorHandler(err, req, res, next) {
    console.error("[ERROR]", err);
    // Customize based on error type, e.g. JWT auth failures
    if (err.name === "UnauthorizedError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }

  /**
   * Initialize: validate env, connect DB, wire up middleware & routes.
   */
  async function initialize() {
    validateEnv();

    // Ensure DB is reachable
    await database.checkDatabaseConnection();

    setupMiddleware();
    setupRoutes();

    // 404 → then error handler
    app.use(notFoundHandler);
    app.use(errorHandler);

    if (process.env.NODE_ENV === "development") {
      console.log("[INFO] Application initialized successfully");
    }

    return app;
  }

  return { app, server, initialize };
};

module.exports = createApp;
