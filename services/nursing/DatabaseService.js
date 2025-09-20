/**
 * Enhanced Database Service with Connection Resilience
 *
 * Provides robust database operations with:
 * - Connection pooling and retry mechanisms
 * - Transaction handling for data consistency
 * - Query optimization for large datasets
 * - Comprehensive error handling and recovery
 */

import mongoose from "mongoose";
import { ValidationError } from "./DataValidationService.js";

class DatabaseError extends Error {
  constructor(message, code, retryable = false, originalError = null) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.retryable = retryable;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

class DatabaseService {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      connectionTimeout: options.connectionTimeout || 10000,
      queryTimeout: options.queryTimeout || 30000,
      maxPoolSize: options.maxPoolSize || 10,
      ...options,
    };

    this.connectionState = {
      isConnected: false,
      lastError: null,
      retryCount: 0,
      connectionAttempts: 0,
    };

    this.queryStats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
    };
  }

  /**
   * Execute a database query with retry logic and error handling
   */
  async executeQuery(operation, params = {}, options = {}) {
    const startTime = Date.now();
    const queryOptions = {
      timeout: options.timeout || this.options.queryTimeout,
      retries: options.retries || this.options.maxRetries,
      ...options,
    };

    this.queryStats.totalQueries++;

    for (let attempt = 1; attempt <= queryOptions.retries; attempt++) {
      try {
        // Check connection health before executing
        await this.ensureConnection();

        // Execute the operation with timeout
        const result = await Promise.race([
          operation(params),
          this.createTimeoutPromise(queryOptions.timeout),
        ]);

        // Update success metrics
        this.queryStats.successfulQueries++;
        this.updateResponseTime(Date.now() - startTime);

        return result;
      } catch (error) {
        const isLastAttempt = attempt === queryOptions.retries;
        const shouldRetry = this.shouldRetryOperation(error) && !isLastAttempt;

        if (shouldRetry) {
          const delay = this.calculateRetryDelay(attempt);
          console.warn(
            `Database query attempt ${attempt} failed, retrying in ${delay}ms:`,
            error.message
          );
          await this.sleep(delay);
          continue;
        }

        // Final failure - update metrics and throw
        this.queryStats.failedQueries++;
        throw this.createDatabaseError(error, "QUERY_EXECUTION_FAILED");
      }
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async executeTransaction(operations) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const results = [];
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      throw this.createDatabaseError(error, "TRANSACTION_FAILED");
    } finally {
      session.endSession();
    }
  }

  /**
   * Ensure database connection is healthy
   */
  async ensureConnection() {
    if (mongoose.connection.readyState === 1) {
      this.connectionState.isConnected = true;
      return true;
    }

    if (mongoose.connection.readyState === 2) {
      // Connection is connecting, wait for it
      await this.waitForConnection();
      return true;
    }

    // Connection is disconnected, attempt to reconnect
    return await this.handleConnectionFailure();
  }

  /**
   * Handle connection failures with retry logic
   */
  async handleConnectionFailure(error = null, retryCount = 0) {
    this.connectionState.isConnected = false;
    this.connectionState.lastError = error;
    this.connectionState.retryCount = retryCount;

    if (retryCount >= this.options.maxRetries) {
      throw new DatabaseError(
        `Database connection failed after ${retryCount} attempts`,
        "CONNECTION_FAILED",
        false,
        error
      );
    }

    const delay = this.calculateRetryDelay(retryCount + 1);
    console.warn(
      `Database connection attempt ${
        retryCount + 1
      } failed, retrying in ${delay}ms`
    );

    await this.sleep(delay);

    try {
      // Attempt to reconnect
      if (mongoose.connection.readyState === 0) {
        const mongoUri =
          process.env.MONGODB_URI || "mongodb://localhost:27017/jawbreaker";
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: this.options.connectionTimeout,
          maxPoolSize: this.options.maxPoolSize,
        });
      }

      this.connectionState.isConnected = true;
      this.connectionState.retryCount = 0;
      return true;
    } catch (reconnectError) {
      return await this.handleConnectionFailure(reconnectError, retryCount + 1);
    }
  }

  /**
   * Wait for existing connection attempt to complete
   */
  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (mongoose.connection.readyState === 2) {
      if (Date.now() - startTime > timeout) {
        throw new DatabaseError(
          "Connection timeout waiting for existing connection",
          "CONNECTION_TIMEOUT"
        );
      }
      await this.sleep(100);
    }

    if (mongoose.connection.readyState !== 1) {
      throw new DatabaseError(
        "Connection failed while waiting",
        "CONNECTION_FAILED"
      );
    }
  }

  /**
   * Optimize query performance for large datasets
   */
  optimizeQuery(query, options = {}) {
    const optimizedQuery = query.clone();

    // Add lean() for read-only operations to improve performance
    if (options.lean !== false) {
      optimizedQuery.lean();
    }

    // Add appropriate indexes hint if provided
    if (options.hint) {
      optimizedQuery.hint(options.hint);
    }

    // Set batch size for large result sets
    if (options.batchSize) {
      optimizedQuery.batchSize(options.batchSize);
    }

    // Add timeout to prevent long-running queries
    if (options.maxTimeMS) {
      optimizedQuery.maxTimeMS(options.maxTimeMS);
    }

    return optimizedQuery;
  }

  /**
   * Create optimized aggregation pipeline
   */
  createOptimizedAggregation(model, pipeline, options = {}) {
    const optimizedPipeline = [...pipeline];

    // Add $match stages early to reduce document processing
    if (options.earlyMatch) {
      optimizedPipeline.unshift({ $match: options.earlyMatch });
    }

    // Add $limit if specified to reduce memory usage
    if (options.limit) {
      optimizedPipeline.push({ $limit: options.limit });
    }

    // Add indexes hint for aggregation
    const aggregateOptions = {};
    if (options.hint) {
      aggregateOptions.hint = options.hint;
    }

    return model.aggregate(optimizedPipeline, aggregateOptions);
  }

  /**
   * Bulk operations for better performance
   */
  async executeBulkOperation(model, operations, options = {}) {
    const bulkOptions = {
      ordered: options.ordered !== false,
      ...options,
    };

    try {
      const bulk = model.collection.initializeUnorderedBulkOp();

      for (const operation of operations) {
        switch (operation.type) {
          case "insert":
            bulk.insert(operation.document);
            break;
          case "update":
            bulk.find(operation.filter).update(operation.update);
            break;
          case "delete":
            bulk.find(operation.filter).delete();
            break;
          default:
            throw new Error(
              `Unsupported bulk operation type: ${operation.type}`
            );
        }
      }

      return await bulk.execute();
    } catch (error) {
      throw this.createDatabaseError(error, "BULK_OPERATION_FAILED");
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        connectionState: mongoose.connection.readyState,
        queryStats: this.queryStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        connectionState: mongoose.connection.readyState,
        queryStats: this.queryStats,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get database performance metrics
   */
  getMetrics() {
    return {
      connection: {
        state: mongoose.connection.readyState,
        isConnected: this.connectionState.isConnected,
        lastError: this.connectionState.lastError,
        retryCount: this.connectionState.retryCount,
      },
      queries: {
        ...this.queryStats,
        successRate:
          this.queryStats.totalQueries > 0
            ? (
                (this.queryStats.successfulQueries /
                  this.queryStats.totalQueries) *
                100
              ).toFixed(2) + "%"
            : "0%",
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods

  shouldRetryOperation(error) {
    const retryableErrors = [
      "MongoNetworkError",
      "MongoTimeoutError",
      "MongoServerSelectionError",
      "MongoWriteConcernError",
    ];

    return retryableErrors.some(
      (errorType) =>
        error.name === errorType || error.message.includes(errorType)
    );
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = this.options.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  createDatabaseError(originalError, code) {
    const retryable = this.shouldRetryOperation(originalError);
    return new DatabaseError(
      originalError.message,
      code,
      retryable,
      originalError
    );
  }

  updateResponseTime(responseTime) {
    const totalQueries = this.queryStats.successfulQueries;
    const currentAverage = this.queryStats.averageResponseTime;

    // Calculate running average
    this.queryStats.averageResponseTime =
      (currentAverage * (totalQueries - 1) + responseTime) / totalQueries;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export both the class and error types
export { DatabaseService, DatabaseError };
export default DatabaseService;
