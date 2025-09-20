import redis from "redis";
import StorageOptimizationService from "./StorageOptimizationService.js";
import EventEmitter from "events";

class NursingCacheService extends EventEmitter {
  constructor() {
    super();
    this.redisClient = null;
    this.storageService = new StorageOptimizationService();
    this.defaultTTL = 3600; // 1 hour
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;

    // Performance monitoring
    this.performanceMetrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };

    this.cachePrefixes = {
      oasis: "nursing:oasis:",
      soap: "nursing:soap:",
      progress: "nursing:progress:",
      outcomes: "nursing:outcomes:",
      medications: "nursing:medications:",
      assessments: "nursing:assessments:",
      clinical: "nursing:clinical:",
      careplans: "nursing:careplans:",
      user: "nursing:user:",
      session: "nursing:session:",
      realtime: "nursing:realtime:",
      ai: "nursing:ai:",
      sync: "nursing:sync:",
    };

    // Cache invalidation strategies
    this.invalidationStrategies = {
      immediate: "immediate",
      delayed: "delayed",
      batch: "batch",
      smart: "smart",
    };

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  // Enhanced performance monitoring
  startPerformanceMonitoring() {
    // Reset metrics every hour
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

    // Update average response time
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const totalRequests = this.performanceMetrics.totalRequests;
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;

    // Emit performance event for monitoring
    this.emit("performanceUpdate", {
      operation,
      responseTime,
      metrics: { ...this.performanceMetrics },
    });
  }

  // Enhanced invalidation with strategies
  async invalidate(key, strategy = this.invalidationStrategies.immediate) {
    const startTime = Date.now();

    try {
      let result;

      switch (strategy) {
        case this.invalidationStrategies.immediate:
          result = await this.remove(key);
          break;

        case this.invalidationStrategies.delayed:
          // Schedule for later invalidation
          setTimeout(() => this.remove(key), 5000);
          result = true;
          break;

        case this.invalidationStrategies.batch:
          // Add to batch invalidation queue
          await this.addToBatchInvalidation(key);
          result = true;
          break;

        case this.invalidationStrategies.smart:
          // Smart invalidation based on key type and usage
          result = await this.smartInvalidate(key);
          break;

        default:
          result = await this.remove(key);
      }

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("hits", responseTime);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("errors", responseTime);
      console.error("Cache invalidation error:", error);
      return false;
    }
  }

  // Smart invalidation based on key patterns and usage
  async smartInvalidate(key) {
    try {
      // Check if key exists and get its TTL
      const exists = await this.exists(key);
      if (!exists) return true;

      const ttl = await this.redisClient.ttl(key);
      const idleTime = await this.redisClient.objectIdletime(key);

      // If key is rarely accessed and has long TTL, just let it expire
      if (idleTime > 3600 && ttl > 1800) {
        await this.redisClient.expire(key, 60); // Expire in 1 minute
        return true;
      }

      // Otherwise, remove immediately
      return await this.remove(key);
    } catch (error) {
      console.error("Smart invalidation error:", error);
      return await this.remove(key);
    }
  }

  // Batch invalidation queue
  async addToBatchInvalidation(key) {
    const batchKey = "nursing:batch:invalidation";
    await this.redisClient.sAdd(batchKey, key);
    await this.redisClient.expire(batchKey, 300); // Process within 5 minutes
  }

  // Process batch invalidations
  async processBatchInvalidations() {
    try {
      const batchKey = "nursing:batch:invalidation";
      const keys = await this.redisClient.sMembers(batchKey);

      if (keys.length > 0) {
        await this.redisClient.del(keys);
        await this.redisClient.del(batchKey);

        console.log(`🗑️ Batch invalidated ${keys.length} cache entries`);
        this.emit("batchInvalidation", { count: keys.length, keys });
      }

      return keys.length;
    } catch (error) {
      console.error("Batch invalidation processing error:", error);
      return 0;
    }
  }

