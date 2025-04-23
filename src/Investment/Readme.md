## Automatic Deposit System with Binance API

### Overview

This project provides an automatic deposit system that allows users to deposit funds directly into an admin-controlled Binance account. It tracks incoming deposits via the Binance API, enforces a minimum deposit, updates user balances in real time, and logs all transactions.

### Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Process Flow](#process-flow)
8. [Error Handling](#error-handling)
9. [Security Considerations](#security-considerations)

---

### Features

- **Automatic Deposit Tracking**: Polls Binance API for new deposits.
- **Real-Time Balance Updates**: Credits user accounts automatically.
- **Minimum Deposit Enforcement**: Rejects deposits below $10.
- **Detailed Logging**: Maintains full audit trail of deposits.
- **User Notifications**: Notifies users of successful or failed deposits.

### Prerequisites

- A Binance account with API access (API key & secret).
- PostgreSQL database.
- Node.js (v14+) and npm.
- Environment variables management (e.g., dotenv).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/automatic-deposit-binance.git
   cd automatic-deposit-binance
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```

### Configuration

1. Create a `.env` file in the project root:
   ```env
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_API_SECRET=your_binance_api_secret
   ADMIN_BINANCE_ADDRESS=your_admin_binance_address
   DATABASE_URL=postgres://user:password@host:port/dbname
   MINIMUM_DEPOSIT=10
   ```
2. Update any other environment variables as needed.

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_balance NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposits table
CREATE TABLE deposits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  binance_tx_id VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(50) CHECK (status IN ('pending','completed','failed')),
  memo VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
```

### API Reference

#### 1. Request Deposit Address

- **Endpoint**: `GET /api/deposit/address`
- **Description**: Provides the admin's Binance deposit address and memo instructions for the user.
- **Response**:
  ```json
  {
    "deposit_address": "AdminBinanceAddress",
    "memo_instruction": "Include your user ID in the memo field",
    "user_id": "UserSpecificID",
    "minimum_deposit": 10
  }
  ```

#### 2. Deposit Monitoring (Binance API)

- **Endpoint**: `GET /sapi/v1/capital/deposit/hisrec`
- **Description**: Retrieves a list of deposit records for the admin account.
- **Sample Response**:
  ```json
  {
    "depositList": [
      {
        "amount": 100,
        "coin": "USDT",
        "network": "TRX",
        "txId": "TransactionID123",
        "address": "AdminBinanceAddress",
        "memo": "UserSpecificID",
        "status": 1,
        "confirmTimes": "3",
        "insertTime": 1628506800000,
        "walletType": 0
      }
    ]
  }
  ```

### Process Flow

1. **User Requests Deposit Address**
   1. User clicks “Deposit” on the platform.
   2. Platform returns the admin’s Binance address and memo instructions.
2. **User Makes Deposit**
   - User sends funds to the admin’s Binance account, including their user ID in the memo field.
3. **Platform Detects Deposit**
   - A scheduled task polls Binance API for new deposits.
   - Matches transactions to users via the memo field.
4. **Validate and Credit User**
   - Checks if deposit ≥ minimum (`$10`).
   - If valid: updates `account_balance`, marks deposit as `completed`, and logs the transaction.
   - If invalid: marks as `failed` and logs reason.
5. **Notify User**
   - Sends notification (email/SMS/in-app) upon success or failure.

### Error Handling

| Error Type           | Action                                                       |
|----------------------|--------------------------------------------------------------|
| Invalid Memo Field   | Log as `failed`; notify admin to investigate.               |
| Below Minimum Amount | Reject deposit; notify user about minimum requirement.      |
| Binance API Errors   | Retry with exponential backoff; alert on repeated failures. |

### Security Considerations

- **API Key Security**: Limit key permissions to required endpoints; store secrets in environment variables.
- **Input Validation**: Sanitize and validate all user inputs and API responses.
- **Rate Limiting**: Implement rate limiting on API endpoints to prevent abuse.
- **Secure Communication**: Use HTTPS and secure WebSockets if applicable.

---

**Maintainers**: Your Name <youremail@example.com>

**License**: MIT

