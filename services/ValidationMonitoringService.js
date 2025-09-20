/**
 * ValidationMonitoringService - Service for monitoring validation operations and metrics
 * Provides comprehensive monitoring, alerting, and performance tracking for validation operations
 */

import ValidationUtilities from "./ValidationUtilities.js";

class ValidationMonitoringService {
  constructor() {
    this.metrics = {
      validationAttempts: 0,
      validationFailures: 0,
      repairAttempts: 0,
      repairSuccesses: 0,
      criticalErrors: 0,
      warningErrors: 0,
      infoErrors: 0,
      performanceMetrics: {
        averageValidationTime: 0,
        averageRepairTime: 0,
        totalValidationTime: 0,
        totalRepairTime: 0,
      },
      errorPatterns: new Map(),
      userRepairHistory: new Map(),
    };

    this.alertThresholds = {
      criticalErrorRate: 0.1, // 10% critical error rate triggers alert
      repairFailureRate: 0.2, // 20% repair failure rate triggers alert
      averageValidationTime: 1000, // 1 second average validation time triggers alert
      validationFailuresPerHour: 100, // 100 failures per hour triggers alert
    };

    this.alerts = [];
    this.startTime = Date.now();
  }

  /**
   * Record a validation attempt
   * @param {string} userId - User ID
   * @param {Object} validationResult - Result from validation
   * @param {number} duration - Time taken for validation in ms
   */
  recordValidationAttempt(userId, validationResult, duration) {
    try {
      this.metrics.validationAttempts++;
      this.metrics.performanceMetrics.totalValidationTime += duration;
      this.metrics.performanceMetrics.averageValidationTime =
        this.metrics.performanceMetrics.totalValidationTime /
        this.metrics.validationAttempts;

      if (!validationResult.isValid) {
        this.metrics.validationFailures++;

        // Classify and count errors
        const classification = this._classifyErrors(validationResult.errors);
        this.metrics.criticalErrors += classification.critical.length;
        this.metrics.warningErrors += classification.warning.length;
        this.metrics.infoErrors += classification.info.length;

        // Track error patterns
        validationResult.errors.forEach((error) => {
          const pattern = this._extractErrorPattern(error);
          const count = this.metrics.errorPatterns.get(pattern) || 0;
          this.metrics.errorPatterns.set(pattern, count + 1);
        });
      }

      // Check for alerts
      this._checkAlerts();

      // Log the validation attempt
      ValidationUtilities.logValidationSuccess("ValidationMonitoring", userId, {
        duration,
        isValid: validationResult.isValid,
        errorCount: validationResult.errors?.length || 0,
      });
    } catch (error) {
      ValidationUtilities.logValidationError(
        "ValidationMonitoring",
        userId,
        error,
        { operation: "recordValidationAttempt" }
      );
    }
  }

  /**
   * Record a repair attempt
   * @param {string} userId - User ID
   * @param {Object} repairResult - Result from repair operation
   * @param {number} duration - Time taken for repair in ms
   */
  recordRepairAttempt(userId, repairResult, duration) {
    try {
      this.metrics.repairAttempts++;
      this.metrics.performanceMetrics.totalRepairTime += duration;
      this.metrics.performanceMetrics.averageRepairTime =
        this.metrics.performanceMetrics.totalRepairTime /
        this.metrics.repairAttempts;

      if (repairResult.wasRepaired && repairResult.errors.length === 0) {
        this.metrics.repairSuccesses++;
      }

      // Track user repair history
      const userHistory = this.metrics.userRepairHistory.get(userId) || {
        attempts: 0,
        successes: 0,
        lastRepair: null,
      };
      userHistory.attempts++;
      if (repairResult.wasRepaired) {
        userHistory.successes++;
      }
      userHistory.lastRepair = new Date();
      this.metrics.userRepairHistory.set(userId, userHistory);

      // Check for alerts
      this._checkAlerts();

      // Log the repair attempt
      ValidationUtilities.logValidationSuccess("RepairMonitoring", userId, {
        duration,
        wasRepaired: repairResult.wasRepaired,
        remainingErrors: repairResult.errors.length,
      });
    } catch (error) {
      ValidationUtilities.logValidationError(
        "RepairMonitoring",
        userId,
        error,
        { operation: "recordRepairAttempt" }
      );
    }
  }