  // Invalidate cache entries by pattern with enhanced strategy
  async invalidatePattern(
    pattern,
    strategy = this.invalidationStrategies.immediate
  ) {
    const startTime = Date.now();

    try {
      const keys = await this.redisClient.keys(pattern);
      let result = 0;

      if (keys.length === 0) return 0;

      switch (strategy) {
        case this.invalidationStrategies.immediate:
          result = await this.deletePattern(pattern);
          break;

        case this.invalidationStrategies.batch:
          for (const key of keys) {
            await this.addToBatchInvalidation(key);
          }
          result = keys.length;
          break;

        case this.invalidationStrategies.smart:
          for (const key of keys) {
            await this.smartInvalidate(key);
          }
          result = keys.length;
          break;

        default:
          result = await this.deletePattern(pattern);
      }

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("hits", responseTime);

      this.emit("patternInvalidation", { pattern, count: result, strategy });
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("errors", responseTime);
      console.error("Pattern invalidation error:", error);
      return 0;
    }
  }

  // Remove data from cache
  async remove(key) {
    try {
      if (!this.redisClient) {
        console.warn("Redis client not initialized");
        return false;
      }

      const result = await this.redisClient.del(key);

      // Emit cache invalidation event
      this.emit("cacheInvalidated", {
        key,
        timestamp: new Date(),
        success: result > 0,
      });

      return result > 0;
    } catch (error) {
      console.error("Error removing from cache:", error);
      return false;
    }
  }

  // Enhanced set with compression and monitoring
  async set(key, data, ttl = null, options = {}) {
    const startTime = Date.now();

    try {
      if (!this.redisClient || !this.isConnected) {
        console.warn("Redis client not initialized or not connected");
        return false;
      }

      const serializedData = JSON.stringify(data);
      const expiration = ttl || this.defaultTTL;

      // Optional compression for large data
      let finalData = serializedData;
      if (options.compress && serializedData.length > 1024) {
        finalData = await this.storageService.compress(serializedData);
      }

      await this.redisClient.setEx(key, expiration, finalData);

      // Update performance metrics
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("hits", responseTime);
      this.updateCacheStats("set", key);

      // Emit cache set event for real-time updates
      this.emit("cacheSet", {
        key,
        size: finalData.length,
        ttl: expiration,
        compressed: options.compress && serializedData.length > 1024,
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics("errors", responseTime);
      console.error("Error setting cache:", error);
      return false;
    }
  }

  // Enhanced get with decompression and monitoring
  async get(key, options = {}) {
    const startTime = Date.now();

    try {
      if (!this.redisClient || !this.isConnected) {
        console.warn(
          "Redis client not initialized or not connected, returning null"
        );
        const responseTime = Date.now() - startTime;
        this.updatePerformanceMetrics("misses", responseTime);
        return null;
      }

      const data = await this.redisClient.get(key);

      if (data) {
        let parsedData;

        // Try to decompress if needed
        try {
          if (options.compressed || this.isCompressed(data)) {
            const decompressed = await this.storageService.decompress(data);
            parsedData = JSON.parse(decompressed);
          } else {
            parsedData = JSON.parse(data);
          }
        } catch (parseError) {
          // If parsing fails, try without decompression
          parsedData = JSON.parse(data);
        }

        const responseTime = Date.now() - startTime;
        this.updatePerformanceMetrics("hits", responseTime);
        this.updateCacheStats("hit", key);

        // Emit cache hit event
        this.emit("cacheHit", {
          key,
          size: data.length,
          responseTime,
          timestamp: new Date(),
        });

        return parsedData;
      } else {
        const responseTime = Date.now() - startTime;
        this.updatePerformanceMetrics("misses", responseTime);
        this.updateCacheStats("miss", key);

        // Emit cache miss event
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
      console.error("Error getting from cache:", error);
      this.updateCacheStats("error", key);

      // Emit cache error event
      this.emit("cacheError", {
        key,
        error: error.message,
        responseTime,
        timestamp: new Date(),
      });

      return null;
    }
  }

  // Helper method to detect compressed data
  isCompressed(data) {
    // Simple heuristic: compressed data typically starts with specific bytes
    return (
      typeof data === "string" &&
      (data.startsWith("H4sI") || // gzip
        data.startsWith("eJy") || // zlib
        (data.length < 100 && data.includes("�"))) // binary indicators
    );
  }

  // Update cache statistics
  updateCacheStats(operation, key) {
    // Implementation for cache statistics tracking
    const prefix = this.extractPrefix(key);
    // This would typically update metrics in a monitoring system
    console.debug(`Cache ${operation} for ${prefix}: ${key}`);
  }

  // Extract prefix from cache key
  extractPrefix(key) {
    for (const [name, prefix] of Object.entries(this.cachePrefixes)) {
      if (key.startsWith(prefix)) {
        return name;
      }
    }
    return "unknown";
  }

  // Enhanced Redis connection initialization
  async initialize() {
    try {
      const redisConfig = {
        socket: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error(
                `Redis connection failed after ${this.maxRetries} retries`
              );
              return false;
            }
            const delay = Math.min(retries * this.retryDelay, 10000);
            console.log(
              `Retrying Redis connection in ${delay}ms (attempt ${retries})`
            );
            return delay;
          },
        },
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB) || 1, // Use separate DB for nursing cache
      };

      this.redisClient = redis.createClient(redisConfig);

      // Enhanced event handlers
      this.redisClient.on("connect", () => {
        console.log("🔄 Nursing Cache Service connecting to Redis...");
        this.connectionRetries = 0;
      });

      this.redisClient.on("ready", () => {
        console.log("✅ Nursing Cache Service ready");
        this.isConnected = true;
        this.emit("connected");

        // Start maintenance tasks
        this.startMaintenanceTasks();
      });

      this.redisClient.on("error", (error) => {
        console.error("Redis error:", error);
        this.isConnected = false;
        this.emit("error", error);
      });

      this.redisClient.on("end", () => {
        console.log("🔄 Redis connection ended");
        this.isConnected = false;
        this.emit("disconnected");
      });

      this.redisClient.on("reconnecting", () => {
        console.log("🔄 Reconnecting to Redis...");
        this.connectionRetries++;
        this.emit("reconnecting", this.connectionRetries);
      });

      await this.redisClient.connect();

      // Perform health check
      const healthCheck = await this.healthCheck();
      if (!healthCheck) {
        throw new Error("Cache health check failed after connection");
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize Nursing Cache Service:", error);
      this.isConnected = false;
      this.emit("initializationFailed", error);
      return false;
    }
  }

