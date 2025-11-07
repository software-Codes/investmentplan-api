Purpose
Handle user deposits of USDT (ERC20) to a shared address. Users submit a TxID; the system verifies it (Binance/chain), records it, and credits the Account wallet on confirmation.

States

pending: user submitted, not yet verified

processing: verification in progress (monitor / webhook)

confirmed: tx verified and wallet credited

failed: invalid or rejected (bad hash, mismatch, duplicate, etc.)

Columns (DB)

deposit_id (uuid, pk)

user_id (uuid, fk → users)

tx_id (varchar, unique, required)

amount_usd (numeric(18,2), required)

asset (varchar, default USDT)

network (enum: ERC20)

status (enum: pending|processing|confirmed|failed, default pending)

source (enum: manual|auto, default manual)

verified_at, credited_at (timestamptz, nullable)

message (varchar, nullable)

metadata (jsonb, nullable)

created_at, updated_at (timestamps)

Environment (used by config/validation later)

DEPOSIT_ADDRESS (required)

MIN_DEPOSIT_USD (default 10) / MAX_DEPOSIT_USD (optional)

DEPOSIT_NETWORKS (ERC20)

Provider: DEPOSIT_PROVIDER, keys, timeouts (for verification)

TypeORM wiring

Entities auto-loaded via database/config/database.config.js, migrations via database/migrations/*.js.

Runtime queries can use your pooled PG wrapper where needed (e.g., for services): connection.js or supabase-database.js.