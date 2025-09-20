import EventEmitter from "events";

class WebSocketConnectionMonitor extends EventEmitter {
  constructor(webSocketManager) {
    super();
    this.wsManager = webSocketManager;
    this.connectionMetrics = new Map();
    this.alertThresholds = {
      maxConnectionsPerUser: 5,
      maxInactiveTime: 300000, // 5 minutes
      maxReconnectAttempts: 10,
      connectionRateLimit: 100, // per minute
    };
    this.monitoringInterval = null;
    this.connectionRateTracker = new Map();
    this.isMonitoring = false;
  }

  // Start monitoring WebSocket connections
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Set up event listeners for WebSocket manager
    this.setupEventListeners();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    console.log("🔍 WebSocket Connection Monitor started");
  }

  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Remove event listeners
    this.wsManager.removeAllListeners("user_connected");
    this.wsManager.removeAllListeners("user_disconnected");
    this.wsManager.removeAllListeners("nursing_update");

    console.log("🔍 WebSocket Connection Monitor stopped");
  }

  // Set up event listeners for WebSocket manager
  setupEventListeners() {
    // Monitor user connections
    this.wsManager.on("user_connected", (data) => {
      this.handleUserConnected(data);
    });

    // Monitor user disconnections
    this.wsManager.on("user_disconnected", (data) => {
      this.handleUserDisconnected(data);
    });

    // Monitor nursing updates
    this.wsManager.on("nursing_update", (data) => {
      this.handleNursingUpdate(data);
    });
  }

  // Handle user connection events
  handleUserConnected(data) {
    const { userId, connectionCount } = data;
    const now = Date.now();

    // Initialize or update connection metrics
    if (!this.connectionMetrics.has(userId)) {
      this.connectionMetrics.set(userId, {
        userId,
        firstConnected: now,
        lastConnected: now,
        totalConnections: 0,
        currentConnections: 0,
        reconnectAttempts: 0,
        lastActivity: now,
        totalDataSent: 0,
        totalDataReceived: 0,
        errors: [],
      });
    }

    const metrics = this.connectionMetrics.get(userId);
    metrics.lastConnected = now;
    metrics.totalConnections++;
    metrics.currentConnections = connectionCount;
    metrics.lastActivity = now;
    metrics.reconnectAttempts = 0; // Reset on successful connection

    // Check connection rate limiting
    this.checkConnectionRateLimit(userId);

    // Check for excessive connections
    if (connectionCount > this.alertThresholds.maxConnectionsPerUser) {
      this.emitAlert("excessive_connections", {
        userId,
        connectionCount,
        threshold: this.alertThresholds.maxConnectionsPerUser,
      });
    }

    // Emit monitoring event
    this.emit("connection_monitored", {
      type: "connected",
      userId,
      metrics: { ...metrics },
    });
  }

  // Handle user disconnection events
  handleUserDisconnected(data) {
    const { userId, code, reason } = data;
    const now = Date.now();

    if (this.connectionMetrics.has(userId)) {
      const metrics = this.connectionMetrics.get(userId);
      metrics.currentConnections = Math.max(0, metrics.currentConnections - 1);

      // Track abnormal disconnections
      if (code !== 1000 && code !== 1001) {
        // Not normal or going away
        metrics.reconnectAttempts++;
        metrics.errors.push({
          timestamp: now,
          type: "abnormal_disconnect",
          code,
          reason,
        });

        // Check for excessive reconnect attempts
        if (
          metrics.reconnectAttempts > this.alertThresholds.maxReconnectAttempts
        ) {
          this.emitAlert("excessive_reconnects", {
            userId,
            attempts: metrics.reconnectAttempts,
            threshold: this.alertThresholds.maxReconnectAttempts,
          });
        }
      }

      // Emit monitoring event
      this.emit("connection_monitored", {
        type: "disconnected",
        userId,
        code,
        reason,
        metrics: { ...metrics },
      });
    }
  }

  // Handle nursing update events
  handleNursingUpdate(data) {
    const { userId } = data;
    const now = Date.now();

    if (this.connectionMetrics.has(userId)) {
      const metrics = this.connectionMetrics.get(userId);
      metrics.lastActivity = now;
      metrics.totalDataSent++;
    }
  }

  // Check connection rate limiting
  checkConnectionRateLimit(userId) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.connectionRateTracker.has(userId)) {
      this.connectionRateTracker.set(userId, []);
    }

    const connections = this.connectionRateTracker.get(userId);

    // Remove old connections outside the window
    const recentConnections = connections.filter((time) => time > windowStart);
    recentConnections.push(now);

    this.connectionRateTracker.set(userId, recentConnections);

    // Check if rate limit exceeded
    if (recentConnections.length > this.alertThresholds.connectionRateLimit) {
      this.emitAlert("connection_rate_limit", {
        userId,
        connectionsInWindow: recentConnections.length,
        threshold: this.alertThresholds.connectionRateLimit,
      });
    }
  }

  // Perform periodic health check
  performHealthCheck() {
    const now = Date.now();
    const stats = this.wsManager.getStats();

    // Check for inactive connections
    for (const [userId, metrics] of this.connectionMetrics.entries()) {
      const inactiveTime = now - metrics.lastActivity;

      if (
        inactiveTime > this.alertThresholds.maxInactiveTime &&
        metrics.currentConnections > 0
      ) {
        this.emitAlert("inactive_connection", {
          userId,
          inactiveTime,
          threshold: this.alertThresholds.maxInactiveTime,
        });
      }
    }

    // Emit health check event
    this.emit("health_check", {
      timestamp: now,
      stats,
      activeUsers: this.connectionMetrics.size,
      totalMetrics: this.getAggregatedMetrics(),
    });
  }

  // Emit alert
  emitAlert(type, data) {
    const alert = {
      type,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(type),
      data,
    };

    console.warn(`🚨 WebSocket Alert [${type}]:`, data);
    this.emit("alert", alert);
  }

  // Get alert severity
  getAlertSeverity(type) {
    const severityMap = {
      excessive_connections: "medium",
      excessive_reconnects: "high",
      connection_rate_limit: "high",
      inactive_connection: "low",
      connection_error: "medium",
    };

    return severityMap[type] || "low";
  }

  // Get aggregated metrics
  getAggregatedMetrics() {
    const metrics = {
      totalUsers: this.connectionMetrics.size,
      totalConnections: 0,
      totalReconnectAttempts: 0,
      totalErrors: 0,
      averageConnectionsPerUser: 0,
      mostActiveUser: null,
      oldestConnection: null,
    };

    let maxConnections = 0;
    let oldestTime = Date.now();

    for (const [userId, userMetrics] of this.connectionMetrics.entries()) {
      metrics.totalConnections += userMetrics.totalConnections;
      metrics.totalReconnectAttempts += userMetrics.reconnectAttempts;
      metrics.totalErrors += userMetrics.errors.length;

      if (userMetrics.totalConnections > maxConnections) {
        maxConnections = userMetrics.totalConnections;
        metrics.mostActiveUser = userId;
      }

      if (userMetrics.firstConnected < oldestTime) {
        oldestTime = userMetrics.firstConnected;
        metrics.oldestConnection = userId;
      }
    }

    if (metrics.totalUsers > 0) {
      metrics.averageConnectionsPerUser =
        metrics.totalConnections / metrics.totalUsers;
    }

    return metrics;
  }

  // Get user metrics
  getUserMetrics(userId) {
    return this.connectionMetrics.get(userId) || null;
  }

  // Get all metrics
  getAllMetrics() {
    return Array.from(this.connectionMetrics.values());
  }

  // Update alert thresholds
  updateThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    console.log(
      "🔧 WebSocket monitoring thresholds updated:",
      this.alertThresholds
    );
  }

  // Clear metrics for a user
  clearUserMetrics(userId) {
    this.connectionMetrics.delete(userId);
    this.connectionRateTracker.delete(userId);
  }

  // Clear all metrics
  clearAllMetrics() {
    this.connectionMetrics.clear();
    this.connectionRateTracker.clear();
  }

  // Get monitoring status
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      thresholds: this.alertThresholds,
      metrics: this.getAggregatedMetrics(),
      wsStats: this.wsManager.getStats(),
    };
  }
}

export default WebSocketConnectionMonitor;