  /**
   * Get current validation metrics
   * @returns {Object} - Current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);

    return {
      ...this.metrics,
      uptime,
      uptimeHours,
      rates: {
        validationFailureRate:
          this.metrics.validationFailures / this.metrics.validationAttempts,
        repairSuccessRate:
          this.metrics.repairSuccesses / this.metrics.repairAttempts,
        criticalErrorRate:
          this.metrics.criticalErrors / this.metrics.validationAttempts,
        validationFailuresPerHour:
          this.metrics.validationFailures / uptimeHours,
      },
      topErrorPatterns: Array.from(this.metrics.errorPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      alerts: this.alerts,
    };
  }

  /**
   * Get user-specific metrics
   * @param {string} userId - User ID
   * @returns {Object} - User-specific metrics
   */
  getUserMetrics(userId) {
    const userHistory = this.metrics.userRepairHistory.get(userId);
    if (!userHistory) {
      return {
        hasHistory: false,
        message: "No validation history found for this user",
      };
    }

    return {
      hasHistory: true,
      repairAttempts: userHistory.attempts,
      repairSuccesses: userHistory.successes,
      successRate: userHistory.successes / userHistory.attempts,
      lastRepair: userHistory.lastRepair,
      needsAttention: userHistory.attempts > 3 && userHistory.successRate < 0.5,
    };
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      validationAttempts: 0,
      validationFailures: 0,
      repairAttempts: 0,
      repairSuccesses: 0,
      criticalErrors: 0,
      warningErrors: 0,
      infoErrors: 0,
      performanceMetrics: {
        averageValidationTime: 0,
        averageRepairTime: 0,
        totalValidationTime: 0,
        totalRepairTime: 0,
      },
      errorPatterns: new Map(),
      userRepairHistory: new Map(),
    };
    this.alerts = [];
    this.startTime = Date.now();

