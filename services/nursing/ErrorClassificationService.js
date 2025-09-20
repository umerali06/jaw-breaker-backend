/**
 * Error Classification Service
 *
 * Provides structured error classification with proper error codes,
 * categorization, and severity levels for the outcome measures system.
 */

class ErrorClassificationService {
  constructor() {
    this.errorCodes = {
      // Validation Errors (1000-1999)
      VALIDATION_FAILED: 1001,
      INVALID_USER_ID: 1002,
      INVALID_OUTCOME_MEASURE_DATA: 1003,
      MISSING_REQUIRED_FIELDS: 1004,
      DATA_TYPE_MISMATCH: 1005,
      VALUE_OUT_OF_RANGE: 1006,
      INVALID_DATE_FORMAT: 1007,
      DUPLICATE_ENTRY: 1008,

      // Database Errors (2000-2999)
      DATABASE_CONNECTION_FAILED: 2001,
      DATABASE_QUERY_FAILED: 2002,
      DATABASE_TIMEOUT: 2003,
      TRANSACTION_FAILED: 2004,
      CONSTRAINT_VIOLATION: 2005,
      INDEX_ERROR: 2006,
      MIGRATION_FAILED: 2007,
      BACKUP_FAILED: 2008,

      // Authentication/Authorization Errors (3000-3999)
      AUTHENTICATION_FAILED: 3001,
      AUTHORIZATION_DENIED: 3002,
      TOKEN_EXPIRED: 3003,
      TOKEN_INVALID: 3004,
      SESSION_EXPIRED: 3005,
      INSUFFICIENT_PERMISSIONS: 3006,
      ACCOUNT_LOCKED: 3007,
      RATE_LIMIT_EXCEEDED: 3008,

      // Business Logic Errors (4000-4999)
      OUTCOME_MEASURE_NOT_FOUND: 4001,
      INVALID_QUALITY_INDICATOR: 4002,
      CALCULATION_ERROR: 4003,
      BENCHMARK_UNAVAILABLE: 4004,
      TREND_ANALYSIS_FAILED: 4005,
      AI_SERVICE_UNAVAILABLE: 4006,
      PATTERN_RECOGNITION_FAILED: 4007,
      PREDICTION_MODEL_ERROR: 4008,

      // External Service Errors (5000-5999)
      OASIS_SERVICE_UNAVAILABLE: 5001,
      SOAP_EXTRACTION_FAILED: 5002,
      WEBSOCKET_CONNECTION_FAILED: 5003,
      CACHE_SERVICE_ERROR: 5004,
      EMAIL_SERVICE_ERROR: 5005,
      FILE_STORAGE_ERROR: 5006,
      THIRD_PARTY_API_ERROR: 5007,
      NETWORK_TIMEOUT: 5008,

      // System Errors (6000-6999)
      INTERNAL_SERVER_ERROR: 6001,
      MEMORY_LIMIT_EXCEEDED: 6002,
      CPU_LIMIT_EXCEEDED: 6003,
      DISK_SPACE_FULL: 6004,
      SERVICE_UNAVAILABLE: 6005,
      CONFIGURATION_ERROR: 6006,
      DEPENDENCY_MISSING: 6007,
      VERSION_MISMATCH: 6008,
    };

    this.errorCategories = {
      VALIDATION: "validation",
      DATABASE: "database",
      AUTHENTICATION: "authentication",
      AUTHORIZATION: "authorization",
      BUSINESS_LOGIC: "business_logic",
      EXTERNAL_SERVICE: "external_service",
      SYSTEM: "system",
      NETWORK: "network",
      SECURITY: "security",
    };

    this.severityLevels = {
      LOW: "low",
      MEDIUM: "medium",
      HIGH: "high",
      CRITICAL: "critical",
    };

    this.errorMappings = this.initializeErrorMappings();
  }

