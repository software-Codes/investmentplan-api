const Admin = require("../../models/admin/Admin");
const OTP = require("../../models/otp.model");
const { generateAdminToken } = require("../../utils/admin/token.util");
const { query } = require("../../Config/neon-database");
const bcrypt = require("bcrypt");
const { STATUS_CODES } = require("../../utils/response.util");


class AdminServiceError extends Error {
    constructor(message, statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR) {
        super(message);
        this.name = 'AdminServiceError';
        this.statusCode = statusCode;
    }
}

class AdminService {
    static async checkEmailConflicts(email) {
        // Check if admin already exists
        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin) {
            throw new AdminServiceError(
                "An admin with this email already exists",
                STATUS_CODES.BAD_REQUEST
            );
        }

        // Check if email is used by a regular user
        const userExists = await query(
            `SELECT user_id FROM users WHERE LOWER(email) = $1`,
            [email.toLowerCase()]
        );

        if (userExists.rows.length > 0) {
            throw new AdminServiceError(
                "This email is already used by a user account",
                STATUS_CODES.BAD_REQUEST
            );
        }
    }

    static async registerAdmin(validatedData) {
        const { fullName, email, password, role } = validatedData;

        try {
            await this.checkEmailConflicts(email);

            const adminData = {
                fullName,
                email,
                password,
                role
            };

            const newAdmin = await Admin.create(adminData);

            return {
                adminId: newAdmin.admin_id,
                fullName: newAdmin.full_name,
                email: newAdmin.email,
                role: newAdmin.role,
                createdAt: newAdmin.created_at
            };
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            // Handle specific database errors
            if (error.message.includes("duplicate key") || error.message.includes("Email already exists")) {
                throw new AdminServiceError(
                    "An admin with this email already exists",
                    STATUS_CODES.BAD_REQUEST
                );
            }

            if (error.message.includes("violates check constraint") || error.message.includes("invalid input")) {
                throw new AdminServiceError(
                    "Please check your input data and try again",
                    STATUS_CODES.BAD_REQUEST
                );
            }

            throw new AdminServiceError(
                "Unable to create admin account. Please try again later."
            );
        }
    }

    static async loginAdmin(validatedData) {
        const { email, password } = validatedData;

        try {
            const { isValid, admin } = await Admin.validateCredentials(email, password);

            if (!isValid) {
                throw new AdminServiceError(
                    "Invalid email or password",
                    STATUS_CODES.UNAUTHORIZED
                );
            }

            const token = generateAdminToken(admin);

            return {
                token,
                admin: {
                    adminId: admin.admin_id,
                    fullName: admin.full_name,
                    email: admin.email,
                    role: admin.role
                }
            };
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            throw new AdminServiceError(
                "Unable to process login request. Please try again later."
            );
        }
    }

    static async requestPasswordReset(validatedData) {
        const { email } = validatedData;

        try {
            const admin = await Admin.findByEmail(email);

            if (admin) {
                await OTP.generate({
                    email: admin.email,
                    purpose: "reset_password",
                    delivery: "email"
                });
            }

            // Always return success to prevent email enumeration
            return { message: "If this email exists, you will receive a reset code" };
        } catch (error) {
            throw new AdminServiceError(
                "Unable to process password reset request. Please try again later."
            );
        }
    }

    static async resetPassword(validatedData) {
        const { email, otpCode, newPassword } = validatedData;

        try {
            const admin = await Admin.findByEmail(email);
            if (!admin) {
                throw new AdminServiceError(
                    "No admin found with this email",
                    STATUS_CODES.NOT_FOUND
                );
            }

            const isValidOtp = await OTP.verify({
                email: admin.email,
                code: otpCode,
                purpose: "reset_password"
            });

            if (!isValidOtp) {
                throw new AdminServiceError(
                    "The OTP code is invalid or expired",
                    STATUS_CODES.BAD_REQUEST
                );
            }

            const updated = await Admin.updatePassword(admin.admin_id, newPassword);

            return {
                adminId: updated.admin_id,
                email: updated.email,
                updatedAt: updated.updated_at
            };
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            throw new AdminServiceError(
                "Unable to reset password. Please try again later."
            );
        }
    }

    static async updateAdminDetails(adminId, validatedData) {
        try {
            const admin = await Admin.findById(adminId);
            if (!admin) {
                throw new AdminServiceError(
                    "Admin account not found",
                    STATUS_CODES.NOT_FOUND
                );
            }

            const { fullName, currentPassword, newPassword } = validatedData;

            // Handle password change
            if (currentPassword && newPassword) {
                const isPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);
                if (!isPasswordValid) {
                    throw new AdminServiceError(
                        "Current password is incorrect",
                        STATUS_CODES.UNAUTHORIZED
                    );
                }

                await Admin.updatePassword(adminId, newPassword);
            }

            // Handle full name update
            if (fullName) {
                await Admin.updateFullName(adminId, fullName);
            }

            return { adminId };
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            throw new AdminServiceError(
                "Unable to update admin details. Please try again later."
            );
        }
    }

    static async getAdminProfile(adminId) {
        try {
            const admin = await Admin.findById(adminId);
            if (!admin) {
                throw new AdminServiceError(
                    "Admin account not found",
                    STATUS_CODES.NOT_FOUND
                );
            }

            return {
                adminId: admin.admin_id,
                fullName: admin.full_name,
                email: admin.email,
                role: admin.role,
                createdAt: admin.created_at,
                updatedAt: admin.updated_at
            };
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            throw new AdminServiceError(
                "Unable to fetch admin profile. Please try again later."
            );
        }
    }

    static async deleteAdmin(adminId) {
        try {
            const deleted = await Admin.deleteById(adminId);

            if (!deleted) {
                throw new AdminServiceError(
                    `Admin not found for ID: ${adminId}`,
                    STATUS_CODES.NOT_FOUND
                );
            }

            return true;
        } catch (error) {
            if (error instanceof AdminServiceError) {
                throw error;
            }

            throw new AdminServiceError(
                "Unable to delete admin account. Please try again later."
            );
        }
    }
}

module.exports = { AdminService, AdminServiceError };

