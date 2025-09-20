/**
 * FeatureAccessRepairService - Specialized service for repairing featureAccess data structures
 * Handles automatic repair of corrupted or invalid featureAccess data
 */

import ValidationUtilities from "./ValidationUtilities.js";

class FeatureAccessRepairService {
  /**
   * Get default limits configuration
   * @returns {Object} - Default limits object
   */
  static getDefaultLimits() {
    return {
      fileUploads: 10,
      storageGB: 1,
      analysisRequests: 5,
      teamMembers: 0,
      apiCalls: 0,
    };
  }

  /**
   * Get default features array
   * @returns {Array} - Default empty features array
   */
  static getDefaultFeatures() {
    return [];
  }

  /**
   * Get complete default featureAccess structure
   * @returns {Object} - Default featureAccess object
   */
  static getDefaultFeatureAccess() {
    return {
      lastUpdated: new Date(),
      features: this.getDefaultFeatures(),
      limits: this.getDefaultLimits(),
    };
  }

  /**
   * Repair limits structure in featureAccess
   * @param {Object} featureAccess - The featureAccess object to repair
   * @returns {Object} - { repaired: boolean, changes: string[] }
   */
  static repairLimitsStructure(featureAccess) {
    const changes = [];
    let repaired = false;

    if (!featureAccess) {
      throw new Error("featureAccess object is required");
    }

    // Initialize limits if missing or invalid
    if (!featureAccess.limits || typeof featureAccess.limits !== "object") {
      featureAccess.limits = {};
      changes.push("Initialized missing limits object");
      repaired = true;
    }

    const defaultLimits = this.getDefaultLimits();

    // Check and repair each limit field
    Object.keys(defaultLimits).forEach((field) => {
      const currentValue = featureAccess.limits[field];
      const defaultValue = defaultLimits[field];

      if (currentValue === undefined || currentValue === null) {
        featureAccess.limits[field] = defaultValue;
        changes.push(
          `Set missing limits.${field} to default value: ${defaultValue}`
        );
        repaired = true;
      } else if (!ValidationUtilities.isValidNumericLimit(currentValue)) {
        // Try to repair invalid values
        const repairedValue = ValidationUtilities.ensureNumericValue(
          currentValue,
          defaultValue
        );
        if (repairedValue !== currentValue) {
          featureAccess.limits[field] = repairedValue;
          changes.push(
            `Repaired invalid limits.${field} from ${currentValue} to ${repairedValue}`
          );
          repaired = true;
        }
      }
    });

    // Remove any unknown fields in limits
    Object.keys(featureAccess.limits).forEach((field) => {
      if (!defaultLimits.hasOwnProperty(field)) {
        delete featureAccess.limits[field];
        changes.push(`Removed unknown field limits.${field}`);
        repaired = true;
      }
    });

    return { repaired, changes };
  }

  /**
   * Repair features array in featureAccess
   * @param {Object} featureAccess - The featureAccess object to repair
   * @returns {Object} - { repaired: boolean, changes: string[] }
   */
  static repairFeaturesArray(featureAccess) {
    const changes = [];
    let repaired = false;

    if (!featureAccess) {
      throw new Error("featureAccess object is required");
    }

    // Initialize features if missing or invalid
    if (!Array.isArray(featureAccess.features)) {
      const originalValue = featureAccess.features;
      featureAccess.features = this.getDefaultFeatures();
      changes.push(
        `Repaired invalid features array from ${typeof originalValue} to empty array`
      );
      repaired = true;
    } else {
      // Clean up invalid entries in features array
      const originalLength = featureAccess.features.length;
      featureAccess.features = featureAccess.features.filter(
        (feature, index) => {
          if (typeof feature !== "string") {
            changes.push(
              `Removed invalid feature at index ${index}: ${feature} (not a string)`
            );
            return false;
          }
          return true;
        }
      );

      if (featureAccess.features.length !== originalLength) {
        repaired = true;
      }

      // Remove duplicates
      const uniqueFeatures = [...new Set(featureAccess.features)];
      if (uniqueFeatures.length !== featureAccess.features.length) {
        featureAccess.features = uniqueFeatures;
        changes.push("Removed duplicate features from array");
        repaired = true;
      }
    }

    return { repaired, changes };
  }

