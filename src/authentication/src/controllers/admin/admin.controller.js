const { success, error, STATUS_CODES } = require("../../utils/response.util");
const { AdminValidator, AdminValidationError } = require("../../utils/validators/admin-auth-validators-shema");
const { AdminService, AdminServiceError } = require("../../services/admin/auth-admin.service");

class AdminController {
  static async register(req, res, next) {
    try {
      const validatedData = AdminValidator.validateRegistrationData(req.body);
      const adminData = await AdminService.registerAdmin(validatedData);

      return res.status(STATUS_CODES.CREATED).json(
        success(adminData, "Admin account created successfully.", STATUS_CODES.CREATED)
      );
    } catch (err) {
      console.error("Registration error:", err);
      return AdminController.handleError(res, err, "Registration failed");
    }
  }

  static async login(req, res, next) {
    try {
      const validatedData = AdminValidator.validateLoginData(req.body);
      const loginData = await AdminService.loginAdmin(validatedData);

      return res.status(STATUS_CODES.OK).json(
        success(loginData, "Login successful", STATUS_CODES.OK)
      );
    } catch (err) {
      console.error("Login error:", err);
      return AdminController.handleError(res, err, "Login failed");
    }
  }

  static async requestPasswordReset(req, res, next) {
    try {
      const validatedData = AdminValidator.validatePasswordResetRequest(req.body);
      const result = await AdminService.requestPasswordReset(validatedData);

      return res.status(STATUS_CODES.OK).json(
        success(null, result.message, STATUS_CODES.OK)
      );
    } catch (err) {
      console.error("Password reset request error:", err);
      return AdminController.handleError(res, err, "Request failed");
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const validatedData = AdminValidator.validatePasswordReset(req.body);
      const resetData = await AdminService.resetPassword(validatedData);

      return res.status(STATUS_CODES.OK).json(
        success(resetData, "Your password has been reset successfully", STATUS_CODES.OK)
      );
    } catch (err) {
      console.error("Password reset error:", err);
      return AdminController.handleError(res, err, "Reset failed");
    }
  }

  static async updateAdminDetails(req, res, next) {
    try {
      const adminId = req.admin?.adminId;

      if (!adminId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          error(
            new Error("Unauthorized"),
            "Admin authentication required",
            STATUS_CODES.UNAUTHORIZED
          )
        );
      }

      const validatedData = AdminValidator.validateUpdateData(req.body);
      const updateData = await AdminService.updateAdminDetails(adminId, validatedData);

      return res.status(STATUS_CODES.OK).json(
        success(updateData, "Admin profile updated successfully", STATUS_CODES.OK)
      );
    } catch (err) {
      console.error("Update admin details error:", err);
      return AdminController.handleError(res, err, "Update failed");
    }
  }

  static async getProfile(req, res, next) {
    try {
      const { adminId } = req.admin;

      if (!adminId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          error(
            new Error("Unauthorized"),
            "Admin authentication required",
            STATUS_CODES.UNAUTHORIZED
          )
        );
      }

      const profileData = await AdminService.getAdminProfile(adminId);

      return res.status(STATUS_CODES.OK).json(
        success(profileData, "Admin profile fetched successfully", STATUS_CODES.OK)
      );
    } catch (err) {
      console.error("Get profile error:", err);
      return AdminController.handleError(res, err, "Fetch failed");
    }
  }

  static async deleteAccount(req, res, next) {
    try {
      const { adminId } = req.admin;

      if (!adminId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          error(
            new Error("Unauthorized"),
            "Missing admin identity in token",
            STATUS_CODES.UNAUTHORIZED
          )
        );
      }

      await AdminService.deleteAdmin(adminId);

      return res.status(STATUS_CODES.NO_CONTENT).send();
    } catch (err) {
      console.error("Delete account error:", err);
      return AdminController.handleError(res, err, "Delete failed");
    }
  }

  static handleError(res, err, defaultMessage) {
    if (err instanceof AdminValidationError) {
      return res.status(err.statusCode).json(
        error(new Error("Validation failed"), err.message, err.statusCode)
      );
    }

    if (err instanceof AdminServiceError) {
      return res.status(err.statusCode).json(
        error(new Error(defaultMessage), err.message, err.statusCode)
      );
    }

    // Generic error for unexpected issues
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json(
      error(
        new Error(defaultMessage),
        "An unexpected error occurred. Please try again later.",
        STATUS_CODES.INTERNAL_SERVER_ERROR
      )
    );
  }
}

module.exports = AdminController;