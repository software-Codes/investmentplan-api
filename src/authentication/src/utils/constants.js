module.exports = {
  CONTACT_METHODS: ["email", "phone"], // Ensure "phone" is included
  ACCOUNT_STATUSES: ["pending", "active", "suspended", "deactivated"],
  VERIFICATION_STATUSES: ["not_submitted", "pending", "verified", "rejected"],
  DOCUMENT_TYPES: ["national_id", "drivers_license", "passport"],
  OTP_PURPOSES: [
    "registration",
    "reset_password"
  ],
  OTP_DELIVERY: ["email", "sms"],
};