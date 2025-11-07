#!/bin/bash
# Test Runner Script with Environment Setup

set -e

echo "🧪 Deposit Integration Test Runner"
echo "=================================="

# Check if .env.test exists
if [ ! -f .env.test ]; then
    echo "❌ .env.test file not found!"
    echo "Creating .env.test with defaults..."
    cat > .env.test << 'EOF'
# Test Environment Variables
NODE_ENV=test
PORT=3000

# Database (UPDATE THIS!)
DATABASE_URL=postgresql://postgres:password@localhost:5432/investmentplan_test

# Deposit Configuration
DEPOSIT_ADDRESS=0x54af84786bc0386d44fe908b2946f7f50c0f513f
MIN_DEPOSIT_USD=10
MAX_DEPOSIT_USD=100000

# JWT
JWT_SECRET=test-jwt-secret-key-for-testing-only

# Binance (Mock)
BINANCE_API_KEY=test-api-key
BINANCE_API_SECRET=test-api-secret

# Admin Sync Job
ADMIN_SYNC_ENABLED=false
EOF
    echo "✅ Created .env.test - Please update DATABASE_URL and run again"
    exit 1
fi

# Load environment
export $(cat .env.test | grep -v '^#' | xargs)

# Check database connection
echo ""
echo "📊 Checking database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Cannot connect to database: $DATABASE_URL"
    echo "Please update DATABASE_URL in .env.test"
    exit 1
fi
echo "✅ Database connection successful"

# Check if test user exists
echo ""
echo "👤 Checking test user..."
USER_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE user_id = 'test-user-123'" 2>/dev/null || echo "0")
if [ "$USER_EXISTS" -eq "0" ]; then
    echo "⚠️  Test user not found. Creating..."
    psql "$DATABASE_URL" -f test/setup-test-data.sql > /dev/null 2>&1 || true
    echo "✅ Test data created"
else
    echo "✅ Test user exists"
fi

# Clean up old test data
echo ""
echo "🧹 Cleaning up old test data..."
psql "$DATABASE_URL" -c "DELETE FROM deposits WHERE tx_id LIKE '0x1234%' OR tx_id LIKE '0xtest%' OR tx_id LIKE '0xfake%' OR tx_id LIKE '0xpending%'" > /dev/null 2>&1
echo "✅ Cleanup complete"

# Run tests
echo ""
echo "🚀 Running tests..."
echo "=================================="
npm run test:deposit

echo ""
echo "✅ Tests completed!"
