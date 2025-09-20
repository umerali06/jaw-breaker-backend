// Comprehensive Error Handling Service for Nursing Backend Integration
import { EventEmitter } from "events";

class ErrorHandlingService extends EventEmitter {
  constructor() {
    super();
    this.errorLog = [];
    this.errorStats = new Map();
    this.circuitBreakers = new Map();
    this.retryConfigs = new Map();
    this.maxLogSize = 10000;
    this.setupDefaultConfigurations();
  }

  // Setup default error handling configurations
  setupDefaultConfigurations() {
    // Enhanced Circuit breaker configurations
    this.circuitBreakers.set("database", {
      failureThreshold: 5,
      resetTimeout: 60000,
      state: "CLOSED",
      failures: 0,
      lastFailureTime: null,
      halfOpenMaxCalls: 3,
      monitoringPeriod: 10000,
    });

    this.circuitBreakers.set("external-api", {
      failureThreshold: 3,
      resetTimeout: 30000,
      state: "CLOSED",
      failures: 0,
      lastFailureTime: null,
      halfOpenMaxCalls: 2,
      monitoringPeriod: 5000,
    });

    this.circuitBreakers.set("ai-service", {
      failureThreshold: 2,
      resetTimeout: 120000,
      state: "CLOSED",
      failures: 0,
      lastFailureTime: null,
      halfOpenMaxCalls: 1,
      monitoringPeriod: 15000,
    });

    this.circuitBreakers.set("websocket", {
      failureThreshold: 10,
      resetTimeout: 30000,
      state: "CLOSED",
      failures: 0,
      lastFailureTime: null,
      halfOpenMaxCalls: 5,
      monitoringPeriod: 5000,
    });

    // Enhanced Retry configurations with jitter
    this.retryConfigs.set("database", {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "MongoNetworkError",
      ],
    });

    this.retryConfigs.set("external-api", {
      maxRetries: 5,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
    });

    this.retryConfigs.set("ai-service", {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 3,
    });