  // Start maintenance tasks
  startMaintenanceTasks() {
    // Process batch invalidations every 30 seconds
    setInterval(async () => {
      await this.processBatchInvalidations();
    }, 30000);

    // Emit performance metrics every 5 minutes
    setInterval(() => {
      this.emit("performanceReport", {
        ...this.performanceMetrics,
        hitRate: this.calculateHitRate(),
        timestamp: new Date(),
      });
    }, 300000);
  }

  // Calculate current hit rate
  calculateHitRate() {
    const total = this.performanceMetrics.hits + this.performanceMetrics.misses;
    return total > 0 ? (this.performanceMetrics.hits / total) * 100 : 0;
  }

  async del(key) {
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  // OASIS Assessment caching
  async cacheOASISAssessment(userId, assessmentId, data, ttl = 7200) {
    const key = `${this.cachePrefixes.oasis}${userId}:${assessmentId}`;
    return await this.set(key, data, ttl);
  }

  async getOASISAssessment(userId, assessmentId) {
    const key = `${this.cachePrefixes.oasis}${userId}:${assessmentId}`;
    return await this.get(key);
  }

  async cacheOASISHistory(userId, patientId, history, ttl = 3600) {
    const key = `${this.cachePrefixes.oasis}history:${userId}:${patientId}`;
    return await this.set(key, history, ttl);
  }

  async getOASISHistory(userId, patientId) {
    const key = `${this.cachePrefixes.oasis}history:${userId}:${patientId}`;
    return await this.get(key);
  }

  // SOAP Notes caching
  async cacheSOAPNote(userId, noteId, data, ttl = 3600) {
    const key = `${this.cachePrefixes.soap}${userId}:${noteId}`;
    return await this.set(key, data, ttl);
  }

  async getSOAPNote(userId, noteId) {
    const key = `${this.cachePrefixes.soap}${userId}:${noteId}`;
    return await this.get(key);
  }

  async cacheSOAPTemplates(userId, templates, ttl = 86400) {
    const key = `${this.cachePrefixes.soap}templates:${userId}`;
    return await this.set(key, templates, ttl);
  }

  async getSOAPTemplates(userId) {
    const key = `${this.cachePrefixes.soap}templates:${userId}`;
    return await this.get(key);
  }

  // Progress Tracking caching
  async cacheProgressData(userId, patientId, data, ttl = 1800) {
    const key = `${this.cachePrefixes.progress}${userId}:${patientId}`;
    return await this.set(key, data, ttl);
  }

  async getProgressData(userId, patientId) {
    const key = `${this.cachePrefixes.progress}${userId}:${patientId}`;
    return await this.get(key);
  }

  async cacheProgressAnalytics(userId, analytics, ttl = 3600) {
    const key = `${this.cachePrefixes.progress}analytics:${userId}`;
    return await this.set(key, analytics, ttl);
  }

  async getProgressAnalytics(userId) {
    const key = `${this.cachePrefixes.progress}analytics:${userId}`;
    return await this.get(key);
  }

  // Outcome Measures caching
  async cacheOutcomeMeasures(userId, measures, ttl = 7200) {
    const key = `${this.cachePrefixes.outcomes}${userId}`;
    return await this.set(key, measures, ttl);
  }

  async getOutcomeMeasures(userId) {
    const key = `${this.cachePrefixes.outcomes}${userId}`;
    return await this.get(key);
  }

  async cacheQualityIndicators(userId, indicators, ttl = 3600) {
    const key = `${this.cachePrefixes.outcomes}quality:${userId}`;
    return await this.set(key, indicators, ttl);
  }

  async getQualityIndicators(userId) {
    const key = `${this.cachePrefixes.outcomes}quality:${userId}`;
    return await this.get(key);
  }

  // Medication Management caching
  async cacheMedicationList(userId, patientId, medications, ttl = 3600) {
    const key = `${this.cachePrefixes.medications}${userId}:${patientId}`;
    return await this.set(key, medications, ttl);
  }

  async getMedicationList(userId, patientId) {
    const key = `${this.cachePrefixes.medications}${userId}:${patientId}`;
    return await this.get(key);
  }

  async cacheDrugInteractions(medicationId, interactions, ttl = 86400) {
    const key = `${this.cachePrefixes.medications}interactions:${medicationId}`;
    return await this.set(key, interactions, ttl);
  }

  async getDrugInteractions(medicationId) {
    const key = `${this.cachePrefixes.medications}interactions:${medicationId}`;
    return await this.get(key);
  }

  // Nursing Assessments caching
  async cacheAssessment(userId, assessmentId, data, ttl = 3600) {
    const key = `${this.cachePrefixes.assessments}${userId}:${assessmentId}`;
    return await this.set(key, data, ttl);
  }

  async getAssessment(userId, assessmentId) {
    const key = `${this.cachePrefixes.assessments}${userId}:${assessmentId}`;
    return await this.get(key);
  }

  async cacheAssessmentTools(tools, ttl = 86400) {
    const key = `${this.cachePrefixes.assessments}tools`;
    return await this.set(key, tools, ttl);
  }

  async getAssessmentTools() {
    const key = `${this.cachePrefixes.assessments}tools`;
    return await this.get(key);
  }

  // Clinical Decision Support caching
  async cacheClinicalGuidelines(guidelines, ttl = 86400) {
    const key = `${this.cachePrefixes.clinical}guidelines`;
    return await this.set(key, guidelines, ttl);
  }

  async getClinicalGuidelines() {
    const key = `${this.cachePrefixes.clinical}guidelines`;
    return await this.get(key);
  }

  async cacheRiskAssessment(userId, patientId, assessment, ttl = 3600) {
    const key = `${this.cachePrefixes.clinical}risk:${userId}:${patientId}`;
    return await this.set(key, assessment, ttl);
  }

  async getRiskAssessment(userId, patientId) {
    const key = `${this.cachePrefixes.clinical}risk:${userId}:${patientId}`;
    return await this.get(key);
  }

  // Care Plans caching
  async cacheCarePlan(userId, planId, data, ttl = 3600) {
    const key = `${this.cachePrefixes.careplans}${userId}:${planId}`;
    return await this.set(key, data, ttl);
  }

  async getCarePlan(userId, planId) {
    const key = `${this.cachePrefixes.careplans}${userId}:${planId}`;
    return await this.get(key);
  }

  async cacheCareTemplates(templates, ttl = 86400) {
    const key = `${this.cachePrefixes.careplans}templates`;
    return await this.set(key, templates, ttl);
  }

  async getCareTemplates() {
    const key = `${this.cachePrefixes.careplans}templates`;
    return await this.get(key);
  }

  // User session and preferences caching
  async cacheUserPreferences(userId, preferences, ttl = 86400) {
    const key = `${this.cachePrefixes.user}preferences:${userId}`;
    return await this.set(key, preferences, ttl);
  }

  async getUserPreferences(userId) {
    const key = `${this.cachePrefixes.user}preferences:${userId}`;
    return await this.get(key);
  }

  async cacheUserSession(userId, sessionData, ttl = 3600) {
    const key = `${this.cachePrefixes.session}${userId}`;
    return await this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = `${this.cachePrefixes.session}${userId}`;
    return await this.get(key);
  }

  // Real-time data caching for live updates
  async cacheRealTimeData(dataType, identifier, data, ttl = 300) {
    const key = `${this.cachePrefixes.realtime}${dataType}:${identifier}`;
    return await this.set(key, data, ttl, { compress: false }); // Don't compress real-time data
  }

  async getRealTimeData(dataType, identifier) {
    const key = `${this.cachePrefixes.realtime}${dataType}:${identifier}`;
    return await this.get(key);
  }

  async invalidateRealTimeData(dataType, identifier) {
    const key = `${this.cachePrefixes.realtime}${dataType}:${identifier}`;
    return await this.invalidate(key, this.invalidationStrategies.immediate);
  }

  // AI analysis result caching
  async cacheAIAnalysis(analysisType, patientId, userId, result, ttl = 1800) {
    const key = `${this.cachePrefixes.ai}${analysisType}:${patientId}:${userId}`;
    return await this.set(key, result, ttl, { compress: true });
  }

  async getAIAnalysis(analysisType, patientId, userId) {
    const key = `${this.cachePrefixes.ai}${analysisType}:${patientId}:${userId}`;
    return await this.get(key, { compressed: true });
  }

  async invalidateAIAnalysis(analysisType, patientId, userId = null) {
    if (userId) {
      const key = `${this.cachePrefixes.ai}${analysisType}:${patientId}:${userId}`;
      return await this.invalidate(key);
    } else {
      const pattern = `${this.cachePrefixes.ai}${analysisType}:${patientId}:*`;
      return await this.invalidatePattern(pattern);
    }
  }

  // Synchronization state caching for offline support
  async cacheSyncState(userId, syncData, ttl = 7200) {
    const key = `${this.cachePrefixes.sync}state:${userId}`;
    return await this.set(key, syncData, ttl);
  }

  async getSyncState(userId) {
    const key = `${this.cachePrefixes.sync}state:${userId}`;
    return await this.get(key);
  }

  async cachePendingSync(userId, operationId, operation, ttl = 86400) {
    const key = `${this.cachePrefixes.sync}pending:${userId}:${operationId}`;
    return await this.set(key, operation, ttl);
  }

  async getPendingSync(userId, operationId) {
    const key = `${this.cachePrefixes.sync}pending:${userId}:${operationId}`;
    return await this.get(key);
  }

  async getAllPendingSync(userId) {
    const pattern = `${this.cachePrefixes.sync}pending:${userId}:*`;
    const keys = await this.getKeysByPattern(pattern);
    const operations = {};

    for (const key of keys) {
      const operationId = key.split(":").pop();
      operations[operationId] = await this.get(key);
    }

    return operations;
  }

  async removePendingSync(userId, operationId) {
    const key = `${this.cachePrefixes.sync}pending:${userId}:${operationId}`;
    return await this.invalidate(key);
  }

  // Bulk operations
  async mget(keys) {
    try {
      const values = await this.redisClient.mGet(keys);
      const results = {};

      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          try {
            const decompressed = await this.storageService.decompress(
              values[i]
            );
            results[keys[i]] = JSON.parse(decompressed);
          } catch (error) {
            console.error(
              `Error processing cached value for key ${keys[i]}:`,
              error
            );
            results[keys[i]] = null;
          }
        } else {
          results[keys[i]] = null;
        }
      }

      return results;
    } catch (error) {
      console.error("Bulk get error:", error);
      return {};
    }
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      const pipeline = this.redisClient.multi();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serialized = JSON.stringify(value);
        const compressed = await this.storageService.compress(serialized);

