/**
 * Validation Logging Configuration
 * Configures logging levels, formats, and destinations for validation operations
 */

import fs from "fs";
import path from "path";

class ValidationLoggingConfig {
  constructor() {
    this.logLevel = process.env.VALIDATION_LOG_LEVEL || "info";
    this.logToFile = process.env.VALIDATION_LOG_TO_FILE === "true";
    this.logDirectory = process.env.VALIDATION_LOG_DIR || "./logs/validation";
    this.maxLogFileSize =
      parseInt(process.env.VALIDATION_MAX_LOG_SIZE) || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = parseInt(process.env.VALIDATION_MAX_LOG_FILES) || 5;

    // Ensure log directory exists
    if (this.logToFile) {
      this.ensureLogDirectory();
    }

    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    this.currentLogLevel = this.logLevels[this.logLevel] || this.logLevels.info;
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error("Failed to create log directory:", error);
    }
  }

  /**
   * Check if a log level should be logged
   * @param {string} level - Log level to check
   * @returns {boolean} - Whether to log this level
   */
  shouldLog(level) {
    const levelValue = this.logLevels[level] || this.logLevels.info;
    return levelValue <= this.currentLogLevel;
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} operation - Operation being logged
   * @param {string} userId - User ID (optional)
   * @param {Object} data - Log data
   * @returns {string} - Formatted log message
   */
  formatLogMessage(level, operation, userId, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      operation,
      userId: userId || "unknown",
      ...data,
    };

    return JSON.stringify(logEntry, null, 2);
  }

  /**
   * Write log to file
   * @param {string} level - Log level
   * @param {string} message - Formatted log message
   */
  writeToFile(level, message) {
    if (!this.logToFile) return;

    try {
      const logFileName = `validation-${level}-${
        new Date().toISOString().split("T")[0]
      }.log`;
      const logFilePath = path.join(this.logDirectory, logFileName);

      // Check file size and rotate if necessary
      this.rotateLogFileIfNeeded(logFilePath);

      fs.appendFileSync(logFilePath, message + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   * @param {string} logFilePath - Path to log file
   */
  rotateLogFileIfNeeded(logFilePath) {
    try {
      if (fs.existsSync(logFilePath)) {
        const stats = fs.statSync(logFilePath);
        if (stats.size > this.maxLogFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const rotatedPath = logFilePath.replace(".log", `-${timestamp}.log`);
          fs.renameSync(logFilePath, rotatedPath);

          // Clean up old log files
          this.cleanupOldLogFiles();
        }
      }
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }

  /**
   * Clean up old log files
   */
  cleanupOldLogFiles() {
    try {
      const files = fs
        .readdirSync(this.logDirectory)
        .filter((file) => file.endsWith(".log"))
        .map((file) => ({
          name: file,
          path: path.join(this.logDirectory, file),
          mtime: fs.statSync(path.join(this.logDirectory, file)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only the most recent files
      if (files.length > this.maxLogFiles) {
        const filesToDelete = files.slice(this.maxLogFiles);
        filesToDelete.forEach((file) => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error("Failed to cleanup old log files:", error);
    }
  }

  /**
   * Log validation error
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} error - Error details
   * @param {Object} context - Additional context
   */
  logValidationError(operation, userId, error, context = {}) {
    if (!this.shouldLog("error")) return;

    const logData = {
      error: {
        message: error.message || error,
        stack: error.stack,
        field: error.field || "unknown",
        value: error.value || "unknown",
        expectedType: error.expectedType || "unknown",
      },
      context,
    };

    const message = this.formatLogMessage("error", operation, userId, logData);

    console.error(`[ValidationError] ${message}`);
    this.writeToFile("error", message);
  }

  /**
   * Log validation success
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} context - Additional context
   */
  logValidationSuccess(operation, userId, context = {}) {
    if (!this.shouldLog("info")) return;

    const message = this.formatLogMessage("info", operation, userId, context);

    console.log(`[ValidationSuccess] ${message}`);
    this.writeToFile("info", message);
  }

  /**
   * Log validation warning
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} warning - Warning details
   * @param {Object} context - Additional context
   */
  logValidationWarning(operation, userId, warning, context = {}) {
    if (!this.shouldLog("warn")) return;

    const logData = {
      warning: {
        message: warning.message || warning,
        field: warning.field || "unknown",
        value: warning.value || "unknown",
      },
      context,
    };

    const message = this.formatLogMessage("warn", operation, userId, logData);

    console.warn(`[ValidationWarning] ${message}`);
    this.writeToFile("warn", message);
  }

  /**
   * Log validation debug information
   * @param {string} operation - Operation being performed
   * @param {string} userId - User ID (optional)
   * @param {Object} debugInfo - Debug information
   */
  logValidationDebug(operation, userId, debugInfo) {
    if (!this.shouldLog("debug")) return;

    const message = this.formatLogMessage(
      "debug",
      operation,
      userId,
      debugInfo
    );

    console.debug(`[ValidationDebug] ${message}`);
    this.writeToFile("debug", message);
  }

  /**
   * Get log configuration summary
   * @returns {Object} - Configuration summary
   */
  getConfigSummary() {
    return {
      logLevel: this.logLevel,
      logToFile: this.logToFile,
      logDirectory: this.logDirectory,
      maxLogFileSize: this.maxLogFileSize,
      maxLogFiles: this.maxLogFiles,
      currentLogLevel: this.currentLogLevel,
    };
  }

  /**
   * Update log level dynamically
   * @param {string} newLevel - New log level
   */
  setLogLevel(newLevel) {
    if (this.logLevels.hasOwnProperty(newLevel)) {
      this.logLevel = newLevel;
      this.currentLogLevel = this.logLevels[newLevel];
      this.logValidationSuccess("ConfigUpdate", "system", {
        action: "logLevelChanged",
        newLevel,
      });
    } else {
      throw new Error(
        `Invalid log level: ${newLevel}. Valid levels: ${Object.keys(
          this.logLevels
        ).join(", ")}`
      );
    }
  }
}

// Create singleton instance
const validationLoggingConfig = new ValidationLoggingConfig();

export default validationLoggingConfig;
