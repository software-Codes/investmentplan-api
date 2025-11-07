// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Set required env vars if not present
process.env.DEPOSIT_ADDRESS = process.env.DEPOSIT_ADDRESS || '0x54af84786bc0386d44fe908b2946f7f50c0f513f';
process.env.MIN_DEPOSIT_USD = process.env.MIN_DEPOSIT_USD || '10';
process.env.MAX_DEPOSIT_USD = process.env.MAX_DEPOSIT_USD || '100000';
process.env.BINANCE_API_KEY = process.env.BINANCE_API_KEY || 'test-key';
process.env.BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || 'test-secret';

const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const { Pool } = require('pg');
const { DepositService } = require('../src/Investment/src/modules/deposit/services/deposit.service');
const { BinanceProvider } = require('../src/Investment/src/modules/deposit/providers/binance.provider');

// Mock wallet service
class MockWalletService {
    constructor() {
        this.credits = [];
    }

    async creditAccount(userId, amountUsd, metadata) {
        const key = metadata.idempotencyKey;
        if (this.credits.find(c => c.idempotencyKey === key)) {
            return { alreadyCredited: true };
        }
        this.credits.push({ userId, amountUsd, ...metadata });
        return { success: true, newBalance: 1000 + amountUsd };
    }

    reset() {
        this.credits = [];
    }
}

// Mock Binance provider
class MockBinanceProvider {
    constructor() {
        this.deposits = [];
    }

    addDeposit(deposit) {
        this.deposits.push(deposit);
    }

    async listRecentDeposits({ sinceMs, coin, network }) {
        return this.deposits;
    }

    async getDepositByTxId(txId) {
        return this.deposits.find(d => d.txId.toLowerCase() === txId.toLowerCase());
    }

    reset() {
        this.deposits = [];
    }
}

describe('Deposit Integration Tests', () => {
    let db, depositService, walletService, binanceProvider;
    const testUserId = 'test-user-123';
    const testTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    before(async () => {
        // Setup database connection
        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Initialize services
        walletService = new MockWalletService();
        binanceProvider = new MockBinanceProvider();
        depositService = new DepositService({
            db,
            walletService,
            binance: binanceProvider,
        });

        // Clean up test data
        await db.query('DELETE FROM deposits WHERE tx_id = $1', [testTxId]);
    });

    after(async () => {
        // Cleanup
        await db.query('DELETE FROM deposits WHERE tx_id = $1', [testTxId]);
        await db.end();
    });

    it('should create deposit record and credit wallet for successful transaction', async () => {
        // Setup: Add successful deposit to mock Binance
        binanceProvider.addDeposit({
            txId: testTxId,
            amount: 100.50,
            coin: 'USDT',
            network: 'ETH',
            address: process.env.DEPOSIT_ADDRESS || '0x54af84786bc0386d44fe908b2946f7f50c0f513f',
            status: 'SUCCESS',
            insertTime: Date.now(),
        });

        // Act: Submit deposit
        const result = await depositService.submitDeposit({
            userId: testUserId,
            txId: testTxId,
        });

        // Assert: Deposit record created
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.amountUsd, 100.50);
        assert.strictEqual(result.txId, testTxId);

        // Assert: Wallet credited
        assert.strictEqual(walletService.credits.length, 1);
        assert.strictEqual(walletService.credits[0].userId, testUserId);
        assert.strictEqual(walletService.credits[0].amountUsd, 100.50);
        assert.strictEqual(walletService.credits[0].idempotencyKey, `deposit:${testTxId}`);

        // Assert: Database record exists
        const { rows } = await db.query('SELECT * FROM deposits WHERE tx_id = $1', [testTxId]);
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].user_id, testUserId);
        assert.strictEqual(rows[0].status, 'completed');
        assert.strictEqual(Number(rows[0].amount_usd), 100.50);
    });

    it('should prevent double-crediting on retry (idempotency)', async () => {
        // Act: Submit same transaction again
        const result = await depositService.submitDeposit({
            userId: testUserId,
            txId: testTxId,
        });

        // Assert: Still shows completed
        assert.strictEqual(result.status, 'completed');

        // Assert: Wallet NOT credited again (idempotency key prevents it)
        assert.strictEqual(walletService.credits.length, 1, 'Should not credit twice');
    });

    it('should reject transaction not found in Binance', async () => {
        const fakeTxId = '0xfake567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

        await assert.rejects(
            async () => {
                await depositService.submitDeposit({
                    userId: testUserId,
                    txId: fakeTxId,
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'ERR_TXID_NOT_FOUND');
                return true;
            }
        );

        // Assert: No database record created
        const { rows } = await db.query('SELECT * FROM deposits WHERE tx_id = $1', [fakeTxId]);
        assert.strictEqual(rows.length, 0);
    });

    it('should reject transaction already claimed by another user', async () => {
        await assert.rejects(
            async () => {
                await depositService.submitDeposit({
                    userId: 'different-user-456',
                    txId: testTxId,
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'ERR_TXID_ALREADY_CLAIMED');
                return true;
            }
        );
    });

    it('should reject pending transactions', async () => {
        const pendingTxId = '0xpending7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        
        binanceProvider.addDeposit({
            txId: pendingTxId,
            amount: 50.00,
            coin: 'USDT',
            network: 'ETH',
            address: process.env.DEPOSIT_ADDRESS || '0x54af84786bc0386d44fe908b2946f7f50c0f513f',
            status: 'PENDING',
            insertTime: Date.now(),
        });

        await assert.rejects(
            async () => {
                await depositService.submitDeposit({
                    userId: testUserId,
                    txId: pendingTxId,
                });
            },
            (err) => {
                assert.strictEqual(err.code, 'ERR_PENDING_CONFIRMATION');
                return true;
            }
        );
    });

    it('admin should see all deposits in database', async () => {
        const result = await depositService.listAllDeposits({
            page: 1,
            limit: 50,
        });

        assert.ok(result.deposits.length > 0);
        const ourDeposit = result.deposits.find(d => d.txId === testTxId);
        assert.ok(ourDeposit);
        assert.strictEqual(ourDeposit.userId, testUserId);
        assert.strictEqual(ourDeposit.status, 'completed');
    });

    it('admin should see all Binance transactions with claim status', async () => {
        const result = await depositService.listBinanceDeposits({
            days: 90,
        });

        assert.ok(result.length > 0);
        const ourDeposit = result.find(d => d.txId === testTxId);
        assert.ok(ourDeposit);
        assert.strictEqual(ourDeposit.claimed, true);
        assert.strictEqual(ourDeposit.claimedBy, testUserId);
    });
});