  initializeErrorMappings() {
    return {
      // Validation Errors
      [this.errorCodes.VALIDATION_FAILED]: {
        category: this.errorCategories.VALIDATION,
        severity: this.severityLevels.MEDIUM,
        message: "Data validation failed",
        userMessage:
          "The provided data is invalid. Please check your input and try again.",
        recoverable: true,
        retryable: false,
      },
      [this.errorCodes.INVALID_USER_ID]: {
        category: this.errorCategories.VALIDATION,
        severity: this.severityLevels.HIGH,
        message: "Invalid user ID format",
        userMessage: "Authentication error. Please log in again.",
        recoverable: true,
        retryable: false,
      },
      [this.errorCodes.INVALID_OUTCOME_MEASURE_DATA]: {
        category: this.errorCategories.VALIDATION,
        severity: this.severityLevels.MEDIUM,
        message: "Invalid outcome measure data structure",
        userMessage:
          "The outcome measure data is invalid. Please verify all required fields.",
        recoverable: true,
        retryable: false,
      },

      // Database Errors
      [this.errorCodes.DATABASE_CONNECTION_FAILED]: {
        category: this.errorCategories.DATABASE,
        severity: this.severityLevels.CRITICAL,
        message: "Failed to connect to database",
        userMessage: "Service temporarily unavailable. Please try again later.",
        recoverable: true,
        retryable: true,
      },
      [this.errorCodes.DATABASE_QUERY_FAILED]: {
        category: this.errorCategories.DATABASE,
        severity: this.severityLevels.HIGH,
        message: "Database query execution failed",
        userMessage: "Unable to process your request. Please try again.",
        recoverable: true,
        retryable: true,
      },
      [this.errorCodes.DATABASE_TIMEOUT]: {
        category: this.errorCategories.DATABASE,
        severity: this.severityLevels.HIGH,
        message: "Database operation timed out",
        userMessage: "Request timed out. Please try again.",
        recoverable: true,
        retryable: true,
      },

      // Authentication/Authorization Errors
      [this.errorCodes.AUTHENTICATION_FAILED]: {
        category: this.errorCategories.AUTHENTICATION,
        severity: this.severityLevels.HIGH,
        message: "User authentication failed",
        userMessage:
          "Invalid credentials. Please check your login information.",
        recoverable: true,
        retryable: false,
      },
      [this.errorCodes.AUTHORIZATION_DENIED]: {
        category: this.errorCategories.AUTHORIZATION,
        severity: this.severityLevels.HIGH,
        message: "User not authorized for this operation",
        userMessage: "You do not have permission to perform this action.",
        recoverable: false,
        retryable: false,
      },
      [this.errorCodes.RATE_LIMIT_EXCEEDED]: {
        category: this.errorCategories.SECURITY,
        severity: this.severityLevels.MEDIUM,
        message: "Rate limit exceeded",
        userMessage: "Too many requests. Please wait before trying again.",
        recoverable: true,
        retryable: true,
      },

      // Business Logic Errors
      [this.errorCodes.OUTCOME_MEASURE_NOT_FOUND]: {
        category: this.errorCategories.BUSINESS_LOGIC,
        severity: this.severityLevels.MEDIUM,
        message: "Outcome measure not found",
        userMessage: "The requested outcome measure could not be found.",
        recoverable: false,
        retryable: false,
      },
      [this.errorCodes.CALCULATION_ERROR]: {
        category: this.errorCategories.BUSINESS_LOGIC,
        severity: this.severityLevels.HIGH,
        message: "Quality indicator calculation failed",
        userMessage:
          "Unable to calculate quality indicators. Please try again.",
        recoverable: true,
        retryable: true,
      },
      [this.errorCodes.AI_SERVICE_UNAVAILABLE]: {
        category: this.errorCategories.EXTERNAL_SERVICE,
        severity: this.severityLevels.MEDIUM,
        message: "AI analytics service unavailable",
        userMessage:
          "Advanced analytics temporarily unavailable. Basic features still work.",
        recoverable: true,
        retryable: true,
      },

      // External Service Errors
      [this.errorCodes.OASIS_SERVICE_UNAVAILABLE]: {
        category: this.errorCategories.EXTERNAL_SERVICE,
        severity: this.severityLevels.MEDIUM,
        message: "OASIS data extraction service unavailable",
        userMessage: "OASIS data extraction temporarily unavailable.",
        recoverable: true,
        retryable: true,
      },
      [this.errorCodes.WEBSOCKET_CONNECTION_FAILED]: {
        category: this.errorCategories.NETWORK,
        severity: this.severityLevels.MEDIUM,
        message: "WebSocket connection failed",
        userMessage: "Real-time updates unavailable. Please refresh the page.",
        recoverable: true,
        retryable: true,
      },

      // System Errors
      [this.errorCodes.INTERNAL_SERVER_ERROR]: {
        category: this.errorCategories.SYSTEM,
        severity: this.severityLevels.CRITICAL,
        message: "Internal server error",
        userMessage: "An unexpected error occurred. Please try again later.",
        recoverable: true,
        retryable: true,
      },
      [this.errorCodes.SERVICE_UNAVAILABLE]: {
        category: this.errorCategories.SYSTEM,
        severity: this.severityLevels.CRITICAL,
        message: "Service temporarily unavailable",
        userMessage: "Service temporarily unavailable. Please try again later.",
        recoverable: true,
        retryable: true,
      },
    };
  }

