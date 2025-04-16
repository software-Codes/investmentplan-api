/**
 * This file contains constant values used across the application.
 * These constants are primarily used for defining enums and standardizing
 * values for various functionalities such as user account statuses,
 * verification processes, and OTP handling.
 */

module.exports = {
  /**
   * CONTACT_METHODS:
   * Defines the available methods for contacting users.
   * Used in user communication preferences and notifications.
   */
  CONTACT_METHODS: ["email", "phone"],

  /**
   * ACCOUNT_STATUSES:
   * Represents the possible statuses of a user account.
   * Used to manage user access and account lifecycle.
   */
  ACCOUNT_STATUSES: ["pending", "active", "suspended", "deactivated"],

  /**
   * VERIFICATION_STATUSES:
   * Defines the statuses for user verification processes.
   * Used in KYC (Know Your Customer) and identity verification workflows.
   */
  VERIFICATION_STATUSES: ["not_submitted", "pending", "verified", "rejected"],

  /**
   * DOCUMENT_TYPES:
   * Specifies the types of documents accepted for user verification.
   * Used in document upload and validation processes.
   */
  DOCUMENT_TYPES: ["national_id", "drivers_license", "passport"],

  /**
   * OTP_PURPOSES:
   * Lists the purposes for which OTPs (One-Time Passwords) are generated.
   * Used in authentication and user action verification flows.
   */
  OTP_PURPOSES: [
    "registration", // OTP for user registration
    "login", // OTP for user login
    "reset_password", // OTP for resetting passwords
    "withdrawal", // OTP for withdrawal actions
    "profile_update", // OTP for updating user profile
  ],

  /**
   * OTP_DELIVERY:
   * Defines the available delivery methods for OTPs.
   * Used to determine how OTPs are sent to users.
   */
  OTP_DELIVERY: ["email", "sms"],
};
