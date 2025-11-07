-- Test Data Setup for Deposit Integration Tests
-- Run this before running tests if you need sample data

-- Create test user (if not exists)
INSERT INTO users (user_id, email, password_hash, full_name, email_verified, account_status, created_at)
VALUES (
    'test-user-123',
    'testuser@example.com',
    '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', -- dummy hash
    'Test User',
    true,
    'active',
    NOW()
) ON CONFLICT (user_id) DO NOTHING;

-- Create test wallet (if not exists)
INSERT INTO wallets (wallet_id, user_id, account_balance, trading_balance, referral_balance, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'test-user-123',
    0.00,
    0.00,
    0.00,
    NOW(),
    NOW()
) ON CONFLICT (user_id) DO NOTHING;

-- Clean up any existing test deposits
DELETE FROM deposits WHERE tx_id LIKE '0x1234%' OR tx_id LIKE '0xtest%' OR tx_id LIKE '0xfake%' OR tx_id LIKE '0xpending%';
DELETE FROM wallet_transactions WHERE idempotency_key LIKE 'deposit:0x1234%' OR idempotency_key LIKE 'deposit:0xtest%';

-- Verify setup
SELECT 'Test user created:' as status, user_id, email, full_name FROM users WHERE user_id = 'test-user-123';
SELECT 'Test wallet created:' as status, wallet_id, user_id, account_balance FROM wallets WHERE user_id = 'test-user-123';
