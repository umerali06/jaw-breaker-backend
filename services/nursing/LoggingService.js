/**
 * Comprehensive Logging Service
 *
 * Provides structured logging with audit trail capabilities,
 * different log levels, and integration with monitoring systems.
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");

class LoggingService {
  constructor() {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6,
    };

    this.logCategories = {
      SYSTEM: "system",
      DATABASE: "database",
      API: "api",
      AUTHENTICATION: "authentication",
      BUSINESS_LOGIC: "business_logic",
      EXTERNAL_SERVICE: "external_service",
      AUDIT: "audit",
      SECURITY: "security",
      PERFORMANCE: "performance",
    };

    this.auditActions = {
      CREATE: "create",
      READ: "read",
      UPDATE: "update",
      DELETE: "delete",
      LOGIN: "login",
      LOGOUT: "logout",
      EXPORT: "export",
      IMPORT: "import",
      CALCULATE: "calculate",
      ANALYZE: "analyze",
    };

    this.initializeLoggers();
  }

  initializeLoggers() {
    // Ensure log directory exists
    const logDir = path.join(__dirname, "../../logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Custom log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(
        ({
          timestamp,
          level,
          message,
          category,
          userId,
          requestId,
          ...meta
        }) => {
          const logEntry = {
            timestamp,
            level,
            message,
            category: category || "system",
            ...(userId && { userId }),
            ...(requestId && { requestId }),
            ...meta,
          };
          return JSON.stringify(logEntry);
        }
      )
    );

    // Main application logger
    this.logger = winston.createLogger({
      levels: this.logLevels,
      format: logFormat,
      defaultMeta: { service: "outcome-measures" },
      transports: [
        // Error log file
        new winston.transports.File({
          filename: path.join(logDir, "error.log"),
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true,
        }),
        // Combined log file
        new winston.transports.File({
          filename: path.join(logDir, "combined.log"),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true,
        }),
        // Console output for development
        ...(process.env.NODE_ENV !== "production"
          ? [
              new winston.transports.Console({
                format: winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple()
                ),
              }),
            ]
          : []),
      ],
    });

    // Audit logger for compliance and security
    this.auditLogger = winston.createLogger({
      levels: this.logLevels,
      format: logFormat,
      defaultMeta: { service: "outcome-measures-audit" },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, "audit.log"),
          maxsize: 20971520, // 20MB
          maxFiles: 20,
          tailable: true,
        }),
      ],
    });

    // Performance logger
    this.performanceLogger = winston.createLogger({
      levels: this.logLevels,
      format: logFormat,
      defaultMeta: { service: "outcome-measures-performance" },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, "performance.log"),
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true,
        }),
      ],
    });

    // Security logger
    this.securityLogger = winston.createLogger({
      levels: this.logLevels,
      format: logFormat,
      defaultMeta: { service: "outcome-measures-security" },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, "security.log"),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true,
        }),
      ],
    });
  }

  // General logging methods
  error(message, meta = {}) {
    this.logger.error(message, {
      category: meta.category || this.logCategories.SYSTEM,
      ...meta,
    });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, {
      category: meta.category || this.logCategories.SYSTEM,
      ...meta,
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, {
      category: meta.category || this.logCategories.SYSTEM,
      ...meta,
    });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, {
      category: meta.category || this.logCategories.SYSTEM,
      ...meta,
    });
  }

  // Audit logging for compliance
  audit(action, resource, userId, details = {}) {
    const auditEntry = {
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      sessionId: details.sessionId,
      requestId: details.requestId,
      success: details.success !== false,
      changes: details.changes,
      previousValues: details.previousValues,
      newValues: details.newValues,
      reason: details.reason,
      metadata: details.metadata,
    };

    this.auditLogger.info("Audit log entry", {
      category: this.logCategories.AUDIT,
      ...auditEntry,
    });

    return auditEntry;
  }

  // Security event logging
  security(event, severity, details = {}) {
    const securityEntry = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      requestId: details.requestId,
      details: details.details,
      blocked: details.blocked || false,
      riskScore: details.riskScore,
    };

    this.securityLogger.warn(`Security event: ${event}`, {
      category: this.logCategories.SECURITY,
      ...securityEntry,
    });

    return securityEntry;
  }

  // Performance logging
  performance(operation, duration, details = {}) {
    const performanceEntry = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      requestId: details.requestId,
      resourceUsage: details.resourceUsage,
      queryCount: details.queryCount,
      cacheHits: details.cacheHits,
      cacheMisses: details.cacheMisses,
      memoryUsage: details.memoryUsage,
      cpuUsage: details.cpuUsage,
    };

    const level = duration > 5000 ? "warn" : duration > 1000 ? "info" : "debug";

    this.performanceLogger[level](
      `Performance: ${operation} took ${duration}ms`,
      {
        category: this.logCategories.PERFORMANCE,
        ...performanceEntry,
      }
    );

    return performanceEntry;
  }

  // API request logging
  apiRequest(method, url, statusCode, duration, details = {}) {
    const apiEntry = {
      method,
      url,
      statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      requestId: details.requestId,
      userAgent: details.userAgent,
      ipAddress: details.ipAddress,
      requestSize: details.requestSize,
      responseSize: details.responseSize,
      errorCode: details.errorCode,
      errorMessage: details.errorMessage,
    };

    const level =
      statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    this.logger[level](`API ${method} ${url} - ${statusCode} (${duration}ms)`, {
      category: this.logCategories.API,
      ...apiEntry,
    });

    return apiEntry;
  }

  // Database operation logging
  database(operation, collection, duration, details = {}) {
    const dbEntry = {
      operation,
      collection,
      duration,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      requestId: details.requestId,
      query: details.query,
      resultCount: details.resultCount,
      errorCode: details.errorCode,
      errorMessage: details.errorMessage,
    };

    const level = details.errorCode
      ? "error"
      : duration > 1000
      ? "warn"
      : "debug";

    this.logger[level](`DB ${operation} on ${collection} (${duration}ms)`, {
      category: this.logCategories.DATABASE,
      ...dbEntry,
    });

    return dbEntry;
  }

  // Business logic logging
  businessLogic(operation, entity, result, details = {}) {
    const businessEntry = {
      operation,
      entity,
      result,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      requestId: details.requestId,
      inputData: details.inputData,
      outputData: details.outputData,
      calculationResults: details.calculationResults,
      validationErrors: details.validationErrors,
      businessRules: details.businessRules,
    };

    const level =
      result === "error" ? "error" : result === "warning" ? "warn" : "info";

    this.logger[level](
      `Business Logic: ${operation} on ${entity} - ${result}`,
      {
        category: this.logCategories.BUSINESS_LOGIC,
        ...businessEntry,
      }
    );

    return businessEntry;
  }

  // External service logging
  externalService(service, operation, success, duration, details = {}) {
    const serviceEntry = {
      service,
      operation,
      success,
      duration,
      timestamp: new Date().toISOString(),
      requestId: details.requestId,
      endpoint: details.endpoint,
      requestData: details.requestData,
      responseData: details.responseData,
      errorCode: details.errorCode,
      errorMessage: details.errorMessage,
      retryCount: details.retryCount,
    };

    const level = !success ? "error" : duration > 5000 ? "warn" : "info";

    this.logger[level](
      `External Service: ${service} ${operation} - ${
        success ? "success" : "failed"
      } (${duration}ms)`,
      {
        category: this.logCategories.EXTERNAL_SERVICE,
        ...serviceEntry,
      }
    );

    return serviceEntry;
  }

  // Error logging with classification
  logError(classifiedError, context = {}) {
    const errorEntry = {
      errorCode: classifiedError.code,
      category: classifiedError.category,
      severity: classifiedError.severity,
      message: classifiedError.message,
      originalError: classifiedError.originalError,
      stack: classifiedError.stack,
      recoverable: classifiedError.recoverable,
      retryable: classifiedError.retryable,
      timestamp: classifiedError.timestamp,
      context: {
        ...classifiedError.context,
        ...context,
      },
    };

    const level =
      classifiedError.severity === "critical"
        ? "error"
        : classifiedError.severity === "high"
        ? "error"
        : classifiedError.severity === "medium"
        ? "warn"
        : "info";

    this.logger[level](
      `Error ${classifiedError.code}: ${classifiedError.message}`,
      {
        category: classifiedError.category,
        ...errorEntry,
      }
    );

    // Also log to security logger if it's a security-related error
    if (
      classifiedError.category === "authentication" ||
      classifiedError.category === "authorization" ||
      classifiedError.category === "security"
    ) {
      this.security(`Error ${classifiedError.code}`, classifiedError.severity, {
        userId: context.userId,
        ipAddress: context.ipAddress,
        details: classifiedError.message,
      });
    }

    return errorEntry;
  }

  // Create request context for correlation
  createRequestContext(req) {
    const requestId =
      req.headers["x-request-id"] ||
      req.id ||
      Math.random().toString(36).substring(2, 15);

    return {
      requestId,
      userId: req.user?.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      method: req.method,
      url: req.originalUrl || req.url,
      timestamp: new Date().toISOString(),
    };
  }

  // Log aggregation and analysis helpers
  async getLogStats(timeRange = "24h", category = null) {
    // This would typically integrate with a log aggregation service
    // For now, return a placeholder structure
    return {
      timeRange,
      category,
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      topErrors: [],
      performanceMetrics: {
        averageResponseTime: 0,
        slowestOperations: [],
      },
      securityEvents: {
        authenticationFailures: 0,
        rateLimitExceeded: 0,
        suspiciousActivity: 0,
      },
    };
  }

  // Health check for logging system
  healthCheck() {
    try {
      // Test each logger
      this.logger.info("Health check - main logger");
      this.auditLogger.info("Health check - audit logger");
      this.performanceLogger.info("Health check - performance logger");
      this.securityLogger.info("Health check - security logger");

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        loggers: {
          main: "operational",
          audit: "operational",
          performance: "operational",
          security: "operational",
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}

module.exports = LoggingService;
