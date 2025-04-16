# Authentication System

A secure authentication flow with OTP verification, KYC document handling, and session management.

---

## **Tools & Technologies**
1. **Backend**: 
   - Node.js + Express
2. **Database**: 
   - Neon Postgres (Serverless PostgreSQL)
3. **Storage**: 
   - Azure Blob Storage (KYC documents)
4. **OTP Delivery**: 
   - Nodemailer (Email) + Africa’s Talking (SMS)
5. **KYC Verification**: 
   - Smile ID API
6. **Security**:
   - Bcrypt (password hashing)
   - JWT (access/refresh tokens)
7. **Logging**:
   - Winston/Morgan

---

## **Authentication Flow**

### 1. **Signup**
1. User submits: `full_name`, `email`, `phone_number`, `password`, `otp_preference`.
2. System:
   - Validates email/phone uniqueness.
   - Generates a 6-digit OTP (expires in 10 mins).
   - Sends OTP via email (Nodemailer) or SMS (Africa’s Talking).
   - Stores OTP hash in the `otps` table.

### 2. **OTP Validation**
1. User submits OTP.
2. System:
   - Validates OTP against the `otps` table.
   - Marks user as `verified` on success.
   - Prompts user to upload KYC documents (optional for deposits).

### 3. **KYC Document Upload**
1. User uploads ID/driver’s license.
2. System:
   - Stores document in **Azure Blob Storage** (private container).
   - Triggers Smile ID verification (async via webhook).
   - Updates `kyc_status` in the `users` table.

### 4. **Login**
1. User submits `email`/`phone` + `password`.
2. System:
   - Validates credentials (bcrypt hash comparison).
   - Issues JWT access token (15 mins) and refresh token (7 days).
   - Stores refresh token in the `sessions` table.

### 5. **Session Management**
- **Access Token**: Short-lived; used for API requests.
- **Refresh Token**: Long-lived; stored securely in DB.
- **Token Rotation**: New access token issued on refresh.

### 6. **Account Recovery**
1. **Forgot Password**:
   - User requests OTP via email/SMS.
   - Validates OTP → Allows password reset.
2. **KYC Recovery**:
   - Manual admin review for lost OTP access.

---

## **Security Practices**
1. **Rate Limiting**:
   - OTP resends: 3 attempts/hour.
   - Login attempts: 5 attempts/hour.
2. **Encryption**:
   - Passwords: Bcrypt (salt rounds: 12).
   - Documents: Azure Blob Storage (encrypted at rest).
3. **Session Security**:
   - Refresh tokens: Hashed before DB storage.
   - JWT signatures: HS256 with secret key.
4. **KYC Enforcement**:
   - Withdrawals blocked until `kyc_status = approved`.

---

## **Environment Variables**
```plaintext
# Database
NEON_POSTGRES_URL=

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=
AZURE_CONTAINER_NAME=

# Smile ID
SMILE_API_KEY=
SMILE_PARTNER_ID=

# Africa’s Talking
AT_API_KEY=
AT_USERNAME=

# Nodemailer
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=