  /**
   * Update lastUpdated timestamp in featureAccess
   * @param {Object} featureAccess - The featureAccess object to update
   * @returns {Object} - { updated: boolean, timestamp: Date }
   */
  static updateLastUpdatedTimestamp(featureAccess) {
    if (!featureAccess) {
      throw new Error("featureAccess object is required");
    }

    const newTimestamp = new Date();
    const wasUpdated =
      !featureAccess.lastUpdated ||
      !(featureAccess.lastUpdated instanceof Date) ||
      featureAccess.lastUpdated.getTime() !== newTimestamp.getTime();

    featureAccess.lastUpdated = newTimestamp;

    return { updated: wasUpdated, timestamp: newTimestamp };
  }

  /**
   * Comprehensive repair of entire featureAccess structure
   * @param {Object} user - User object containing featureAccess
   * @returns {Object} - { success: boolean, changes: string[], user: Object }
   */
  static async repairFeatureAccess(user) {
    const allChanges = [];
    let totalRepaired = false;

    try {
      if (!user) {
        throw new Error("User object is required");
      }

      // Initialize featureAccess if completely missing
      if (!user.featureAccess || typeof user.featureAccess !== "object") {
        user.featureAccess = this.getDefaultFeatureAccess();
        allChanges.push(
          "Initialized missing featureAccess object with defaults"
        );
        totalRepaired = true;
      } else {
        // Repair limits structure
        const limitsRepair = this.repairLimitsStructure(user.featureAccess);
        if (limitsRepair.repaired) {
          allChanges.push(...limitsRepair.changes);
          totalRepaired = true;
        }

        // Repair features array
        const featuresRepair = this.repairFeaturesArray(user.featureAccess);
        if (featuresRepair.repaired) {
          allChanges.push(...featuresRepair.changes);
          totalRepaired = true;
        }

        // Update timestamp if any repairs were made
        if (totalRepaired) {
          const timestampUpdate = this.updateLastUpdatedTimestamp(
            user.featureAccess
          );
          if (timestampUpdate.updated) {
            allChanges.push(
              `Updated lastUpdated timestamp to ${timestampUpdate.timestamp.toISOString()}`
            );
          }
        }
      }

      // Log repair operation
      if (totalRepaired) {
        ValidationUtilities.logValidationSuccess(
          "FeatureAccessRepair",
          user._id?.toString(),
          {
            changesCount: allChanges.length,
            changes: allChanges,
          }
        );
      }

      return {
        success: true,
        changes: allChanges,
        user: user,
      };
    } catch (error) {
      ValidationUtilities.logValidationError(
        "FeatureAccessRepair",
        user?._id?.toString(),
        error,
        { changes: allChanges }
      );

      return {
        success: false,
        changes: allChanges,
        user: user,
        error: error.message,
      };
    }
  }

  /**
   * Validate featureAccess structure after repair
   * @param {Object} featureAccess - The featureAccess object to validate
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  static validateRepairedFeatureAccess(featureAccess) {
    return ValidationUtilities.isValidFeatureAccessStructure(featureAccess);
  }

  /**
   * Create a backup of featureAccess before repair
   * @param {Object} featureAccess - The featureAccess object to backup
   * @returns {Object} - Deep clone of the original featureAccess
   */
  static createBackup(featureAccess) {
    return ValidationUtilities.deepClone(featureAccess);
  }

  /**
   * Restore featureAccess from backup
   * @param {Object} user - User object to restore
   * @param {Object} backup - Backup to restore from
   * @returns {Object} - { restored: boolean, user: Object }
   */
  static restoreFromBackup(user, backup) {
    try {
      if (!user || !backup) {
        throw new Error("User and backup objects are required");
      }

      user.featureAccess = ValidationUtilities.deepClone(backup);

      return {
        restored: true,
        user: user,
      };
    } catch (error) {
      ValidationUtilities.logValidationError(
        "FeatureAccessRestore",
        user?._id?.toString(),
        error
      );

      return {
        restored: false,
        user: user,
        error: error.message,
      };
    }
  }

  /**
   * Get repair statistics for monitoring
   * @param {Array} changes - Array of change descriptions
   * @returns {Object} - Statistics about the repair operation
   */
  static getRepairStatistics(changes) {
    const stats = {
      totalChanges: changes.length,
      limitsRepairs: 0,
      featuresRepairs: 0,
      structureRepairs: 0,
      timestampUpdates: 0,
    };

    changes.forEach((change) => {
      if (change.includes("limits.")) {
        stats.limitsRepairs++;
      } else if (change.includes("features")) {
        stats.featuresRepairs++;
      } else if (change.includes("Initialized")) {
        stats.structureRepairs++;
      } else if (change.includes("timestamp")) {
        stats.timestampUpdates++;
      }
    });

    return stats;
  }
}
export default FeatureAccessRepairService;
