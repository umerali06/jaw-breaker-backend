import EventEmitter from "events";

// Enhanced mock cache service for when Redis is not available
class MockCacheService extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.timers = new Map();
    this.defaultTTL = 3600; // 1 hour
    this.isConnected = true;

    // Performance monitoring
    this.performanceMetrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };

    console.log("🔄 Using enhanced mock cache service (Redis not available)");

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    setInterval(() => {
      this.resetPerformanceMetrics();
    }, 3600000);
  }

  resetPerformanceMetrics() {
    this.performanceMetrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };
    this.emit("metricsReset", this.performanceMetrics);
  }

  updatePerformanceMetrics(operation, responseTime = 0) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics[operation]++;

    const currentAvg = this.performanceMetrics.averageResponseTime;
    const totalRequests = this.performanceMetrics.totalRequests;
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;

    this.emit("performanceUpdate", {
      operation,
      responseTime,
      metrics: { ...this.performanceMetrics },
    });
  }

  async get(key) {
    const startTime = Date.now();

    try {
      const item = this.cache.get(key);
      const responseTime = Date.now() - startTime;

      if (item && (item.expiry === null || item.expiry > Date.now())) {
        this.updatePerformanceMetrics("hits", responseTime);
        this.emit("cacheHit", {
          key,
          size: JSON.stringify(item.value).length,
          responseTime,
          timestamp: new Date(),
        });
        return item.value;
      } else {
        // Remove expired item
        if (item) {
          this.cache.delete(key);
          this.clearTimer(key);
        }

        this.updatePerformanceMetrics("misses", responseTime);
        this.emit("cacheMiss", {
          key,
          responseTime,
          timestamp: new Date(),
        });
        return null;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("errors", responseTime);
      this.emit("cacheError", {
        key,
        error: error.message,
        responseTime,
        timestamp: new Date(),
      });
      return null;
    }
  }

  async set(key, value, ttl = null) {
    const startTime = Date.now();

    try {
      const expiration = ttl || this.defaultTTL;
      const expiry = expiration ? Date.now() + expiration * 1000 : null;

      this.cache.set(key, {
        value: JSON.parse(JSON.stringify(value)), // Deep copy
        expiry,
        created: Date.now(),
      });

      // Set expiration timer
      if (expiry) {
        this.setExpirationTimer(key, expiration * 1000);
      }

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("hits", responseTime);

      this.emit("cacheSet", {
        key,
        size: JSON.stringify(value).length,
        ttl: expiration,
        compressed: false,
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("errors", responseTime);
      console.error("Mock cache set error:", error);
      return false;
    }
  }

  async del(key) {
    try {
      const existed = this.cache.has(key);
      this.cache.delete(key);
      this.clearTimer(key);

      this.emit("cacheInvalidated", {
        key,
        timestamp: new Date(),
        success: existed,
      });

      return existed;
    } catch (error) {
      console.error("Mock cache delete error:", error);
      return false;
    }
  }

  async exists(key) {
    try {
      const item = this.cache.get(key);
      return item && (item.expiry === null || item.expiry > Date.now());
    } catch (error) {
      console.error("Mock cache exists error:", error);
      return false;
    }
  }

  async invalidate(key, strategy = "immediate") {
    try {
      return await this.del(key);
    } catch (error) {
      console.error("Mock cache invalidate error:", error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      let count = 0;

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          await this.del(key);
          count++;
        }
      }

      this.emit("patternInvalidation", {
        pattern,
        count,
        strategy: "immediate",
      });
      return count;
    } catch (error) {
      console.error("Mock cache pattern invalidation error:", error);
      return 0;
    }
  }

  async deletePattern(pattern) {
    return await this.invalidatePattern(pattern);
  }

  async mget(keys) {
    const results = {};
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    return results;
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      for (const [key, value] of Object.entries(keyValuePairs)) {
        await this.set(key, value, ttl);
      }
      return true;
    } catch (error) {
      console.error("Mock cache bulk set error:", error);
      return false;
    }
  }

  setExpirationTimer(key, ttl) {
    this.clearTimer(key);
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl);
    this.timers.set(key, timer);
  }

  clearTimer(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async healthCheck() {
    try {
      const testKey = "mock:health:check";
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 60);
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      return retrieved && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      console.error("Mock cache health check failed:", error);
      return false;
    }
  }

  async initialize() {
    console.log("✅ Mock Cache Service initialized");
    this.emit("connected");
    return true;
  }

  async cleanup() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  async shutdown() {
    await this.cleanup();
    this.emit("disconnected");
  }

  // Cache statistics
  getCacheSize() {
    return this.cache.size;
  }

  getMemoryUsage() {
    let totalSize = 0;
    for (const [key, item] of this.cache.entries()) {
      totalSize += JSON.stringify({ key, ...item }).length;
    }
    return totalSize;
  }

  calculateHitRate() {
    const total = this.performanceMetrics.hits + this.performanceMetrics.misses;
    return total > 0 ? (this.performanceMetrics.hits / total) * 100 : 0;
  }

  // Nursing-specific cache methods (simplified versions)
  async cacheOASISAssessment(userId, assessmentId, data, ttl = 7200) {
    const key = `nursing:oasis:${userId}:${assessmentId}`;
    return await this.set(key, data, ttl);
  }

  async getOASISAssessment(userId, assessmentId) {
    const key = `nursing:oasis:${userId}:${assessmentId}`;
    return await this.get(key);
  }

  async cacheSOAPNote(userId, noteId, data, ttl = 3600) {
    const key = `nursing:soap:${userId}:${noteId}`;
    return await this.set(key, data, ttl);
  }

  async getSOAPNote(userId, noteId) {
    const key = `nursing:soap:${userId}:${noteId}`;
    return await this.get(key);
  }

  async cacheProgressData(userId, patientId, data, ttl = 1800) {
    const key = `nursing:progress:${userId}:${patientId}`;
    return await this.set(key, data, ttl);
  }

  async getProgressData(userId, patientId) {
    const key = `nursing:progress:${userId}:${patientId}`;
    return await this.get(key);
  }

  async cacheOutcomeMeasures(userId, measures, ttl = 7200) {
    const key = `nursing:outcomes:${userId}`;
    return await this.set(key, measures, ttl);
  }

  async getOutcomeMeasures(userId) {
    const key = `nursing:outcomes:${userId}`;
    return await this.get(key);
  }

  async cacheMedicationList(userId, patientId, medications, ttl = 3600) {
    const key = `nursing:medications:${userId}:${patientId}`;
    return await this.set(key, medications, ttl);
  }

  async getMedicationList(userId, patientId) {
    const key = `nursing:medications:${userId}:${patientId}`;
    return await this.get(key);
  }

  async cacheAssessment(userId, assessmentId, data, ttl = 3600) {
    const key = `nursing:assessments:${userId}:${assessmentId}`;
    return await this.set(key, data, ttl);
  }

  async getAssessment(userId, assessmentId) {
    const key = `nursing:assessments:${userId}:${assessmentId}`;
    return await this.get(key);
  }

  async cacheRealTimeData(dataType, identifier, data, ttl = 300) {
    const key = `nursing:realtime:${dataType}:${identifier}`;
    return await this.set(key, data, ttl);
  }

  async getRealTimeData(dataType, identifier) {
    const key = `nursing:realtime:${dataType}:${identifier}`;
    return await this.get(key);
  }

  async cacheAIAnalysis(analysisType, patientId, userId, result, ttl = 1800) {
    const key = `nursing:ai:${analysisType}:${patientId}:${userId}`;
    return await this.set(key, result, ttl);
  }

  async getAIAnalysis(analysisType, patientId, userId) {
    const key = `nursing:ai:${analysisType}:${patientId}:${userId}`;
    return await this.get(key);
  }

  // User and session caching
  async cacheUserPreferences(userId, preferences, ttl = 86400) {
    const key = `nursing:user:preferences:${userId}`;
    return await this.set(key, preferences, ttl);
  }

  async getUserPreferences(userId) {
    const key = `nursing:user:preferences:${userId}`;
    return await this.get(key);
  }

  async cacheUserSession(userId, sessionData, ttl = 3600) {
    const key = `nursing:session:${userId}`;
    return await this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = `nursing:session:${userId}`;
    return await this.get(key);
  }

  // Invalidation methods
  async invalidateUserCache(userId) {
    const patterns = [
      `nursing:oasis:${userId}:*`,
      `nursing:soap:${userId}:*`,
      `nursing:progress:${userId}:*`,
      `nursing:outcomes:${userId}*`,
      `nursing:medications:${userId}:*`,
      `nursing:assessments:${userId}:*`,
      `nursing:user:*${userId}*`,
      `nursing:session:${userId}`,
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    console.log(
      `🗑️ Mock cache invalidated ${totalDeleted} entries for user ${userId}`
    );
    return totalDeleted;
  }

  async invalidatePatientCache(patientId) {
    const patterns = [
      `nursing:oasis:*:${patientId}`,
      `nursing:progress:*:${patientId}`,
      `nursing:medications:*:${patientId}`,
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    console.log(
      `🗑️ Mock cache invalidated ${totalDeleted} entries for patient ${patientId}`
    );
    return totalDeleted;
  }
}

export default MockCacheService;
