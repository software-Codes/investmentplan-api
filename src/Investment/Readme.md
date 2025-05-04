# Investment Platform with Binance Integration

## Overview

This platform is a scalable, secure, and automated investment system with deep Binance integration for deposits and withdrawals. It features a multi-wallet architecture, compound interest investments, a robust referral system, and a comprehensive admin dashboard. The backend is designed for extensibility, maintainability, and security.

---

## Features

### Wallet System
- **Account Wallet**: For deposits and withdrawals.
- **Trading Wallet**: For active investments and compounding.
- **Referral Wallet**: For referral bonuses and rewards.

### Investment Features
- **Daily Compound Returns**: 0.25% daily interest.
- **Minimum Investment**: $10.
- **Lock Periods**:
  - **Profit withdrawal**: After 7 days.
  - **Principal withdrawal**: After 30 days.

### Deposit System
- **Currency**: USDT (TRC20 recommended).
- **Minimum Deposit**: $10.
- **Method**: User sends USDT to a fixed admin-controlled Binance address.
- **User Action**: User copies the address, sends funds, and submits the transaction hash.
- **Processing**: System verifies the transaction and credits the user's account wallet.

### Withdrawal System
- **Admin Approval Required**: All withdrawals are reviewed by an admin.
- **Processing Time**: 20 minutes window for admin action.
- **Verification**: Manual admin verification and blockchain confirmation.
- **Withdrawal Types**:
  - **Profit**: After 7 days.
  - **Principal**: After 30 days.
  - **Referral Bonus**: Instant.

### Referral Program
- **Bonus**: 10% of referee's first deposit.
- **Options**: Instant withdrawal or reinvestment.

### Admin Dashboard
- **Deposit Monitoring**
- **Withdrawal Approval**
- **User Management**
- **Investment Tracking**
- **Referral Statistics**

---

## Technical Architecture

### Algorithms & Data Structures

#### Algorithms
- **Deposit Verification**:  
  1. User submits transaction hash after sending USDT.
  2. System queries Binance API or blockchain explorer for transaction details.
  3. If transaction is confirmed, amount is credited to user's account wallet.
  4. Duplicate transaction hashes are rejected.

- **Compound Interest Calculation**:  
  - Daily cron job iterates through active investments and applies 0.25% interest to the trading wallet balance.

- **Withdrawal Eligibility**:  
  - System checks lock periods (7 days for profit, 30 days for principal) before allowing withdrawal requests.

- **Referral Bonus Distribution**:  
  - On first deposit, system checks for referral code and credits 10% bonus to referrer’s referral wallet.

#### Data Structures
- **Relational Tables**:  
  - Users, Wallets, Investments, Deposits, Withdrawals, Referrals, Referral Bonuses, Trading Accounts, Wallet Transfers, Admins, KYC Documents, OTP Records, User Sessions.

- **Indexes**:  
  - Used on user IDs, transaction hashes, statuses, and wallet types for fast lookups.

- **Enums**:  
  - Used for statuses, wallet types, account types, and verification states.

---

## Database Schema

> See `/src/authentication/src/Config/setupDatabase.js` for full schema and migrations.

```sql
-- Users
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    preferred_contact_method VARCHAR(50) DEFAULT 'email',
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    account_status VARCHAR(50) DEFAULT 'pending',
    failed_login_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN ('account', 'trading', 'referral')),
    balance NUMERIC(12, 2) DEFAULT 0.00,
    locked_balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_type)
);

-- Investments, Deposits, Withdrawals, Referrals, Trading Accounts, etc.
-- (See setupDatabase.js for all table definitions)
```

---

## API Reference

### Deposit Endpoints

```http
GET /api/v1/deposit/address         # Get the fixed admin deposit address
POST /api/v1/deposit/submit        # Submit transaction hash after sending funds
GET /api/v1/deposit/history        # Get user's deposit history
```

