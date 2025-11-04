const { STATUS_CODES } = require("../response.util")


class AdminValidationError extends Error {
    constructor(message, statusCode = STATUS_CODES.BAD_REQUEST) {
        super(message);
        this.name = 'AdminValidationError';
        this.statusCode = statusCode;
    }
}


class AdminValidator {
    static validateEmail(email) {
        if (!email?.trim()) {
            throw new AdminValidationError("Email is required");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new AdminValidationError("Please provide a valid email address");
        }

        return email.toLowerCase().trim();
    }

    static validatePassword(password, fieldName = "Password") {
        if (!password?.trim()) {
            throw new AdminValidationError(`${fieldName} is required`);
        }

        if (password.length < 8) {
            throw new AdminValidationError(`${fieldName} must be at least 8 characters long`);
        }

        return password;
    }

    static validateFullName(fullName) {
        if (!fullName?.trim()) {
            throw new AdminValidationError("Full name is required");
        }

        if (fullName.trim().length < 2) {
            throw new AdminValidationError("Full name must be at least 2 characters long");
        }

        return fullName.trim();
    }
    static validateOtpCode(otpCode) {
        if (!otpCode?.trim()) {
            throw new AdminValidationError("OTP code is required");
        }

        return otpCode.trim();
    }

    static validateRole(role) {
        const validRoles = 'admin';
        const normalizedRole = role || 'admin';

        if (!validRoles.includes(normalizedRole)) {
            throw new AdminValidationError(`Role must be one of: ${validRoles.join(', ')}`);
        }

        return normalizedRole;
    }

    static validateRegistrationData(data) {
        const { fullName, email, password, role } = data;

        return {
            fullName: this.validateFullName(fullName),
            email: this.validateEmail(email),
            password: this.validatePassword(password),
            role: this.validateRole(role)
        };
    }

    static validateLoginData(data) {
        const { email, password } = data;

        return {
            email: this.validateEmail(email),
            password: this.validatePassword(password)
        };
    }

    static validatePasswordResetRequest(data) {
        const { email } = data;

        return {
            email: this.validateEmail(email)
        };
    }

    static validatePasswordReset(data) {
        const { email, otpCode, newPassword } = data;

        return {
            email: this.validateEmail(email),
            otpCode: this.validateOtpCode(otpCode),
            newPassword: this.validatePassword(newPassword, "New password")
        };
    }

    static validateUpdateData(data) {
        const { fullName, currentPassword, newPassword } = data;
        const validatedData = {};

        if (fullName !== undefined) {
            validatedData.fullName = this.validateFullName(fullName);
        }

        if (currentPassword && newPassword) {
            validatedData.currentPassword = this.validatePassword(currentPassword, "Current password");
            validatedData.newPassword = this.validatePassword(newPassword, "New password");
        } else if (currentPassword || newPassword) {
            throw new AdminValidationError("Both current password and new password are required for password change");
        }

        return validatedData;
    }

}


module.exports = { AdminValidator, AdminValidationError };
