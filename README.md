# Investment Plan API

A secure investment platform API with authentication, KYC verification, wallet management, and trading features.

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

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get started quickly
- **[Migration Guide](MIGRATION_GUIDE.md)** - Neon to Supabase migration
- **[Project Summary](PROJECT_SUMMARY.md)** - Complete project overview
- **[Cleanup Plan](CLEANUP_PLAN.md)** - Code cleanup strategy
- **[Implementation Status](IMPLEMENTATION_COMPLETE.md)** - What's been done
- **[Authentication Docs](src/authentication/README.MD)** - Auth system details

## 🛠️ Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: Supabase PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT + Bcrypt
- **Storage**: Azure Blob Storage
- **KYC**: Smile ID API
- **Notifications**: Nodemailer + Africa's Talking
- **Payments**: Binance API
- **Monitoring**: Sentry
- **Logging**: Winston

## 📁 Project Structure

```
investmentplan-api/
├── src/
│   ├── database/              # TypeORM entities, migrations
│   ├── authentication/        # Auth module
│   │   └── src/
│   │       ├── controllers/   # HTTP handlers
│   │       ├── services/      # Business logic
│   │       ├── models/        # Data models
│   │       ├── middleware/    # Auth, validation
│   │       ├── routes/        # API routes
│   │       └── utils/         # Helpers
│   ├── Investment/            # Investment module
│   │   └── src/
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── models/
│   │       └── routes/
│   ├── app.js                 # Express app
│   └── swagger.config.js      # API docs
├── test/                      # Test files
├── scripts/                   # Utility scripts
├── .env                       # Environment variables
├── ormconfig.js              # TypeORM config
├── package.json
└── index.js                   # Entry point
```

## 🔑 Key Features

### Authentication & Security
- User registration with OTP verification
- Email & SMS OTP delivery
- JWT-based authentication
- Session management
- Password reset flow
- Multi-device logout
- Rate limiting
- Token blacklisting

### KYC Verification
- Document upload (ID, Passport, Driver's License)
- Azure Blob Storage integration
- Smile ID verification
- Document status tracking

### Wallet Management
- 3 wallet types: Account, Trading, Referral
- Balance tracking
- Internal transfers
- Transaction history

### Investment Features
- Deposit management
- Withdrawal requests
- Trading accounts
- Profit tracking
- Referral program
- Bonus system

### Admin Panel
- User management
- Withdrawal approvals
- KYC verification
- System monitoring

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/register              # User registration
POST   /api/v1/auth/verify-otp            # OTP verification
POST   /api/v1/auth/login                 # User login
POST   /api/v1/auth/logout                # Logout
GET    /api/v1/auth/me                    # Get current user
POST   /api/v1/auth/initiate-password-reset
POST   /api/v1/auth/complete-password-reset
DELETE /api/v1/auth/account               # Delete account
```

### KYC
```
POST   /api/v1/kyc/upload                 # Upload document
GET    /api/v1/kyc/documents              # Get user documents
GET    /api/v1/kyc/documents/:id          # Get document status
```

### Admin
```
POST   /api/v1/admin/login                # Admin login
GET    /api/v1/admin/users                # List users
GET    /api/v1/admin/users/:id            # Get user details
PATCH  /api/v1/admin/users/:id/status     # Update user status
DELETE /api/v1/admin/users/:id            # Delete user
```

### Health Check
```
GET    /health                            # API health status
GET    /                                  # Available routes
```

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts
- `admins` - Admin accounts
- `wallets` - User wallet balances
- `otp_records` - OTP verification codes
- `user_sessions` - Active sessions
- `kyc_documents` - KYC document metadata
- `deposits` - Deposit transactions
- `withdrawals` - Withdrawal requests
- `referrals` - Referral codes
- `referral_bonuses` - Referral rewards
- `trading_accounts` - Trading data
- `wallet_transfers` - Internal transfers

## 🔧 Environment Variables

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# JWT
JWT_SECRET=your_jwt_secret_key

# Azure Storage
AZURE_STORAGE_ACCOUNT=your_account
AZURE_STORAGE_KEY=your_key
AZURE_KYC_CONTAINER=container_name

# Smile ID
SMILE_ID_API_KEY=your_api_key
SMILE_ID_PARTNER_ID=your_partner_id

# Africa's Talking
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Binance
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret

# Admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=secure_password
```

## 📜 Scripts

```bash
# Development
npm run dev                    # Start dev server with nodemon

# Testing
npm test                       # Run tests

# Database
npm run migration:run          # Run pending migrations
npm run migration:revert       # Revert last migration
npm run migration:generate     # Generate new migration
npm run schema:sync            # Sync schema (dev only)

# TypeORM
npm run typeorm                # TypeORM CLI
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
node --test test/admin_auth_middleware.test.js

# Test with coverage
npm test -- --coverage
```

## 🚢 Deployment

### Prerequisites
- Node.js 16+ installed
- PostgreSQL database (Supabase)
- Environment variables configured

### Steps
1. Clone repository
2. Install dependencies: `npm install`
3. Set up environment: Configure `.env`
4. Run migrations: `npm run migration:run`
5. Start server: `npm start`

### Docker (Optional)
```bash
# Build image
docker build -t investment-api .

# Run container
docker run -p 3000:3000 --env-file .env investment-api
```

## 🔒 Security

- Bcrypt password hashing (10 rounds)
- JWT token authentication
- Session management with expiry
- Rate limiting on sensitive endpoints
- SQL injection prevention (parameterized queries)
- CORS configuration
- Helmet security headers
- Input validation
- Error handling without data leakage

## 📊 Monitoring

- **Sentry**: Error tracking and monitoring
- **Winston**: Application logging
- **Morgan**: HTTP request logging
- **Supabase Dashboard**: Database monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is proprietary and confidential.

## 👥 Team

- **Backend**: Node.js + Express
- **Database**: PostgreSQL + TypeORM
- **DevOps**: Docker + GitHub Actions

## 📞 Support

- **Documentation**: See `/docs` folder
- **Issues**: Create issue in repository
- **Email**: support@example.com

## 🗺️ Roadmap

### Phase 1: Migration (Current)
- [x] TypeORM setup
- [x] Entity creation
- [x] Migration files
- [ ] Data migration
- [ ] Testing

### Phase 2: Refactoring
- [ ] Repository pattern implementation
- [ ] Service layer optimization
- [ ] Controller splitting
- [ ] Unit test coverage

### Phase 3: Features
- [ ] Real-time notifications
- [ ] Advanced analytics
- [ ] Mobile app API
- [ ] WebSocket support

### Phase 4: Optimization
- [ ] Query optimization
- [ ] Caching layer
- [ ] Load balancing
- [ ] Performance tuning

## 📈 Status

- **Version**: 1.0.0
- **Status**: Active Development
- **Last Updated**: 2024
- **Migration Status**: Phase 1 Complete

## 🎯 Quick Links

- [API Documentation](swagger.json)
- [Database Schema](src/database/entities/)
- [Migration Guide](MIGRATION_GUIDE.md)
- [Changelog](CHANGELOG.md)

---

**Built with ❤️ for secure investment management**
