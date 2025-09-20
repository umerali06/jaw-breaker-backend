/**
 * ValidationDebugLogger - Debug logging for validation operations
 * Provides detailed logging for development and debugging purposes
 */

import ValidationUtilities from "./ValidationUtilities.js";

class ValidationDebugLogger {
  static sessions = new Map();
  static isDebugMode = process.env.NODE_ENV === "development";

  /**
   * Create a new debug session
   * @param {string} sessionId - Unique session identifier
   * @param {string} userId - User ID
   * @param {string} operation - Operation name
   * @returns {Object} - Debug session object
   */
  static createSession(sessionId, userId, operation) {
    if (!this.isDebugMode) {
      return this.createNoOpSession();
    }

    const session = {
      sessionId,
      userId,
      operation,
      startTime: Date.now(),
      steps: [],
      snapshots: [],

      logStep: (stepName, data, context = {}) => {
        this.logStep(sessionId, stepName, data, context);
      },

      logSnapshot: (label, data) => {
        this.logSnapshot(sessionId, label, data);
      },

      complete: (result) => {
        this.completeSession(sessionId, result);
      },
    };

    this.sessions.set(sessionId, session);

    this.log("SESSION_START", sessionId, {
      userId,
      operation,
      timestamp: new Date().toISOString(),
    });

    return session;
  }

  /**
   * Create a no-op session for production
   * @returns {Object} - No-op session object
   */
  static createNoOpSession() {
    return {
      logStep: () => {},
      logSnapshot: () => {},
      complete: () => {},
    };
  }

  /**
   * Log a step in the validation process
   * @param {string} sessionId - Session ID
   * @param {string} stepName - Step name
   * @param {*} data - Step data
   * @param {Object} context - Additional context
   */
  static logStep(sessionId, stepName, data, context = {}) {
    if (!this.isDebugMode) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const step = {
      stepName,
      timestamp: Date.now(),
      relativeTime: Date.now() - session.startTime,
      data: this.sanitizeData(data),
      context,
    };

    session.steps.push(step);

    this.log("STEP", sessionId, {
      stepName,
      relativeTime: step.relativeTime + "ms",
      context,
      dataType: typeof data,
      dataKeys:
        data && typeof data === "object" ? Object.keys(data) : undefined,
    });
  }

  /**
   * Log a data snapshot
   * @param {string} sessionId - Session ID
   * @param {string} label - Snapshot label
   * @param {*} data - Data to snapshot
   */
  static logSnapshot(sessionId, label, data) {
    if (!this.isDebugMode) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const snapshot = {
      label,
      timestamp: Date.now(),
      relativeTime: Date.now() - session.startTime,
      data: this.sanitizeData(data),
    };

    session.snapshots.push(snapshot);

    this.log("SNAPSHOT", sessionId, {
      label,
      relativeTime: snapshot.relativeTime + "ms",
      dataSize: JSON.stringify(snapshot.data).length,
    });
  }

  /**
   * Complete a debug session
   * @param {string} sessionId - Session ID
   * @param {*} result - Final result
   */
  static completeSession(sessionId, result) {
    if (!this.isDebugMode) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const duration = Date.now() - session.startTime;

    this.log("SESSION_COMPLETE", sessionId, {
      duration: duration + "ms",
      stepCount: session.steps.length,
      snapshotCount: session.snapshots.length,
      success: result?.success !== false,
      wasRepaired: result?.wasRepaired || false,
      errorCount: result?.errors?.length || 0,
    });

    // Generate session summary
    this.generateSessionSummary(sessionId);

    // Clean up session after a delay to allow for final logging
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5000);
  }

  /**
   * Generate a comprehensive session summary
   * @param {string} sessionId - Session ID
   */
  static generateSessionSummary(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const summary = {
      sessionId,
      userId: session.userId,
      operation: session.operation,
      duration: Date.now() - session.startTime,
      timeline: session.steps.map((step) => ({
        step: step.stepName,
        time: step.relativeTime,
        context: step.context,
      })),
      snapshots: session.snapshots.map((snapshot) => ({
        label: snapshot.label,
        time: snapshot.relativeTime,
      })),
    };

    this.log("SESSION_SUMMARY", sessionId, summary);
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   * @param {*} data - Data to sanitize
   * @returns {*} - Sanitized data
   */
  static sanitizeData(data) {
    if (!data || typeof data !== "object") {
      return data;
    }

    try {
      const sanitized = ValidationUtilities.deepClone(data);

      // Remove sensitive fields
      this.removeSensitiveFields(sanitized);

      return sanitized;
    } catch (error) {
      return "[Error sanitizing data]";
    }
  }

  /**
   * Remove sensitive fields from data
   * @param {Object} obj - Object to clean
   */
  static removeSensitiveFields(obj) {
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "auth",
      "stripeCustomerId",
      "resetPasswordToken",
      "googleId",
    ];

    if (typeof obj !== "object" || obj === null) return;

    for (const key in obj) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        this.removeSensitiveFields(obj[key]);
      }
    }
  }

  /**
   * Log debug message
   * @param {string} type - Log type
   * @param {string} sessionId - Session ID
   * @param {Object} data - Log data
   */
  static log(type, sessionId, data) {
    if (!this.isDebugMode) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      sessionId,
      ...data,
    };

    console.log(
      `[ValidationDebug] ${type}:`,
      JSON.stringify(logEntry, null, 2)
    );
  }

  /**
   * Get active sessions (for monitoring)
   * @returns {Array} - Active session summaries
   */
  static getActiveSessions() {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      userId: session.userId,
      operation: session.operation,
      duration: Date.now() - session.startTime,
      stepCount: session.steps.length,
      snapshotCount: session.snapshots.length,
    }));
  }

  /**
   * Get session details
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session details
   */
  static getSessionDetails(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      operation: session.operation,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      steps: session.steps,
      snapshots: session.snapshots,
    };
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  static setDebugMode(enabled) {
    this.isDebugMode = enabled;
    this.log("DEBUG_MODE_CHANGED", "system", { enabled });
  }

  /**
   * Clear all sessions (useful for testing)
   */
  static clearSessions() {
    this.sessions.clear();
  }

  /**
   * Export debug data for analysis
   * @returns {Object} - Debug data export
   */
  static exportDebugData() {
    return {
      timestamp: new Date().toISOString(),
      isDebugMode: this.isDebugMode,
      activeSessions: this.getActiveSessions(),
      sessionDetails: Array.from(this.sessions.entries()).map(
        ([id, session]) => ({
          sessionId: id,
          details: this.getSessionDetails(id),
        })
      ),
    };
  }
}

export default ValidationDebugLogger;