  classifyError(error, context = {}) {
    let errorCode = this.errorCodes.INTERNAL_SERVER_ERROR;
    let additionalInfo = {};

    // Determine error code based on error type and message
    if (error.name === "ValidationError") {
      errorCode = this.errorCodes.VALIDATION_FAILED;
    } else if (error.name === "MongoError" || error.name === "MongooseError") {
      if (error.message.includes("timeout")) {
        errorCode = this.errorCodes.DATABASE_TIMEOUT;
      } else if (error.message.includes("connection")) {
        errorCode = this.errorCodes.DATABASE_CONNECTION_FAILED;
      } else {
        errorCode = this.errorCodes.DATABASE_QUERY_FAILED;
      }
    } else if (error.name === "JsonWebTokenError") {
      errorCode = this.errorCodes.TOKEN_INVALID;
    } else if (error.name === "TokenExpiredError") {
      errorCode = this.errorCodes.TOKEN_EXPIRED;
    } else if (error.message && error.message.includes("rate limit")) {
      errorCode = this.errorCodes.RATE_LIMIT_EXCEEDED;
    } else if (error.message && error.message.includes("not found")) {
      errorCode = this.errorCodes.OUTCOME_MEASURE_NOT_FOUND;
    } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      errorCode = this.errorCodes.NETWORK_TIMEOUT;
    }

    // Get error mapping
    const mapping =
      this.errorMappings[errorCode] ||
      this.errorMappings[this.errorCodes.INTERNAL_SERVER_ERROR];

    // Add context information
    if (context.userId) additionalInfo.userId = context.userId;
    if (context.operation) additionalInfo.operation = context.operation;
    if (context.resource) additionalInfo.resource = context.resource;
    if (context.requestId) additionalInfo.requestId = context.requestId;

    return {
      code: errorCode,
      category: mapping.category,
      severity: mapping.severity,
      message: mapping.message,
      userMessage: mapping.userMessage,
      originalError: error.message,
      stack: error.stack,
      recoverable: mapping.recoverable,
      retryable: mapping.retryable,
      timestamp: new Date().toISOString(),
      context: additionalInfo,
    };
  }

  createError(errorCode, additionalContext = {}) {
    const mapping = this.errorMappings[errorCode];
    if (!mapping) {
      throw new Error(`Unknown error code: ${errorCode}`);
    }

    const error = new Error(mapping.message);
    error.code = errorCode;
    error.category = mapping.category;
    error.severity = mapping.severity;
    error.userMessage = mapping.userMessage;
    error.recoverable = mapping.recoverable;
    error.retryable = mapping.retryable;
    error.context = additionalContext;

    return error;
  }

  isRetryable(errorCode) {
    const mapping = this.errorMappings[errorCode];
    return mapping ? mapping.retryable : false;
  }

  isRecoverable(errorCode) {
    const mapping = this.errorMappings[errorCode];
    return mapping ? mapping.recoverable : false;
  }

  getSeverity(errorCode) {
    const mapping = this.errorMappings[errorCode];
    return mapping ? mapping.severity : this.severityLevels.CRITICAL;
  }

  getCategory(errorCode) {
    const mapping = this.errorMappings[errorCode];
    return mapping ? mapping.category : this.errorCategories.SYSTEM;
  }

  getUserMessage(errorCode) {
    const mapping = this.errorMappings[errorCode];
    return mapping
      ? mapping.userMessage
      : "An unexpected error occurred. Please try again later.";
  }
}

module.exports = ErrorClassificationService;
