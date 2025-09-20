/**
 * OutcomeMeasuresCircuitBreaker - Circuit breaker pattern implementation for service resilience
 * Implements Requirements: 1.3, 5.4 - Service resilience and failure handling
 *
 * Features:
 * - Configurable failure thresholds and timeouts
 * - Multiple circuit breaker states (CLOSED, OPEN, HALF_OPEN)
 * - Fallback strategies for different failure types
 * - Monitoring and alerting capabilities
 * - Graceful degradation for outcome measures services
 */

import { EventEmitter } from "events";

class OutcomeMeasuresCircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration with defaults
    this.config = {
      // Failure threshold before opening circuit
      failureThreshold: options.failureThreshold || 5,

      // Success threshold to close circuit from half-open
      successThreshold: options.successThreshold || 3,

      // Timeout before attempting to close circuit (ms)
      timeout: options.timeout || 60000, // 1 minute

      // Monitor window for failure counting (ms)
      monitorWindow: options.monitorWindow || 300000, // 5 minutes

      // Maximum execution timeout for operations (ms)
      executionTimeout: options.executionTimeout || 30000, // 30 seconds

      // Enable/disable monitoring and alerting
      enableMonitoring: options.enableMonitoring !== false,

      // Service name for logging and monitoring
      serviceName: options.serviceName || "OutcomeMeasuresService",
    };

    // Circuit breaker states
    this.states = {
      CLOSED: "CLOSED", // Normal operation
      OPEN: "OPEN", // Circuit is open, failing fast
      HALF_OPEN: "HALF_OPEN", // Testing if service has recovered
    };

    // Current state
    this.state = this.states.CLOSED;

    // Failure tracking
    this.failures = [];
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalFallbacks: 0,
      stateChanges: 0,
      lastStateChange: null,
      uptime: Date.now(),
    };

    // Fallback strategies
    this.fallbackStrategies = new Map();
    this.initializeFallbackStrategies();

    // Monitoring
    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {Function} operation - The operation to execute
   * @param {string} operationType - Type of operation for fallback selection
   * @param {Object} context - Additional context for operation
   * @returns {Promise} Operation result or fallback result
   */
  async execute(operation, operationType = "default", context = {}) {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === this.states.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit is open, use fallback
        this.stats.totalFallbacks++;
        return this.executeFallback(operationType, context, "CIRCUIT_OPEN");
      } else {
        // Time to try half-open
        this.setState(this.states.HALF_OPEN);
      }
    }

    try {
      // Execute operation with timeout
      const result = await this.executeWithTimeout(
        operation,
        this.config.executionTimeout
      );

      // Operation succeeded
      this.onSuccess();
      return result;
    } catch (error) {
      // Operation failed
      this.onFailure(error);

      // Use fallback strategy
      this.stats.totalFallbacks++;
      return this.executeFallback(
        operationType,
        context,
        error.message || "OPERATION_FAILED"
      );
    }
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Operation result
   */
  async executeWithTimeout(operation, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.totalTimeouts++;
        reject(new Error("OPERATION_TIMEOUT"));
      }, timeout);

      Promise.resolve(operation())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.stats.totalSuccesses++;

    if (this.state === this.states.HALF_OPEN) {
      this.consecutiveSuccesses++;

      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        // Close the circuit
        this.setState(this.states.CLOSED);
        this.resetFailures();
      }
    } else if (this.state === this.states.CLOSED) {
      // Clean up old failures outside monitor window
      this.cleanupOldFailures();
    }
  }

  /**
   * Handle failed operation
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.stats.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failures.push({
      timestamp: this.lastFailureTime,
      error: error.message || "UNKNOWN_ERROR",
      type: this.classifyError(error),
    });

    // Clean up old failures
    this.cleanupOldFailures();

    // Check if we should open the circuit
    if (
      this.state === this.states.CLOSED &&
      this.failures.length >= this.config.failureThreshold
    ) {
      this.setState(this.states.OPEN);
      this.nextAttemptTime = Date.now() + this.config.timeout;
    } else if (this.state === this.states.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.setState(this.states.OPEN);
      this.nextAttemptTime = Date.now() + this.config.timeout;
      this.consecutiveSuccesses = 0;
    }

    // Emit failure event for monitoring
    this.emit("failure", {
      error,
      state: this.state,
      failureCount: this.failures.length,
      timestamp: this.lastFailureTime,
    });
  }

  /**
   * Set circuit breaker state
   * @param {string} newState - New state to set
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.stats.stateChanges++;
    this.stats.lastStateChange = Date.now();

    // Reset consecutive successes when changing state
    if (newState !== this.states.HALF_OPEN) {
      this.consecutiveSuccesses = 0;
    }

    // Emit state change event
    this.emit("stateChange", {
      from: oldState,
      to: newState,
      timestamp: this.stats.lastStateChange,
      failureCount: this.failures.length,
    });

    console.log(
      `[${this.config.serviceName}] Circuit breaker state changed: ${oldState} -> ${newState}`
    );
  }

  /**
   * Clean up failures outside the monitor window
   */
  cleanupOldFailures() {
    const cutoffTime = Date.now() - this.config.monitorWindow;
    this.failures = this.failures.filter(
      (failure) => failure.timestamp > cutoffTime
    );
  }

  /**
   * Reset failure tracking
   */
  resetFailures() {
    this.failures = [];
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Classify error type for appropriate fallback strategy
   * @param {Error} error - The error to classify
   * @returns {string} Error type
   */
  classifyError(error) {
    const message = error.message || "";

    if (message.includes("TIMEOUT") || message.includes("timeout")) {
      return "TIMEOUT";
    } else if (
      message.includes("CONNECTION") ||
      message.includes("ECONNREFUSED")
    ) {
      return "CONNECTION";
    } else if (message.includes("DATABASE") || message.includes("MongoDB")) {
      return "DATABASE";
    } else if (
      message.includes("VALIDATION") ||
      message.includes("validation")
    ) {
      return "VALIDATION";
    } else if (message.includes("AI") || message.includes("analytics")) {
      return "AI_SERVICE";
    } else {
      return "UNKNOWN";
    }
  }

  /**
   * Initialize fallback strategies for different operation types
   */
  initializeFallbackStrategies() {
    // Dashboard data fallback
    this.fallbackStrategies.set("getDashboardData", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      data: {
        qualityIndicators: [],
        trends: {},
        benchmarks: {},
        recentAssessments: [],
        alerts: [
          {
            type: "warning",
            message:
              "Outcome measures service temporarily unavailable. Showing cached data.",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      metadata: {
        source: "circuit_breaker_fallback",
        timestamp: new Date().toISOString(),
        userId: context.userId || "unknown",
      },
    }));

    // Quality indicators fallback
    this.fallbackStrategies.set("getQualityIndicators", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      indicators: [],
      summary: {
        total: 0,
        improving: 0,
        stable: 0,
        declining: 0,
        lastUpdated: null,
      },
      message:
        "Quality indicators temporarily unavailable due to service issues.",
    }));

    // Trends analysis fallback
    this.fallbackStrategies.set("getTrends", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      trends: {},
      analysis: {
        overallTrend: "unknown",
        confidence: 0,
        dataPoints: 0,
        message: "Trend analysis temporarily unavailable.",
      },
    }));

    // Benchmarks fallback
    this.fallbackStrategies.set("getBenchmarks", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      benchmarks: {},
      comparisons: [],
      message: "Benchmark data temporarily unavailable.",
    }));

    // CRUD operations fallback
    this.fallbackStrategies.set("createOutcomeMeasure", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      error:
        "Unable to create outcome measure at this time. Please try again later.",
      retryAfter: Math.ceil(this.config.timeout / 1000),
    }));

    this.fallbackStrategies.set("updateOutcomeMeasure", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      error:
        "Unable to update outcome measure at this time. Changes have been queued for retry.",
      retryAfter: Math.ceil(this.config.timeout / 1000),
    }));

    this.fallbackStrategies.set("deleteOutcomeMeasure", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      error:
        "Unable to delete outcome measure at this time. Please try again later.",
      retryAfter: Math.ceil(this.config.timeout / 1000),
    }));

    // AI analytics fallback
    this.fallbackStrategies.set("getAIAnalytics", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      analytics: {
        patterns: {},
        predictions: [],
        recommendations: [],
        confidence: 0,
      },
      message:
        "AI analytics temporarily unavailable. Basic statistics are still available.",
    }));

    // Default fallback
    this.fallbackStrategies.set("default", (context, reason) => ({
      success: false,
      fallback: true,
      reason,
      error: "Service temporarily unavailable. Please try again later.",
      retryAfter: Math.ceil(this.config.timeout / 1000),
    }));
  }

  /**
   * Execute fallback strategy
   * @param {string} operationType - Type of operation
   * @param {Object} context - Operation context
   * @param {string} reason - Reason for fallback
   * @returns {Object} Fallback result
   */
  executeFallback(operationType, context, reason) {
    const strategy =
      this.fallbackStrategies.get(operationType) ||
      this.fallbackStrategies.get("default");

    const result = strategy(context, reason);

    // Emit fallback event for monitoring
    this.emit("fallback", {
      operationType,
      reason,
      context,
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Get current circuit breaker status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failures.length,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats },
      config: { ...this.config },
      isHealthy:
        this.state === this.states.CLOSED &&
        this.failures.length < this.config.failureThreshold / 2,
    };
  }

  /**
   * Force circuit breaker state (for testing/admin purposes)
   * @param {string} state - State to force
   */
  forceState(state) {
    if (Object.values(this.states).includes(state)) {
      this.setState(state);

      if (state === this.states.CLOSED) {
        this.resetFailures();
      } else if (state === this.states.OPEN) {
        this.nextAttemptTime = Date.now() + this.config.timeout;
      }
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.setState(this.states.CLOSED);
    this.resetFailures();

    // Reset stats but keep uptime
    const uptime = this.stats.uptime;
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalFallbacks: 0,
      stateChanges: 0,
      lastStateChange: null,
      uptime,
    };
  }

  /**
   * Start monitoring and alerting
   */
  startMonitoring() {
    // Monitor circuit breaker health every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Set up event listeners for alerting
    this.on("stateChange", (event) => {
      if (event.to === this.states.OPEN) {
        this.sendAlert("CIRCUIT_OPENED", {
          message: `Circuit breaker opened for ${this.config.serviceName}`,
          failureCount: event.failureCount,
          timestamp: event.timestamp,
        });
      } else if (
        event.to === this.states.CLOSED &&
        event.from === this.states.HALF_OPEN
      ) {
        this.sendAlert("CIRCUIT_CLOSED", {
          message: `Circuit breaker closed for ${this.config.serviceName} - service recovered`,
          timestamp: event.timestamp,
        });
      }
    });

    this.on("failure", (event) => {
      if (event.failureCount >= this.config.failureThreshold * 0.8) {
        this.sendAlert("HIGH_FAILURE_RATE", {
          message: `High failure rate detected for ${this.config.serviceName}`,
          failureCount: event.failureCount,
          threshold: this.config.failureThreshold,
          error: event.error.message,
        });
      }
    });
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    const status = this.getStatus();

    // Emit health check event
    this.emit("healthCheck", status);

    // Log health status
    if (!status.isHealthy) {
      console.warn(
        `[${this.config.serviceName}] Circuit breaker health check: UNHEALTHY`,
        {
          state: status.state,
          failures: status.failureCount,
          stats: status.stats,
        }
      );
    }
  }

  /**
   * Send alert (can be extended to integrate with alerting systems)
   * @param {string} alertType - Type of alert
   * @param {Object} details - Alert details
   */
  sendAlert(alertType, details) {
    const alert = {
      type: alertType,
      service: this.config.serviceName,
      timestamp: new Date().toISOString(),
      details,
    };

    // Emit alert event
    this.emit("alert", alert);

    // Log alert (in production, this would integrate with alerting systems)
    console.error(`[ALERT] ${alertType}:`, alert);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

export default OutcomeMeasuresCircuitBreaker;
