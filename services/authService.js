import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import emailService from "./emailService.js";

class AuthService {
  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  static generateToken(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      name: user.name,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: "jawbreaker-app",
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid token");
      } else {
        throw new Error("Token verification failed");
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Token or null if not found
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Create authentication response object
   * @param {Object} user - User object
   * @returns {Object} Authentication response
   */
  static createAuthResponse(user) {
    const token = this.generateToken(user);
    return {
      success: true,
      token,
      user: user.toPublicJSON(),
    };
  }

  /**
   * Validate user credentials
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Validation result
   */
  static async validateCredentials(email, password) {
    try {
      // Find user by email and populate subscriptions
      const user = await User.findByEmail(email).populate("subscriptions");
      if (!user) {
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: "Authentication failed",
      };
    }
  }

  /**
   * Create new user account
   * @param {Object} userData - User registration data
   * @returns {Object} Registration result
   */
  static async createUser(userData) {
    try {
      const { email, password, name } = userData;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          error: "Email address is already registered",
        };
      }

      // Create new user
      const user = new User({
        email,
        password,
        name,
        signupSource: "free",
        isEmailVerified: false,
      });

      await user.save();

      return {
        success: true,
        user,
      };
    } catch (error) {
      if (error.name === "ValidationError") {
        const firstError = Object.values(error.errors)[0];
        return {
          success: false,
          error: firstError.message,
        };
      }

      return {
        success: false,
        error: error.message || "Registration failed",
      };
    }
  }

  /**
   * Find or create user from Google OAuth data
   * @param {Object} googleProfile - Google profile data
   * @returns {Object} User operation result
   */
  static async findOrCreateGoogleUser(googleProfile) {
    try {
      const { id: googleId, emails, displayName, photos } = googleProfile;
      const email = emails[0].value;
      const avatar = photos && photos[0] ? photos[0].value : null;

      // Check if user exists with Google ID
      let user = await User.findByGoogleId(googleId).populate("subscriptions");

      if (user) {
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        return { success: true, user };
      }

      // Check if user exists with same email
      user = await User.findByEmail(email).populate("subscriptions");

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        if (!user.avatar && avatar) {
          user.avatar = avatar;
        }
        user.lastLogin = new Date();
        await user.save();
        return { success: true, user };
      }

      // Create new user
      user = new User({
        email,
        googleId,
        name: displayName,
        avatar,
        signupSource: "google",
        isEmailVerified: true, // Google accounts are pre-verified
        lastLogin: new Date(),
      });

      await user.save();
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Google authentication failed",
      };
    }
  }

  /**
   * Request password reset for user
   * @param {string} email - User email
   * @returns {Object} Password reset request result
   */
  static async requestPasswordReset(email) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: "If the email exists, a reset link has been sent",
        };
      }

      // Check if user has a password (not Google OAuth only)
      if (user.googleId && !user.password) {
        return {
          success: false,
          error:
            "This account uses Google sign-in. Please use Google to log in.",
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Set reset token and expiration (1 hour)
      user.resetPasswordToken = resetTokenHash;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Send password reset email
      const emailResult = await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.name
      );

      if (!emailResult.success) {
        console.error(
          "Failed to send password reset email:",
          emailResult.error
        );
        // Don't reveal email sending failure to prevent email enumeration
      }

      // Log for development
      if (process.env.NODE_ENV === "development") {
        console.log("Password reset token for", email, ":", resetToken);
        if (emailResult.previewUrl) {
          console.log("Email preview URL:", emailResult.previewUrl);
        }
      }

      return {
        success: true,
        message: "Password reset email sent successfully",
        // In development, return the token for testing
        ...(process.env.NODE_ENV === "development" && { resetToken }),
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to process password reset request",
      };
    }
  }

  /**
   * Reset user password using reset token
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password
   * @returns {Object} Password reset result
   */
  static async resetPassword(resetToken, newPassword) {
    try {
      // Hash the token to compare with stored hash
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Find user with valid reset token
      const user = await User.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (!user) {
        return {
          success: false,
          error: "Invalid or expired reset token",
        };
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        return {
          success: false,
          error: "Password must be at least 8 characters long",
        };
      }

      // Update password and clear reset token
      user.password = newPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to reset password",
      };
    }
  }
}

export default AuthService;
