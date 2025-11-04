# Authentication System

A secure authentication flow with OTP verification, KYC document handling, and session management.

---

## **Tools & Technologies**
1. **Backend**: 
   - Node.js + Express
2. **Database**: 
   - Supabase PostgreSQL
   - TypeORM (ORM & Migrations)
3. **Storage**: 
   - Azure Blob Storage (KYC documents)
4. **OTP Delivery**: 
   - Nodemailer (Email) + Africa's Talking (SMS)
5. **KYC Verification**: 
   - Smile ID API
6. **Security**:
   - Bcrypt (password hashing)
   - JWT (session tokens)
   - Helmet (HTTP headers)
7. **Logging**:
   - Winston/Morgan
8. **Monitoring**:
   - Sentry (Error tracking)

---

## **Authentication Flow**

### 1. **Signup**
1. User submits: `full_name`, `email`, `phone_number`, `password`, `otp_preference`.
2. System:
   - Validates email/phone uniqueness.
   - Generates a 6-digit OTP (expires in 10 mins).
   - Sends OTP via email (Nodemailer) or SMS (Africa's Talking).
   - Stores OTP hash in the `otp_records` table.
   - Creates 3 wallets (account, trading, referral) for user.

### 2. **OTP Validation**
1. User submits OTP.
2. System:
   - Validates OTP against the `otp_records` table.
   - Marks user as `verified` on success.
   - Updates account status to `active`.
   - Prompts user to upload KYC documents (optional for deposits).

### 3. **KYC Document Upload**
1. User uploads ID/driver's license/passport.
2. System:
   - Stores document in **Azure Blob Storage** (private container).
   - Saves metadata in `kyc_documents` table.
   - Triggers Smile ID verification (async via webhook).

### 4. **Login**
1. User submits `email` + `password`.
2. System:
   - Validates credentials (bcrypt hash comparison).
   - Checks account verification status.
   - Issues JWT token (7 days).
   - Creates session in `user_sessions` table.
   - Returns user data with wallet balances.

### 5. **Session Management**
- **JWT Token**: 7-day validity; used for API requests.
- **Session Tracking**: Stored in `user_sessions` table.
- **Token Blacklist**: Invalidated tokens tracked in memory.
- **Multi-device Support**: Users can logout from all devices.

### 6. **Account Recovery**
1. **Forgot Password**:
   - User requests OTP via email/SMS.
   - Validates OTP → Allows password reset.
2. **Account Deletion**:
   - Requires password confirmation.
   - Soft delete: marks account as deactivated.
   - Hard delete: removes all user data.

---

## **Database Schema**

### Core Tables
- `users` - User accounts
- `admins` - Admin accounts
- `wallets` - User wallet balances (account, trading, referral)
- `otp_records` - OTP verification codes
- `user_sessions` - Active user sessions
- `kyc_documents` - KYC document metadata
- `deposits` - Deposit transactions
- `withdrawals` - Withdrawal requests
- `referrals` - Referral codes
- `referral_bonuses` - Referral rewards
- `trading_accounts` - Trading account data
- `wallet_transfers` - Internal wallet transfers

### TypeORM Entities
Located in `src/database/entities/`:
- User.entity.js
- Wallet.entity.js
- Admin.entity.js
- OTPRecord.entity.js
- UserSession.entity.js
- KYCDocument.entity.js
- Deposit.entity.js
- Withdrawal.entity.js
- Referral.entity.js
- ReferralBonus.entity.js
- TradingAccount.entity.js
- WalletTransfer.entity.js

---

## **Security Practices**
1. **Rate Limiting**:
   - OTP resends: 3 attempts/hour.
   - Login attempts: 5 attempts/hour.
2. **Encryption**:
   - Passwords: Bcrypt (salt rounds: 10).
   - Documents: Azure Blob Storage (encrypted at rest).
3. **Session Security**:
   - JWT signatures: HS256 with secret key.
   - Token blacklist for logout.
   - Session expiry tracking.
4. **KYC Enforcement**:
   - Withdrawals blocked until documents uploaded.
5. **SQL Injection Prevention**:
   - Parameterized queries via TypeORM.
6. **CORS Configuration**:
   - Restricted origins.
   - Credentials support enabled.

---

## **API Endpoints**

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/verify-otp` - OTP verification
- `POST /api/v1/auth/resend-verification` - Resend OTP
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - Logout current session
- `POST /api/v1/auth/logout-all` - Logout all devices
- `POST /api/v1/auth/initiate-password-reset` - Request password reset
- `POST /api/v1/auth/complete-password-reset` - Complete password reset
- `GET /api/v1/auth/me` - Get current user
- `DELETE /api/v1/auth/account` - Delete account

### KYC
- `POST /api/v1/kyc/upload` - Upload KYC document
- `GET /api/v1/kyc/documents` - Get user documents
- `GET /api/v1/kyc/documents/:id` - Get document status

### Admin
- `POST /api/v1/admin/login` - Admin login
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/:id` - Get user details
- `PATCH /api/v1/admin/users/:id/status` - Update user status
- `DELETE /api/v1/admin/users/:id` - Delete user

---

## **Environment Variables**
```plaintext
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# JWT
JWT_SECRET=your_jwt_secret_key

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=investmentplan
AZURE_STORAGE_KEY=your_storage_key
AZURE_KYC_CONTAINER=investmentplan

# Smile ID
SMILE_ID_API_KEY=your_api_key
SMILE_ID_PARTNER_ID=7555
SMILE_ID_CALLBACK_URL=http://localhost:3000/api/v1/kyc/callback

# Africa's Talking
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=6015

# Nodemailer
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@yourplatform.com

# Binance
BINANCE_ROOT_URL=https://bpay.binanceapi.com
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret

# Admin
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=secure_password
```

---

## **TypeORM Commands**

### Run Migrations
```bash
npm run migration:run
```

### Revert Migration
```bash
npm run migration:revert
```

### Generate Migration
```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

---

## **Development**

### Start Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Check Health
```bash
curl http://localhost:3000/health
```

---

## **Architecture**

### Clean Architecture Principles
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic
- **Models**: Data access layer (being migrated to repositories)
- **Repositories**: TypeORM data access (new)
- **Entities**: TypeORM entity definitions (new)
- **Middleware**: Authentication, validation, rate limiting
- **Utils**: Helper functions, logging, response formatting

### Dependency Injection
- Admin services use DI pattern
- Repositories injected into services
- Promotes testability and maintainability

---

## **Migration Status**

### Completed
✅ TypeORM entities created
✅ Initial migration file generated
✅ Database configuration setup
✅ Connection wrapper implemented

### In Progress
🔄 Migrating models to repositories
🔄 Updating services to use TypeORM
🔄 Data migration from Neon to Supabase

### Pending
⏳ Remove old Neon database files
⏳ Update all queries to use TypeORM
⏳ Add repository pattern to all modules
⏳ Implement database seeding

---

## **Best Practices**
1. Always use migrations for schema changes
2. Never commit sensitive data to `.env`
3. Use parameterized queries (TypeORM handles this)
4. Implement proper error handling
5. Log all authentication events
6. Validate input at controller level
7. Use transactions for multi-table operations
8. Keep business logic in services, not controllers
9. Write tests for critical flows
10. Monitor database performance

---

## **Troubleshooting**

### Connection Issues
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Ensure IP is whitelisted in Supabase

### Migration Errors
- Check migration files for syntax errors
- Verify database user has proper permissions
- Run migrations one at a time if needed

### Authentication Failures
- Check JWT_SECRET is set
- Verify token hasn't expired
- Check user account status

---

## **Support**
- Documentation: See `MIGRATION_GUIDE.md`
- Issues: Create issue in repository
- Supabase: https://supabase.com/docs
- TypeORM: https://typeorm.io
