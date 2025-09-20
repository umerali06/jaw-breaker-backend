/**
 * ValidationUtilities - Reusable validation functions for consistent data checking
 * Provides comprehensive validation and sanitization methods for user data
 */

class ValidationUtilities {
  /**
   * Check if featureAccess structure is valid
   * @param {Object} featureAccess - The featureAccess object to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static isValidFeatureAccessStructure(featureAccess) {
    const errors = [];

    if (!featureAccess || typeof featureAccess !== "object") {
      errors.push("featureAccess must be an object");
      return { isValid: false, errors };
    }

    // Check lastUpdated
    if (
      !featureAccess.lastUpdated ||
      !(featureAccess.lastUpdated instanceof Date)
    ) {
      errors.push("featureAccess.lastUpdated must be a valid Date");
    }

    // Check features array
    if (!this.isValidFeaturesArray(featureAccess.features).isValid) {
      errors.push("featureAccess.features must be a valid array");
    }

    // Check limits object
    if (!this.isValidLimitsObject(featureAccess.limits).isValid) {
      errors.push(
        "featureAccess.limits must be a valid object with proper structure"
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate limits object structure and values
   * @param {Object} limits - The limits object to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static isValidLimitsObject(limits) {
    const errors = [];
    const requiredFields = [
      "fileUploads",
      "storageGB",
      "analysisRequests",
      "teamMembers",
      "apiCalls",
    ];

    if (!limits || typeof limits !== "object") {
      errors.push("limits must be an object");
      return { isValid: false, errors };
    }

    // Check all required fields exist and are valid numbers
    requiredFields.forEach((field) => {
      if (limits[field] === undefined || limits[field] === null) {
        errors.push(`limits.${field} is required`);
      } else if (!this.isValidNumericLimit(limits[field])) {
        errors.push(
          `limits.${field} must be a non-negative number or -1 for unlimited`
        );
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate features array
   * @param {Array} features - The features array to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static isValidFeaturesArray(features) {
    const errors = [];

    if (!Array.isArray(features)) {
      errors.push("features must be an array");
      return { isValid: false, errors };
    }

    // Check that all elements are strings
    features.forEach((feature, index) => {
      if (typeof feature !== "string") {
        errors.push(`features[${index}] must be a string`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Check if a numeric value is valid for limits
   * @param {*} value - Value to check
   * @returns {boolean} - True if valid numeric limit
   */
  static isValidNumericLimit(value) {
    return typeof value === "number" && (value >= 0 || value === -1);
  }

  /**
   * Sanitize string value with optional max length
   * @param {*} value - Value to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} - Sanitized string
   */
  static sanitizeString(value, maxLength = 255) {
    if (typeof value !== "string") {
      return "";
    }

    // Remove potentially dangerous characters and trim
    let sanitized = value.trim().replace(/[<>\"'&]/g, "");

    // Truncate if too long
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Ensure a value is numeric with fallback to default
   * @param {*} value - Value to check
   * @param {number} defaultValue - Default value if invalid
   * @returns {number} - Valid numeric value
   */
  static ensureNumericValue(value, defaultValue = 0) {
    if (typeof value === "number" && !isNaN(value)) {
      return value;
    }

    // Try to parse as number
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }

    return defaultValue;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid email format
   */
  static isValidEmail(email) {
    if (typeof email !== "string") return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate user ID format (MongoDB ObjectId)
   * @param {string} userId - User ID to validate
   * @returns {boolean} - True if valid ObjectId format
   */
  static isValidUserId(userId) {
    if (typeof userId !== "string") return false;

    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(userId);
  }

  /**
   * Deep clone an object safely
   * @param {Object} obj - Object to clone
   * @returns {Object} - Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map((item) => this.deepClone(item));

    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Log validation error with context
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} error - Error details
   * @param {Object} context - Additional context
   */
  static logValidationError(operation, userId, error, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      operation,
      userId: userId || "unknown",
      error: {
        message: error.message || error,
        field: error.field || "unknown",
        value: error.value || "unknown",
        expectedType: error.expectedType || "unknown",
      },
      context,
    };

    console.error(
      "[ValidationUtilities] Validation Error:",
      JSON.stringify(logData, null, 2)
    );
  }

  /**
   * Log validation success with context
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} context - Additional context
   */
  static logValidationSuccess(operation, userId, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      operation,
      userId: userId || "unknown",
      context,
    };

    console.log(
      "[ValidationUtilities] Validation Success:",
      JSON.stringify(logData, null, 2)
    );
  }

  /**
   * Create a standardized validation error object
   * @param {string} field - Field that failed validation
   * @param {*} value - Invalid value
   * @param {string} expectedType - Expected data type
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code for programmatic handling
   * @param {string} severity - Error severity level
   * @returns {Object} - Standardized error object
   */
  static createValidationError(
    field,
    value,
    expectedType,
    message,
    code = "VALIDATION_ERROR",
    severity = "error"
  ) {
    return {
      field,
      value,
      expectedType,
      message,
      code,
      severity,
      timestamp: new Date(),
      repaired: false,
    };
  }
}

export default ValidationUtilities;
