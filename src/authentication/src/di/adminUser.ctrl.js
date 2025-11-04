// src/di/admin-user.controller.factory.js  (example location)

/* ───── low-level data access  ────────────────────────────────────── */
const PgUserRepository    = require('../postgres/PgUserRepository');
const PgSessionRepository = require('../postgres/PgSessionRepository');
const PgAuditRepository   = require('../postgres/PgAuditRepository');

/* ───── service & controller  ─────────────────────────────────────── */
const AdminUserService    = require('../services/admin/AdminUserService');
const AdminUserController = require('../controllers/admin/admin-user.controller');

/* 1️⃣  Instantiate repositories once and reuse them */
const userRepo    = new PgUserRepository();
const sessionRepo = new PgSessionRepository();
const auditRepo   = new PgAuditRepository();

/* 2️⃣  Wire them into the business service */
const adminUserService = new AdminUserService({
  userRepo,
  sessionRepo,
  auditRepo,
});

/* 3️⃣  Expose a singleton controller for the router */
module.exports = new AdminUserController({ adminUserService });
