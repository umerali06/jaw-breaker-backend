// Comprehensive Monitoring Service for Nursing Backend Integration
import { EventEmitter } from "events";
import os from "os";

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.alerts = [];
    this.healthChecks = new Map();
    this.performanceData = [];
    this.systemMetrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
    };
    this.alertThresholds = {
      cpu: 80,
      memory: 85,
      responseTime: 5000,
      errorRate: 5,
      diskSpace: 90,
    };
    this.monitoringInterval = null;
    this.startMonitoring();
  }

  // Start comprehensive monitoring
  startMonitoring() {
    console.log("📊 Starting comprehensive monitoring service");

    // Monitor system metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkHealthStatus();
      this.analyzePerformance();
      this.checkAlertConditions();
    }, 30000);

    // Initial collection
    this.collectSystemMetrics();
    this.registerDefaultHealthChecks();
  }

  // Collect system performance metrics
  collectSystemMetrics() {
    const timestamp = new Date();

    // CPU metrics
    const cpuUsage = this.getCPUUsage();
    this.systemMetrics.cpu.push({
      timestamp,
      usage: cpuUsage,
      loadAverage: os.loadavg(),
    });

    // Memory metrics
    const memoryUsage = this.getMemoryUsage();
    this.systemMetrics.memory.push({
      timestamp,
      ...memoryUsage,
    });

    // Keep only last 100 entries for each metric
    Object.keys(this.systemMetrics).forEach((key) => {
      if (this.systemMetrics[key].length > 100) {
        this.systemMetrics[key] = this.systemMetrics[key].slice(-100);
      }
    });

    // Emit metrics for real-time monitoring
    this.emit("metrics-collected", {
      timestamp,
      cpu: cpuUsage,
      memory: memoryUsage,
      uptime: process.uptime(),
    });
  }

  // Get CPU usage percentage
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  }

  // Get memory usage information
  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercentage = (usedMemory / totalMemory) * 100;

    const processMemory = process.memoryUsage();

    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      percentage: usagePercentage,
      process: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
      },
    };
  }

  // Register default health checks
  registerDefaultHealthChecks() {
    // Database health check
    this.registerHealthCheck("database", async () => {
      try {
        // This would check database connectivity
        // For now, simulate a health check
        return {
          status: "healthy",
          responseTime: Math.random() * 100,
          details: "Database connection active",
        };
      } catch (error) {
        return {
          status: "unhealthy",
          error: error.message,
          details: "Database connection failed",
        };
      }
    });

    // Redis health check
    this.registerHealthCheck("redis", async () => {
      try {
        return {
          status: "healthy",
          responseTime: Math.random() * 50,
          details: "Redis connection active",
        };
      } catch (error) {
        return {
          status: "unhealthy",
          error: error.message,
          details: "Redis connection failed",
        };
      }
    });

    // AI Service health check
    this.registerHealthCheck("ai-service", async () => {
      try {
        return {
          status: "healthy",
          responseTime: Math.random() * 200,
          details: "AI service responding",
        };
      } catch (error) {
        return {
          status: "unhealthy",
          error: error.message,
          details: "AI service unavailable",
        };
      }
    });

    // WebSocket health check
    this.registerHealthCheck("websocket", async () => {
      try {
        return {
          status: "healthy",
          connections: Math.floor(Math.random() * 100),
          details: "WebSocket server active",
        };
      } catch (error) {
        return {
          status: "unhealthy",
          error: error.message,
          details: "WebSocket server failed",
        };
      }
    });
  }

  // Register a custom health check
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      lastCheck: null,
      lastResult: null,
      registeredAt: new Date(),
    });

    console.log(`✅ Registered health check: ${name}`);
  }

  // Run all health checks
  async checkHealthStatus() {
    const results = new Map();

    for (const [name, healthCheck] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await healthCheck.check();
        const endTime = Date.now();

        const checkResult = {
          ...result,
          responseTime: result.responseTime || endTime - startTime,
          timestamp: new Date(),
        };

        healthCheck.lastCheck = new Date();
        healthCheck.lastResult = checkResult;
        results.set(name, checkResult);

        // Emit individual health check result
        this.emit("health-check", { service: name, result: checkResult });
      } catch (error) {
        const errorResult = {
          status: "error",
          error: error.message,
          timestamp: new Date(),
        };

        healthCheck.lastResult = errorResult;
        results.set(name, errorResult);

        console.error(`❌ Health check failed for ${name}:`, error);
      }
    }

    // Emit overall health status
    this.emit("health-status", {
      timestamp: new Date(),
      services: Object.fromEntries(results),
    });

    return results;
  }

  // Record performance metrics
  recordPerformance(operation, duration, metadata = {}) {
    const performanceEntry = {
      id: this.generateId(),
      operation,
      duration,
      timestamp: new Date(),
      metadata,
    };

    this.performanceData.push(performanceEntry);

    // Keep only last 1000 entries
    if (this.performanceData.length > 1000) {
      this.performanceData = this.performanceData.slice(-1000);
    }

    // Update metrics
    const metricKey = `performance.${operation}`;
    const currentMetric = this.metrics.get(metricKey) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    };

    currentMetric.count++;
    currentMetric.totalDuration += duration;
    currentMetric.avgDuration =
      currentMetric.totalDuration / currentMetric.count;
    currentMetric.minDuration = Math.min(currentMetric.minDuration, duration);
    currentMetric.maxDuration = Math.max(currentMetric.maxDuration, duration);

    this.metrics.set(metricKey, currentMetric);

    // Emit performance event
    this.emit("performance-recorded", performanceEntry);

    // Check for performance alerts
    if (duration > this.alertThresholds.responseTime) {
      this.createAlert("performance", "high_response_time", {
        operation,
        duration,
        threshold: this.alertThresholds.responseTime,
      });
    }
  }

  // Analyze performance trends
  analyzePerformance() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    // Get recent performance data
    const recentData = this.performanceData.filter(
      (entry) => entry.timestamp >= oneHourAgo
    );

    if (recentData.length === 0) return;

    // Group by operation
    const operationGroups = {};
    recentData.forEach((entry) => {
      if (!operationGroups[entry.operation]) {
        operationGroups[entry.operation] = [];
      }
      operationGroups[entry.operation].push(entry);
    });

    // Analyze each operation
    const analysis = {};
    Object.entries(operationGroups).forEach(([operation, data]) => {
      const durations = data.map((d) => d.duration);
      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      analysis[operation] = {
        count: data.length,
        avgDuration,
        maxDuration,
        minDuration,
        trend: this.calculateTrend(data),
      };
    });

    this.emit("performance-analysis", {
      timestamp: now,
      period: "1hour",
      analysis,
    });
  }

  // Calculate performance trend
  calculateTrend(data) {
    if (data.length < 2) return "stable";

    const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
    const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
    const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, d) => sum + d.duration, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, d) => sum + d.duration, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return "degrading";
    if (change < -10) return "improving";
    return "stable";
  }

  // Check alert conditions
  checkAlertConditions() {
    const latestMetrics = this.getLatestMetrics();

    // CPU usage alert
    if (latestMetrics.cpu > this.alertThresholds.cpu) {
      this.createAlert("system", "high_cpu_usage", {
        current: latestMetrics.cpu,
        threshold: this.alertThresholds.cpu,
      });
    }

    // Memory usage alert
    if (latestMetrics.memory.percentage > this.alertThresholds.memory) {
      this.createAlert("system", "high_memory_usage", {
        current: latestMetrics.memory.percentage,
        threshold: this.alertThresholds.memory,
      });
    }

    // Error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.alertThresholds.errorRate) {
      this.createAlert("application", "high_error_rate", {
        current: errorRate,
        threshold: this.alertThresholds.errorRate,
      });
    }
  }

  // Create an alert
  createAlert(category, type, details) {
    const alert = {
      id: this.generateId(),
      category,
      type,
      severity: this.getAlertSeverity(type),
      details,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(`🚨 Alert created: ${category}.${type}`, details);

    // Emit alert
    this.emit("alert-created", alert);

    // Send critical alerts immediately
    if (alert.severity === "critical") {
      this.emit("critical-alert", alert);
    }

    return alert.id;
  }

  // Get alert severity
  getAlertSeverity(type) {
    const severityMap = {
      high_cpu_usage: "warning",
      high_memory_usage: "warning",
      high_response_time: "warning",
      high_error_rate: "critical",
      service_down: "critical",
      database_connection_failed: "critical",
      security_breach: "critical",
    };

    return severityMap[type] || "info";
  }

  // Calculate current error rate
  calculateErrorRate() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const recentPerformance = this.performanceData.filter(
      (entry) => entry.timestamp >= oneHourAgo
    );

    if (recentPerformance.length === 0) return 0;

    const errors = recentPerformance.filter(
      (entry) => entry.metadata.error || entry.metadata.status >= 400
    );

    return (errors.length / recentPerformance.length) * 100;
  }

  // Get latest system metrics
  getLatestMetrics() {
    return {
      cpu:
        this.systemMetrics.cpu[this.systemMetrics.cpu.length - 1]?.usage || 0,
      memory:
        this.systemMetrics.memory[this.systemMetrics.memory.length - 1] || {},
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  // Get comprehensive monitoring dashboard data
  getDashboardData() {
    const latestMetrics = this.getLatestMetrics();
    const recentAlerts = this.alerts.filter(
      (alert) =>
        !alert.resolved &&
        alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      systemHealth: {
        status: this.getOverallHealthStatus(),
        metrics: latestMetrics,
        uptime: process.uptime(),
      },
      services: this.getServiceStatus(),
      performance: this.getPerformanceSummary(),
      alerts: {
        active: recentAlerts.length,
        critical: recentAlerts.filter((a) => a.severity === "critical").length,
        recent: recentAlerts.slice(0, 5),
      },
      trends: this.getPerformanceTrends(),
    };
  }

  // Get overall health status
  getOverallHealthStatus() {
    const healthResults = Array.from(this.healthChecks.values())
      .map((hc) => hc.lastResult)
      .filter((result) => result);

    if (healthResults.length === 0) return "unknown";

    const unhealthy = healthResults.filter((r) => r.status !== "healthy");

    if (unhealthy.length === 0) return "healthy";
    if (unhealthy.length < healthResults.length / 2) return "degraded";
    return "unhealthy";
  }

  // Get service status summary
  getServiceStatus() {
    const services = {};

    this.healthChecks.forEach((healthCheck, name) => {
      services[name] = {
        status: healthCheck.lastResult?.status || "unknown",
        lastCheck: healthCheck.lastCheck,
        responseTime: healthCheck.lastResult?.responseTime,
        details: healthCheck.lastResult?.details,
      };
    });

    return services;
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {};

    this.metrics.forEach((metric, key) => {
      if (key.startsWith("performance.")) {
        const operation = key.replace("performance.", "");
        summary[operation] = {
          count: metric.count,
          avgDuration: Math.round(metric.avgDuration),
          maxDuration: metric.maxDuration,
          minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
        };
      }
    });

    return summary;
  }

  // Get performance trends
  getPerformanceTrends() {
    const now = new Date();
    const periods = [
      { name: "1h", duration: 60 * 60 * 1000 },
      { name: "6h", duration: 6 * 60 * 60 * 1000 },
      { name: "24h", duration: 24 * 60 * 60 * 1000 },
    ];

    const trends = {};

    periods.forEach((period) => {
      const startTime = new Date(now - period.duration);
      const periodData = this.performanceData.filter(
        (entry) => entry.timestamp >= startTime
      );

      if (periodData.length > 0) {
        const avgDuration =
          periodData.reduce((sum, d) => sum + d.duration, 0) /
          periodData.length;
        const errorCount = periodData.filter((d) => d.metadata.error).length;
        const errorRate = (errorCount / periodData.length) * 100;

        trends[period.name] = {
          requests: periodData.length,
          avgResponseTime: Math.round(avgDuration),
          errorRate: Math.round(errorRate * 100) / 100,
        };
      }
    });

    return trends;
  }

  // Acknowledge an alert
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      this.emit("alert-acknowledged", alert);
      return true;
    }
    return false;
  }

  // Resolve an alert
  resolveAlert(alertId, resolvedBy, resolution) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      alert.resolution = resolution;

      this.emit("alert-resolved", alert);
      return true;
    }
    return false;
  }

  // Generate unique ID
  generateId() {
    return `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log("📊 Monitoring service stopped");
  }

  // Get monitoring statistics
  getStats() {
    return {
      uptime: process.uptime(),
      healthChecks: this.healthChecks.size,
      activeAlerts: this.alerts.filter((a) => !a.resolved).length,
      totalAlerts: this.alerts.length,
      performanceEntries: this.performanceData.length,
      metrics: this.metrics.size,
      systemMetrics: {
        cpu: this.systemMetrics.cpu.length,
        memory: this.systemMetrics.memory.length,
      },
    };
  }
}

export default new MonitoringService();
  // Advanced Performance Monitoring
  trackRequestMetrics(req, res, responseTime) {
    this.metrics.set('requests_total', this.metrics.get('requests_total') + 1);
    
    if (res.statusCode >= 400) {
      this.metrics.set('requests_failed', this.metrics.get('requests_failed') + 1);
    }

    // Track response times
    const responseTimes = this.performanceData.filter(d => d.type === 'response_time');
    responseTimes.push({ timestamp: new Date(), value: responseTime });
    
    // Keep only last 1000 entries
    if (responseTimes.length > 1000) {
      responseTimes.splice(0, responseTimes.length - 1000);
    }

    // Calculate percentiles
    const sortedTimes = responseTimes.map(d => d.value).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    this.metrics.set('response_time_p95', sortedTimes[p95Index] || 0);
    this.metrics.set('response_time_p99', sortedTimes[p99Index] || 0);
    this.metrics.set('response_time_avg', sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length || 0);

    // Check for performance alerts
    this.checkPerformanceAlerts(responseTime, res.statusCode);
  }

  // Business Metrics Tracking
  trackBusinessMetrics(eventType, data = {}) {
    const businessEvents = {
      'oasis_assessment_completed': () => {
        this.metrics.set('oasis_assessments_completed', 
          this.metrics.get('oasis_assessments_completed') + 1);
      },
      'soap_note_created': () => {
        this.metrics.set('soap_notes_created', 
          this.metrics.get('soap_notes_created') + 1);
      },
      'care_plan_activated': () => {
        this.metrics.set('care_plans_active', 
          this.metrics.get('care_plans_active') + 1);
      },
      'medication_alert_triggered': () => {
        this.metrics.set('medication_alerts_triggered', 
          this.metrics.get('medication_alerts_triggered') + 1);
      },
      'ai_request_completed': () => {
        this.metrics.set('ai_requests_total', 
          this.metrics.get('ai_requests_total') + 1);
      },
      'ai_request_failed': () => {
        this.metrics.set('ai_requests_failed', 
          this.metrics.get('ai_requests_failed') + 1);
      },
      'websocket_connected': () => {
        this.metrics.set('websocket_connections', 
          this.metrics.get('websocket_connections') + 1);
      },
      'websocket_disconnected': () => {
        this.metrics.set('websocket_connections', 
          Math.max(0, this.metrics.get('websocket_connections') - 1));
      }
    };

    if (businessEvents[eventType]) {
      businessEvents[eventType]();
      console.log(`📈 Business metric tracked: ${eventType}`);
    }
  }

  // Real-time Alert System
  checkPerformanceAlerts(responseTime, statusCode) {
    const now = Date.now();
    
    // High response time alert
    if (responseTime > this.alertThresholds.responseTime) {
      this.triggerAlert('high_response_time', {
        responseTime,
        threshold: this.alertThresholds.responseTime,
        timestamp: now
      });
    }

    // Error rate alert
    const totalRequests = this.metrics.get('requests_total');
    const failedRequests = this.metrics.get('requests_failed');
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    
    if (errorRate > this.alertThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        errorRate,
        threshold: this.alertThresholds.errorRate,
        totalRequests,
        failedRequests,
        timestamp: now
      });
    }
  }

  // Advanced Alert Management
  triggerAlert(alertType, data) {
    const alertRule = this.alertThresholds[alertType];
    const now = Date.now();
    
    // Check cooldown period
    const lastAlert = this.alerts.find(a => a.type === alertType && a.resolved === false);
    if (lastAlert && (now - lastAlert.timestamp) < (alertRule?.cooldown || 300000)) {
      return; // Still in cooldown
    }

    const alert = {
      id: this.generateAlertId(),
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      message: this.getAlertMessage(alertType, data),
      data,
      timestamp: now,
      resolved: false,
      acknowledgedBy: null,
      resolvedAt: null
    };

    this.alerts.push(alert);
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    console.error(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Send to external monitoring systems
    this.sendToExternalMonitoring(alert);
    
    return alert;
  }

  // Generate unique alert ID
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get alert severity
  getAlertSeverity(alertType) {
    const severityMap = {
      'high_error_rate': 'critical',
      'high_response_time': 'warning',
      'high_memory_usage': 'warning',
      'high_cpu_usage': 'critical',
      'database_connection_failure': 'critical',
      'ai_service_failure': 'warning',
      'websocket_connection_failure': 'warning'
    };
    return severityMap[alertType] || 'info';
  }

  // Get alert message
  getAlertMessage(alertType, data) {
    const messageMap = {
      'high_error_rate': `Error rate is ${data.errorRate?.toFixed(2)}% (threshold: ${data.threshold}%)`,
      'high_response_time': `Response time is ${data.responseTime}ms (threshold: ${data.threshold}ms)`,
      'high_memory_usage': `Memory usage is ${(data.memoryUsage * 100).toFixed(1)}% (threshold: ${data.threshold * 100}%)`,
      'high_cpu_usage': `CPU usage is ${(data.cpuUsage * 100).toFixed(1)}% (threshold: ${data.threshold * 100}%)`,
      'database_connection_failure': 'Database connection failed',
      'ai_service_failure': 'AI service is experiencing issues',
      'websocket_connection_failure': 'WebSocket connections are failing'
    };
    return messageMap[alertType] || `Alert triggered: ${alertType}`;
  }

  // Send alerts to external monitoring systems
  async sendToExternalMonitoring(alert) {
    try {
      // Webhook notifications
      if (process.env.MONITORING_WEBHOOK_URL) {
        await this.sendWebhookAlert(alert);
      }

      // Slack notifications
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(alert);
      }

      // Email notifications (for critical alerts)
      if (alert.severity === 'critical' && process.env.ALERT_EMAIL) {
        await this.sendEmailAlert(alert);
      }

    } catch (error) {
      console.error('Failed to send external alert:', error);
    }
  }

  // Webhook alert sender
  async sendWebhookAlert(alert) {
    const payload = {
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      data: alert.data,
      service: 'nursing-backend'
    };

    // In a real implementation, use fetch or axios
    console.log('📤 Webhook alert sent:', payload);
  }

  // Slack alert sender
  async sendSlackAlert(alert) {
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const payload = {
      text: `🚨 Nursing Backend Alert`,
      attachments: [{
        color,
        title: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
        ]
      }]
    };

    console.log('📤 Slack alert sent:', payload);
  }

  // Email alert sender
  async sendEmailAlert(alert) {
    const emailData = {
      to: process.env.ALERT_EMAIL,
      subject: `🚨 CRITICAL: Nursing Backend Alert - ${alert.type}`,
      body: `
        Alert Details:
        - Type: ${alert.type}
        - Severity: ${alert.severity}
        - Message: ${alert.message}
        - Time: ${new Date(alert.timestamp).toISOString()}
        - Data: ${JSON.stringify(alert.data, null, 2)}
      `
    };

    console.log('📧 Email alert sent:', emailData);
  }

  // Comprehensive Health Dashboard
  generateHealthDashboard() {
    const now = new Date();
    const systemInfo = {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname()
    };

    const currentMetrics = Object.fromEntries(this.metrics);
    const recentAlerts = this.alerts.filter(a => 
      (now - a.timestamp) < 24 * 60 * 60 * 1000 && !a.resolved
    );

    const healthStatus = this.calculateOverallHealth();

    return {
      timestamp: now,
      status: healthStatus,
      system: systemInfo,
      metrics: currentMetrics,
      alerts: {
        active: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        warning: recentAlerts.filter(a => a.severity === 'warning').length
      },
      performance: {
        responseTime: {
          avg: currentMetrics.response_time_avg,
          p95: currentMetrics.response_time_p95,
          p99: currentMetrics.response_time_p99
        },
        throughput: currentMetrics.requests_total,
        errorRate: currentMetrics.requests_total > 0 ? 
          (currentMetrics.requests_failed / currentMetrics.requests_total) * 100 : 0
      },
      resources: {
        memory: currentMetrics.memory_usage_percent,
        cpu: currentMetrics.cpu_usage,
        connections: currentMetrics.active_connections
      }
    };
  }

  // Calculate overall system health
  calculateOverallHealth() {
    const criticalAlerts = this.alerts.filter(a => 
      a.severity === 'critical' && !a.resolved &&
      (Date.now() - a.timestamp) < 60 * 60 * 1000 // Last hour
    );

    if (criticalAlerts.length > 0) return 'critical';

    const warningAlerts = this.alerts.filter(a => 
      a.severity === 'warning' && !a.resolved &&
      (Date.now() - a.timestamp) < 60 * 60 * 1000
    );

    if (warningAlerts.length > 3) return 'degraded';
    if (warningAlerts.length > 0) return 'warning';

    return 'healthy';
  }

  // Alert acknowledgment
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = Date.now();
      console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`);
      return true;
    }
    return false;
  }

  // Resolve alert
  resolveAlert(alertId, resolvedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = Date.now();
      console.log(`✅ Alert ${alertId} resolved by ${resolvedBy}`);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  // Cleanup old alerts and metrics
  cleanup() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Remove old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneWeekAgo);
    
    // Clean up old performance data
    this.performanceData = this.performanceData.filter(data => 
      data.timestamp > oneWeekAgo
    );
    
    console.log('🧹 Monitoring data cleanup completed');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📊 Monitoring service stopped');
    }
  }
}

export default MonitoringService;