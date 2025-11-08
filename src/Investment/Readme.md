deposit/
├── controllers/              # Route handlers: HTTP-level interaction
│   └── deposit.controller.js
│
├── services/                 # Core business logic: verification, processing, etc.
│   └── deposit.service.js
│
├── jobs/                     # Background polling, cron jobs, or Binance webhooks
│   ├── depositMonitor.job.js
│   └── webhookHandler.js
│
├── routes/                   # Express route definitions for deposit-related endpoints
│   └── deposit.routes.js
│
├── models/                   # Sequelize (or Mongoose etc.) models and helpers
│   └── deposit.model.js
│
├── validations/             # Joi / Yup / Zod schema validations
│   └── deposit.validation.js
│
├── dto/                      # Data Transfer Objects (incoming and outgoing shapes)
│   └── deposit.dto.js
│
├── utils/                    # Reusable deposit-related helpers
│   └── txUtils.js
│
├── config/                   # Configs for limits, timeouts, etc.
│   └── deposit.config.js
│
└── index.js                  # Deposit module bootstrapper (router + DI if used)


| Layer          | Responsibility                                              |
| -------------- | ----------------------------------------------------------- |
| `controllers/` | Orchestrates service calls, handles requests/responses      |
| `services/`    | Contains the main business rules and flows                  |
| `jobs/`        | Handles polling Binance APIs, retry logic, webhook handlers |
| `routes/`      | Binds controller actions to HTTP routes                     |
| `models/`      | DB layer – entities, accessors, schema rules                |
| `validations/` | Defines and centralizes request validation logic            |
| `dto/`         | Structures incoming/outgoing data contracts                 |
| `utils/`       | Non-domain logic: parsing, formatting, network helpers      |
| `config/`      | Centralized constants: min/max deposit, lock periods, etc.  |


#walllet module 
src/
└─ modules/
   └─ investment/
      └─ wallet/
         ├─ controllers/
         │  └─ wallet.controller.js           # HTTP handlers (transfer A→T, T→A, R→A, balances, history)
         │
         ├─ routes/
         │  └─ wallet.routes.js               # Express routes; attach auth middleware; mount under /api/v1/wallet
         │
         ├─ services/
         │  ├─ wallet.service.js              # Core balance ops: row locks, atomic updates, ledger writes
         │  ├─ transfer.service.js            # High-level flows: account→trading, trading→account, referral→account
         │  ├─ validation.service.js          # Business-rule checks (min $10, locked principal, sufficient funds)
         │  ├─ notification.service.js        # Email/SMS hooks (async fire-and-forget after commit)
         │  └─ audit.service.js               # Structured audit logs for admin/compliance
         │
         ├─ validations/
         │  └─ wallet.validation.js           # Request schemas (Zod/Joi): amount, wallet types, idempotency key
         │
         ├─ dto/
         │  └─ wallet.dto.js                  # Response shapes: balances, transfer result, errors (UX-friendly)
         │
         ├─ policies/
         │  └─ wallet.policy.js               # Centralized rules: allowed flows, lock duration, min amounts
         │
         ├─ jobs/
         │  └─ walletUnlock.job.js            # Daily unlock of matured principal (reduces trading.locked_balance)
         │
         ├─ utils/
         │  └─ wallet.utils.js                # Small helpers: money math (2dp), dates, idempotency key helpers
         │
         ├─ config/
         │  └─ wallet.config.js               # Read env: LOCK_DAYS=30, MIN_TRADE_USD=10, notify toggles, etc.
         │
         ├─ index.js                          # Module composer: wires services, routes; exports router/factory
         │
         └─ tests/
            ├─ wallet.service.test.js         # Unit tests: concurrency, idempotency, invariants
            ├─ transfer.flows.test.js         # Flow tests: A→T, T→A (profits only), R→A, edge cases
            └─ routes.wallet.test.js          # Integration tests: HTTP layer with auth stub