### Investment Endpoints

```http
POST /api/v1/investment/start      # Start a new investment
GET /api/v1/investment/status      # Get current investment status
GET /api/v1/investment/profits     # Get profit history
```

### Withdrawal Endpoints

```http
POST /api/v1/withdraw/request      # Request withdrawal (profit/principal/referral)
GET /api/v1/withdraw/status        # Get withdrawal status/history
```

### Wallet Endpoints

```http
GET /api/v1/wallet/balances        # Get all wallet balances
POST /api/v1/wallet/transfer       # Transfer between wallets
```

### Referral Endpoints

```http
GET /api/v1/referral/code          # Get user's referral code
GET /api/v1/referral/earnings      # Get referral earnings
POST /api/v1/referral/withdraw     # Withdraw referral bonus
```

---

## Investment Process Flow

1. **Deposit**
   - User copies the fixed admin USDT address and sends funds.
   - User submits the transaction hash via the frontend.
   - Backend verifies the transaction and credits the user's account wallet.

2. **Investment**
   - User transfers funds from account wallet to trading wallet.
   - User starts an investment (min $10).
   - System applies daily compound interest (0.25%).
   - Profit is available after 7 days; principal after 30 days.

3. **Withdrawal**
   - User requests withdrawal (profit/principal/referral).
   - Admin receives notification and approves/rejects within 20 minutes.
   - Funds are sent to the user's Binance address after approval.

4. **Referral**
   - User shares referral code.
   - New user registers and deposits.
   - Referrer receives 10% bonus (withdrawable or reinvestable).

---

## Security & Problem Solving

- **Deposit Validation**:  
  - Minimum deposit enforced.
  - Transaction hash must be unique and confirmed on-chain.
  - Admin notified of large or suspicious deposits.

- **Withdrawal Security**:  
  - Admin approval required for all withdrawals.
  - Time-locks enforced for profit/principal.
  - Address validation and duplicate prevention.

- **System Security**:  
  - API keys stored in environment variables.
  - Rate limiting and input sanitization.
  - All actions logged for audit.

- **Error Handling**:  
  - All API responses include `success`, `message`, and error details if any.
  - User and admin notifications for all critical actions and failures.

---

## Installation & Setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env

# Setup and migrate database
npm run db:migrate

# Start the application
npm run start
```

---

## Environment Variables

```env
# Binance
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
ADMIN_BINANCE_ADDRESS=admin_usdt_address
BINANCE_NETWORK=TRC20

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# App Settings
MIN_DEPOSIT=10
MIN_INVESTMENT=10
DAILY_INTEREST_RATE=0.0025
REFERRAL_BONUS_PERCENT=0.10

# Security
JWT_SECRET=your_jwt_secret
API_RATE_LIMIT=100
```

---

## Algorithms Used

- **Deposit Verification**:  
  - O(1) lookup for transaction hash in deposits table.
  - O(n) scan for new transactions on the monitored address.

- **Compound Interest**:  
  - O(n) daily update for all active investments.

- **Referral Bonus**:  
  - O(1) check for first deposit and bonus eligibility.

- **Withdrawal Approval**:  
  - O(1) lookup and update for withdrawal requests.

---

## Data Structures

- **Relational Tables**:  
  - Users, Wallets, Investments, Deposits, Withdrawals, Referrals, Referral Bonuses, Trading Accounts, Wallet Transfers, Admins, KYC Documents, OTP Records, User Sessions.

- **Indexes**:  
  - On user IDs, transaction hashes, statuses, wallet types.

- **Enums**:  
  - For statuses, wallet types, account types, verification states.

---

## Admin Dashboard Features

- Real-time deposit and withdrawal monitoring
- Approval/rejection of withdrawals
- User and investment management
- Transaction and referral analytics

---

## License

MIT License

---

## Support

For technical support, contact [support@yourplatform.com](mailto:support@yourplatform.com)

---

