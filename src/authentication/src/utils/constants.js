module.exports = {
  CONTACT_METHODS: ["email", "phone"],
  ACCOUNT_STATUSES: ["pending", "active", "suspended", "deactivated"],
  // VERIFICATION_STATUSES: [
  //   "not_submitted", 
  //   "pending", 
  //   "processing", // Added intermediate status
  //   "verified", 
  //   "rejected",
  //   "expired",    // Added for documents that have expired
  //   "cancelled"   // Added for user-cancelled verifications
  // ],
  DOCUMENT_TYPES: ["national_id", "drivers_license", "passport"],
  DOCUMENT_COUNTRIES: [
    "NG", "KE", "ZA", "GH", "UG", "TZ", "RW", "ET",  // Common African countries
    "US", "GB", "CA", "AU"  // Some international countries
  ],
  OTP_PURPOSES: [
    "registration",
    "login",
    "reset_password",
    "withdrawal",
    "profile_update",
    "document_verification"  // Added for KYC verification
  ],
  OTP_DELIVERY: ["email", "sms"],
  VERIFICATION_METHODS: [
    "smile_id",
    "manual",
    "third_party"
  ],
  // Map internal document types to Smile ID types
  SMILE_ID_DOCUMENT_MAPPING: {
    "national_id": "ID_CARD",
    "drivers_license": "DRIVERS_LICENSE",
    "passport": "PASSPORT"
  }
};