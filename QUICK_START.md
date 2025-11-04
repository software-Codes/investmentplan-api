# Quick Start Guide - Supabase Migration

## Prerequisites
- Node.js 16+ installed
- Supabase account created
- Neon database backup completed

## Step-by-Step Migration

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
1. Go to https://supabase.com
2. Create new project
3. Copy connection string from Settings > Database
4. Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 3. Update Environment
```bash
# Backup current .env
cp .env .env.neon.backup

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### 4. Run Migrations
```bash
# This creates all tables, indexes, and constraints
npm run migration:run
```

### 5. Export Data from Neon
```bash
pg_dump "postgresql://investment-app-api_owner:npg_EkrUb7MasT4V@ep-raspy-lab-a8m23vek-pooler.eastus2.azure.neon.tech/investment-app-api?sslmode=require" \
  --data-only \
  --format=custom \
  --file=neon_backup.dump
```

### 6. Import Data to Supabase
```bash
pg_restore --verbose --clean --no-acl --no-owner \
  -h db.[YOUR-PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  neon_backup.dump
```

### 7. Verify Migration
```bash
# Start the server
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 8. Check Data Integrity
```bash
# Connect to Supabase
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Check table counts
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;

# Verify users
SELECT COUNT(*) FROM users;

# Verify wallets
SELECT COUNT(*) FROM wallets;

# Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
```

## Rollback (If Needed)

```bash
# Restore Neon connection
cp .env.neon.backup .env

# Restart server
npm run dev
```

## Common Issues

### Connection Refused
- Check Supabase project is active
- Verify DATABASE_URL is correct
- Ensure IP is whitelisted in Supabase dashboard

### Migration Fails
```bash
# Revert last migration
npm run migration:revert

# Check migration status
npm run typeorm migration:show
```

### Data Import Errors
- Ensure schema is created first (run migrations)
- Check for data type mismatches
- Verify foreign key constraints

## TypeORM Commands

```bash
# Show migration status
npm run typeorm migration:show -d src/database/config/database.config.js

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration
npm run migration:generate -- src/database/migrations/NewMigration

# Sync schema (dev only - dangerous!)
npm run schema:sync
```

## Testing Checklist

- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] User registration works
- [ ] OTP verification works
- [ ] User login works
- [ ] JWT token generated
- [ ] Session created
- [ ] Wallet balances correct
- [ ] KYC upload works
- [ ] Admin login works
- [ ] All API endpoints respond

## Monitoring

### Check Logs
```bash
# Application logs
tail -f logs/app.log

# Database queries (if logging enabled)
tail -f logs/queries.log
```

### Supabase Dashboard
1. Go to your project dashboard
2. Check Database > Query Performance
3. Monitor API > Logs
4. Review Database > Backups

## Support

- **Migration Guide**: See `MIGRATION_GUIDE.md`
- **Cleanup Plan**: See `CLEANUP_PLAN.md`
- **Project Summary**: See `PROJECT_SUMMARY.md`
- **Authentication Docs**: See `src/authentication/README.MD`

## Quick Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npm test                       # Run tests

# Database
npm run migration:run          # Run migrations
npm run migration:revert       # Revert migration
npm run migration:generate     # Generate migration

# Deployment
npm start                      # Start production server
```

## Environment Variables Quick Check

```bash
# Verify all required variables are set
node -e "
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'AZURE_STORAGE_ACCOUNT',
  'AZURE_STORAGE_KEY',
  'EMAIL_USER',
  'EMAIL_PASS'
];
required.forEach(key => {
  if (!process.env[key]) console.error('Missing:', key);
  else console.log('✓', key);
});
"
```

## Success Indicators

✅ Server starts on port 3000
✅ Database connection established
✅ All tables created
✅ Indexes created
✅ Data migrated
✅ Authentication works
✅ No errors in logs

## Next Steps After Migration

1. Monitor performance for 24 hours
2. Run full test suite
3. Update deployment scripts
4. Remove Neon dependency
5. Implement TypeORM repositories
6. Refactor code to use entities
7. Add more tests
8. Optimize queries

---

**Need Help?** Check the detailed guides or create an issue in the repository.
