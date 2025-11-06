# Investment Plan API

A secure investment platform API with authentication, KYC verification, and admin management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run migration:run

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

API Documentation: `http://localhost:3000/api-docs`

## 🛠️ Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: Supabase PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT + Bcrypt
- **Storage**: Supabase Storage
- **Monitoring**: Sentry
- **Documentation**: Swagger/OpenAPI 3.0

## 📁 Project Structure

```
investmentplan-api/
├── src/
│   ├── database/              # TypeORM entities & migrations
│   ├── authentication/        # Auth module
│   │   └── src/
│   │       ├── controllers/   # HTTP handlers
│   │       ├── services/      # Business logic
│   │       ├── models/        # Data models
│   │       ├── middleware/    # Auth & validation
│   │       ├── routes/        # API routes
│   │       └── Config/        # Database config
│   ├── app.js                 # Express app
│   └── swagger.config.js      # API docs config
├── swagger.json               # OpenAPI specification
├── ormconfig.js              # TypeORM config
└── index.js                   # Entry point
```

## 🔑 Authentication Flow

### 1. User Registration
```
POST /api/v1/auth/register
```
- User provides email, password, full name
- System sends OTP to email
- Returns userId for next step

### 2. Email Verification
```
POST /api/v1/auth/verify-email
```
- User enters OTP code
- Email marked as verified
- Proceed to KYC upload

### 3. KYC Document Upload
```
POST /api/v1/auth/upload-document
```
- Upload ID, passport, or driver's license
- Stored in Supabase Storage
- Account activated

### 4. Login
```
POST /api/v1/auth/login
```
- Returns JWT token (7-day expiration)
- Includes user profile and wallet balances
- Token required for all protected endpoints

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/register              # Register user
POST   /api/v1/auth/verify-email          # Verify OTP
POST   /api/v1/auth/resend-verification   # Resend OTP
POST   /api/v1/auth/upload-document       # Upload KYC
POST   /api/v1/auth/login                 # Login
POST   /api/v1/auth/logout                # Logout
GET    /api/v1/auth/me                    # Get profile
```

### Profile Management
```
PUT    /api/v1/auth/profile               # Update profile (name, phone, photo)
DELETE /api/v1/auth/account               # Delete account
```

### Password Reset
```
POST   /api/v1/auth/password-reset/initiate   # Request reset
POST   /api/v1/auth/password-reset/complete   # Complete reset
```

### Admin (Requires Admin Token)
```
GET    /api/v1/admin/users                     # List users
GET    /api/v1/admin/users/:userId             # Get user details
PATCH  /api/v1/admin/users/:userId/block       # Block user
PATCH  /api/v1/admin/users/:userId/unblock     # Unblock user
POST   /api/v1/admin/users/:userId/force-logout # Force logout
DELETE /api/v1/admin/users/:userId             # Delete user
```

### Health Check
```
GET    /health                            # API health status
GET    /api-docs                          # Swagger documentation
```

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts
- `admins` - Admin accounts
- `wallets` - User wallet balances (account, trading, referral)
- `otp_records` - OTP verification codes
- `user_sessions` - Active sessions
- `kyc_documents` - KYC document metadata
- `admin_actions` - Admin action audit trail

## 🔧 Environment Variables

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# JWT
JWT_SECRET=your_jwt_secret_key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Sentry (Optional)
SENTRY_DSN=your_sentry_dsn
```

## 📜 Scripts

```bash
# Development
npm run dev                    # Start dev server with nodemon

# Database
npm run migration:run          # Run pending migrations
npm run migration:revert       # Revert last migration
npm run migration:generate     # Generate new migration

# TypeORM
npm run typeorm                # TypeORM CLI
```

## 🔒 Security Features

- Bcrypt password hashing (10 rounds)
- JWT token authentication (7-day expiration)
- Session validation on every request
- Token blacklisting on logout
- Account status validation (prevents suspended users)
- Password verification for sensitive operations
- File upload validation (type, size)
- Rate limiting ready
- CORS configuration
- Helmet security headers

## 📊 Account Statuses

| Status | Can Login | Can Access API | Description |
|--------|-----------|----------------|-------------|
| `pending` | ❌ | ❌ | Registration incomplete |
| `active` | ✅ | ✅ | Normal active account |
| `suspended` | ❌ | ❌ | Blocked by admin |
| `deactivated` | ❌ | ❌ | Soft deleted |

## 🚢 Deployment

### Prerequisites
- Node.js 16+
- PostgreSQL database (Supabase)
- Environment variables configured

### Steps
1. Clone repository
2. Install dependencies: `npm install`
3. Configure `.env` file
4. Run migrations: `npm run migration:run`
5. Start server: `npm start`

## 📝 API Documentation

Interactive API documentation available at:
```
http://localhost:3000/api-docs
```

Features:
- Try out endpoints directly
- View request/response schemas
- Authentication setup
- Example requests

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
node --test test/admin_auth_middleware.test.js
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature/name`
5. Open Pull Request

## 📈 Status

- **Version**: 1.0.0
- **Status**: Active Development
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage

## 🎯 Roadmap

### Current Phase: Authentication & Admin
- [x] User registration with OTP
- [x] Email verification
- [x] KYC document upload
- [x] JWT authentication
- [x] Profile management
- [x] Admin user management
- [x] Swagger documentation

### Next Phase: Investment Features
- [ ] Investment plans
- [ ] Deposit management
- [ ] Withdrawal requests
- [ ] Trading accounts
- [ ] Profit tracking
- [ ] Referral program

---

**Built with ❤️ for secure investment management**
