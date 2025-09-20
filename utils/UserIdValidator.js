import mongoose from "mongoose";

/**
 * Utility class for handling user ID validation and normalization
 * Handles both ObjectId and string formats consistently across the application
 */
class UserIdValidator {
  /**
   * Validates and normalizes a user ID
   * @param {string|ObjectId} userId - User ID to validate
   * @returns {string} Normalized user ID string
   * @throws {Error} If user ID is invalid
   */
  static validate(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Handle ObjectId instances
    if (mongoose.Types.ObjectId.isValid(userId)) {
      return userId.toString();
    }

    // Handle string format
    if (typeof userId === "string") {
      const trimmed = userId.trim();

      if (trimmed.length === 0) {
        throw new Error("User ID cannot be empty");
      }

      // Check if it's a valid ObjectId string
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        return trimmed;
      }

      // For non-ObjectId strings, validate basic format
      if (trimmed.length >= 3 && trimmed.length <= 50) {
        // Additional validation for string format
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
          throw new Error("User ID contains invalid characters");
        }
        return trimmed;
      }
    }

    throw new Error("Invalid user ID format");
  }

  /**
   * Checks if a user ID is valid without throwing an error
   * @param {string|ObjectId} userId - User ID to check
   * @returns {boolean} True if valid, false otherwise
   */
  static isValid(userId) {
    try {
      this.validate(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalizes a user ID to string format
   * @param {string|ObjectId} userId - User ID to normalize
   * @returns {string|null} Normalized user ID or null if invalid
   */
  static normalize(userId) {
    try {
      return this.validate(userId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Validates multiple user IDs at once
   * @param {Array} userIds - Array of user IDs to validate
   * @returns {Object} Object with valid and invalid user IDs
   */
  static validateMultiple(userIds) {
    if (!Array.isArray(userIds)) {
      throw new Error("User IDs must be provided as an array");
    }

    const result = {
      valid: [],
      invalid: [],
      errors: [],
    };

    userIds.forEach((userId, index) => {
      try {
        const normalized = this.validate(userId);
        result.valid.push(normalized);
      } catch (error) {
        result.invalid.push(userId);
        result.errors.push({
          index,
          userId,
          error: error.message,
        });
      }
    });

    return result;
  }

  /**
   * Converts a user ID to ObjectId format if possible
   * @param {string|ObjectId} userId - User ID to convert
   * @returns {ObjectId|null} ObjectId instance or null if not convertible
   */
  static toObjectId(userId) {
    try {
      const normalized = this.validate(userId);
      if (mongoose.Types.ObjectId.isValid(normalized)) {
        return new mongoose.Types.ObjectId(normalized);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if a user ID is in ObjectId format
   * @param {string|ObjectId} userId - User ID to check
   * @returns {boolean} True if ObjectId format, false otherwise
   */
  static isObjectIdFormat(userId) {
    if (!userId) return false;

    const userIdStr = userId.toString();
    return (
      mongoose.Types.ObjectId.isValid(userIdStr) && userIdStr.length === 24
    );
  }

  /**
   * Sanitizes user ID for database queries
   * @param {string|ObjectId} userId - User ID to sanitize
   * @returns {string} Sanitized user ID
   */
  static sanitizeForQuery(userId) {
    const normalized = this.validate(userId);

    // Escape special regex characters if present
    return normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Generates a validation schema for user ID fields
   * @returns {Object} Mongoose validation schema
   */
  static getValidationSchema() {
    return {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return UserIdValidator.isValid(value);
        },
        message: "Invalid user ID format",
      },
      set: function (value) {
        return UserIdValidator.normalize(value);
      },
    };
  }
}

export default UserIdValidator;
