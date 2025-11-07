# Deposit Email Notifications

## Overview

Automatic email notifications are sent when deposits are successfully confirmed and credited to user accounts.

## Email Types

### 1. User Confirmation Email
- **Sent to:** User who made the deposit
- **Subject:** ✅ Deposit Confirmed - Funds Credited
- **Contains:** Amount, deposit ID, transaction hash, Etherscan link

### 2. Admin Notification Email
- **Sent to:** Admin email (ADMIN_EMAIL env var)
- **Subject:** 💰 New Deposit Received
- **Contains:** User details, amount, deposit ID, transaction hash

## Configuration

```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@yourplatform.com
```

## Email Flow

```
Deposit completed → Wallet credited → Emails sent (async) → Response returned
```

Emails are sent asynchronously and don't block the deposit response.

## Testing

```bash
# Submit deposit and check emails
curl -X POST http://localhost:3000/api/v1/deposit/submit \
  -H "Authorization: Bearer TOKEN" \
  -d '{"txId": "0x..."}'
```

Check logs for:
- ✅ "User deposit confirmation email sent"
- ✅ "Admin deposit notification email sent"
