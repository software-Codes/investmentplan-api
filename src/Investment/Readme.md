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