    console.log("🛡️ Error Handling Service initialized");
  }

  // Handle errors with comprehensive logging and recovery
  async handleError(error, context = {}) {
    const errorEntry = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      severity: this.determineSeverity(error, context),
      context: {
        service: context.service || "unknown",
        operation: context.operation || "unknown",
        userId: context.userId,
        patientId: context.patientId,
        requestId: context.requestId,
        ...context,
      },
      resolved: false,
      retryCount: context.retryCount || 0,
    };

    // Log the error
    this.logError(errorEntry);

    // Update error statistics
    this.updateErrorStats(errorEntry);

    // Handle circuit breaker logic
    if (context.service) {
      this.handleCircuitBreaker(context.service, errorEntry);
    }

    // Emit error event for monitoring
    this.emit("error", errorEntry);

    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(errorEntry);

    try {
      const result = await this.executeRecoveryStrategy(
        recoveryStrategy,
        errorEntry,
        context
      );

      if (result.recovered) {
        errorEntry.resolved = true;
        errorEntry.recoveryStrategy = recoveryStrategy.type;
        errorEntry.resolvedAt = new Date();
        this.emit("error-recovered", errorEntry);
      }

      return result;
    } catch (recoveryError) {
      console.error("Recovery strategy failed:", recoveryError);
      this.emit("recovery-failed", {
        originalError: errorEntry,
        recoveryError,
      });
      throw error; // Re-throw original error if recovery fails
    }
  }

  // Determine error severity
  determineSeverity(error, context) {
    // Critical errors that require immediate attention
    if (
      error.message.includes("HIPAA") ||
      error.message.includes("security") ||
      error.message.includes("unauthorized") ||
      context.service === "security"
    ) {
      return "CRITICAL";
    }

    // High severity errors
    if (
      error.message.includes("database") ||
      error.message.includes("connection") ||
      error.message.includes("timeout") ||
      context.service === "database"
    ) {
      return "HIGH";
    }

    // Medium severity errors
    if (
      error.message.includes("validation") ||
      error.message.includes("not found") ||
      error.message.includes("permission")
    ) {
      return "MEDIUM";
    }

    // Low severity errors
    return "LOW";
  }

  // Determine recovery strategy based on error type and context
  determineRecoveryStrategy(errorEntry) {
    const { type, context, severity, retryCount } = errorEntry;

    // Security errors - no automatic recovery
    if (severity === "CRITICAL") {
      return { type: "ALERT_ONLY", action: "immediate_notification" };
    }

    // Database connection errors
    if (
      context.service === "database" ||
      errorEntry.message.includes("database")
    ) {
      if (retryCount < 3) {
        return { type: "RETRY_WITH_BACKOFF", service: "database" };
      } else {
        return { type: "FALLBACK_TO_CACHE", service: "database" };
      }
    }

    // External API errors
    if (
      context.service === "external-api" ||
      errorEntry.message.includes("API")
    ) {
      const circuitBreaker = this.circuitBreakers.get("external-api");
      if (circuitBreaker.state === "OPEN") {
        return { type: "CIRCUIT_BREAKER_OPEN", service: "external-api" };
      }
      return { type: "RETRY_WITH_BACKOFF", service: "external-api" };
    }

    // AI service errors
    if (context.service === "ai-service" || errorEntry.message.includes("AI")) {
      return { type: "GRACEFUL_DEGRADATION", service: "ai-service" };
    }

    // Validation errors
    if (type === "ValidationError") {
      return { type: "RETURN_VALIDATION_ERROR", action: "user_feedback" };
    }

    // Default strategy
    return { type: "LOG_AND_CONTINUE", action: "monitor" };
  }

  // Execute recovery strategy
  async executeRecoveryStrategy(strategy, errorEntry, context) {
    switch (strategy.type) {
      case "RETRY_WITH_BACKOFF":
        return await this.retryWithBackoff(context, strategy.service);

      case "FALLBACK_TO_CACHE":
        return await this.fallbackToCache(context);

      case "GRACEFUL_DEGRADATION":
        return await this.gracefulDegradation(context);

      case "CIRCUIT_BREAKER_OPEN":
        return { recovered: false, reason: "Circuit breaker is open" };

      case "ALERT_ONLY":
        await this.sendCriticalAlert(errorEntry);
        return {
          recovered: false,
          reason: "Critical error - manual intervention required",
        };

      case "RETURN_VALIDATION_ERROR":
        return {
          recovered: true,
          userError: true,
          message: errorEntry.message,
        };

      case "LOG_AND_CONTINUE":
      default:
        return { recovered: true, reason: "Error logged and monitored" };
    }
  }

  // Retry with exponential backoff
  async retryWithBackoff(context, service) {
    const config =
      this.retryConfigs.get(service) || this.retryConfigs.get("database");
    const retryCount = context.retryCount || 0;

    if (retryCount >= config.maxRetries) {
      return { recovered: false, reason: "Max retries exceeded" };
    }

    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    );

    console.log(
      `🔄 Retrying operation after ${delay}ms (attempt ${retryCount + 1}/${
        config.maxRetries
      })`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // Re-execute the original operation
      if (context.retryFunction) {
        const result = await context.retryFunction();
        return { recovered: true, result };
      }
      return { recovered: true, reason: "Retry delay completed" };
    } catch (retryError) {
      context.retryCount = retryCount + 1;
      return await this.handleError(retryError, context);
    }
  }

  // Fallback to cache when database is unavailable
  async fallbackToCache(context) {
    try {
      console.log("📦 Falling back to cache for data retrieval");

      // This would integrate with your caching service
      if (context.cacheKey && context.cacheService) {
        const cachedData = await context.cacheService.get(context.cacheKey);
        if (cachedData) {
          return {
            recovered: true,
            result: cachedData,
            source: "cache",
            warning: "Data served from cache due to database unavailability",
          };
        }
      }

      return { recovered: false, reason: "No cached data available" };
    } catch (cacheError) {
      console.error("Cache fallback failed:", cacheError);
      return { recovered: false, reason: "Cache fallback failed" };
    }
  }

  // Graceful degradation for AI services
  async gracefulDegradation(context) {
    console.log("🎯 Implementing graceful degradation for AI service");

    // Provide basic functionality without AI enhancement
    const degradedResponse = {
      recovered: true,
      degraded: true,
      message:
        "AI features temporarily unavailable - basic functionality provided",
      basicResult: context.basicFallback || null,
    };

    return degradedResponse;
  }

  // Handle circuit breaker logic
  handleCircuitBreaker(service, errorEntry) {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (!circuitBreaker) return;

    const now = Date.now();

    switch (circuitBreaker.state) {
      case "CLOSED":
        circuitBreaker.failures++;
        circuitBreaker.lastFailureTime = now;

        if (circuitBreaker.failures >= circuitBreaker.failureThreshold) {
          circuitBreaker.state = "OPEN";
          console.warn(`🔴 Circuit breaker OPENED for service: ${service}`);
          this.emit("circuit-breaker-opened", {
            service,
            failures: circuitBreaker.failures,
          });
        }
        break;

      case "OPEN":
        if (
          now - circuitBreaker.lastFailureTime >=
          circuitBreaker.resetTimeout
        ) {
          circuitBreaker.state = "HALF_OPEN";
          console.log(`🟡 Circuit breaker HALF-OPEN for service: ${service}`);
          this.emit("circuit-breaker-half-open", { service });
        }
        break;

      case "HALF_OPEN":
        // If we get an error in half-open state, go back to open
        circuitBreaker.state = "OPEN";
        circuitBreaker.lastFailureTime = now;
        console.warn(`🔴 Circuit breaker back to OPEN for service: ${service}`);
        break;
    }
  }

  // Record successful operation (for circuit breaker recovery)
  recordSuccess(service) {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (!circuitBreaker) return;

    if (circuitBreaker.state === "HALF_OPEN") {
      circuitBreaker.state = "CLOSED";
      circuitBreaker.failures = 0;
      circuitBreaker.lastFailureTime = null;
      console.log(`🟢 Circuit breaker CLOSED for service: ${service}`);
      this.emit("circuit-breaker-closed", { service });
    }
  }

  // Send critical alerts
  async sendCriticalAlert(errorEntry) {
    const alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      severity: "CRITICAL",
      error: errorEntry,
      message: `Critical error in nursing system: ${errorEntry.message}`,
      requiresImmediateAttention: true,
    };

    // In production, this would integrate with:
    // - PagerDuty
    // - Slack/Teams
    // - Email notifications
    // - SMS alerts
    console.error("🚨 CRITICAL ALERT:", alert);

    this.emit("critical-alert", alert);
  }

  // Log error with rotation
  logError(errorEntry) {
    this.errorLog.push(errorEntry);

    // Rotate logs to prevent memory issues
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console with appropriate level
    const logLevel = this.getLogLevel(errorEntry.severity);
    console[logLevel](`[${errorEntry.severity}] ${errorEntry.message}`, {
      id: errorEntry.id,
      service: errorEntry.context.service,
      operation: errorEntry.context.operation,
    });
  }

  // Update error statistics
  updateErrorStats(errorEntry) {
    const key = `${errorEntry.context.service}:${errorEntry.type}`;
    const stats = this.errorStats.get(key) || {
      count: 0,
      lastOccurrence: null,
      severity: errorEntry.severity,
    };

    stats.count++;
    stats.lastOccurrence = errorEntry.timestamp;
    this.errorStats.set(key, stats);
  }

  // Get log level for console output
  getLogLevel(severity) {
    switch (severity) {
      case "CRITICAL":
        return "error";
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warn";
      case "LOW":
        return "info";
      default:
        return "log";
    }
  }

  // Generate unique error ID
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique alert ID
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get error statistics
  getErrorStats() {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const recent24h = this.errorLog.filter(
      (error) => error.timestamp >= last24Hours
    );
    const recent7d = this.errorLog.filter(
      (error) => error.timestamp >= last7Days
    );

    return {
      total: this.errorLog.length,
      last24Hours: {
        total: recent24h.length,
        critical: recent24h.filter((e) => e.severity === "CRITICAL").length,
        high: recent24h.filter((e) => e.severity === "HIGH").length,
        resolved: recent24h.filter((e) => e.resolved).length,
      },
      last7Days: {
        total: recent7d.length,
        byService: this.groupByService(recent7d),
        topErrors: this.getTopErrors(recent7d),
      },
      circuitBreakers: this.getCircuitBreakerStatus(),
    };
  }

  // Group errors by service
  groupByService(errors) {
    const grouped = {};
    errors.forEach((error) => {
      const service = error.context.service;
      grouped[service] = (grouped[service] || 0) + 1;
    });
    return grouped;
  }

  // Get top errors by frequency
  getTopErrors(errors) {
    const errorCounts = {};
    errors.forEach((error) => {
      const key = `${error.type}: ${error.message.substring(0, 50)}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  // Get circuit breaker status
  getCircuitBreakerStatus() {
    const status = {};
    this.circuitBreakers.forEach((breaker, service) => {
      status[service] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailureTime: breaker.lastFailureTime,
      };
    });
    return status;
  }

  // Health check
  getHealthStatus() {
    const stats = this.getErrorStats();
    const criticalErrors = stats.last24Hours.critical;
    const circuitBreakersOpen = Object.values(
      this.getCircuitBreakerStatus()
    ).filter((cb) => cb.state === "OPEN").length;

    let health = "HEALTHY";
    const issues = [];

    if (criticalErrors > 0) {
      health = "CRITICAL";
      issues.push(`${criticalErrors} critical errors in last 24 hours`);
    } else if (circuitBreakersOpen > 0) {
      health = "DEGRADED";
      issues.push(`${circuitBreakersOpen} circuit breakers open`);
    } else if (stats.last24Hours.total > 100) {
      health = "WARNING";
      issues.push(`High error rate: ${stats.last24Hours.total} errors in 24h`);
    }

    return {
      status: health,
      issues,
      stats,
      timestamp: new Date(),
    };
  }

  // Clear old errors (for maintenance)
  clearOldErrors(olderThanDays = 30) {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );
    const initialCount = this.errorLog.length;

    this.errorLog = this.errorLog.filter(
      (error) => error.timestamp >= cutoffDate
    );

    const removedCount = initialCount - this.errorLog.length;
    console.log(`🧹 Cleaned up ${removedCount} old error entries`);

    return removedCount;
  }
  // Advanced Circuit Breaker Implementation
  async executeWithCircuitBreaker(serviceName, operation, fallback = null) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) {
      throw new Error(
        `Circuit breaker not configured for service: ${serviceName}`
      );
    }

    // Check circuit breaker state
    if (breaker.state === "OPEN") {
      if (Date.now() - breaker.lastFailureTime < breaker.resetTimeout) {
        console.warn(
          `🔴 Circuit breaker OPEN for ${serviceName}, using fallback`
        );
        return fallback
          ? await fallback()
          : this.getDefaultFallback(serviceName);
      } else {
        breaker.state = "HALF_OPEN";
        breaker.failures = 0;
      }
    }

    try {
      const result = await operation();

      // Success - reset circuit breaker
      if (breaker.state === "HALF_OPEN") {
        breaker.state = "CLOSED";
        breaker.failures = 0;
        console.log(
          `🟢 Circuit breaker CLOSED for ${serviceName} - service recovered`
        );
      }

      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();

      if (breaker.failures >= breaker.failureThreshold) {
        breaker.state = "OPEN";
        console.error(
          `🔴 Circuit breaker OPEN for ${serviceName} after ${breaker.failures} failures`
        );
        this.emit("circuitBreakerOpen", { serviceName, error });
      }

      // Use fallback or rethrow
      if (fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  // Enhanced Retry Logic with Exponential Backoff and Jitter
  async executeWithRetry(serviceName, operation, customConfig = {}) {
    const config = { ...this.retryConfigs.get(serviceName), ...customConfig };
    if (!config) {
      throw new Error(
        `Retry configuration not found for service: ${serviceName}`
      );
    }

    let lastError;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(
            `✅ Operation succeeded on attempt ${
              attempt + 1
            } for ${serviceName}`
          );
        }
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (
          config.retryableErrors &&
          !this.isRetryableError(error, config.retryableErrors)
        ) {
          console.warn(
            `❌ Non-retryable error for ${serviceName}:`,
            error.message
          );
          throw error;
        }

        if (attempt < config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, config);
          console.warn(
            `⏳ Retrying ${serviceName} in ${delay}ms (attempt ${attempt + 1}/${
              config.maxRetries
            })`
          );
          await this.sleep(delay);
        }
      }
    }

    console.error(`❌ All retry attempts failed for ${serviceName}`);
    throw lastError;
  }

  // Calculate backoff delay with jitter
  calculateBackoffDelay(attempt, config) {
    let delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelay
    );

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  // Check if error is retryable
  isRetryableError(error, retryableErrors) {
    if (!retryableErrors || retryableErrors.length === 0) return true;

    return retryableErrors.some(
      (retryableError) =>
        error.code === retryableError ||
        error.message.includes(retryableError) ||
        error.constructor.name === retryableError
    );
  }

  // Graceful Degradation Handler
  async executeWithGracefulDegradation(
    serviceName,
    primaryOperation,
    fallbackOperations = []
  ) {
    try {
      return await this.executeWithCircuitBreaker(
        serviceName,
        primaryOperation
      );
    } catch (primaryError) {
      console.warn(
        `🔄 Primary operation failed for ${serviceName}, trying fallbacks`
      );

      for (let i = 0; i < fallbackOperations.length; i++) {
        try {
          const result = await fallbackOperations[i]();
          console.log(`✅ Fallback ${i + 1} succeeded for ${serviceName}`);
          return result;
        } catch (fallbackError) {
          console.warn(
            `❌ Fallback ${i + 1} failed for ${serviceName}:`,
            fallbackError.message
          );
        }
      }

      // All fallbacks failed, return default response
      console.error(
        `❌ All operations failed for ${serviceName}, using default response`
      );
      return this.getDefaultFallback(serviceName);
    }
  }

  // Get default fallback responses
  getDefaultFallback(serviceName) {
    const fallbacks = {
      database: { success: false, data: null, cached: true },
      "ai-service": {
        analysis: "Service temporarily unavailable",
        confidence: 0,
      },
      "external-api": { data: null, status: "degraded" },
      websocket: {
        connected: false,
        message: "Real-time features temporarily unavailable",
      },
    };

    return (
      fallbacks[serviceName] || { error: "Service temporarily unavailable" }
    );
  }

  // Enhanced Error Metrics and Monitoring
  trackErrorMetrics(error, context) {
    const errorType = error.constructor.name;
    const serviceName = context.service || "unknown";

    // Update error statistics
    if (!this.errorStats.has(serviceName)) {
      this.errorStats.set(serviceName, {
        totalErrors: 0,
        errorTypes: new Map(),
        lastError: null,
        errorRate: 0,
      });
    }

    const stats = this.errorStats.get(serviceName);
    stats.totalErrors++;
    stats.lastError = new Date();

    if (!stats.errorTypes.has(errorType)) {
      stats.errorTypes.set(errorType, 0);
    }
    stats.errorTypes.set(errorType, stats.errorTypes.get(errorType) + 1);

    // Check if error rate exceeds thresholds
    this.checkErrorRateThresholds(serviceName, stats);
  }

  // Check error rate thresholds and emit alerts
  checkErrorRateThresholds(serviceName, stats) {
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    // Calculate error rate (simplified - in production, use sliding window)
    const recentErrors = this.errorLog.filter(
      (entry) =>
        entry.context.service === serviceName &&
        now - entry.timestamp.getTime() < timeWindow
    ).length;

    if (recentErrors > 10) {
      // More than 10 errors in 5 minutes
      this.emit("highErrorRate", {
        serviceName,
        errorCount: recentErrors,
        timeWindow: timeWindow / 1000 / 60,
      });
    }
  }

  // Health Check for All Services
  async performHealthCheck() {
    const healthStatus = {
      timestamp: new Date(),
      overall: "healthy",
      services: {},
    };

    for (const [serviceName, breaker] of this.circuitBreakers) {
      const stats = this.errorStats.get(serviceName) || { totalErrors: 0 };

      healthStatus.services[serviceName] = {
        status: breaker.state === "OPEN" ? "unhealthy" : "healthy",
        circuitBreakerState: breaker.state,
        failures: breaker.failures,
        totalErrors: stats.totalErrors,
        lastError: stats.lastError,
      };

      if (breaker.state === "OPEN") {
        healthStatus.overall = "degraded";
      }
    }

    return healthStatus;
  }

  // Bulk Error Recovery
  async recoverAllServices() {
    console.log("🔄 Initiating bulk service recovery...");

    for (const [serviceName, breaker] of this.circuitBreakers) {
      if (breaker.state === "OPEN") {
        breaker.state = "HALF_OPEN";
        breaker.failures = 0;
        console.log(`🔄 Reset circuit breaker for ${serviceName}`);
      }
    }

    // Clear error statistics
    this.errorStats.clear();
    this.errorLog.length = 0;

    this.emit("servicesRecovered");
    console.log("✅ Bulk service recovery completed");
  }

  // Sleep utility
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new ErrorHandlingService();
