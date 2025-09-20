import EventEmitter from "events";

class CacheMonitoringService extends EventEmitter {
  constructor(cacheService) {
    super();
    this.cacheService = cacheService;
    this.monitoringData = {
      startTime: Date.now(),
      totalOperations: 0,
      operationsByType: {},
      errorsByType: {},
      performanceHistory: [],
      alerts: [],
    };

    this.thresholds = {
      hitRateWarning: 70, // Warn if hit rate drops below 70%
      hitRateCritical: 50, // Critical if hit rate drops below 50%
      responseTimeWarning: 100, // Warn if average response time > 100ms
      responseTimeCritical: 500, // Critical if average response time > 500ms
      errorRateWarning: 5, // Warn if error rate > 5%
      errorRateCritical: 15, // Critical if error rate > 15%
    };

    this.setupEventListeners();
    this.startPeriodicReporting();
  }

  setupEventListeners() {
    if (!this.cacheService) return;

    // Listen to cache events
    this.cacheService.on("cacheHit", (data) => {
      this.recordOperation("hit", data);
    });

    this.cacheService.on("cacheMiss", (data) => {
      this.recordOperation("miss", data);
    });

    this.cacheService.on("cacheSet", (data) => {
      this.recordOperation("set", data);
    });

    this.cacheService.on("cacheError", (data) => {
      this.recordError("cache_error", data);
    });

    this.cacheService.on("cacheInvalidated", (data) => {
      this.recordOperation("invalidation", data);
    });

    this.cacheService.on("performanceUpdate", (data) => {
      this.updatePerformanceHistory(data);
    });

    this.cacheService.on("metricsReset", (data) => {
      this.handleMetricsReset(data);
    });
  }

  recordOperation(type, data) {
    this.monitoringData.totalOperations++;

    if (!this.monitoringData.operationsByType[type]) {
      this.monitoringData.operationsByType[type] = 0;
    }
    this.monitoringData.operationsByType[type]++;

    // Check for performance issues
    this.checkPerformanceThresholds(data);

    // Emit monitoring event
    this.emit("operationRecorded", {
      type,
      data,
      totalOperations: this.monitoringData.totalOperations,
    });
  }

  recordError(type, data) {
    if (!this.monitoringData.errorsByType[type]) {
      this.monitoringData.errorsByType[type] = 0;
    }
    this.monitoringData.errorsByType[type]++;

    // Create alert for errors
    this.createAlert("error", `Cache error: ${data.error}`, {
      type,
      key: data.key,
      error: data.error,
      timestamp: data.timestamp,
    });

    // Emit error event
    this.emit("errorRecorded", {
      type,
      data,
      totalErrors: this.getTotalErrors(),
    });
  }

  updatePerformanceHistory(data) {
    const historyEntry = {
      timestamp: Date.now(),
      operation: data.operation,
      responseTime: data.responseTime,
      metrics: data.metrics,
    };

    this.monitoringData.performanceHistory.push(historyEntry);

    // Keep only last 1000 entries
    if (this.monitoringData.performanceHistory.length > 1000) {
      this.monitoringData.performanceHistory.shift();
    }

    // Check thresholds
    this.checkPerformanceThresholds(data);
  }

  checkPerformanceThresholds(data) {
    const metrics = data.metrics || this.getCurrentMetrics();
    if (!metrics) return;

    // Check hit rate
    const hitRate = this.calculateHitRate(metrics);
    if (hitRate < this.thresholds.hitRateCritical) {
      this.createAlert(
        "critical",
        `Cache hit rate critically low: ${hitRate.toFixed(2)}%`,
        {
          hitRate,
          threshold: this.thresholds.hitRateCritical,
        }
      );
    } else if (hitRate < this.thresholds.hitRateWarning) {
      this.createAlert(
        "warning",
        `Cache hit rate low: ${hitRate.toFixed(2)}%`,
        {
          hitRate,
          threshold: this.thresholds.hitRateWarning,
        }
      );
    }

    // Check response time
    const avgResponseTime = metrics.averageResponseTime;
    if (avgResponseTime > this.thresholds.responseTimeCritical) {
      this.createAlert(
        "critical",
        `Cache response time critically high: ${avgResponseTime.toFixed(2)}ms`,
        {
          responseTime: avgResponseTime,
          threshold: this.thresholds.responseTimeCritical,
        }
      );
    } else if (avgResponseTime > this.thresholds.responseTimeWarning) {
      this.createAlert(
        "warning",
        `Cache response time high: ${avgResponseTime.toFixed(2)}ms`,
        {
          responseTime: avgResponseTime,
          threshold: this.thresholds.responseTimeWarning,
        }
      );
    }

    // Check error rate
    const errorRate = this.calculateErrorRate(metrics);
    if (errorRate > this.thresholds.errorRateCritical) {
      this.createAlert(
        "critical",
        `Cache error rate critically high: ${errorRate.toFixed(2)}%`,
        {
          errorRate,
          threshold: this.thresholds.errorRateCritical,
        }
      );
    } else if (errorRate > this.thresholds.errorRateWarning) {
      this.createAlert(
        "warning",
        `Cache error rate high: ${errorRate.toFixed(2)}%`,
        {
          errorRate,
          threshold: this.thresholds.errorRateWarning,
        }
      );
    }
  }