        if (ttl) {
          pipeline.setEx(key, ttl, compressed);
        } else {
          pipeline.set(key, compressed);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error("Bulk set error:", error);
      return false;
    }
  }

  // Pattern-based operations
  async deletePattern(pattern) {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`Delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  async getKeysByPattern(pattern) {
    try {
      return await this.redisClient.keys(pattern);
    } catch (error) {
      console.error(`Get keys by pattern error for ${pattern}:`, error);
      return [];
    }
  }

  // Cache invalidation methods
  async invalidateUserCache(userId) {
    const patterns = [
      `${this.cachePrefixes.oasis}${userId}:*`,
      `${this.cachePrefixes.soap}${userId}:*`,
      `${this.cachePrefixes.progress}${userId}:*`,
      `${this.cachePrefixes.outcomes}${userId}*`,
      `${this.cachePrefixes.medications}${userId}:*`,
      `${this.cachePrefixes.assessments}${userId}:*`,
      `${this.cachePrefixes.clinical}*${userId}:*`,
      `${this.cachePrefixes.careplans}${userId}:*`,
      `${this.cachePrefixes.user}*${userId}*`,
      `${this.cachePrefixes.session}${userId}`,
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    console.log(
      `🗑️ Invalidated ${totalDeleted} cache entries for user ${userId}`
    );
    return totalDeleted;
  }

  async invalidatePatientCache(patientId) {
    const patterns = [
      `${this.cachePrefixes.oasis}*:${patientId}`,
      `${this.cachePrefixes.progress}*:${patientId}`,
      `${this.cachePrefixes.medications}*:${patientId}`,
      `${this.cachePrefixes.clinical}*:${patientId}`,
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    console.log(
      `🗑️ Invalidated ${totalDeleted} cache entries for patient ${patientId}`
    );
    return totalDeleted;
  }

  // Cache statistics and monitoring
  async getCacheStats() {
    try {
      const info = await this.redisClient.info("memory");
      const keyspace = await this.redisClient.info("keyspace");

      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connected: this.redisClient.isReady,
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return null;
    }
  }

  parseRedisInfo(info) {
    const lines = info.split("\r\n");
    const result = {};

    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":");
        result[key] = isNaN(value) ? value : Number(value);
      }
    }

    return result;
  }

  // Health check
  async healthCheck() {
    try {
      const testKey = "nursing:health:check";
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 60);
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      return retrieved && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      console.error("Cache health check failed:", error);
      return false;
    }
  }

  // Advanced caching features
  async setWithTags(key, value, ttl = this.defaultTTL, tags = []) {
    try {
      // Set the main value
      await this.set(key, value, ttl);

      // Set tags for cache invalidation
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        await this.redisClient.sAdd(tagKey, key);
        await this.redisClient.expire(tagKey, ttl + 300); // Tags expire 5 minutes after data
      }

      return true;
    } catch (error) {
      console.error(`Tagged cache set error for key ${key}:`, error);
      return false;
    }
  }

  async invalidateByTag(tag) {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.redisClient.sMembers(tagKey);

      if (keys.length > 0) {
        await this.redisClient.del(keys);
        await this.redisClient.del(tagKey);
        console.log(
          `🏷️ Invalidated ${keys.length} cache entries with tag: ${tag}`
        );
      }

      return keys.length;
    } catch (error) {
      console.error(`Tag invalidation error for tag ${tag}:`, error);
      return 0;
    }
  }

  // Cache warming strategies
  async warmCache(dataType, identifiers = []) {
    console.log(`🔥 Starting cache warming for ${dataType}`);

    const warmupPromises = identifiers.map(async (id) => {
      try {
        // Check if already cached
        const key = this.generateCacheKey(dataType, id);
        const exists = await this.exists(key);

        if (!exists) {
          // Load from database and cache
          const data = await this.loadFromDatabase(dataType, id);
          if (data) {
            await this.set(key, data);
          }
        }
      } catch (error) {
        console.error(`Cache warming error for ${dataType}:${id}:`, error);
      }
    });

    await Promise.all(warmupPromises);
    console.log(`✅ Cache warming completed for ${dataType}`);
  }

  generateCacheKey(dataType, ...parts) {
    const prefix = this.cachePrefixes[dataType] || `nursing:${dataType}:`;
    return `${prefix}${parts.join(":")}`;
  }

  // Placeholder for database loading (would be implemented based on actual data layer)
  async loadFromDatabase(dataType, id) {
    // This would integrate with your actual database layer
    console.log(`Loading ${dataType} with id ${id} from database`);
    return null;
  }

  // Cache hit rate monitoring
  async trackCacheHit(key) {
    const statsKey = "nursing:cache:stats:hits";
    await this.redisClient.incr(statsKey);
    await this.redisClient.expire(statsKey, 86400); // Daily stats
  }

  async trackCacheMiss(key) {
    const statsKey = "nursing:cache:stats:misses";
    await this.redisClient.incr(statsKey);
    await this.redisClient.expire(statsKey, 86400); // Daily stats
  }

  async getCacheHitRate() {
    try {
      const hits =
        (await this.redisClient.get("nursing:cache:stats:hits")) || 0;
      const misses =
        (await this.redisClient.get("nursing:cache:stats:misses")) || 0;
      const total = parseInt(hits) + parseInt(misses);

      return total > 0 ? (parseInt(hits) / total) * 100 : 0;
    } catch (error) {
      console.error("Error calculating hit rate:", error);
      return 0;
    }
  }

  // Enhanced get with hit/miss tracking
  async getWithStats(key) {
    const result = await this.get(key);

    if (result !== null) {
      await this.trackCacheHit(key);
    } else {
      await this.trackCacheMiss(key);
    }

    return result;
  }

  // Cache compression analysis
  async analyzeCompression() {
    try {
      const keys = await this.redisClient.keys("nursing:*");
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;
      let sampleCount = 0;

      // Sample up to 100 keys for analysis
      const sampleKeys = keys.slice(0, 100);

      for (const key of sampleKeys) {
        try {
          const compressedValue = await this.redisClient.get(key);
          if (compressedValue) {
            const originalValue = await this.storageService.decompress(
              compressedValue
            );

            totalOriginalSize += originalValue.length;
            totalCompressedSize += compressedValue.length;
            sampleCount++;
          }
        } catch (error) {
          // Skip problematic keys
          continue;
        }
      }

      const compressionRatio =
        sampleCount > 0
          ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) *
            100
          : 0;

      return {
        sampleCount,
        totalOriginalSize,
        totalCompressedSize,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        spaceSaved: totalOriginalSize - totalCompressedSize,
      };
    } catch (error) {
      console.error("Compression analysis error:", error);
      return null;
    }
  }

  // Memory usage optimization
  async optimizeMemoryUsage() {
    try {
      console.log("🔧 Starting cache memory optimization...");

      // Get memory info
      const memoryInfo = await this.redisClient.info("memory");
      const usedMemory = this.parseRedisInfo(memoryInfo).used_memory;

      if (usedMemory > 100 * 1024 * 1024) {
        // If using more than 100MB
        // Find and remove least recently used keys
        const keys = await this.redisClient.keys("nursing:*");
        const keyStats = [];

        // Sample keys to check access patterns
        const sampleSize = Math.min(keys.length, 1000);
        const sampleKeys = keys.slice(0, sampleSize);

        for (const key of sampleKeys) {
          try {
            const ttl = await this.redisClient.ttl(key);
            const idleTime = await this.redisClient.objectIdletime(key);

            keyStats.push({
              key,
              ttl,
              idleTime: idleTime || 0,
            });
          } catch (error) {
            // Skip keys that can't be analyzed
            continue;
          }
        }

        // Sort by idle time (descending) and remove oldest 10%
        keyStats.sort((a, b) => b.idleTime - a.idleTime);
        const keysToRemove = keyStats.slice(
          0,
          Math.floor(keyStats.length * 0.1)
        );

        if (keysToRemove.length > 0) {
          const keysArray = keysToRemove.map((item) => item.key);
          await this.redisClient.del(keysArray);
          console.log(
            `🗑️ Removed ${keysArray.length} least recently used cache entries`
          );
        }
      }

      console.log("✅ Cache memory optimization completed");
    } catch (error) {
      console.error("Memory optimization error:", error);
    }
  }

  // Enhanced cache statistics
  async getDetailedStats() {
    try {
      const basicStats = await this.getCacheStats();
      const hitRate = await this.getCacheHitRate();
      const compressionStats = await this.analyzeCompression();

      // Get key distribution by prefix
      const keyDistribution = {};
      for (const [prefix, pattern] of Object.entries(this.cachePrefixes)) {
        const keys = await this.redisClient.keys(`${pattern}*`);
        keyDistribution[prefix] = keys.length;
      }

      return {
        ...basicStats,
        hitRate: Math.round(hitRate * 100) / 100,
        compression: compressionStats,
        keyDistribution,
        totalKeys: Object.values(keyDistribution).reduce(
          (sum, count) => sum + count,
          0
        ),
      };
    } catch (error) {
      console.error("Error getting detailed stats:", error);
      return await this.getCacheStats();
    }
  }

  // Scheduled cache maintenance
  startMaintenanceScheduler() {
    // Run memory optimization every hour
    setInterval(async () => {
      await this.optimizeMemoryUsage();
    }, 60 * 60 * 1000);

    // Clean up expired tag references every 30 minutes
    setInterval(async () => {
      try {
        const tagKeys = await this.redisClient.keys("tag:*");
        for (const tagKey of tagKeys) {
          const members = await this.redisClient.sMembers(tagKey);
          const validMembers = [];

          for (const member of members) {
            const exists = await this.redisClient.exists(member);
            if (exists) {
              validMembers.push(member);
            }
          }

          if (validMembers.length !== members.length) {
            await this.redisClient.del(tagKey);
            if (validMembers.length > 0) {
              await this.redisClient.sAdd(tagKey, validMembers);
            }
          }
        }
      } catch (error) {
        console.error("Tag cleanup error:", error);
      }
    }, 30 * 60 * 1000);

    console.log("🕐 Cache maintenance scheduler started");
  }

  // Cleanup and shutdown
  async cleanup() {
    try {
      // Clean up expired keys and optimize memory
      await this.optimizeMemoryUsage();
      console.log("🧹 Nursing cache cleaned up");
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }

  async shutdown() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log("🔄 Nursing Cache Service disconnected");
      }
    } catch (error) {
      console.error("Cache shutdown error:", error);
    }
  }
}

export default NursingCacheService;
