# Migration Guide: Neon to Supabase with TypeORM

## Overview
This guide covers the migration from Neon PostgreSQL to Supabase PostgreSQL with TypeORM implementation.

## Prerequisites
1. Supabase account and project created
2. Database connection string from Supabase
3. Backup of existing Neon database

## Migration Steps

### 1. Install Dependencies
```bash
npm install typeorm@^0.3.20 reflect-metadata@^0.2.1
```

### 2. Update Environment Variables
Update `.env` file with Supabase connection string:
```env
# Old Neon connection
# DATABASE_URL='postgresql://investment-app-api_owner:npg_EkrUb7MasT4V@ep-raspy-lab-a8m23vek-pooler.eastus2.azure.neon.tech/investment-app-api?sslmode=require'

# New Supabase connection
DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres'
```

### 3. Export Data from Neon
```bash
# Connect to Neon and export data
pg_dump "postgresql://investment-app-api_owner:npg_EkrUb7MasT4V@ep-raspy-lab-a8m23vek-pooler.eastus2.azure.neon.tech/investment-app-api?sslmode=require" \
  --data-only \
  --format=custom \
  --file=neon_data_backup.dump
```

### 4. Run TypeORM Migrations on Supabase
```bash
# Run migrations to create schema
npm run migration:run
```

### 5. Import Data to Supabase
```bash
# Restore data to Supabase
pg_restore --verbose --clean --no-acl --no-owner \
  -h db.[YOUR-PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  neon_data_backup.dump
```

### 6. Verify Migration
```bash
# Check table counts
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

### 7. Update Application Code
The application now uses TypeORM entities. Key changes:
- Database connection: `src/database/connection.js`
- Entities: `src/database/entities/`
- Migrations: `src/database/migrations/`

### 8. Test Application
```bash
# Start development server
npm run dev

# Test endpoints
curl http://localhost:3000/health
```

## TypeORM Commands

### Generate Migration
```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

### Run Migrations
```bash
npm run migration:run
```

### Revert Migration
```bash
npm run migration:revert
```

### Sync Schema (Development Only)
```bash
npm run schema:sync
```

## Rollback Plan
If migration fails:
1. Keep Neon connection string in `.env`
2. Revert code changes
3. Application will continue using Neon

## Post-Migration Checklist
- [ ] All tables migrated successfully
- [ ] Data integrity verified
- [ ] Indexes created
- [ ] Foreign keys working
- [ ] Application tests passing
- [ ] Authentication flow working
- [ ] Wallet operations functional
- [ ] Admin panel accessible
- [ ] KYC document upload working
- [ ] Binance integration functional

## Supabase-Specific Features
After migration, you can leverage:
1. **Row Level Security (RLS)**: Secure data access at database level
2. **Realtime subscriptions**: Listen to database changes
3. **Storage**: Alternative to Azure Blob Storage
4. **Auth**: Built-in authentication (optional replacement)
5. **Edge Functions**: Serverless functions

## Performance Optimization
1. Enable connection pooling in Supabase
2. Use prepared statements
3. Implement query result caching
4. Monitor slow queries in Supabase dashboard

## Monitoring
- Supabase Dashboard: Monitor queries, connections, and performance
- Application logs: Check `src/authentication/src/utils/logger.js`
- Error tracking: Sentry integration already configured

## Support
- Supabase Docs: https://supabase.com/docs
- TypeORM Docs: https://typeorm.io
- Project Issues: Create issue in repository
