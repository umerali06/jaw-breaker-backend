/**
 * OutcomeMeasuresServiceWithCircuitBreaker - Enhanced service with circuit breaker protection
 * Implements Requirements: 1.3, 5.4 - Service resilience and failure handling
 *
 * This service wraps the OutcomeMeasuresService with circuit breaker protection
 * to provide graceful degradation and fallback strategies during service failures.
 */

import OutcomeMeasuresService from "./OutcomeMeasuresService.js";
import OutcomeMeasuresCircuitBreaker from "./OutcomeMeasuresCircuitBreaker.js";

class OutcomeMeasuresServiceWithCircuitBreaker {
  constructor(options = {}) {
    // Initialize the underlying service
    this.outcomeMeasuresService = new OutcomeMeasuresService();

    // Initialize circuit breaker with service-specific configuration
    this.circuitBreaker = new OutcomeMeasuresCircuitBreaker({
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 3,
      timeout: options.timeout || 60000, // 1 minute
      monitorWindow: options.monitorWindow || 300000, // 5 minutes
      executionTimeout: options.executionTimeout || 30000, // 30 seconds
      enableMonitoring: options.enableMonitoring !== false,
      serviceName: "OutcomeMeasuresService",
    });

    // Set up monitoring and alerting
    this.setupMonitoring();
  }

