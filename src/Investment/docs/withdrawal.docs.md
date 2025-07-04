Backend Design Documentation
Core Withdrawal Flow

Withdrawal Request Creation

Validate minimum amount ($10 USDT)
Check wallet balance (account or referral wallet only)
Validate Binance address format
Create withdrawal record with "pending" status
Send email notification to admin
Return confirmation message to user


Database Schema Additions
Withdrawals Table:
- withdrawal_id (UUID, primary key)
- user_id (UUID, foreign key)
- wallet_type (enum: 'account', 'referral')
- amount (decimal)
- receiving_address (string)
- status (enum: 'pending', 'processing', 'completed', 'rejected')
- admin_notes (text, optional)
- requested_at (timestamp)
- completed_at (timestamp, nullable)
- processed_by_admin (UUID, nullable)

API Endpoints Structure

POST /api/v1/withdraw/request - Submit withdrawal request
GET /api/v1/withdraw/history - User's withdrawal history
GET /api/v1/admin/withdrawals/pending - Admin pending withdrawals
PUT /api/v1/admin/withdrawals/:id/complete - Mark as completed
PUT /api/v1/admin/withdrawals/:id/reject - Reject withdrawal


Wallet Transfer System

POST /api/v1/wallet/transfer - Transfer from trading to account wallet
Validate sufficient balance in trading wallet
Update both wallet balances atomically
Log transfer transaction


Email Notification System

Admin notification on new withdrawal request
User confirmation email on request submission
User notification on withdrawal completion/rejection


Admin Dashboard Backend

Real-time pending withdrawals count
Withdrawal history with filters
User wallet balance visibility
Manual status update capabilities



Security & Validation

Rate limiting on withdrawal requests (e.g., max 3 per day)
Address validation for Binance format
Balance verification before deduction
Transaction logging for audit trail
Admin authentication for status updates