  createAlert(level, message, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      data,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.monitoringData.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.monitoringData.alerts.length > 100) {
      this.monitoringData.alerts.shift();
    }

    // Emit alert
    this.emit("alert", alert);

    // Log critical alerts
    if (level === "critical") {
      console.error(`🚨 CRITICAL CACHE ALERT: ${message}`, data);
    } else if (level === "warning") {
      console.warn(`⚠️ CACHE WARNING: ${message}`, data);
    }

    return alert;
  }

  acknowledgeAlert(alertId) {
    const alert = this.monitoringData.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      this.emit("alertAcknowledged", alert);
      return true;
    }
    return false;
  }

  getCurrentMetrics() {
    if (!this.cacheService || !this.cacheService.performanceMetrics) {
      return null;
    }
    return this.cacheService.performanceMetrics;
  }

  calculateHitRate(metrics = null) {
    const m = metrics || this.getCurrentMetrics();
    if (!m) return 0;

    const total = m.hits + m.misses;
    return total > 0 ? (m.hits / total) * 100 : 0;
  }

  calculateErrorRate(metrics = null) {
    const m = metrics || this.getCurrentMetrics();
    if (!m) return 0;

    const total = m.totalRequests;
    return total > 0 ? (m.errors / total) * 100 : 0;
  }

  getTotalErrors() {
    return Object.values(this.monitoringData.errorsByType).reduce(
      (sum, count) => sum + count,
      0
    );
  }

  getMonitoringReport() {
    const currentMetrics = this.getCurrentMetrics();
    const uptime = Date.now() - this.monitoringData.startTime;

    return {
      uptime,
      totalOperations: this.monitoringData.totalOperations,
      operationsByType: { ...this.monitoringData.operationsByType },
      errorsByType: { ...this.monitoringData.errorsByType },
      currentMetrics,
      hitRate: this.calculateHitRate(currentMetrics),
      errorRate: this.calculateErrorRate(currentMetrics),
      totalErrors: this.getTotalErrors(),
      activeAlerts: this.monitoringData.alerts.filter((a) => !a.acknowledged),
      totalAlerts: this.monitoringData.alerts.length,
      performanceHistory: this.monitoringData.performanceHistory.slice(-10), // Last 10 entries
      cacheType: this.cacheService?.constructor?.name || "Unknown",
    };
  }

  getPerformanceTrends(minutes = 60) {
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    const recentHistory = this.monitoringData.performanceHistory.filter(
      (entry) => entry.timestamp > cutoffTime
    );

    if (recentHistory.length === 0) {
      return null;
    }

    // Calculate trends
    const responseTimes = recentHistory
      .map((entry) => entry.responseTime)
      .filter((rt) => rt > 0);
    const hitRates = recentHistory
      .map((entry) => this.calculateHitRate(entry.metrics))
      .filter((hr) => hr > 0);

    return {
      timeRange: minutes,
      dataPoints: recentHistory.length,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg:
          responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
      },
      hitRate: {
        min: Math.min(...hitRates),
        max: Math.max(...hitRates),
        avg: hitRates.reduce((sum, hr) => sum + hr, 0) / hitRates.length,
      },
    };
  }

  handleMetricsReset(data) {
    console.log("📊 Cache metrics reset", data);
    this.emit("metricsReset", {
      previousMetrics: data,
      resetTime: new Date(),
    });
  }

  startPeriodicReporting() {
    // Generate report every 5 minutes
    setInterval(() => {
      const report = this.getMonitoringReport();
      this.emit("periodicReport", report);

      // Log summary
      console.log(`📊 Cache Performance Summary:
        Hit Rate: ${report.hitRate.toFixed(2)}%
        Avg Response Time: ${
          report.currentMetrics?.averageResponseTime?.toFixed(2) || 0
        }ms
        Total Operations: ${report.totalOperations}
        Active Alerts: ${report.activeAlerts.length}
        Cache Type: ${report.cacheType}`);
    }, 5 * 60 * 1000);

    // Generate detailed report every hour
    setInterval(() => {
      const report = this.getMonitoringReport();
      const trends = this.getPerformanceTrends(60);

      this.emit("hourlyReport", {
        report,
        trends,
        timestamp: new Date(),
      });
    }, 60 * 60 * 1000);
  }

  // Health check for monitoring service
  healthCheck() {
    try {
      const report = this.getMonitoringReport();
      const criticalAlerts = this.monitoringData.alerts.filter(
        (a) => a.level === "critical" && !a.acknowledged
      );

      return {
        healthy: criticalAlerts.length === 0,
        criticalAlerts: criticalAlerts.length,
        totalOperations: report.totalOperations,
        uptime: report.uptime,
        lastUpdate: new Date(),
      };
    } catch (error) {
      console.error("Cache monitoring health check failed:", error);
      return {
        healthy: false,
        error: error.message,
        lastUpdate: new Date(),
      };
    }
  }

  // Cleanup method
  cleanup() {
    // Clear any intervals if needed
    this.removeAllListeners();
    this.monitoringData = {
      startTime: Date.now(),
      totalOperations: 0,
      operationsByType: {},
      errorsByType: {},
      performanceHistory: [],
      alerts: [],
    };
  }
}

export default CacheMonitoringService;
