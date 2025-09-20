// Database Optimization Service for nursing backend performance
import crypto from "crypto";
import mongoose from "mongoose";
import Redis from "ioredis";

class DatabaseOptimizationService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.queryCache = new Map();
    this.connectionPool = null;
    this.indexStats = new Map();
    this.queryStats = new Map();
    this.setupOptimizations();
  }

  // Setup database optimizations
  async setupOptimizations() {
    try {
      await this.setupConnectionPool();
      await this.createOptimalIndexes();
      await this.setupQueryOptimization();
      await this.setupCaching();
      console.log("Database optimizations configured");
    } catch (error) {
      console.error("Database optimization setup failed:", error);
    }
  }

  // Setup connection pooling
  async setupConnectionPool() {
    const poolOptions = {
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    };

    mongoose.connection.on("connected", () => {
      console.log("MongoDB connection pool established");
    });

    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    // Apply connection pool settings
    mongoose.set("maxPoolSize", poolOptions.maxPoolSize);
    mongoose.set("minPoolSize", poolOptions.minPoolSize);
  }

  // Create optimal indexes for nursing collections
  async createOptimalIndexes() {
    const indexDefinitions = {
      // OASIS Assessment indexes
      oasisassessments: [
        { patientId: 1, assessmentDate: -1 },
        { patientId: 1, assessmentType: 1 },
        { createdBy: 1, createdAt: -1 },
        { "scores.totalScore": -1 },
        { status: 1, assessmentDate: -1 },
        { "items.M0100": 1 }, // Patient ID
        { "items.M0110": 1 }, // Episode Timing
      ],

      // SOAP Notes indexes
      soapnotes: [
        { patientId: 1, createdAt: -1 },
        { createdBy: 1, createdAt: -1 },
        { patientId: 1, noteType: 1 },
        { status: 1, createdAt: -1 },
        { tags: 1 },
        { "$**": "text" }, // Text search index
      ],

      // Medication Records indexes
      medicationrecords: [
        { patientId: 1, administrationDate: -1 },
        { medicationId: 1, patientId: 1 },
        { administeredBy: 1, administrationDate: -1 },
        { status: 1, dueDate: -1 },
        { "interactions.severity": -1 },
        { patientId: 1, medicationId: 1, administrationDate: -1 },
      ],

      // Care Plans indexes
      careplans: [
        { patientId: 1, createdAt: -1 },
        { createdBy: 1, status: 1 },
        { patientId: 1, planType: 1 },
        { "goals.status": 1, "goals.targetDate": 1 },
        { status: 1, lastUpdated: -1 },
        { patientId: 1, "goals.category": 1 },
      ],

      // Progress Tracking indexes
      progresstracking: [
        { patientId: 1, recordDate: -1 },
        { patientId: 1, metricType: 1, recordDate: -1 },
        { createdBy: 1, recordDate: -1 },
        { "metrics.category": 1, recordDate: -1 },
        { patientId: 1, "trends.direction": 1 },
      ],

      // Outcome Measures indexes
      outcomemeasures: [
        { patientId: 1, measurementDate: -1 },
        { measureType: 1, measurementDate: -1 },
        { patientId: 1, measureType: 1, measurementDate: -1 },
        { "qualityIndicators.category": 1 },
        { "benchmarks.percentile": -1 },
      ],

      // Nursing Assessments indexes
      nursingassessments: [
        { patientId: 1, assessmentDate: -1 },
        { assessmentType: 1, assessmentDate: -1 },
        { patientId: 1, assessmentType: 1 },
        { createdBy: 1, assessmentDate: -1 },
        { "riskFactors.level": -1 },
        { status: 1, assessmentDate: -1 },
      ],

      // User Storage indexes
      userstorage: [
        { userId: 1 },
        { userId: 1, dataType: 1 },
        { userId: 1, createdAt: -1 },
        { storageUsed: -1 },
        { userId: 1, "quotaLimits.type": 1 },
      ],
    };

    for (const [collection, indexes] of Object.entries(indexDefinitions)) {
      try {
        const db = mongoose.connection.db;
        const collectionObj = db.collection(collection);

        for (const indexSpec of indexes) {
          await collectionObj.createIndex(indexSpec, { background: true });
          this.indexStats.set(`${collection}_${JSON.stringify(indexSpec)}`, {
            created: new Date(),
            collection,
            spec: indexSpec,
          });
        }

        console.log(`Created ${indexes.length} indexes for ${collection}`);
      } catch (error) {
        console.error(`Error creating indexes for ${collection}:`, error);
      }
    }
  }

  // Setup query optimization
  setupQueryOptimization() {
    // Monitor slow queries
    mongoose.set("debug", (collectionName, method, query, doc) => {
      const queryKey = `${collectionName}.${method}`;
      const startTime = Date.now();

      // Track query execution
      if (!this.queryStats.has(queryKey)) {
        this.queryStats.set(queryKey, {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          slowQueries: [],
        });
      }

      const stats = this.queryStats.get(queryKey);
      stats.count++;

      // Simulate query completion (in real implementation, this would be tracked differently)
      setTimeout(() => {
        const duration = Date.now() - startTime;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;

        // Track slow queries (>100ms)
        if (duration > 100) {
          stats.slowQueries.push({
            query,
            duration,
            timestamp: new Date(),
          });

          // Keep only last 10 slow queries
          if (stats.slowQueries.length > 10) {
            stats.slowQueries = stats.slowQueries.slice(-10);
          }

          console.warn(`Slow query detected: ${queryKey} took ${duration}ms`);
        }
      }, 0);
    });
  }

  // Setup caching strategies
  async setupCaching() {
    // Cache frequently accessed data
    this.cacheStrategies = {
      // Patient data cache (5 minutes)
      patient: { ttl: 300, prefix: "patient:" },

      // Assessment results cache (10 minutes)
      assessment: { ttl: 600, prefix: "assessment:" },

      // Medication schedules cache (2 minutes)
      medication: { ttl: 120, prefix: "medication:" },

      // Care plan cache (15 minutes)
      careplan: { ttl: 900, prefix: "careplan:" },

      // Outcome measures cache (30 minutes)
      outcome: { ttl: 1800, prefix: "outcome:" },

      // User preferences cache (1 hour)
      userprefs: { ttl: 3600, prefix: "userprefs:" },
    };

    console.log("Caching strategies configured");
  }

  // Optimized query execution with caching
  async executeOptimizedQuery(collection, operation, query, options = {}) {
    const queryKey = this.generateQueryKey(collection, operation, query);
    const cacheStrategy = this.cacheStrategies[collection] || {
      ttl: 300,
      prefix: "default:",
    };

    // Check cache first
    if (options.useCache !== false) {
      const cachedResult = await this.getCachedResult(queryKey, cacheStrategy);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Execute query with optimization
    const startTime = Date.now();
    let result;

    try {
      switch (operation) {
        case "find":
          result = await this.optimizedFind(collection, query, options);
          break;
        case "findOne":
          result = await this.optimizedFindOne(collection, query, options);
          break;
        case "aggregate":
          result = await this.optimizedAggregate(collection, query, options);
          break;
        case "count":
          result = await this.optimizedCount(collection, query, options);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const duration = Date.now() - startTime;

      // Cache result if successful and cacheable
      if (result && options.useCache !== false) {
        await this.cacheResult(queryKey, result, cacheStrategy);
      }

      // Log performance
      this.logQueryPerformance(collection, operation, query, duration);

      return result;
    } catch (error) {
      console.error(
        `Query execution failed: ${collection}.${operation}`,
        error
      );
      throw error;
    }
  }

  // Optimized find operation
  async optimizedFind(collection, query, options) {
    const Model = mongoose.model(collection);
    let queryBuilder = Model.find(query);

    // Apply optimizations
    if (options.select) {
      queryBuilder = queryBuilder.select(options.select);
    }

    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort);
    }

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    if (options.skip) {
      queryBuilder = queryBuilder.skip(options.skip);
    }

    if (options.populate) {
      queryBuilder = queryBuilder.populate(options.populate);
    }

    // Use lean() for read-only operations
    if (options.lean !== false) {
      queryBuilder = queryBuilder.lean();
    }

    return await queryBuilder.exec();
  }

  // Optimized findOne operation
  async optimizedFindOne(collection, query, options) {
    const Model = mongoose.model(collection);
    let queryBuilder = Model.findOne(query);

    if (options.select) {
      queryBuilder = queryBuilder.select(options.select);
    }

    if (options.populate) {
      queryBuilder = queryBuilder.populate(options.populate);
    }

    if (options.lean !== false) {
      queryBuilder = queryBuilder.lean();
    }

    return await queryBuilder.exec();
  }

  // Optimized aggregation
  async optimizedAggregate(collection, pipeline, options) {
    const Model = mongoose.model(collection);

    // Add optimization stages
    const optimizedPipeline = [...pipeline];

    // Add early filtering if possible
    if (options.earlyFilter) {
      optimizedPipeline.unshift({ $match: options.earlyFilter });
    }

    // Add index hints if specified
    if (options.hint) {
      optimizedPipeline.push({ $hint: options.hint });
    }

    return await Model.aggregate(optimizedPipeline).exec();
  }

  // Optimized count operation
  async optimizedCount(collection, query, options) {
    const Model = mongoose.model(collection);

    // Use countDocuments for accuracy or estimatedDocumentCount for speed
    if (options.estimate) {
      return await Model.estimatedDocumentCount();
    } else {
      return await Model.countDocuments(query);
    }
  }

  // Generate cache key for query
  generateQueryKey(collection, operation, query) {
    const queryString = JSON.stringify(query);
    const hash = crypto.createHash("md5").update(queryString).digest("hex");
    return `${collection}:${operation}:${hash}`;
  }

  // Get cached result
  async getCachedResult(queryKey, strategy) {
    try {
      const cacheKey = `${strategy.prefix}${queryKey}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error("Cache retrieval error:", error);
    }
    return null;
  }

  // Cache query result
  async cacheResult(queryKey, result, strategy) {
    try {
      const cacheKey = `${strategy.prefix}${queryKey}`;
      await this.redis.setex(cacheKey, strategy.ttl, JSON.stringify(result));
    } catch (error) {
      console.error("Cache storage error:", error);
    }
  }

  // Invalidate cache for specific patterns
  async invalidateCache(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(
          `Invalidated ${keys.length} cache entries for pattern: ${pattern}`
        );
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  // Log query performance
  logQueryPerformance(collection, operation, query, duration) {
    const logEntry = {
      collection,
      operation,
      query: JSON.stringify(query),
      duration,
      timestamp: new Date(),
    };

    // Log slow queries
    if (duration > 100) {
      console.warn("Slow query detected:", logEntry);
    }

    // Update query statistics
    const statsKey = `${collection}.${operation}`;
    if (!this.queryStats.has(statsKey)) {
      this.queryStats.set(statsKey, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
      });
    }

    const stats = this.queryStats.get(statsKey);
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.minTime = Math.min(stats.minTime, duration);
  }

  // Optimize database connections
  async optimizeConnections() {
    const currentConnections = mongoose.connection.readyState;
    const poolSize = mongoose.connection.db?.serverConfig?.poolSize || 0;

    console.log(`Current connection state: ${currentConnections}`);
    console.log(`Connection pool size: ${poolSize}`);

    // Adjust pool size based on load
    if (poolSize < 5) {
      console.log("Increasing connection pool size");
      // In production, this would involve reconnecting with new pool settings
    }
  }

  // Get database performance statistics
  getPerformanceStats() {
    const queryStatsArray = Array.from(this.queryStats.entries()).map(
      ([key, stats]) => ({
        operation: key,
        ...stats,
      })
    );

    return {
      totalQueries: Array.from(this.queryStats.values()).reduce(
        (sum, stats) => sum + stats.count,
        0
      ),
      queryStats: queryStatsArray,
      indexCount: this.indexStats.size,
      cacheStrategies: Object.keys(this.cacheStrategies).length,
      connectionState: mongoose.connection.readyState,
      memoryUsage: process.memoryUsage(),
    };
  }

  // Analyze query patterns
  analyzeQueryPatterns() {
    const analysis = {
      slowQueries: [],
      frequentQueries: [],
      recommendations: [],
    };

    // Find slow queries
    for (const [operation, stats] of this.queryStats.entries()) {
      if (stats.avgTime > 50) {
        analysis.slowQueries.push({
          operation,
          avgTime: stats.avgTime,
          count: stats.count,
        });
      }

      if (stats.count > 100) {
        analysis.frequentQueries.push({
          operation,
          count: stats.count,
          avgTime: stats.avgTime,
        });
      }
    }

    // Generate recommendations
    if (analysis.slowQueries.length > 0) {
      analysis.recommendations.push("Consider adding indexes for slow queries");
    }

    if (analysis.frequentQueries.length > 0) {
      analysis.recommendations.push(
        "Consider caching results for frequent queries"
      );
    }

    return analysis;
  }

  // Cleanup and maintenance
  async performMaintenance() {
    try {
      // Clear old query statistics
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      for (const [key, stats] of this.queryStats.entries()) {
        if (stats.slowQueries) {
          stats.slowQueries = stats.slowQueries.filter(
            (query) => query.timestamp.getTime() > cutoffTime
          );
        }
      }

      // Clear expired cache entries
      await this.redis.eval(
        `
        for i, name in ipairs(redis.call('KEYS', ARGV[1])) do
          local ttl = redis.call('TTL', name)
          if ttl == -1 then
            redis.call('DEL', name)
          end
        end
      `,
        0,
        "*"
      );

      console.log("Database maintenance completed");
    } catch (error) {
      console.error("Maintenance error:", error);
    }
  }

  // Shutdown cleanup
  async shutdown() {
    try {
      await this.redis.quit();
      console.log("Database optimization service shutdown complete");
    } catch (error) {
      console.error("Shutdown error:", error);
    }
  }
}

export default new DatabaseOptimizationService();
