# Investment Platform with Binance Integration

## Overview

This platform provides an automated investment system with Binance integration for deposits and withdrawals. It features multiple wallet types, compound interest investments, and a referral system.

## Features

### Wallet System
- **Account Wallet**: Primary deposit wallet
- **Trading Wallet**: Investment-specific wallet
- **Referral Wallet**: For referral bonuses

### Investment Features
- **Daily Returns**: 0.25% compound interest
- **Minimum Investment**: $10
- **Lock Periods**:
  - Profit withdrawal: After 7 days
  - Principal withdrawal: After 30 days

### Deposit System
- **Currency**: USDT only
- **Minimum Deposit**: $10
- **Method**: Direct Binance transfer
- **Processing**: Automatic credit to account wallet

### Withdrawal System
- **Admin Approval Required**
- **Processing Time**: 20 minutes
- **Verification**: Manual admin verification
- **Withdrawal Types**:
  - Profit (after 7 days)
  - Principal (after 30 days)
  - Referral bonus (instant)

### Referral Program
- **Bonus**: 10% of referee's first deposit
- **Options**: 
  - Instant withdrawal
  - Reinvestment option

## Technical Architecture

### Database Schema

```sql
-- Users and Wallets
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  referral_code VARCHAR(10) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallets (
  wallet_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  wallet_type VARCHAR(50) CHECK (wallet_type IN ('account', 'trading', 'referral')),
  balance NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investments
CREATE TABLE investments (
  investment_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  amount NUMERIC(12, 2) NOT NULL,
  profit NUMERIC(12, 2) DEFAULT 0.00,
  start_date TIMESTAMPTZ NOT NULL,
  last_compound_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'active',
  principal_locked BOOLEAN DEFAULT true
);

-- Transactions
CREATE TABLE deposits (
  deposit_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  amount NUMERIC(12, 2) NOT NULL,
  binance_tx_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE withdrawals (
  withdrawal_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  amount NUMERIC(12, 2) NOT NULL,
  wallet_type VARCHAR(50),
  binance_address VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  admin_approved BOOLEAN DEFAULT false,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

## API Reference

### Deposit Endpoints

```http
GET /api/v1/deposit/address
POST /api/v1/deposit/verify
GET /api/v1/deposit/history
```

### Investment Endpoints

```http
POST /api/v1/investment/start
GET /api/v1/investment/status
GET /api/v1/investment/profits
```

### Withdrawal Endpoints

```http
POST /api/v1/withdraw/request
GET /api/v1/withdraw/status
```

### Wallet Endpoints

```http
GET /api/v1/wallet/balances
POST /api/v1/wallet/transfer
```

### Referral Endpoints

```http
GET /api/v1/referral/code
GET /api/v1/referral/earnings
POST /api/v1/referral/withdraw
```

## Investment Process Flow

1. **Deposit Process**
   - User deposits USDT via Binance
   - System verifies deposit
   - Amount credited to account wallet

2. **Investment Process**
   - Transfer from account to trading wallet
   - Start investment (min $10)
   - Daily compound interest (0.25%)
   - Profit available after 7 days
   - Principal locked for 30 days

3. **Withdrawal Process**
   - User submits withdrawal request
   - Admin receives notification
   - 20-minute verification period
   - Manual processing by admin
   - Funds sent to user's Binance address

4. **Referral Process**
   - User shares referral code
   - New user registers and deposits
   - 10% bonus to referrer
   - Instant withdrawal or reinvestment option

## Security Measures

- **Deposit Validation**
  - Minimum amount check ($10)
  - Transaction verification
  - Duplicate transaction prevention

- **Withdrawal Security**
  - Admin approval required
  - Time-lock periods
  - Address verification
  - Amount validation

- **System Security**
  - API key encryption
  - Rate limiting
  - Input sanitization
  - Transaction logging

## Installation & Setup

```bash
# Install dependencies
npm install

# Environment setup
cp .env.example .env

# Database setup
npm run db:migrate

# Start application
npm run start
```

## Environment Variables

```env
# Binance Configuration
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
ADMIN_BINANCE_ADDRESS=admin_address

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Application Settings
MIN_DEPOSIT=10
MIN_INVESTMENT=10
DAILY_INTEREST_RATE=0.0025
REFERRAL_BONUS_PERCENT=0.10

# Security
JWT_SECRET=your_jwt_secret
API_RATE_LIMIT=100
```

## Admin Dashboard Features

- Deposit monitoring
- Withdrawal approval interface
- User management
- Investment tracking
- Transaction history
- Referral statistics

---

## License
MIT License

## Support
For technical support, contact support@yourplatform.com

