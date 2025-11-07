# Integration Tests

## Deposit System Tests

The deposit integration tests verify the complete deposit flow from submission to wallet crediting.

### Test Coverage

1. **Successful Deposit Flow**
   - Transaction found in Binance
   - Deposit record created in database
   - Account wallet credited immediately
   - Status marked as 'completed'

2. **Idempotency Protection**
   - Retry same transaction doesn't double-credit
   - Uses idempotency key: `deposit:${txId}`

3. **Error Handling**
   - Transaction not found in Binance (ERR_TXID_NOT_FOUND)
   - Transaction already claimed by another user (ERR_TXID_ALREADY_CLAIMED)
   - Pending transactions rejected (ERR_PENDING_CONFIRMATION)

4. **Admin Monitoring**
   - List all deposits from database with user details
   - List all Binance transactions with claim status
   - Identify unclaimed deposits

### Running Tests

```bash
# Run all tests
npm test

# Run only deposit tests
npm run test:deposit

# Run all integration tests
npm run test:all
```

### Prerequisites

1. **Environment Setup**
   ```bash
   # Copy test environment file
   cp .env.test .env.test.local
   
   # Update DATABASE_URL in .env.test.local with your test database
   # DATABASE_URL=postgresql://postgres:password@localhost:5432/investmentplan_test
   ```

2. **Database Setup**
   ```bash
   # Run migrations on test database
   DATABASE_URL=<your_test_db_url> npm run migration:run
   
   # (Optional) Set up test data
   psql <your_test_db_url> -f test/setup-test-data.sql
   ```

3. **Required Environment Variables**
   - `DATABASE_URL` - Test database connection
   - `DEPOSIT_ADDRESS` - Deposit wallet address (default: 0x54af84786bc0386d44fe908b2946f7f50c0f513f)
   - `JWT_SECRET` - JWT secret for auth (any value for tests)

### Test Structure

```javascript
describe('Deposit Integration Tests', () => {
    before() // Setup: Create DB connection, initialize services
    after()  // Cleanup: Remove test data, close connections
    
    it('should create deposit record and credit wallet')
    it('should prevent double-crediting on retry')
    it('should reject transaction not found')
    it('should reject already claimed transaction')
    it('should reject pending transactions')
    it('admin should see all deposits')
    it('admin should see Binance transactions')
})
```

### Mock Services

- **MockWalletService**: Simulates wallet crediting with idempotency tracking
- **MockBinanceProvider**: Simulates Binance API responses

### Environment Variables Required

```env
DATABASE_URL=postgresql://...
DEPOSIT_ADDRESS=0x54af84786bc0386d44fe908b2946f7f50c0f513f
```

## Admin Deposit Sync Job

The background job has been optimized to prevent database connection timeouts:

### Improvements

1. **Concurrent Sync Prevention**: Only one sync runs at a time
2. **Query Timeout Protection**: 10-second timeout on database queries
3. **Batch Limiting**: Process max 10 deposits per sync cycle
4. **Better Error Logging**: Info-level logs for expected errors, error-level only for system failures

### Configuration

```javascript
// In app.js
const syncJob = new AdminDepositSyncJob({
    depositService,
    binance: binanceProvider,
    logger: console,
    intervalMs: 60000, // 60 seconds (configurable)
});
```

### Monitoring

Check logs for:
- `AdminDepositSyncJob: Starting sync...`
- `AdminDepositSyncJob: Found X pending deposits`
- `AdminDepositSyncJob: Verified X/Y deposits`
- `AdminDepositSyncJob: Sync complete`

### Troubleshooting

If sync fails:
1. Check database connection pool settings
2. Verify Binance API credentials
3. Check for pending deposits stuck in processing
4. Review error logs for specific failures
