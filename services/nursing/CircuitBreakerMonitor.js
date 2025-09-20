/**
 * CircuitBreakerMonitor - Monitoring and alerting for circuit breaker patterns
 * Implements Requirements: 1.3, 5.4 - Monitoring and alerting for service resilience
 *
 * Features:
 * - Real-time monitoring of circuit breaker states
 * - Configurable alerting thresholds
 * - Integration with external monitoring systems
 * - Health check endpoints
 * - Metrics collection and reporting
 */

import { EventEmitter } from "events";

class CircuitBreakerMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      // Monitoring intervals
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      metricsCollectionInterval: options.metricsCollectionInterval || 60000, // 1 minute

      // Alerting thresholds
      failureRateThreshold: options.failureRateThreshold || 0.5, // 50%
      responseTimeThreshold: options.responseTimeThreshold || 5000, // 5 seconds
      circuitOpenAlertDelay: options.circuitOpenAlertDelay || 60000, // 1 minute

      // Retention settings
      metricsRetentionPeriod: options.metricsRetentionPeriod || 86400000, // 24 hours
      maxMetricsPoints: options.maxMetricsPoints || 1440, // 24 hours of minute-by-minute data

      // Integration settings
      enableSlackAlerts: options.enableSlackAlerts || false,
      enableEmailAlerts: options.enableEmailAlerts || false,
      enableWebhooks: options.enableWebhooks || false,

      // Webhook URLs
      webhookUrls: options.webhookUrls || [],
      slackWebhookUrl: options.slackWebhookUrl,

      // Service identification
      serviceName: options.serviceName || "Unknown Service",
      environment: options.environment || "development",
    };

    // Monitored circuit breakers
    this.circuitBreakers = new Map();

    // Metrics storage
    this.metrics = {
      current: new Map(),
      historical: new Map(),
      alerts: [],
    };

    // Alert state tracking
    this.alertStates = new Map();

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Register a circuit breaker for monitoring
   * @param {string} name - Circuit breaker name
   * @param {OutcomeMeasuresCircuitBreaker} circuitBreaker - Circuit breaker instance
   */
  registerCircuitBreaker(name, circuitBreaker) {
    if (this.circuitBreakers.has(name)) {
      console.warn(`Circuit breaker ${name} is already registered`);
      return;
    }

    this.circuitBreakers.set(name, circuitBreaker);

    // Initialize metrics for this circuit breaker
    this.metrics.current.set(name, {
      state: "CLOSED",
      failureCount: 0,
      successRate: 100,
      failureRate: 0,
      fallbackRate: 0,
      averageResponseTime: 0,
      lastStateChange: null,
      uptime: Date.now(),
    });

    this.metrics.historical.set(name, []);
    this.alertStates.set(name, {
      circuitOpen: false,
      highFailureRate: false,
      slowResponse: false,
      lastAlertTime: null,
    });

    // Set up event listeners
    this.setupCircuitBreakerListeners(name, circuitBreaker);

    console.log(`Circuit breaker ${name} registered for monitoring`);
  }

  /**
   * Unregister a circuit breaker from monitoring
   * @param {string} name - Circuit breaker name
   */
  unregisterCircuitBreaker(name) {
    if (!this.circuitBreakers.has(name)) {
      console.warn(`Circuit breaker ${name} is not registered`);
      return;
    }

    this.circuitBreakers.delete(name);
    this.metrics.current.delete(name);
    this.metrics.historical.delete(name);
    this.alertStates.delete(name);

    console.log(`Circuit breaker ${name} unregistered from monitoring`);
  }

  /**
   * Set up event listeners for a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {OutcomeMeasuresCircuitBreaker} circuitBreaker - Circuit breaker instance
   */
  setupCircuitBreakerListeners(name, circuitBreaker) {
    // State change events
    circuitBreaker.on("stateChange", (event) => {
      this.handleStateChange(name, event);
    });

    // Failure events
    circuitBreaker.on("failure", (event) => {
      this.handleFailure(name, event);
    });

    // Fallback events
    circuitBreaker.on("fallback", (event) => {
      this.handleFallback(name, event);
    });

    // Health check events
    circuitBreaker.on("healthCheck", (status) => {
      this.handleHealthCheck(name, status);
    });

    // Alert events
    circuitBreaker.on("alert", (alert) => {
      this.handleAlert(name, alert);
    });
  }

  /**
   * Handle circuit breaker state changes
   * @param {string} name - Circuit breaker name
   * @param {Object} event - State change event
   */
  handleStateChange(name, event) {
    const currentMetrics = this.metrics.current.get(name);
    if (currentMetrics) {
      currentMetrics.state = event.to;
      currentMetrics.lastStateChange = event.timestamp;
    }

    // Send alerts for critical state changes
    if (event.to === "OPEN") {
      this.sendAlert(name, "CIRCUIT_OPENED", {
        message: `Circuit breaker ${name} has opened`,
        previousState: event.from,
        failureCount: event.failureCount,
        timestamp: event.timestamp,
      });
    } else if (event.to === "CLOSED" && event.from !== "CLOSED") {
      this.sendAlert(name, "CIRCUIT_RECOVERED", {
        message: `Circuit breaker ${name} has recovered`,
        previousState: event.from,
        timestamp: event.timestamp,
      });
    }

    // Emit monitoring event
    this.emit("stateChange", { name, event });
  }

  /**
   * Handle circuit breaker failures
   * @param {string} name - Circuit breaker name
   * @param {Object} event - Failure event
   */
  handleFailure(name, event) {
    const currentMetrics = this.metrics.current.get(name);
    if (currentMetrics) {
      currentMetrics.failureCount = event.failureCount;
    }

    // Check for high failure rate alerts
    this.checkFailureRateAlert(name);

    // Emit monitoring event
    this.emit("failure", { name, event });
  }

  /**
   * Handle circuit breaker fallbacks
   * @param {string} name - Circuit breaker name
   * @param {Object} event - Fallback event
   */
  handleFallback(name, event) {
    // Track fallback usage for metrics
    this.emit("fallback", { name, event });
  }

  /**
   * Handle health check results
   * @param {string} name - Circuit breaker name
   * @param {Object} status - Health status
   */
  handleHealthCheck(name, status) {
    this.updateMetrics(name, status);

    // Emit monitoring event
    this.emit("healthCheck", { name, status });
  }

  /**
   * Handle circuit breaker alerts
   * @param {string} name - Circuit breaker name
   * @param {Object} alert - Alert details
   */
  handleAlert(name, alert) {
    this.recordAlert(name, alert);

    // Forward alert to external systems
    this.forwardAlert(name, alert);

    // Emit monitoring event
    this.emit("alert", { name, alert });
  }

  /**
   * Update metrics for a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} status - Circuit breaker status
   */
  updateMetrics(name, status) {
    const currentMetrics = this.metrics.current.get(name);
    if (!currentMetrics) return;

    // Calculate rates
    const totalRequests = status.stats.totalRequests;
    const successRate =
      totalRequests > 0
        ? (status.stats.totalSuccesses / totalRequests) * 100
        : 100;
    const failureRate =
      totalRequests > 0
        ? (status.stats.totalFailures / totalRequests) * 100
        : 0;
    const fallbackRate =
      totalRequests > 0
        ? (status.stats.totalFallbacks / totalRequests) * 100
        : 0;

    // Update current metrics
    Object.assign(currentMetrics, {
      state: status.state,
      failureCount: status.failureCount,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      fallbackRate: Math.round(fallbackRate * 100) / 100,
      isHealthy: status.isHealthy,
      uptime: Date.now() - status.stats.uptime,
    });

    // Store historical data point
    const historical = this.metrics.historical.get(name);
    if (historical) {
      historical.push({
        timestamp: Date.now(),
        ...currentMetrics,
      });

      // Limit historical data size
      if (historical.length > this.config.maxMetricsPoints) {
        historical.splice(0, historical.length - this.config.maxMetricsPoints);
      }
    }
  }

  /**
   * Check if failure rate alert should be sent
   * @param {string} name - Circuit breaker name
   */
  checkFailureRateAlert(name) {
    const currentMetrics = this.metrics.current.get(name);
    const alertState = this.alertStates.get(name);

    if (!currentMetrics || !alertState) return;

    const failureRateExceeded =
      currentMetrics.failureRate > this.config.failureRateThreshold * 100;
    const shouldAlert = failureRateExceeded && !alertState.highFailureRate;

    if (shouldAlert) {
      alertState.highFailureRate = true;
      alertState.lastAlertTime = Date.now();

      this.sendAlert(name, "HIGH_FAILURE_RATE", {
        message: `High failure rate detected for ${name}`,
        failureRate: currentMetrics.failureRate,
        threshold: this.config.failureRateThreshold * 100,
        timestamp: Date.now(),
      });
    } else if (!failureRateExceeded && alertState.highFailureRate) {
      // Reset alert state when failure rate returns to normal
      alertState.highFailureRate = false;
    }
  }

  /**
   * Send alert to configured channels
   * @param {string} name - Circuit breaker name
   * @param {string} alertType - Type of alert
   * @param {Object} details - Alert details
   */
  async sendAlert(name, alertType, details) {
    const alert = {
      id: `${name}-${alertType}-${Date.now()}`,
      service: this.config.serviceName,
      circuitBreaker: name,
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      details,
    };

    // Record alert
    this.recordAlert(name, alert);

    // Send to configured channels
    await this.forwardAlert(name, alert);

    // Emit alert event
    this.emit("alertSent", { name, alert });
  }

  /**
   * Get alert severity level
   * @param {string} alertType - Type of alert
   * @returns {string} Severity level
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      CIRCUIT_OPENED: "high",
      CIRCUIT_RECOVERED: "info",
      HIGH_FAILURE_RATE: "medium",
      SLOW_RESPONSE: "medium",
      SERVICE_DEGRADED: "medium",
      SERVICE_RECOVERED: "info",
    };

    return severityMap[alertType] || "low";
  }

  /**
   * Record alert in metrics
   * @param {string} name - Circuit breaker name
   * @param {Object} alert - Alert details
   */
  recordAlert(name, alert) {
    this.metrics.alerts.push({
      ...alert,
      circuitBreaker: name,
    });

    // Limit alert history
    if (this.metrics.alerts.length > 1000) {
      this.metrics.alerts.splice(0, 100);
    }
  }

  /**
   * Forward alert to external systems
   * @param {string} name - Circuit breaker name
   * @param {Object} alert - Alert details
   */
  async forwardAlert(name, alert) {
    const promises = [];

    // Slack alerts
    if (this.config.enableSlackAlerts && this.config.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(alert));
    }

    // Webhook alerts
    if (this.config.enableWebhooks && this.config.webhookUrls.length > 0) {
      promises.push(this.sendWebhookAlerts(alert));
    }

    // Email alerts (placeholder - would integrate with email service)
    if (this.config.enableEmailAlerts) {
      promises.push(this.sendEmailAlert(alert));
    }

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Error forwarding alert:", error);
    }
  }

  /**
   * Send Slack alert
   * @param {Object} alert - Alert details
   */
  async sendSlackAlert(alert) {
    if (!this.config.slackWebhookUrl) return;

    const color =
      {
        high: "danger",
        medium: "warning",
        info: "good",
        low: "#439FE0",
      }[alert.severity] || "#439FE0";

    const payload = {
      text: `Circuit Breaker Alert: ${alert.type}`,
      attachments: [
        {
          color,
          fields: [
            { title: "Service", value: alert.service, short: true },
            {
              title: "Circuit Breaker",
              value: alert.circuitBreaker,
              short: true,
            },
            { title: "Environment", value: alert.environment, short: true },
            {
              title: "Severity",
              value: alert.severity.toUpperCase(),
              short: true,
            },
            { title: "Message", value: alert.details.message, short: false },
            { title: "Timestamp", value: alert.timestamp, short: false },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to send Slack alert:", error);
    }
  }

  /**
   * Send webhook alerts
   * @param {Object} alert - Alert details
   */
  async sendWebhookAlerts(alert) {
    const promises = this.config.webhookUrls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alert),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status}`);
        }
      } catch (error) {
        console.error(`Failed to send webhook alert to ${url}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send email alert (placeholder)
   * @param {Object} alert - Alert details
   */
  async sendEmailAlert(alert) {
    // Placeholder for email integration
    console.log("Email alert would be sent:", alert);
  }

  /**
   * Get current metrics for all circuit breakers
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    const metrics = {};

    for (const [name, currentMetrics] of this.metrics.current) {
      metrics[name] = { ...currentMetrics };
    }

    return {
      timestamp: new Date().toISOString(),
      circuitBreakers: metrics,
      summary: this.getMetricsSummary(),
    };
  }

  /**
   * Get historical metrics for a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {number} duration - Duration in milliseconds
   * @returns {Array} Historical metrics
   */
  getHistoricalMetrics(name, duration = 3600000) {
    // Default 1 hour
    const historical = this.metrics.historical.get(name);
    if (!historical) return [];

    const cutoffTime = Date.now() - duration;
    return historical.filter((point) => point.timestamp > cutoffTime);
  }

  /**
   * Get metrics summary
   * @returns {Object} Metrics summary
   */
  getMetricsSummary() {
    const circuitBreakers = Array.from(this.metrics.current.values());
    const total = circuitBreakers.length;

    if (total === 0) {
      return { total: 0, healthy: 0, degraded: 0, failed: 0 };
    }

    const healthy = circuitBreakers.filter(
      (cb) => cb.state === "CLOSED" && cb.isHealthy
    ).length;
    const degraded = circuitBreakers.filter(
      (cb) =>
        cb.state === "HALF_OPEN" || (cb.state === "CLOSED" && !cb.isHealthy)
    ).length;
    const failed = circuitBreakers.filter((cb) => cb.state === "OPEN").length;

    return {
      total,
      healthy,
      degraded,
      failed,
      healthyPercentage: Math.round((healthy / total) * 100),
      averageSuccessRate: Math.round(
        circuitBreakers.reduce((sum, cb) => sum + cb.successRate, 0) / total
      ),
    };
  }

  /**
   * Get recent alerts
   * @param {number} limit - Maximum number of alerts to return
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.metrics.alerts.slice(-limit).reverse();
  }

  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Metrics collection interval
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    console.log("Circuit breaker monitoring started");
  }

  /**
   * Perform health checks on all registered circuit breakers
   */
  performHealthChecks() {
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      try {
        const status = circuitBreaker.getStatus();
        this.updateMetrics(name, status);
      } catch (error) {
        console.error(`Health check failed for ${name}:`, error);
      }
    }
  }

  /**
   * Collect and process metrics
   */
  collectMetrics() {
    // Clean up old historical data
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;

    for (const [name, historical] of this.metrics.historical) {
      const filtered = historical.filter(
        (point) => point.timestamp > cutoffTime
      );
      this.metrics.historical.set(name, filtered);
    }

    // Clean up old alerts
    this.metrics.alerts = this.metrics.alerts.filter(
      (alert) =>
        Date.now() - new Date(alert.timestamp).getTime() <
        this.config.metricsRetentionPeriod
    );

    // Emit metrics collection event
    this.emit("metricsCollected", this.getCurrentMetrics());
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    console.log("Circuit breaker monitoring stopped");
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    this.circuitBreakers.clear();
    this.metrics.current.clear();
    this.metrics.historical.clear();
    this.metrics.alerts = [];
    this.alertStates.clear();
    this.removeAllListeners();
  }
}

export default CircuitBreakerMonitor;