    ValidationUtilities.logValidationSuccess("ValidationMonitoring", "system", {
      operation: "metricsReset",
    });
  }

  /**
   * Start validation tracking for an operation
   * @param {string} operation - Operation name
   * @param {string} userId - User ID
   * @param {Object} context - Additional context
   * @returns {Function} - Function to call when operation completes
   */
  startValidationTracking(operation, userId, context = {}) {
    const startTime = Date.now();

    ValidationUtilities.logValidationSuccess("ValidationTracking", userId, {
      operation,
      phase: "start",
      ...context,
    });

    // Return a function to call when the operation completes
    return (result = {}) => {
      const duration = Date.now() - startTime;

      if (result.errors && result.errors.length > 0) {
        this.recordValidationAttempt(
          userId,
          { isValid: false, errors: result.errors },
          duration
        );
      } else {
        this.recordValidationAttempt(
          userId,
          { isValid: true, errors: [] },
          duration
        );
      }

      if (result.wasRepaired !== undefined) {
        this.recordRepairAttempt(userId, result, duration);
      }

      ValidationUtilities.logValidationSuccess("ValidationTracking", userId, {
        operation,
        phase: "complete",
        duration,
        ...result,
      });
    };
  }

  /**
   * Get health status of the validation system
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: "healthy",
      issues: [],
      recommendations: [],
    };

    // Check critical error rate
    if (
      metrics.rates.criticalErrorRate > this.alertThresholds.criticalErrorRate
    ) {
      health.status = "warning";
      health.issues.push(
        `High critical error rate: ${(
          metrics.rates.criticalErrorRate * 100
        ).toFixed(2)}%`
      );
      health.recommendations.push(
        "Review user data quality and consider bulk repair operations"
      );
    }

    // Check repair failure rate
    if (
      metrics.rates.repairSuccessRate <
      1 - this.alertThresholds.repairFailureRate
    ) {
      health.status = "warning";
      health.issues.push(
        `Low repair success rate: ${(
          metrics.rates.repairSuccessRate * 100
        ).toFixed(2)}%`
      );
      health.recommendations.push(
        "Review repair logic and consider manual intervention for problematic users"
      );
    }

    // Check performance
    if (
      metrics.performanceMetrics.averageValidationTime >
      this.alertThresholds.averageValidationTime
    ) {
      health.status = "warning";
      health.issues.push(
        `Slow validation performance: ${metrics.performanceMetrics.averageValidationTime.toFixed(
          2
        )}ms average`
      );
      health.recommendations.push(
        "Optimize validation logic or consider caching strategies"
      );
    }

    // Check validation failure rate
    if (
      metrics.rates.validationFailuresPerHour >
      this.alertThresholds.validationFailuresPerHour
    ) {
      health.status = "critical";
      health.issues.push(
        `High validation failure rate: ${metrics.rates.validationFailuresPerHour.toFixed(
          2
        )} failures/hour`
      );
      health.recommendations.push(
        "Investigate data corruption sources and implement preventive measures"
      );
    }

    return health;
  }

  /**
   * Classify errors by severity (internal method)
   * @param {Array} errors - Array of error messages
   * @returns {Object} - Classified errors
   */
  _classifyErrors(errors) {
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
   * Extract error pattern for tracking (internal method)
   * @param {string} error - Error message
   * @returns {string} - Error pattern
   */
  _extractErrorPattern(error) {
    // Extract the general pattern from specific error messages
    return error
      .replace(/\d+/g, "N") // Replace numbers with N
      .replace(/[a-f0-9]{24}/g, "ID") // Replace ObjectIds with ID
      .replace(/\w+@\w+\.\w+/g, "EMAIL") // Replace emails with EMAIL
      .toLowerCase();
  }

  /**
   * Check for alert conditions (internal method)
   */
  _checkAlerts() {
    const metrics = this.getMetrics();
    const now = new Date();

    // Check for critical error rate alert
    if (
      metrics.rates.criticalErrorRate > this.alertThresholds.criticalErrorRate
    ) {
      this._addAlert("critical_error_rate", {
        message: `Critical error rate exceeded threshold: ${(
          metrics.rates.criticalErrorRate * 100
        ).toFixed(2)}%`,
        threshold: this.alertThresholds.criticalErrorRate,
        current: metrics.rates.criticalErrorRate,
        timestamp: now,
      });
    }

    // Check for repair failure rate alert
    if (
      metrics.rates.repairSuccessRate <
      1 - this.alertThresholds.repairFailureRate
    ) {
      this._addAlert("repair_failure_rate", {
        message: `Repair success rate below threshold: ${(
          metrics.rates.repairSuccessRate * 100
        ).toFixed(2)}%`,
        threshold: 1 - this.alertThresholds.repairFailureRate,
        current: metrics.rates.repairSuccessRate,
        timestamp: now,
      });
    }

    // Check for performance alert
    if (
      metrics.performanceMetrics.averageValidationTime >
      this.alertThresholds.averageValidationTime
    ) {
      this._addAlert("slow_validation", {
        message: `Average validation time exceeded threshold: ${metrics.performanceMetrics.averageValidationTime.toFixed(
          2
        )}ms`,
        threshold: this.alertThresholds.averageValidationTime,
        current: metrics.performanceMetrics.averageValidationTime,
        timestamp: now,
      });
    }
  }

  /**
   * Add an alert (internal method)
   * @param {string} type - Alert type
   * @param {Object} details - Alert details
   */
  _addAlert(type, details) {
    // Avoid duplicate alerts within 5 minutes
    const recentAlert = this.alerts.find(
      (alert) =>
        alert.type === type &&
        Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000
    );

    if (!recentAlert) {
      this.alerts.push({
        type,
        ...details,
      });

      // Keep only the last 50 alerts
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(-50);
      }

      // Log the alert
      ValidationUtilities.logValidationError(
        "ValidationMonitoring",
        "system",
        { message: details.message },
        {
          alertType: type,
          threshold: details.threshold,
          current: details.current,
        }
      );
    }
  }
}

// Create a singleton instance
const validationMonitoringService = new ValidationMonitoringService();

export default validationMonitoringService;