  /**
   * Get dashboard data with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Dashboard data or fallback
   */
  async getDashboardData(userId, options = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.getDashboardData(userId, options),
      "getDashboardData",
      { userId, options }
    );
  }

  /**
   * Get quality indicators with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Quality indicators or fallback
   */
  async getQualityIndicators(userId, filters = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.getQualityIndicators(userId, filters),
      "getQualityIndicators",
      { userId, filters }
    );
  }

  /**
   * Get trends analysis with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Trends analysis or fallback
   */
  async getTrends(userId, options = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.getTrends(userId, options),
      "getTrends",
      { userId, options }
    );
  }

  /**
   * Get benchmarks with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} criteria - Benchmark criteria
   * @returns {Promise<Object>} Benchmarks or fallback
   */
  async getBenchmarks(userId, criteria = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.getBenchmarks(userId, criteria),
      "getBenchmarks",
      { userId, criteria }
    );
  }

  /**
   * Create outcome measure with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} measureData - Outcome measure data
   * @returns {Promise<Object>} Created measure or fallback
   */
  async createOutcomeMeasure(userId, measureData) {
    return this.circuitBreaker.execute(
      () =>
        this.outcomeMeasuresService.createOutcomeMeasure(userId, measureData),
      "createOutcomeMeasure",
      { userId, measureData }
    );
  }

  /**
   * Update outcome measure with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {string} measureId - Measure identifier
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated measure or fallback
   */
  async updateOutcomeMeasure(userId, measureId, updateData) {
    return this.circuitBreaker.execute(
      () =>
        this.outcomeMeasuresService.updateOutcomeMeasure(
          userId,
          measureId,
          updateData
        ),
      "updateOutcomeMeasure",
      { userId, measureId, updateData }
    );
  }

  /**
   * Delete outcome measure with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {string} measureId - Measure identifier
   * @returns {Promise<Object>} Deletion result or fallback
   */
  async deleteOutcomeMeasure(userId, measureId) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.deleteOutcomeMeasure(userId, measureId),
      "deleteOutcomeMeasure",
      { userId, measureId }
    );
  }

  /**
   * Get outcome measure by ID with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {string} measureId - Measure identifier
   * @returns {Promise<Object>} Outcome measure or fallback
   */
  async getOutcomeMeasureById(userId, measureId) {
    return this.circuitBreaker.execute(
      () =>
        this.outcomeMeasuresService.getOutcomeMeasureById(userId, measureId),
      "getOutcomeMeasureById",
      { userId, measureId }
    );
  }

  /**
   * List outcome measures with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} List of measures or fallback
   */
  async listOutcomeMeasures(userId, options = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.listOutcomeMeasures(userId, options),
      "listOutcomeMeasures",
      { userId, options }
    );
  }

  /**
   * Get AI analytics with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} analyticsConfig - Analytics configuration
   * @returns {Promise<Object>} AI analytics or fallback
   */
  async getAIAnalytics(userId, analyticsConfig = {}) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.getAIAnalytics(userId, analyticsConfig),
      "getAIAnalytics",
      { userId, analyticsConfig }
    );
  }

  /**
   * Extract data from OASIS assessment with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} oasisData - OASIS assessment data
   * @returns {Promise<Object>} Extracted data or fallback
   */
  async extractFromOASIS(userId, oasisData) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.extractFromOASIS(userId, oasisData),
      "extractFromOASIS",
      { userId, oasisData }
    );
  }

  /**
   * Extract data from SOAP note with circuit breaker protection
   * @param {string} userId - User identifier
   * @param {Object} soapData - SOAP note data
   * @returns {Promise<Object>} Extracted data or fallback
   */
  async extractFromSOAP(userId, soapData) {
    return this.circuitBreaker.execute(
      () => this.outcomeMeasuresService.extractFromSOAP(userId, soapData),
      "extractFromSOAP",
      { userId, soapData }
    );
  }

  /**
   * Get service health status including circuit breaker status
   * @returns {Object} Comprehensive health status
   */
  getHealthStatus() {
    const circuitBreakerStatus = this.circuitBreaker.getStatus();

    return {
      service: "OutcomeMeasuresService",
      timestamp: new Date().toISOString(),
      circuitBreaker: circuitBreakerStatus,
      overall: {
        healthy: circuitBreakerStatus.isHealthy,
        status:
          circuitBreakerStatus.state === "CLOSED" ? "operational" : "degraded",
        uptime: Date.now() - circuitBreakerStatus.stats.uptime,
      },
      metrics: {
        totalRequests: circuitBreakerStatus.stats.totalRequests,
        successRate:
          circuitBreakerStatus.stats.totalRequests > 0
            ? (
                (circuitBreakerStatus.stats.totalSuccesses /
                  circuitBreakerStatus.stats.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "N/A",
        failureRate:
          circuitBreakerStatus.stats.totalRequests > 0
            ? (
                (circuitBreakerStatus.stats.totalFailures /
                  circuitBreakerStatus.stats.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "N/A",
        fallbackRate:
          circuitBreakerStatus.stats.totalRequests > 0
            ? (
                (circuitBreakerStatus.stats.totalFallbacks /
                  circuitBreakerStatus.stats.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "N/A",
      },
    };
  }

  /**
   * Get detailed metrics for monitoring and observability
   * @returns {Object} Detailed metrics
   */
  getMetrics() {
    const status = this.circuitBreaker.getStatus();

    return {
      timestamp: new Date().toISOString(),
      circuitBreaker: {
        state: status.state,
        failureCount: status.failureCount,
        consecutiveSuccesses: status.consecutiveSuccesses,
        isHealthy: status.isHealthy,
      },
      statistics: status.stats,
      configuration: {
        failureThreshold: status.config.failureThreshold,
        successThreshold: status.config.successThreshold,
        timeout: status.config.timeout,
        monitorWindow: status.config.monitorWindow,
      },
    };
  }

  /**
   * Force circuit breaker state (for testing/admin purposes)
   * @param {string} state - State to force (CLOSED, OPEN, HALF_OPEN)
   */
  forceCircuitBreakerState(state) {
    this.circuitBreaker.forceState(state);
  }

  /**
   * Reset circuit breaker to initial state
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
  }

  /**
   * Setup monitoring and alerting for the service
   */
  setupMonitoring() {
    // Listen for circuit breaker events
    this.circuitBreaker.on("stateChange", (event) => {
      console.log(
        `[OutcomeMeasuresService] Circuit breaker state changed: ${event.from} -> ${event.to}`,
        {
          timestamp: new Date(event.timestamp).toISOString(),
          failureCount: event.failureCount,
        }
      );
    });

    this.circuitBreaker.on("alert", (alert) => {
      console.error(`[OutcomeMeasuresService] ALERT: ${alert.type}`, alert);

      // In production, this would integrate with monitoring systems like:
      // - Datadog, New Relic, or Prometheus for metrics
      // - PagerDuty or Slack for alerting
      // - CloudWatch or ELK stack for logging
    });

    this.circuitBreaker.on("healthCheck", (status) => {
      if (!status.isHealthy) {
        console.warn(`[OutcomeMeasuresService] Health check failed`, {
          state: status.state,
          failures: status.failureCount,
          successRate:
            status.stats.totalRequests > 0
              ? (
                  (status.stats.totalSuccesses / status.stats.totalRequests) *
                  100
                ).toFixed(2) + "%"
              : "N/A",
        });
      }
    });

    // Set up periodic health reporting
    this.healthReportInterval = setInterval(() => {
      const health = this.getHealthStatus();

      if (!health.overall.healthy) {
        console.warn(
          `[OutcomeMeasuresService] Periodic health report: Service degraded`,
          health
        );
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.healthReportInterval) {
      clearInterval(this.healthReportInterval);
    }

    if (this.circuitBreaker) {
      this.circuitBreaker.destroy();
    }
  }
}

export default OutcomeMeasuresServiceWithCircuitBreaker;
