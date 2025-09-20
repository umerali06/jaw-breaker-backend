/**
 * BulkUserDataRepair - Utilities for bulk user data repair and migration
 * Handles large-scale data repair operations with progress tracking and rollback capabilities
 */

import mongoose from "mongoose";
import User from "../models/User.js";
import UserDataValidationService from "../services/UserDataValidationService.js";
import FeatureAccessRepairService from "../services/FeatureAccessRepairService.js";
import ValidationUtilities from "../services/ValidationUtilities.js";
import validationMonitoringService from "../services/ValidationMonitoringService.js";

class BulkUserDataRepair {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 100,
      maxConcurrency: options.maxConcurrency || 5,
      enableRollback: options.enableRollback !== false,
      dryRun: options.dryRun || false,
      progressCallback: options.progressCallback || null,
      errorCallback: options.errorCallback || null,
      ...options,
    };

    this.stats = {
      totalUsers: 0,
      processedUsers: 0,
      repairedUsers: 0,
      failedUsers: 0,
      skippedUsers: 0,
      startTime: null,
      endTime: null,
      errors: [],
      rollbackData: new Map(),
    };
  }

  /**
   * Repair all users with corrupted featureAccess data
   * @param {Object} criteria - MongoDB query criteria for selecting users
   * @returns {Object} - Repair operation results
   */
  async repairAllUsers(criteria = {}) {
    this.stats.startTime = Date.now();

    try {
      ValidationUtilities.logValidationSuccess("BulkUserDataRepair", "system", {
        action: "Starting bulk user data repair",
        criteria,
        options: this.options,
      });

      // Get total count for progress tracking
      this.stats.totalUsers = await User.countDocuments(criteria);

      if (this.stats.totalUsers === 0) {
        return this.completeOperation("No users found matching criteria");
      }

      // Process users in batches
      let skip = 0;
      const results = [];

      while (skip < this.stats.totalUsers) {
        const batch = await User.find(criteria)
          .skip(skip)
          .limit(this.options.batchSize)
          .lean();

        if (batch.length === 0) break;

        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);

        skip += this.options.batchSize;

        // Report progress
        this.reportProgress();

        // Small delay to prevent overwhelming the database
        await this.delay(100);
      }

      return this.completeOperation(
        "Bulk repair completed successfully",
        results
      );
    } catch (error) {
      ValidationUtilities.logValidationError(
        "BulkUserDataRepair",
        "system",
        error,
        { stats: this.stats }
      );

      return this.completeOperation(
        `Bulk repair failed: ${error.message}`,
        [],
        error
      );
    }
  }

  /**
   * Process a batch of users
   * @param {Array} userBatch - Batch of user documents
   * @returns {Array} - Batch processing results
   */
  async processBatch(userBatch) {
    const batchPromises = userBatch.map((userData) =>
      this.processUser(userData).catch((error) => ({
        userId: userData._id,
        success: false,
        error: error.message,
      }))
    );

    // Process with concurrency limit
    const results = [];
    for (
      let i = 0;
      i < batchPromises.length;
      i += this.options.maxConcurrency
    ) {
      const chunk = batchPromises.slice(i, i + this.options.maxConcurrency);
      const chunkResults = await Promise.all(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Process a single user
   * @param {Object} userData - User data from database
   * @returns {Object} - Processing result
   */
  async processUser(userData) {
    const userId = userData._id.toString();

    try {
      // Create backup if rollback is enabled
      if (this.options.enableRollback) {
        this.stats.rollbackData.set(userId, {
          originalData: ValidationUtilities.deepClone(userData),
          timestamp: Date.now(),
        });
      }

      // Validate current data
      const validationResult = await UserDataValidationService.validateUserData(
        userData
      );

      if (validationResult.isValid) {
        this.stats.skippedUsers++;
        return {
          userId,
          success: true,
          action: "skipped",
          reason: "Data already valid",
        };
      }

      // Perform repair
      const repairResult =
        await UserDataValidationService.validateAndRepairUser(userData);

      if (!repairResult.wasRepaired) {
        this.stats.skippedUsers++;
        return {
          userId,
          success: true,
          action: "skipped",
          reason: "No repair needed",
        };
      }

      // Save repaired data (unless dry run)
      if (!this.options.dryRun) {
        const user = await User.findById(userId);
        if (user) {
          // Apply repairs to the actual user document
          Object.assign(user, repairResult.user);
          await user.save();
        }
      }

      this.stats.repairedUsers++;
      this.stats.processedUsers++;

      return {
        userId,
        success: true,
        action: "repaired",
        changes: repairResult.changes || [],
        errorsFixed: validationResult.errors.length,
        dryRun: this.options.dryRun,
      };
    } catch (error) {
      this.stats.failedUsers++;
      this.stats.processedUsers++;
      this.stats.errors.push({
        userId,
        error: error.message,
        timestamp: Date.now(),
      });

      if (this.options.errorCallback) {
        this.options.errorCallback(userId, error);
      }

      return {
        userId,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Repair users with specific validation errors
   * @param {Array} errorPatterns - Array of error patterns to match
   * @returns {Object} - Repair operation results
   */
  async repairUsersByErrorPattern(errorPatterns) {
    const criteria = await this.buildCriteriaForErrorPatterns(errorPatterns);
    return this.repairAllUsers(criteria);
  }

  /**
   * Build MongoDB criteria for users with specific error patterns
   * @param {Array} errorPatterns - Error patterns to match
   * @returns {Object} - MongoDB query criteria
   */
  async buildCriteriaForErrorPatterns(errorPatterns) {
    // This is a simplified approach - in practice, you might need more sophisticated querying
    const criteria = { $or: [] };

    for (const pattern of errorPatterns) {
      switch (pattern) {
        case "missing_feature_access":
          criteria.$or.push({ featureAccess: { $exists: false } });
          break;
        case "invalid_limits":
          criteria.$or.push({
            $or: [
              { "featureAccess.limits": { $exists: false } },
              { "featureAccess.limits": null },
              { "featureAccess.limits.fileUploads": { $type: "string" } },
              { "featureAccess.limits.storageGB": { $lt: 0, $ne: -1 } },
            ],
          });
          break;
        case "invalid_features":
          criteria.$or.push({
            $or: [
              { "featureAccess.features": { $not: { $type: "array" } } },
              { "featureAccess.features": { $exists: false } },
            ],
          });
          break;
        default:
          // Generic pattern matching
          break;
      }
    }

    return criteria.$or.length > 0 ? criteria : {};
  }

  /**
   * Rollback repairs for specific users
   * @param {Array} userIds - Array of user IDs to rollback
   * @returns {Object} - Rollback operation results
   */
  async rollbackRepairs(userIds = []) {
    if (!this.options.enableRollback) {
      throw new Error("Rollback is not enabled for this repair operation");
    }

    const rollbackResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (const userId of userIds) {
      try {
        const rollbackData = this.stats.rollbackData.get(userId);

        if (!rollbackData) {
          rollbackResults.push({
            userId,
            success: false,
            error: "No rollback data available",
          });
          failureCount++;
          continue;
        }

        // Restore original data
        const user = await User.findById(userId);
        if (user) {
          Object.assign(user, rollbackData.originalData);
          await user.save();

          rollbackResults.push({
            userId,
            success: true,
            restoredAt: new Date().toISOString(),
          });
          successCount++;
        } else {
          rollbackResults.push({
            userId,
            success: false,
            error: "User not found",
          });
          failureCount++;
        }
      } catch (error) {
        rollbackResults.push({
          userId,
          success: false,
          error: error.message,
        });
        failureCount++;
      }
    }

    ValidationUtilities.logValidationSuccess("BulkUserDataRepair", "system", {
      action: "Rollback completed",
      successCount,
      failureCount,
      totalUsers: userIds.length,
    });

    return {
      success: true,
      results: rollbackResults,
      summary: {
        totalUsers: userIds.length,
        successCount,
        failureCount,
      },
    };
  }

  /**
   * Generate migration script for specific data transformations
   * @param {string} scriptType - Type of migration script
   * @param {Object} options - Script generation options
   * @returns {string} - Generated migration script
   */
  generateMigrationScript(scriptType, options = {}) {
    const scripts = {
      featureAccessInit: this.generateFeatureAccessInitScript(options),
      limitsRepair: this.generateLimitsRepairScript(options),
      featuresArrayFix: this.generateFeaturesArrayFixScript(options),
      bulkValidation: this.generateBulkValidationScript(options),
    };

    return scripts[scriptType] || "// Unknown script type";
  }

  /**
   * Generate feature access initialization script
   * @param {Object} options - Script options
   * @returns {string} - MongoDB script
   */
  generateFeatureAccessInitScript(options) {
    return `
// Feature Access Initialization Script
// Generated on: ${new Date().toISOString()}

db.users.updateMany(
  { featureAccess: { $exists: false } },
  {
    $set: {
      featureAccess: {
        lastUpdated: new Date(),
        features: [],
        limits: {
          fileUploads: 10,
          storageGB: 1,
          analysisRequests: 5,
          teamMembers: 0,
          apiCalls: 0
        }
      }
    }
  }
);

// Verify the update
print("Users updated:", db.users.countDocuments({ featureAccess: { $exists: true } }));
`;
  }

  /**
   * Generate limits repair script
   * @param {Object} options - Script options
   * @returns {string} - MongoDB script
   */
  generateLimitsRepairScript(options) {
    return `
// Limits Repair Script
// Generated on: ${new Date().toISOString()}

// Fix missing or invalid limits
db.users.updateMany(
  {
    $or: [
      { "featureAccess.limits": { $exists: false } },
      { "featureAccess.limits": null },
      { "featureAccess.limits.fileUploads": { $not: { $type: "number" } } },
      { "featureAccess.limits.storageGB": { $not: { $type: "number" } } }
    ]
  },
  [
    {
      $set: {
        "featureAccess.limits": {
          fileUploads: {
            $cond: {
              if: { $and: [{ $type: ["$featureAccess.limits.fileUploads", "number"] }, { $gte: ["$featureAccess.limits.fileUploads", 0] }] },
              then: "$featureAccess.limits.fileUploads",
              else: 10
            }
          },
          storageGB: {
            $cond: {
              if: { $and: [{ $type: ["$featureAccess.limits.storageGB", "number"] }, { $gte: ["$featureAccess.limits.storageGB", 0] }] },
              then: "$featureAccess.limits.storageGB",
              else: 1
            }
          },
          analysisRequests: {
            $cond: {
              if: { $and: [{ $type: ["$featureAccess.limits.analysisRequests", "number"] }, { $gte: ["$featureAccess.limits.analysisRequests", 0] }] },
              then: "$featureAccess.limits.analysisRequests",
              else: 5
            }
          },
          teamMembers: {
            $cond: {
              if: { $and: [{ $type: ["$featureAccess.limits.teamMembers", "number"] }, { $gte: ["$featureAccess.limits.teamMembers", 0] }] },
              then: "$featureAccess.limits.teamMembers",
              else: 0
            }
          },
          apiCalls: {
            $cond: {
              if: { $and: [{ $type: ["$featureAccess.limits.apiCalls", "number"] }, { $gte: ["$featureAccess.limits.apiCalls", 0] }] },
              then: "$featureAccess.limits.apiCalls",
              else: 0
            }
          }
        },
        "featureAccess.lastUpdated": new Date()
      }
    }
  ]
);

print("Limits repair completed");
`;
  }

  /**
   * Generate features array fix script
   * @param {Object} options - Script options
   * @returns {string} - MongoDB script
   */
  generateFeaturesArrayFixScript(options) {
    return `
// Features Array Fix Script
// Generated on: ${new Date().toISOString()}

// Fix non-array features
db.users.updateMany(
  { "featureAccess.features": { $not: { $type: "array" } } },
  {
    $set: {
      "featureAccess.features": [],
      "featureAccess.lastUpdated": new Date()
    }
  }
);

// Remove non-string elements from features arrays
db.users.updateMany(
  { "featureAccess.features": { $type: "array" } },
  [
    {
      $set: {
        "featureAccess.features": {
          $filter: {
            input: "$featureAccess.features",
            cond: { $type: ["$$this", "string"] }
          }
        },
        "featureAccess.lastUpdated": new Date()
      }
    }
  ]
);

print("Features array fix completed");
`;
  }

  /**
   * Generate bulk validation script
   * @param {Object} options - Script options
   * @returns {string} - Node.js script
   */
  generateBulkValidationScript(options) {
    return `
// Bulk Validation Script
// Generated on: ${new Date().toISOString()}
// Run with: node bulk-validation.js

const { BulkUserDataRepair } = require('./utils/BulkUserDataRepair');

async function runBulkValidation() {
  const repair = new BulkUserDataRepair({
    batchSize: ${options.batchSize || 100},
    maxConcurrency: ${options.maxConcurrency || 5},
    dryRun: ${options.dryRun || false},
    enableRollback: true,
    progressCallback: (stats) => {
      console.log(\`Progress: \${stats.processedUsers}/\${stats.totalUsers} users processed\`);
    }
  });

  try {
    const result = await repair.repairAllUsers();
    console.log('Bulk validation completed:', result);
  } catch (error) {
    console.error('Bulk validation failed:', error);
  }
}

runBulkValidation();
`;
  }

  /**
   * Report progress to callback if provided
   */
  reportProgress() {
    if (this.options.progressCallback) {
      this.options.progressCallback({
        ...this.stats,
        progressPercentage:
          (this.stats.processedUsers / this.stats.totalUsers) * 100,
      });
    }
  }

  /**
   * Complete the operation and return results
   * @param {string} message - Completion message
   * @param {Array} results - Operation results
   * @param {Error} error - Error if operation failed
   * @returns {Object} - Final operation result
   */
  completeOperation(message, results = [], error = null) {
    this.stats.endTime = Date.now();
    const duration = this.stats.endTime - this.stats.startTime;

    const finalResult = {
      success: !error,
      message,
      stats: {
        ...this.stats,
        duration,
        durationFormatted: this.formatDuration(duration),
      },
      results: results.slice(0, 100), // Limit results to prevent memory issues
      error: error ? error.message : null,
    };

    ValidationUtilities.logValidationSuccess("BulkUserDataRepair", "system", {
      action: "Bulk repair operation completed",
      ...finalResult.stats,
    });

    return finalResult;
  }

  /**
   * Format duration in human-readable format
   * @param {number} duration - Duration in milliseconds
   * @returns {string} - Formatted duration
   */
  formatDuration(duration) {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default BulkUserDataRepair;
