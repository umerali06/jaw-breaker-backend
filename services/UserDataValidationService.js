/**
 * UserDataValidationService - Central service for validating and repairing user data structures
 * Provides comprehensive user data validation, automatic repair, and error recovery
 */

import ValidationUtilities from "./ValidationUtilities.js";
import FeatureAccessRepairService from "./FeatureAccessRepairService.js";
import validationMonitoringService from "./ValidationMonitoringService.js";
import ValidationDebugLogger from "./ValidationDebugLogger.js";

class UserDataValidationService {
  /**
   * Comprehensive user data validation
   * @param {Object} user - User object to validate
   * @returns {Object} - { isValid: boolean, errors: string[], repaired: boolean }
   */
  static async validateUserData(user) {
    const errors = [];
    let repaired = false;

    try {
      if (!user) {
        errors.push("User object is required");
        return { isValid: false, errors, repaired };
      }

      // Validate basic user fields
      if (!user.email || !ValidationUtilities.isValidEmail(user.email)) {
        errors.push("Valid email is required");
      }

      if (user._id && !ValidationUtilities.isValidUserId(user._id.toString())) {
        errors.push("Invalid user ID format");
      }

      // Validate featureAccess structure
      const featureAccessValidation =
        ValidationUtilities.isValidFeatureAccessStructure(user.featureAccess);
      if (!featureAccessValidation.isValid) {
        errors.push(...featureAccessValidation.errors);
      }

      // Validate subscription data if present
      if (user.subscription) {
        const subscriptionValidation = this.validateSubscriptionData(
          user.subscription
        );
        if (!subscriptionValidation.isValid) {
          errors.push(...subscriptionValidation.errors);
        }
      }

      // Validate profile data if present
      if (user.profile) {
        const profileValidation = this.validateProfileData(user.profile);
        if (!profileValidation.isValid) {
          errors.push(...profileValidation.errors);
        }
      }

      const isValid = errors.length === 0;

      // Log validation results
      if (isValid) {
        ValidationUtilities.logValidationSuccess(
          "UserDataValidation",
          user._id?.toString(),
          {
            fieldsValidated: [
              "email",
              "featureAccess",
              "subscription",
              "profile",
            ],
          }
        );
      } else {
        ValidationUtilities.logValidationError(
          "UserDataValidation",
          user._id?.toString(),
          { message: "User data validation failed", errors },
          { errorCount: errors.length }
        );
      }

      return { isValid, errors, repaired };
    } catch (error) {
      ValidationUtilities.logValidationError(
        "UserDataValidation",
        user?._id?.toString(),
        error
      );

      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors, repaired };
    }
  }

  /**
   * Validate subscription data structure
   * @param {Object} subscription - Subscription object to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static validateSubscriptionData(subscription) {
    const errors = [];

    if (!subscription || typeof subscription !== "object") {
      errors.push("Subscription must be an object");
      return { isValid: false, errors };
    }

    // Validate plan type
    if (!subscription.planType || typeof subscription.planType !== "string") {
      errors.push("Subscription planType is required and must be a string");
    }

    // Validate status
    const validStatuses = [
      "active",
      "inactive",
      "cancelled",
      "past_due",
      "trialing",
    ];
    if (!subscription.status || !validStatuses.includes(subscription.status)) {
      errors.push(
        `Subscription status must be one of: ${validStatuses.join(", ")}`
      );
    }

    // Validate dates if present
    if (subscription.startDate && !(subscription.startDate instanceof Date)) {
      errors.push("Subscription startDate must be a valid Date");
    }

    if (subscription.endDate && !(subscription.endDate instanceof Date)) {
      errors.push("Subscription endDate must be a valid Date");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate profile data structure
   * @param {Object} profile - Profile object to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static validateProfileData(profile) {
    const errors = [];

    if (!profile || typeof profile !== "object") {
      errors.push("Profile must be an object");
      return { isValid: false, errors };
    }

    // Validate name fields if present
    if (profile.firstName && typeof profile.firstName !== "string") {
      errors.push("Profile firstName must be a string");
    }

    if (profile.lastName && typeof profile.lastName !== "string") {
      errors.push("Profile lastName must be a string");
    }

    // Validate phone if present
    if (profile.phone && typeof profile.phone !== "string") {
      errors.push("Profile phone must be a string");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Sanitize user fields to ensure data integrity
   * @param {Object} user - User object to sanitize
   * @returns {Object} - Sanitized user object (modified in place)
   */
  static sanitizeUserFields(user) {
    if (!user) return user;

    try {
      // Sanitize email
      if (user.email && typeof user.email === "string") {
        user.email = user.email.trim().toLowerCase();
      }

      // Sanitize profile fields
      if (user.profile) {
        if (user.profile.firstName) {
          user.profile.firstName = ValidationUtilities.sanitizeString(
            user.profile.firstName,
            50
          );
        }
        if (user.profile.lastName) {
          user.profile.lastName = ValidationUtilities.sanitizeString(
            user.profile.lastName,
            50
          );
        }
        if (user.profile.phone) {
          user.profile.phone = ValidationUtilities.sanitizeString(
            user.profile.phone,
            20
          );
        }
      }

      // Ensure timestamps are valid dates
      if (user.createdAt && !(user.createdAt instanceof Date)) {
        user.createdAt = new Date(user.createdAt);
      }

      if (user.updatedAt && !(user.updatedAt instanceof Date)) {
        user.updatedAt = new Date(user.updatedAt);
      }

      ValidationUtilities.logValidationSuccess(
        "UserDataSanitization",
        user._id?.toString(),
        { sanitizedFields: ["email", "profile", "timestamps"] }
      );

      return user;
    } catch (error) {
      ValidationUtilities.logValidationError(
        "UserDataSanitization",
        user._id?.toString(),
        error
      );
      return user;
    }
  }

  /**
   * Combined validation and repair operation
   * @param {Object} user - User object to validate and repair
   * @returns {Object} - { user: Object, wasRepaired: boolean, errors: string[] }
   */
  static async validateAndRepairUser(user) {
    const allErrors = [];
    let wasRepaired = false;

    // Start monitoring and debug tracking
    const endTracking = validationMonitoringService.startValidationTracking(
      "validateAndRepairUser",
      user?._id?.toString(),
      { hasFeatureAccess: !!user?.featureAccess }
    );

    const debugSession = ValidationDebugLogger.createSession(
      `repair_${Date.now()}`,
      user?._id?.toString(),
      "validateAndRepairUser"
    );

    try {
      if (!user) {
        throw new Error("User object is required");
      }

      debugSession.logStep("validation_start", user, {
        operation: "validateAndRepairUser",
      });

      // Create backup before making changes
      const originalFeatureAccess = FeatureAccessRepairService.createBackup(
        user.featureAccess
      );

      // Step 1: Sanitize user fields
      this.sanitizeUserFields(user);

      // Step 2: Initial validation
      const initialValidation = await this.validateUserData(user);
      allErrors.push(...initialValidation.errors);

      // Step 3: Repair featureAccess if needed
      if (user.featureAccess) {
        const repairResult =
          await FeatureAccessRepairService.repairFeatureAccess(user);
        if (repairResult.success && repairResult.changes.length > 0) {
          wasRepaired = true;

          // Validate after repair
          const postRepairValidation = await this.validateUserData(user);
          if (!postRepairValidation.isValid) {
            // If still invalid after repair, restore backup and log error
            FeatureAccessRepairService.restoreFromBackup(
              user,
              originalFeatureAccess
            );
            allErrors.push("Failed to repair user data - restored from backup");
            wasRepaired = false;
          } else {
            // Clear previous featureAccess errors since they were fixed
            const featureAccessErrorCount = allErrors.filter((error) =>
              error.includes("featureAccess")
            ).length;
            if (featureAccessErrorCount > 0) {
              allErrors.splice(0, allErrors.length);
            }
          }
        }
      } else {
        // Initialize featureAccess if completely missing
        user.featureAccess =
          FeatureAccessRepairService.getDefaultFeatureAccess();
        wasRepaired = true;
      }

      // Step 4: Apply fallback defaults if still invalid
      if (allErrors.length > 0 && !wasRepaired) {
        const fallbackResult = await this.applyFallbackDefaults(user);
        if (fallbackResult.applied) {
          wasRepaired = true;
          // Re-validate after applying fallbacks
          const finalValidation = await this.validateUserData(user);
          if (finalValidation.isValid) {
            allErrors.splice(0, allErrors.length); // Clear errors if now valid
          }
        }
      }

      // Log final results
      if (wasRepaired) {
        ValidationUtilities.logValidationSuccess(
          "UserDataValidationAndRepair",
          user._id?.toString(),
          {
            wasRepaired,
            remainingErrors: allErrors.length,
            errors: allErrors,
          }
        );
      }

      const result = {
        user,
        wasRepaired,
        errors: allErrors,
        success: allErrors.length === 0,
      };

      // Complete monitoring and debug tracking
      endTracking(result);
      debugSession.complete(result);

      return result;
    } catch (error) {
      ValidationUtilities.logValidationError(
        "UserDataValidationAndRepair",
        user?._id?.toString(),
        error,
        { wasRepaired, errorCount: allErrors.length }
      );

      allErrors.push(`Validation and repair error: ${error.message}`);
      return {
        user,
        wasRepaired,
        errors: allErrors,
      };
    }
  }

  /**
   * Apply fallback defaults when automatic repair fails
   * @param {Object} user - User object to apply defaults to
   * @returns {Object} - { applied: boolean, changes: string[] }
   */
  static async applyFallbackDefaults(user) {
    const changes = [];
    let applied = false;

    try {
      if (!user) {
        throw new Error("User object is required");
      }

      // Apply default featureAccess
      if (!user.featureAccess || typeof user.featureAccess !== "object") {
        user.featureAccess =
          FeatureAccessRepairService.getDefaultFeatureAccess();
        changes.push("Applied default featureAccess structure");
        applied = true;
      }

      // Ensure basic subscription structure if missing
      if (!user.subscription) {
        user.subscription = {
          planType: "free",
          status: "active",
          startDate: new Date(),
          features: [],
        };
        changes.push("Applied default subscription structure");
        applied = true;
      }

      // Ensure basic profile structure if missing
      if (!user.profile) {
        user.profile = {
          firstName: "",
          lastName: "",
          createdAt: new Date(),
        };
        changes.push("Applied default profile structure");
        applied = true;
      }

      if (applied) {
        ValidationUtilities.logValidationSuccess(
          "FallbackDefaults",
          user._id?.toString(),
          { changes }
        );
      }

      return { applied, changes };
    } catch (error) {
      ValidationUtilities.logValidationError(
        "FallbackDefaults",
        user?._id?.toString(),
        error,
        { changes }
      );

      return { applied: false, changes, error: error.message };
    }
  }

  /**
   * Classify validation errors by severity
   * @param {Array} errors - Array of error messages
   * @returns {Object} - { critical: Array, warning: Array, info: Array }
   */
  static classifyErrors(errors) {
    const classification = {
      critical: [],
      warning: [],
      info: [],
    };

    errors.forEach((error) => {
      const errorLower = error.toLowerCase();

      if (
        errorLower.includes("required") ||
        errorLower.includes("missing") ||
        errorLower.includes("invalid user id")
      ) {
        classification.critical.push(error);
      } else if (
        errorLower.includes("format") ||
        errorLower.includes("type") ||
        errorLower.includes("structure")
      ) {
        classification.warning.push(error);
      } else {
        classification.info.push(error);
      }
    });

    return classification;
  }

  /**
   * Get validation statistics for monitoring
   * @param {Object} validationResult - Result from validateAndRepairUser
   * @returns {Object} - Statistics about the validation operation
   */
  static getValidationStatistics(validationResult) {
    const errorClassification = this.classifyErrors(validationResult.errors);

    return {
      wasRepaired: validationResult.wasRepaired,
      totalErrors: validationResult.errors.length,
      criticalErrors: errorClassification.critical.length,
      warningErrors: errorClassification.warning.length,
      infoErrors: errorClassification.info.length,
      isHealthy: validationResult.errors.length === 0,
      needsAttention: errorClassification.critical.length > 0,
    };
  }
}
export default UserDataValidationService;
