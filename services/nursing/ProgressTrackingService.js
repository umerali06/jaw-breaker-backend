import ProgressTracking from "../../models/nursing/ProgressTracking.js";
import NursingAIService from "./NursingAIService.js";
import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";
import ProgressAnalyticsService from "./ProgressAnalyticsService.js";
import crypto from "crypto";

// Custom error classes for Progress Tracking Service
class ProgressTrackingServiceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "ProgressTrackingServiceError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
  }

  determineSeverity(code) {
    const criticalCodes = ['PROGRESS_DATA_CORRUPTION', 'CRITICAL_DATA_LOSS', 'PATIENT_SAFETY_RISK'];
    const highCodes = ['VALIDATION_FAILURE', 'UNAUTHORIZED_ACCESS', 'RATE_LIMIT_EXCEEDED'];
    
    if (criticalCodes.includes(code)) return 'CRITICAL';
    if (highCodes.includes(code)) return 'HIGH';
    return 'MEDIUM';
  }
}

class ValidationError extends Error {
  constructor(message, field, validationType = 'general') {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.validationType = validationType;
    this.timestamp = new Date().toISOString();
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter, userContext = {}) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.userContext = userContext;
    this.timestamp = new Date().toISOString();
  }
}

class ServiceUnavailableError extends Error {
  constructor(message, service, failureReason = 'unknown') {
    super(message);
    this.name = "ServiceUnavailableError";
    this.service = service;
    this.failureReason = failureReason;
    this.timestamp = new Date().toISOString();
  }
}

// Input validation class for progress tracking
class ProgressTrackingValidator {
  static validateProgressData(data, context = {}) {
    const errors = [];
    const warnings = [];
    
    if (!data) {
      errors.push("Progress data is required");
      return { isValid: false, errors, warnings };
    }
    
    // Required fields validation
    if (!data.patientId) {
      errors.push("Patient ID is required");
    }
    
    if (!data.recordedBy) {
      errors.push("Recorded by user ID is required");
    }
    
    if (!data.assessmentDate) {
      errors.push("Assessment date is required");
    } else if (!this.isValidDate(data.assessmentDate)) {
      errors.push("Invalid assessment date format");
    }
    
    // Progress metrics validation
    if (data.metrics) {
      const metricsValidation = this.validateMetrics(data.metrics);
      errors.push(...metricsValidation.errors);
      warnings.push(...metricsValidation.warnings);
    }
    
    // Goals validation
    if (data.goals && Array.isArray(data.goals)) {
      for (let i = 0; i < data.goals.length; i++) {
        const goalValidation = this.validateGoal(data.goals[i]);
        if (!goalValidation.isValid) {
          errors.push(`Goal ${i + 1}: ${goalValidation.errors.join(', ')}`);
        }
        warnings.push(...goalValidation.warnings);
      }
    }
    
    // Interventions validation
    if (data.interventions && Array.isArray(data.interventions)) {
      for (let i = 0; i < data.interventions.length; i++) {
        const interventionValidation = this.validateIntervention(data.interventions[i]);
        if (!interventionValidation.isValid) {
          errors.push(`Intervention ${i + 1}: ${interventionValidation.errors.join(', ')}`);
        }
        warnings.push(...interventionValidation.warnings);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateMetrics(metrics) {
    const errors = [];
    const warnings = [];
    
    if (typeof metrics !== 'object') {
      errors.push("Metrics must be an object");
      return { errors, warnings };
    }
    
    // Validate common healthcare metrics
    const validMetrics = ['painLevel', 'mobility', 'strength', 'endurance', 'balance', 'cognition'];
    
    for (const [key, value] of Object.entries(metrics)) {
      if (!validMetrics.includes(key)) {
        warnings.push(`Unknown metric: ${key}`);
        continue;
      }
      
      if (typeof value !== 'number' || value < 0 || value > 10) {
        errors.push(`${key} must be a number between 0 and 10`);
      }
    }
    
    return { errors, warnings };
  }
  
  static validateGoal(goal) {
    const errors = [];
    const warnings = [];
    
    if (!goal.description) {
      errors.push("Goal description is required");
    }
    
    if (!goal.targetDate) {
      errors.push("Goal target date is required");
    } else if (!this.isValidDate(goal.targetDate)) {
      errors.push("Invalid target date format");
    }
    
    if (goal.progress !== undefined) {
      if (typeof goal.progress !== 'number' || goal.progress < 0 || goal.progress > 100) {
        errors.push("Goal progress must be a number between 0 and 100");
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateIntervention(intervention) {
    const errors = [];
    const warnings = [];
    
    if (!intervention.type) {
      errors.push("Intervention type is required");
    }
    
    if (!intervention.description) {
      errors.push("Intervention description is required");
    }
    
    if (intervention.effectiveness !== undefined) {
      if (typeof intervention.effectiveness !== 'number' || intervention.effectiveness < 0 || intervention.effectiveness > 100) {
        errors.push("Intervention effectiveness must be a number between 0 and 100");
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateUserId(userId, context = {}) {
    if (!userId) {
      throw new ValidationError("User ID is required", "userId");
    }
    
    if (typeof userId !== 'string' && typeof userId !== 'object') {
      throw new ValidationError("User ID must be a string or object", "userId");
    }
  }
  
  static validatePatientId(patientId, context = {}) {
    if (!patientId) {
      throw new ValidationError("Patient ID is required", "patientId");
    }
    
    if (typeof patientId !== 'string' && typeof patientId !== 'object') {
      throw new ValidationError("Patient ID must be a string or object", "patientId");
    }
  }
  
  static validateRecordId(recordId, context = {}) {
    if (!recordId) {
      throw new ValidationError("Record ID is required", "recordId");
    }
    
    if (typeof recordId !== 'string' && typeof recordId !== 'object') {
      throw new ValidationError("Record ID must be a string or object", "recordId");
    }
  }
  
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  static sanitizeData(data) {
    if (!data) return data;
    
    // Deep clone to avoid mutating original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove potentially dangerous properties
    delete sanitized.__proto__;
    delete sanitized.constructor;
    
    // Sanitize sensitive healthcare data
    if (sanitized.patientNotes) {
      sanitized.patientNotes = this.maskSensitiveInfo(sanitized.patientNotes);
    }
    
    return sanitized;
  }
  
  static maskSensitiveInfo(text) {
    // Basic PII masking - in production, use more sophisticated methods
    return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****')
               .replace(/\b\d{10}\b/g, '**********');
  }
}

class ProgressTrackingService {
  constructor() {
    this.aiService = NursingAIService;
    this.eventManager = EventManager;
    this.cacheService = NursingCacheService;
    this.analyticsService = ProgressAnalyticsService;

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.PROGRESS_TRACKING_AI_PROVIDER || 'openai',
      rateLimit: {
        maxRequests: parseInt(process.env.PROGRESS_TRACKING_RATE_LIMIT_MAX_REQUESTS) || 100,
        windowMs: parseInt(process.env.PROGRESS_TRACKING_RATE_LIMIT_WINDOW_MS) || 60000
      },
      cache: {
        ttl: parseInt(process.env.PROGRESS_TRACKING_CACHE_TTL) || 300000, // 5 minutes
        maxSize: parseInt(process.env.PROGRESS_TRACKING_CACHE_MAX_SIZE) || 1000
      },
      circuitBreaker: {
        threshold: parseInt(process.env.PROGRESS_TRACKING_CIRCUIT_BREAKER_THRESHOLD) || 5,
        timeout: parseInt(process.env.PROGRESS_TRACKING_CIRCUIT_BREAKER_TIMEOUT) || 60000
      },
      retries: {
        maxAttempts: parseInt(process.env.PROGRESS_TRACKING_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay: parseInt(process.env.PROGRESS_TRACKING_RETRY_BACKOFF_DELAY) || 1000
      }
    };

    // SMART goal templates
    this.goalTemplates = this.initializeGoalTemplates();

    // Progress metrics configuration
    this.metricsConfig = this.initializeMetricsConfig();

    // Real-time tracking intervals
    this.trackingIntervals = new Map();

    // Enhanced performance metrics
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: {
        validation: 0,
        rateLimit: 0,
        serviceUnavailable: 0,
        database: 0,
        ai: 0
      }
    };

    // Rate limiting tracker
    this.rateLimitTracker = {};

    // Circuit breaker state
    this.circuitBreakerState = {
      database: { status: 'closed', failures: 0, lastFailure: null },
      ai: { status: 'closed', failures: 0, lastFailure: null },
      cache: { status: 'closed', failures: 0, lastFailure: null }
    };

    // Cache for intelligent caching
    this.cache = {};
    this.cacheTimestamps = {};
    this.requestCounter = 0;
  }

  // Utility methods for enhanced functionality
  generateRequestId() {
    return `progress_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      service: 'ProgressTrackingService',
      ...context
    };
    console.log(JSON.stringify(logEntry));
  }

  logError(message, error, context = {}) {
    const logEntry = {
      level: 'error',
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      service: 'ProgressTrackingService',
      ...context
    };
    console.error(JSON.stringify(logEntry));
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const userKey = `user_${userId}`;
    
    if (!this.rateLimitTracker[userKey]) {
      this.rateLimitTracker[userKey] = { count: 0, resetTime: now + this.config.rateLimit.windowMs };
    }
    
    const userLimit = this.rateLimitTracker[userKey];
    
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + this.config.rateLimit.windowMs;
    }
    
    if (userLimit.count >= this.config.rateLimit.maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      throw new RateLimitError(`Rate limit exceeded for user ${userId}`, retryAfter);
    }
    
    userLimit.count++;
  }

  checkCircuitBreaker(service) {
    const breaker = this.circuitBreakerState[service];
    if (!breaker) return;
    
    if (breaker.status === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure < this.config.circuitBreaker.timeout) {
        throw new ServiceUnavailableError(`${service} service is temporarily unavailable`, service);
      }
      breaker.status = 'half-open';
    }
  }

  updateCircuitBreaker(service, success) {
    const breaker = this.circuitBreakerState[service];
    if (!breaker) return;
    
    if (success) {
      breaker.status = 'closed';
      breaker.failures = 0;
    } else {
      breaker.failures++;
      if (breaker.failures >= this.config.circuitBreaker.threshold) {
        breaker.status = 'open';
        breaker.lastFailure = Date.now();
      }
    }
  }

  generateCacheKey(prefix, data) {
    const dataString = JSON.stringify(data);
    const hash = crypto.createHash('md5').update(dataString).digest('hex');
    return `${prefix}_${hash}`;
  }

  getFromCache(cacheKey) {
    const cached = this.cache[cacheKey];
    if (!cached) {
      this.performanceMetrics.cacheMisses++;
      return null;
    }
    
    const now = Date.now();
    if (now - cached.timestamp > this.config.cache.ttl) {
      delete this.cache[cacheKey];
      this.performanceMetrics.cacheMisses++;
      return null;
    }
    
    this.performanceMetrics.cacheHits++;
    return cached.data;
  }

  setCache(cacheKey, data) {
    // Implement cache size limit
    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length >= this.config.cache.maxSize) {
      // Remove oldest entry
      const oldestKey = cacheKeys.reduce((oldest, key) => 
        this.cache[key].timestamp < this.cache[oldest].timestamp ? key : oldest
      );
      delete this.cache[oldestKey];
    }
    
    this.cache[cacheKey] = {
      data,
      timestamp: Date.now()
    };
  }

  updateMetrics(success, responseTime) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.totalResponseTime += responseTime;
    this.performanceMetrics.averageResponseTime = 
      this.performanceMetrics.totalResponseTime / this.performanceMetrics.totalRequests;
    
    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }
  }

  validateInputs(data, context = {}) {
    const validation = ProgressTrackingValidator.validateProgressData(data, context);
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(`Validation failed: ${validation.errors.join(', ')}`, 'progressData');
    }
    
    if (validation.warnings.length > 0) {
      this.logInfo(`Validation warnings: ${validation.warnings.join(', ')}`, context);
    }
    
    if (context.userId) {
      ProgressTrackingValidator.validateUserId(context.userId, context);
    }
    
    if (context.patientId) {
      ProgressTrackingValidator.validatePatientId(context.patientId, context);
    }
    
    if (context.recordId) {
      ProgressTrackingValidator.validateRecordId(context.recordId, context);
    }
  }

  // Service monitoring and management methods
  getServiceStatus() {
    try {
      const cacheHitRate = this.calculateCacheHitRate();
      const totalRequests = this.performanceMetrics.totalRequests || 0;
      const successRate = totalRequests > 0 
        ? ((this.performanceMetrics.successfulRequests || 0) / totalRequests * 100).toFixed(2)
        : 0;
      
      return {
        service: 'ProgressTrackingService',
        status: 'operational',
        timestamp: new Date().toISOString(),
        metrics: {
          ...this.performanceMetrics,
          successRate: `${successRate}%`,
          averageResponseTime: this.performanceMetrics.averageResponseTime || 0
        },
        cache: {
          size: Object.keys(this.cache).length,
          hitRate: `${(cacheHitRate * 100).toFixed(2)}%`,
          maxSize: this.config.cache.maxSize
        },
        circuitBreakers: Object.keys(this.circuitBreakerState).map(service => ({
          service,
          state: this.circuitBreakerState[service].status,
          failures: this.circuitBreakerState[service].failures
        })),
        rateLimits: {
          activeUsers: Object.keys(this.rateLimitTracker).length,
          maxRateLimit: this.config.rateLimit.maxRequests
        },
        configuration: {
          aiProvider: this.config.aiProvider,
          cacheTTL: this.config.cache.ttl,
          circuitBreakerThreshold: this.config.circuitBreaker.threshold
        }
      };
    } catch (error) {
      this.logError("Error getting service status", error, {});
      return {
        service: 'ProgressTrackingService',
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  calculateCacheHitRate() {
    const totalRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    return totalRequests > 0 ? this.performanceMetrics.cacheHits / totalRequests : 0;
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.calculateCacheHitRate(),
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(2)
        : 0
    };
  }

  clearCache() {
    this.cache = {};
    this.cacheTimestamps = {};
    this.logInfo("Cache cleared");
  }

  resetCircuitBreakers() {
    Object.keys(this.circuitBreakerState).forEach(service => {
      this.circuitBreakerState[service] = {
        status: 'closed',
        failures: 0,
        lastFailure: null
      };
    });
    this.logInfo("Circuit breakers reset");
  }

  getConfiguration() {
    return {
      ...this.config,
      goalTemplates: Object.keys(this.goalTemplates).length,
      metricsConfig: Object.keys(this.metricsConfig).length,
      trackingIntervals: this.trackingIntervals.size
    };
  }

  getErrorReport(timeframe = "24h") {
    const cutoff = Date.now() - (timeframe === "24h" ? 86400000 : 3600000);
    return {
      timeframe,
      totalErrors: this.performanceMetrics.errors.validation +
                   this.performanceMetrics.errors.rateLimit +
                   this.performanceMetrics.errors.serviceUnavailable +
                   this.performanceMetrics.errors.database +
                   this.performanceMetrics.errors.ai,
      errorBreakdown: this.performanceMetrics.errors,
      circuitBreakerStatus: this.circuitBreakerState,
      timestamp: new Date().toISOString()
    };
  }

  healthCheck() {
    try {
      const cacheStatus = Object.keys(this.cache).length < this.config.cache.maxSize;
      const circuitBreakerStatus = Object.values(this.circuitBreakerState).every(state => state.status === 'closed');
      const rateLimitStatus = Object.keys(this.rateLimitTracker).length < 1000; // Reasonable limit
      
      const overallStatus = cacheStatus && circuitBreakerStatus && rateLimitStatus ? 'healthy' : 'degraded';
      
      return {
        service: 'ProgressTrackingService',
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks: {
          cache: {
            status: cacheStatus ? 'healthy' : 'warning',
            size: Object.keys(this.cache).length,
            maxSize: this.config.cache.maxSize
          },
          circuitBreakers: {
            status: circuitBreakerStatus ? 'healthy' : 'warning',
            openBreakers: Object.values(this.circuitBreakerState).filter(state => state.status === 'open').length
          },
          rateLimits: {
            status: rateLimitStatus ? 'healthy' : 'warning',
            activeUsers: Object.keys(this.rateLimitTracker).length
          }
        },
        metrics: {
          totalRequests: this.performanceMetrics.totalRequests || 0,
          successfulRequests: this.performanceMetrics.successfulRequests || 0,
          averageResponseTime: this.performanceMetrics.averageResponseTime || 0
        }
      };
    } catch (error) {
      this.logError("Error during health check", error, {});
      return {
        service: 'ProgressTrackingService',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        error: error.message
      };
    }
  }

  // Record progress (alias for recordPatientProgress)
  async recordProgress(patientId, progressData, recordedBy) {
    return this.recordPatientProgress(patientId, progressData, recordedBy);
  }

  // Generate report
  async generateReport(
    patientId,
    timeframe = "30days",
    reportType = "comprehensive"
  ) {
    try {
      const endDate = new Date();
      const startDate = new Date();

      // Calculate start date based on timeframe
      switch (timeframe) {
        case "7days":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30days":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90days":
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const progressEntries = await this.getProgressEntries(
        patientId,
        startDate,
        endDate
      );

      const report = {
        patientId,
        timeframe,
        reportType,
        generatedAt: new Date(),
        summary: {
          totalEntries: progressEntries.length,
          averageScore: 0,
          trend: "stable",
          improvements: [],
          concerns: [],
        },
        details: progressEntries,
        recommendations: [],
        charts: this.generateChartData(progressEntries),
      };

      // Calculate metrics
      if (progressEntries.length > 0) {
        const scores = progressEntries.map((entry) => entry.overallScore || 0);
        report.summary.averageScore =
          scores.reduce((a, b) => a + b, 0) / scores.length;

        // Determine trend
        if (scores.length >= 2) {
          const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
          const secondHalf = scores.slice(Math.floor(scores.length / 2));
          const firstAvg =
            firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg =
            secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

          if (secondAvg > firstAvg + 5) {
            report.summary.trend = "improving";
          } else if (secondAvg < firstAvg - 5) {
            report.summary.trend = "declining";
          }
        }

        // Identify improvements and concerns
        report.summary.improvements =
          this.identifyImprovements(progressEntries);
        report.summary.concerns = this.identifyConcerns(progressEntries);
      }

      // Generate AI-powered recommendations
      const aiRecommendations =
        await this.aiService.generateProgressRecommendations(progressEntries, {
          patientId,
          timeframe,
        });

      if (aiRecommendations.success) {
        report.recommendations = aiRecommendations.recommendations;
      }

      return report;
    } catch (error) {
      console.error("Error generating progress report:", error);
      throw error;
    }
  }

  // Record patient progress
  async recordPatientProgress(patientId, progressData, recordedBy) {
    try {
      const progressEntry = {
        patientId,
        recordedBy,
        timestamp: new Date(),
        progressData,
        overallScore: this.calculateOverallScore(progressData),
        metrics: this.extractMetrics(progressData),
        notes: progressData.notes || "",
        goals: progressData.goals || [],
      };

      // Save to database
      const progressRecord = new ProgressTracking(progressEntry);
      await progressRecord.save();

      // Update cache
      const cacheKey = `progress:${patientId}:latest`;
      await this.cacheService.set(cacheKey, progressEntry, 300); // 5 minutes

      // Emit real-time event
      this.eventManager.emit("progressRecorded", {
        patientId,
        progressId: progressRecord._id,
        overallScore: progressEntry.overallScore,
        recordedBy,
      });

      return {
        success: true,
        progressId: progressRecord._id,
        overallScore: progressEntry.overallScore,
        timestamp: progressEntry.timestamp,
        message: "Progress recorded successfully",
      };
    } catch (error) {
      console.error("Error recording patient progress:", error);
      throw error;
    }
  }

  // Get progress entries for a patient within a timeframe
  async getProgressEntries(patientId, startDate, endDate) {
    try {
      const entries = await ProgressTracking.find({
        patientId,
        timestamp: { $gte: startDate, $lte: endDate },
      }).sort({ timestamp: -1 });

      return entries;
    } catch (error) {
      console.error("Error getting progress entries:", error);
      return [];
    }
  }

  // Calculate overall score from progress data
  calculateOverallScore(progressData) {
    if (!progressData || typeof progressData !== "object") {
      return 0;
    }

    let totalScore = 0;
    let scoreCount = 0;

    // Extract numeric scores from various fields
    Object.values(progressData).forEach((value) => {
      if (typeof value === "number" && value >= 0 && value <= 100) {
        totalScore += value;
        scoreCount++;
      }
    });

    return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
  }

  // Extract metrics from progress data
  extractMetrics(progressData) {
    const metrics = {};

    // Common nursing metrics
    if (progressData.painScore !== undefined) {
      metrics.painScore = progressData.painScore;
    }
    if (progressData.mobilityScore !== undefined) {
      metrics.mobilityScore = progressData.mobilityScore;
    }
    if (progressData.cognitiveScore !== undefined) {
      metrics.cognitiveScore = progressData.cognitiveScore;
    }
    if (progressData.functionalScore !== undefined) {
      metrics.functionalScore = progressData.functionalScore;
    }

    return metrics;
  }

  // Generate chart data for visualization
  generateChartData(progressEntries) {
    const chartData = {
      overallScores: [],
      painScores: [],
      mobilityScores: [],
      timestamps: [],
    };

    progressEntries.forEach((entry) => {
      chartData.timestamps.push(entry.timestamp);
      chartData.overallScores.push(entry.overallScore || 0);
      chartData.painScores.push(entry.metrics?.painScore || null);
      chartData.mobilityScores.push(entry.metrics?.mobilityScore || null);
    });

    return chartData;
  }

  // Identify improvements in progress
  identifyImprovements(progressEntries) {
    const improvements = [];

    if (progressEntries.length >= 2) {
      const latest = progressEntries[0];
      const previous = progressEntries[1];

      if (latest.overallScore > previous.overallScore + 5) {
        improvements.push({
          type: "overall_improvement",
          description: `Overall score improved from ${previous.overallScore} to ${latest.overallScore}`,
          improvement: latest.overallScore - previous.overallScore,
        });
      }

      // Check specific metrics
      if (latest.metrics?.painScore < previous.metrics?.painScore - 1) {
        improvements.push({
          type: "pain_reduction",
          description: `Pain score decreased from ${previous.metrics.painScore} to ${latest.metrics.painScore}`,
          improvement: previous.metrics.painScore - latest.metrics.painScore,
        });
      }
    }

    return improvements;
  }

  // Identify concerns in progress
  identifyConcerns(progressEntries) {
    const concerns = [];

    if (progressEntries.length >= 2) {
      const latest = progressEntries[0];
      const previous = progressEntries[1];

      if (latest.overallScore < previous.overallScore - 5) {
        concerns.push({
          type: "declining_progress",
          severity: "medium",
          description: `Overall score declined from ${previous.overallScore} to ${latest.overallScore}`,
          decline: previous.overallScore - latest.overallScore,
        });
      }

      // Check for high pain scores
      if (latest.metrics?.painScore >= 7) {
        concerns.push({
          type: "high_pain",
          severity: "high",
          description: `High pain score reported: ${latest.metrics.painScore}/10`,
          value: latest.metrics.painScore,
        });
      }
    }

    return concerns;
  }

  // Create new progress tracking record
  async createProgressRecord(recordData, userId) {
    try {
      // Validate user has nursing premium access
      if (!(await this.validatePremiumAccess(userId))) {
        throw new Error(
          "Progress tracking requires nursing premium subscription"
        );
      }

      // Create progress record
      const progressRecord = new ProgressTracking({
        ...recordData,
        userId,
        status: "active",
        metadata: {
          createdAt: new Date(),
        },
      });

      // Initialize SMART goals if provided
      if (recordData.goals && recordData.goals.length > 0) {
        progressRecord.goals = recordData.goals.map((goal) =>
          this.createSMARTGoal(goal)
        );
      }

      // Get initial AI analysis
      const aiAnalysis = await this.aiService.analyzeProgress(
        progressRecord.progressData,
        progressRecord.goals
      );

      if (aiAnalysis.success) {
        progressRecord.aiAnalysis = aiAnalysis.analysis;
      }

      // Calculate initial metrics
      this.calculateProgressMetrics(progressRecord);

      await progressRecord.save();

      // Cache for quick access
      await this.cacheService.setProgressRecord(
        progressRecord._id,
        progressRecord
      );

      // Start real-time tracking
      this.startRealTimeTracking(progressRecord._id, userId);

      // Emit event
      this.eventManager.emit("progressTrackingCreated", {
        recordId: progressRecord._id,
        userId,
        patientId: progressRecord.patientId,
        goals: progressRecord.goals.length,
      });

      return {
        success: true,
        progressRecord,
        aiAnalysis: aiAnalysis.success ? aiAnalysis.analysis : null,
      };
    } catch (error) {
      console.error("Error creating progress record:", error);
      throw error;
    }
  }

  // Update progress data
  async updateProgress(recordId, progressData, userId) {
    try {
      const progressRecord = await ProgressTracking.findById(recordId);

      if (!progressRecord) {
        throw new Error("Progress record not found");
      }

      if (progressRecord.userId.toString() !== userId) {
        throw new Error("Unauthorized access to progress record");
      }

      // Track changes
      const changes = this.trackProgressChanges(
        progressRecord.progressData,
        progressData
      );

      // Update progress data
      progressRecord.progressData = {
        ...progressRecord.progressData,
        ...progressData,
      };
      progressRecord.metadata.updatedAt = new Date();

      // Add to history
      progressRecord.history.push({
        timestamp: new Date(),
        userId,
        action: "progress_updated",
        changes,
        metrics: this.calculateCurrentMetrics(progressData),
      });

      // Recalculate metrics
      this.calculateProgressMetrics(progressRecord);

      // Get AI analysis for significant changes
      if (this.hasSignificantProgressChanges(changes)) {
        const aiAnalysis = await this.aiService.analyzeProgress(
          progressRecord.progressData,
          progressRecord.goals
        );

        if (aiAnalysis.success) {
          progressRecord.aiAnalysis = aiAnalysis.analysis;
        }
      }

      await progressRecord.save();

      // Update cache
      await this.cacheService.setProgressRecord(recordId, progressRecord);

      // Emit real-time event
      this.eventManager.emit("progressUpdated", {
        recordId,
        userId,
        changes,
        metrics: progressRecord.metrics,
        aiAnalysis: progressRecord.aiAnalysis,
      });

      return {
        success: true,
        progressRecord,
        changes,
      };
    } catch (error) {
      console.error("Error updating progress:", error);
      throw error;
    }
  }

  // Add or update goal
  async updateGoal(recordId, goalData, userId) {
    try {
      const progressRecord = await ProgressTracking.findById(recordId);

      if (!progressRecord) {
        throw new Error("Progress record not found");
      }

      if (progressRecord.userId.toString() !== userId) {
        throw new Error("Unauthorized access to progress record");
      }

      let goal;
      if (goalData.goalId) {
        // Update existing goal
        goal = progressRecord.goals.id(goalData.goalId);
        if (!goal) {
          throw new Error("Goal not found");
        }
        Object.assign(goal, goalData);
      } else {
        // Create new goal
        goal = this.createSMARTGoal(goalData);
        progressRecord.goals.push(goal);
      }

      // Update goal progress
      this.updateGoalProgress(goal, progressRecord.progressData);

      progressRecord.metadata.updatedAt = new Date();
      await progressRecord.save();

      // Update cache
      await this.cacheService.setProgressRecord(recordId, progressRecord);

      // Emit event
      this.eventManager.emit("goalUpdated", {
        recordId,
        userId,
        goalId: goal._id,
        goalStatus: goal.status,
        progress: goal.progress,
      });

      return {
        success: true,
        goal,
        progressRecord,
      };
    } catch (error) {
      console.error("Error updating goal:", error);
      throw error;
    }
  }

  // Record intervention
  async recordIntervention(recordId, interventionData, userId) {
    try {
      const progressRecord = await ProgressTracking.findById(recordId);

      if (!progressRecord) {
        throw new Error("Progress record not found");
      }

      if (progressRecord.userId.toString() !== userId) {
        throw new Error("Unauthorized access to progress record");
      }

      // Create intervention record
      const intervention = {
        ...interventionData,
        recordedAt: new Date(),
        recordedBy: userId,
        interventionId: this.generateInterventionId(),
      };

      progressRecord.interventions.push(intervention);

      // Update related goals if specified
      if (
        interventionData.relatedGoals &&
        interventionData.relatedGoals.length > 0
      ) {
        for (const goalId of interventionData.relatedGoals) {
          const goal = progressRecord.goals.id(goalId);
          if (goal) {
            goal.interventions.push(intervention.interventionId);
            this.updateGoalProgress(goal, progressRecord.progressData);
          }
        }
      }

      // Calculate intervention effectiveness
      const effectiveness = await this.calculateInterventionEffectiveness(
        intervention,
        progressRecord.progressData,
        progressRecord.history
      );

      intervention.effectiveness = effectiveness;

      progressRecord.metadata.updatedAt = new Date();
      await progressRecord.save();

      // Update cache
      await this.cacheService.setProgressRecord(recordId, progressRecord);

      // Emit event
      this.eventManager.emit("interventionRecorded", {
        recordId,
        userId,
        intervention,
        effectiveness,
      });

      return {
        success: true,
        intervention,
        effectiveness,
        progressRecord,
      };
    } catch (error) {
      console.error("Error recording intervention:", error);
      throw error;
    }
  }

  // Get progress analytics
  async getProgressAnalytics(recordId, userId, timeRange = {}) {
    try {
      const progressRecord = await ProgressTracking.findById(recordId);

      if (!progressRecord) {
        throw new Error("Progress record not found");
      }

      if (progressRecord.userId.toString() !== userId) {
        throw new Error("Unauthorized access to progress record");
      }

      // Calculate analytics
      const analytics = {
        overview: this.calculateOverviewMetrics(progressRecord),
        trends: this.calculateTrends(progressRecord, timeRange),
        goalProgress: this.calculateGoalAnalytics(progressRecord),
        interventionEffectiveness:
          this.calculateInterventionAnalytics(progressRecord),
        predictions: await this.generatePredictions(progressRecord),
        recommendations: await this.generateRecommendations(progressRecord),
      };

      return {
        success: true,
        analytics,
      };
    } catch (error) {
      console.error("Error getting progress analytics:", error);
      throw error;
    }
  }

  // Get patient progress summary
  async getPatientProgressSummary(patientId, userId) {
    try {
      const progressRecords = await ProgressTracking.find({
        patientId,
        userId,
        status: "active",
      }).sort({ createdAt: -1 });

      if (progressRecords.length === 0) {
        return {
          success: true,
          summary: {
            totalRecords: 0,
            activeGoals: 0,
            completedGoals: 0,
            totalInterventions: 0,
            overallProgress: 0,
          },
        };
      }

      // Calculate summary metrics
      const summary = {
        totalRecords: progressRecords.length,
        activeGoals: 0,
        completedGoals: 0,
        totalInterventions: 0,
        overallProgress: 0,
        recentTrends: [],
        upcomingMilestones: [],
        riskFactors: [],
      };

      for (const record of progressRecords) {
        summary.activeGoals += record.goals.filter(
          (g) => g.status === "active"
        ).length;
        summary.completedGoals += record.goals.filter(
          (g) => g.status === "completed"
        ).length;
        summary.totalInterventions += record.interventions.length;

        // Add to overall progress calculation
        const recordProgress =
          record.goals.reduce((sum, goal) => sum + goal.progress, 0) /
          record.goals.length;
        summary.overallProgress += recordProgress;
      }

      summary.overallProgress =
        summary.overallProgress / progressRecords.length;

      // Get AI insights for summary
      const aiInsights = await this.aiService.analyzeProgress(
        { summary, records: progressRecords },
        []
      );

      if (aiInsights.success) {
        summary.aiInsights = aiInsights.analysis;
      }

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error("Error getting patient progress summary:", error);
      throw error;
    }
  }

  // Start real-time tracking
  startRealTimeTracking(recordId, userId) {
    const trackingKey = `${recordId}_${userId}`;

    // Clear existing tracking if any
    if (this.trackingIntervals.has(trackingKey)) {
      clearInterval(this.trackingIntervals.get(trackingKey));
    }

    // Set up real-time tracking (every 5 minutes)
    const interval = setInterval(async () => {
      try {
        await this.performRealTimeUpdate(recordId, userId);
      } catch (error) {
        console.error("Real-time tracking error:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.trackingIntervals.set(trackingKey, interval);
  }

  // Stop real-time tracking
  stopRealTimeTracking(recordId, userId) {
    const trackingKey = `${recordId}_${userId}`;

    if (this.trackingIntervals.has(trackingKey)) {
      clearInterval(this.trackingIntervals.get(trackingKey));
      this.trackingIntervals.delete(trackingKey);
    }
  }

  // Perform real-time update
  async performRealTimeUpdate(recordId, userId) {
    try {
      const progressRecord = await ProgressTracking.findById(recordId);

      if (!progressRecord || progressRecord.status !== "active") {
        this.stopRealTimeTracking(recordId, userId);
        return;
      }

      // Check for goal milestones
      const milestones = this.checkGoalMilestones(progressRecord);

      if (milestones.length > 0) {
        // Emit milestone events
        for (const milestone of milestones) {
          this.eventManager.emit("goalMilestoneReached", {
            recordId,
            userId,
            milestone,
          });
        }
      }

      // Check for alerts
      const alerts = this.checkProgressAlerts(progressRecord);

      if (alerts.length > 0) {
        // Emit alert events
        for (const alert of alerts) {
          this.eventManager.emit("progressAlert", {
            recordId,
            userId,
            alert,
          });
        }
      }
    } catch (error) {
      console.error("Real-time update error:", error);
    }
  }

  // Create SMART goal
  createSMARTGoal(goalData) {
    return {
      description: goalData.description,
      specific: goalData.specific || goalData.description,
      measurable: goalData.measurable || "Progress tracked",
      achievable: goalData.achievable || true,
      relevant: goalData.relevant || true,
      timeBound:
        goalData.timeBound || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      category: goalData.category || "general",
      priority: goalData.priority || "medium",
      status: "active",
      progress: 0,
      milestones: goalData.milestones || [],
      interventions: [],
      createdAt: new Date(),
      targetValue: goalData.targetValue,
      currentValue: goalData.currentValue || 0,
      unit: goalData.unit || "points",
    };
  }

  // Update goal progress
  updateGoalProgress(goal, progressData) {
    // Calculate progress based on current vs target values
    if (goal.targetValue && goal.currentValue !== undefined) {
      goal.progress = Math.min(
        (goal.currentValue / goal.targetValue) * 100,
        100
      );
    }

    // Check if goal is completed
    if (goal.progress >= 100) {
      goal.status = "completed";
      goal.completedAt = new Date();
    }

    // Check if goal is overdue
    if (new Date() > goal.timeBound && goal.status === "active") {
      goal.status = "overdue";
    }
  }

  // Calculate progress metrics
  calculateProgressMetrics(progressRecord) {
    const metrics = {
      overallProgress: 0,
      goalCompletionRate: 0,
      interventionCount: progressRecord.interventions.length,
      activeGoals: 0,
      completedGoals: 0,
      overdueGoals: 0,
      averageGoalProgress: 0,
      trendsAnalysis: {},
      lastUpdated: new Date(),
    };

    if (progressRecord.goals.length > 0) {
      metrics.activeGoals = progressRecord.goals.filter(
        (g) => g.status === "active"
      ).length;
      metrics.completedGoals = progressRecord.goals.filter(
        (g) => g.status === "completed"
      ).length;
      metrics.overdueGoals = progressRecord.goals.filter(
        (g) => g.status === "overdue"
      ).length;

      metrics.goalCompletionRate =
        (metrics.completedGoals / progressRecord.goals.length) * 100;
      metrics.averageGoalProgress =
        progressRecord.goals.reduce((sum, goal) => sum + goal.progress, 0) /
        progressRecord.goals.length;
      metrics.overallProgress = metrics.averageGoalProgress;
    }

    progressRecord.metrics = metrics;
  }

  // Track progress changes
  trackProgressChanges(oldData, newData) {
    const changes = [];

    for (const [key, newValue] of Object.entries(newData)) {
      const oldValue = oldData[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          metric: key,
          oldValue,
          newValue,
          change: this.calculateChange(oldValue, newValue),
          timestamp: new Date(),
        });
      }
    }

    return changes;
  }

  // Calculate change between values
  calculateChange(oldValue, newValue) {
    if (typeof oldValue === "number" && typeof newValue === "number") {
      return {
        absolute: newValue - oldValue,
        percentage:
          oldValue !== 0 ? ((newValue - oldValue) / oldValue) * 100 : 0,
        direction:
          newValue > oldValue
            ? "increase"
            : newValue < oldValue
            ? "decrease"
            : "stable",
      };
    }
    return { type: "qualitative", direction: "changed" };
  }

  // Check for significant progress changes
  hasSignificantProgressChanges(changes) {
    return changes.some(
      (change) =>
        change.change.percentage && Math.abs(change.change.percentage) > 10
    );
  }

  // Calculate intervention effectiveness
  async calculateInterventionEffectiveness(
    intervention,
    progressData,
    history
  ) {
    // Look at progress changes before and after intervention
    const beforeData = this.getProgressDataBefore(
      intervention.recordedAt,
      history
    );
    const afterData = progressData;

    const effectiveness = {
      score: 0,
      impact: "unknown",
      metrics: {},
      confidence: 0.5,
    };

    // Calculate effectiveness based on progress improvements
    if (beforeData && afterData) {
      const improvements = this.calculateImprovements(beforeData, afterData);
      effectiveness.score = improvements.overallScore;
      effectiveness.impact =
        improvements.overallScore > 70
          ? "high"
          : improvements.overallScore > 40
          ? "moderate"
          : "low";
      effectiveness.metrics = improvements.metrics;
      effectiveness.confidence = improvements.confidence;
    }

    return effectiveness;
  }

  // Generate intervention ID
  generateInterventionId() {
    return `INT_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}`.toUpperCase();
  }

  // Calculate overview metrics
  calculateOverviewMetrics(progressRecord) {
    return {
      totalGoals: progressRecord.goals.length,
      activeGoals: progressRecord.goals.filter((g) => g.status === "active")
        .length,
      completedGoals: progressRecord.goals.filter(
        (g) => g.status === "completed"
      ).length,
      overallProgress: progressRecord.metrics.overallProgress,
      totalInterventions: progressRecord.interventions.length,
      lastUpdate: progressRecord.metadata.updatedAt,
      duration: Math.floor(
        (new Date() - progressRecord.metadata.createdAt) / (1000 * 60 * 60 * 24)
      ), // days
    };
  }

  // Calculate trends
  calculateTrends(progressRecord, timeRange) {
    const trends = [];

    // Analyze historical data for trends
    const historyData = progressRecord.history.filter((h) => {
      if (timeRange.start && h.timestamp < timeRange.start) return false;
      if (timeRange.end && h.timestamp > timeRange.end) return false;
      return true;
    });

    // Group by time periods and calculate trends
    const timeGroups = this.groupByTimePeriod(historyData, "day");

    for (const [period, data] of Object.entries(timeGroups)) {
      const trend = this.calculatePeriodTrend(data);
      trends.push({
        period,
        trend: trend.direction,
        value: trend.value,
        confidence: trend.confidence,
      });
    }

    return trends;
  }

  // Calculate goal analytics
  calculateGoalAnalytics(progressRecord) {
    return progressRecord.goals.map((goal) => ({
      goalId: goal._id,
      description: goal.description,
      progress: goal.progress,
      status: goal.status,
      daysRemaining: goal.timeBound
        ? Math.ceil((goal.timeBound - new Date()) / (1000 * 60 * 60 * 24))
        : null,
      interventionCount: goal.interventions.length,
      onTrack: this.isGoalOnTrack(goal),
      riskLevel: this.calculateGoalRisk(goal),
    }));
  }

  // Calculate intervention analytics
  calculateInterventionAnalytics(progressRecord) {
    const interventions = progressRecord.interventions;

    return {
      totalInterventions: interventions.length,
      averageEffectiveness:
        interventions.reduce(
          (sum, i) => sum + (i.effectiveness?.score || 0),
          0
        ) / interventions.length,
      mostEffective: interventions.sort(
        (a, b) => (b.effectiveness?.score || 0) - (a.effectiveness?.score || 0)
      )[0],
      interventionsByType: this.groupInterventionsByType(interventions),
      recentInterventions: interventions.filter(
        (i) => new Date() - i.recordedAt < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      ).length,
    };
  }

  // Generate predictions using AI
  async generatePredictions(progressRecord) {
    const aiPrediction = await this.aiService.predictOutcomes(
      progressRecord.progressData,
      progressRecord.interventions
    );

    if (aiPrediction.success) {
      return aiPrediction.prediction;
    }

    return {
      outcomes: {},
      probability: 0.5,
      timeframe: "unknown",
      factors: [],
      recommendations: [],
    };
  }

  // Generate recommendations using AI
  async generateRecommendations(progressRecord) {
    const aiAnalysis = await this.aiService.analyzeProgress(
      progressRecord.progressData,
      progressRecord.goals
    );

    if (aiAnalysis.success) {
      return aiAnalysis.analysis.recommendations || [];
    }

    return [];
  }

  // Check goal milestones
  checkGoalMilestones(progressRecord) {
    const milestones = [];

    for (const goal of progressRecord.goals) {
      for (const milestone of goal.milestones) {
        if (!milestone.reached && goal.progress >= milestone.threshold) {
          milestone.reached = true;
          milestone.reachedAt = new Date();
          milestones.push({
            goalId: goal._id,
            milestone: milestone.description,
            progress: goal.progress,
            reachedAt: milestone.reachedAt,
          });
        }
      }
    }

    return milestones;
  }

  // Check progress alerts
  checkProgressAlerts(progressRecord) {
    const alerts = [];

    // Check for overdue goals
    const overdueGoals = progressRecord.goals.filter(
      (g) => g.status === "active" && new Date() > g.timeBound
    );

    for (const goal of overdueGoals) {
      alerts.push({
        type: "goal_overdue",
        severity: "high",
        message: `Goal "${goal.description}" is overdue`,
        goalId: goal._id,
      });
    }

    // Check for stalled progress
    const stalledGoals = progressRecord.goals.filter(
      (g) =>
        g.status === "active" &&
        this.isProgressStalled(g, progressRecord.history)
    );

    for (const goal of stalledGoals) {
      alerts.push({
        type: "progress_stalled",
        severity: "medium",
        message: `Progress on goal "${goal.description}" has stalled`,
        goalId: goal._id,
      });
    }

    return alerts;
  }

  // Helper methods
  isGoalOnTrack(goal) {
    if (goal.status === "completed") return true;
    if (goal.status === "overdue") return false;

    const daysRemaining = Math.ceil(
      (goal.timeBound - new Date()) / (1000 * 60 * 60 * 24)
    );
    const expectedProgress = 100 - (daysRemaining / 30) * 100; // Assuming 30-day goals

    return goal.progress >= expectedProgress * 0.8; // 80% of expected progress
  }

  calculateGoalRisk(goal) {
    if (goal.status === "completed") return "low";
    if (goal.status === "overdue") return "high";

    const onTrack = this.isGoalOnTrack(goal);
    return onTrack ? "low" : "medium";
  }

  isProgressStalled(goal, history) {
    // Check if progress hasn't changed in the last week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter((h) => h.timestamp > oneWeekAgo);

    return (
      recentHistory.length === 0 ||
      recentHistory.every(
        (h) => !h.changes.some((c) => c.metric.includes(goal._id))
      )
    );
  }

  groupInterventionsByType(interventions) {
    const groups = {};

    for (const intervention of interventions) {
      const type = intervention.type || "other";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(intervention);
    }

    return groups;
  }

  groupByTimePeriod(data, period) {
    const groups = {};

    for (const item of data) {
      let key;
      const date = new Date(item.timestamp);

      switch (period) {
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          break;
        default:
          key = date.toISOString();
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    return groups;
  }

  calculatePeriodTrend(data) {
    if (data.length < 2) {
      return { direction: "stable", value: 0, confidence: 0.1 };
    }

    // Simple trend calculation
    const values = data.map((d) => d.metrics?.overallProgress || 0);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];

    const change = lastValue - firstValue;
    const direction =
      change > 5 ? "improving" : change < -5 ? "declining" : "stable";

    return {
      direction,
      value: change,
      confidence: Math.min(data.length / 10, 1), // More data = higher confidence
    };
  }

  getProgressDataBefore(timestamp, history) {
    const beforeHistory = history.filter((h) => h.timestamp < timestamp);
    return beforeHistory.length > 0
      ? beforeHistory[beforeHistory.length - 1].metrics
      : null;
  }

  calculateImprovements(beforeData, afterData) {
    // Placeholder for improvement calculation
    return {
      overallScore: 50,
      metrics: {},
      confidence: 0.5,
    };
  }

  calculateCurrentMetrics(progressData) {
    // Calculate current metrics from progress data
    return {
      timestamp: new Date(),
      values: progressData,
    };
  }

  // Validate premium access
  async validatePremiumAccess(userId) {
    // This would integrate with the billing system
    return true;
  }

  // Initialize goal templates
  initializeGoalTemplates() {
    return {
      mobility: {
        description: "Improve patient mobility",
        measurable: "Distance walked per day",
        unit: "meters",
        category: "functional",
      },
      pain: {
        description: "Reduce pain levels",
        measurable: "Pain score (0-10)",
        unit: "points",
        category: "comfort",
      },
      independence: {
        description: "Increase independence in ADLs",
        measurable: "ADL independence score",
        unit: "percentage",
        category: "functional",
      },
    };
  }

  // Initialize metrics configuration
  initializeMetricsConfig() {
    return {
      vital_signs: {
        weight: "numeric",
        blood_pressure: "text",
        heart_rate: "numeric",
        temperature: "numeric",
      },
      functional: {
        mobility_score: "numeric",
        adl_score: "numeric",
        balance_score: "numeric",
      },
      quality_of_life: {
        pain_level: "numeric",
        mood_score: "numeric",
        sleep_quality: "numeric",
      },
    };
  }

  // Advanced Analytics Methods

  // Predictive Outcome Modeling
  async generatePredictiveOutcomes(patientId, modelType = "recovery") {
    try {
      const result = await this.analyticsService.generatePredictiveModel(
        patientId,
        modelType
      );

      if (result.success) {
        // Emit event for real-time updates
        this.eventManager.emit("progress-prediction-generated", {
          patientId,
          modelType,
          prediction: result.data,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error("Error generating predictive outcomes:", error);
      throw error;
    }
  }

  // Risk Assessment with AI
  async performAdvancedRiskAssessment(
    patientId,
    assessmentType = "comprehensive"
  ) {
    try {
      const result = await this.analyticsService.performRiskAssessment(
        patientId,
        assessmentType
      );

      if (
        (result.success && result.data.riskLevel === "high") ||
        result.data.riskLevel === "critical"
      ) {
        // Generate alerts for high-risk patients
        this.eventManager.emit("high-risk-patient-identified", {
          patientId,
          riskLevel: result.data.riskLevel,
          riskScores: result.data.riskScores,
          alerts: result.data.alerts,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error("Error performing risk assessment:", error);
      throw error;
    }
  }

  // Intervention Optimization
  async optimizeInterventions(patientId, currentInterventions = []) {
    try {
      const result =
        await this.analyticsService.generateInterventionOptimization(
          patientId,
          currentInterventions
        );

      if (result.success) {
        // Cache optimization results
        const cacheKey = `progress:optimization:${patientId}`;
        await this.cacheService.set(cacheKey, result.data, 7200); // 2 hours

        // Emit event for care team notifications
        this.eventManager.emit("intervention-optimization-available", {
          patientId,
          optimization: result.data,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error("Error optimizing interventions:", error);
      throw error;
    }
  }

  // Comprehensive Progress Reporting
  async generateAdvancedProgressReport(
    patientId,
    reportType = "comprehensive",
    dateRange = {}
  ) {
    try {
      const result = await this.analyticsService.generateProgressReport(
        patientId,
        reportType,
        dateRange
      );

      if (result.success) {
        // Store report for future reference
        const reportKey = `progress:report:${patientId}:${reportType}:${Date.now()}`;
        await this.cacheService.set(reportKey, result.data, 86400); // 24 hours
      }

      return result;
    } catch (error) {
      console.error("Error generating progress report:", error);
      throw error;
    }
  }

  // Real-time Progress Monitoring
  async setupRealtimeMonitoring(patientId, monitoringConfig = {}) {
    try {
      const defaultConfig = {
        alertThresholds: {
          functionalDecline: 0.2,
          cognitiveDecline: 0.15,
          riskIncrease: 0.3,
        },
        monitoringInterval: 3600000, // 1 hour
        enablePredictiveAlerts: true,
        enableRiskAssessment: true,
      };

      const config = { ...defaultConfig, ...monitoringConfig };

      // Set up monitoring interval
      const monitoringKey = `progress:monitoring:${patientId}`;
      await this.cacheService.set(
        monitoringKey,
        {
          patientId,
          config,
          lastCheck: new Date(),
          status: "active",
        },
        86400
      );

      // Schedule periodic assessments
      this.schedulePeriodicAssessment(patientId, config);

      return {
        success: true,
        message: "Real-time monitoring activated",
        config,
      };
    } catch (error) {
      console.error("Error setting up real-time monitoring:", error);
      throw error;
    }
  }

  // Trend Analysis with Machine Learning
  async performTrendAnalysis(patientId, analysisType = "comprehensive") {
    try {
      const cacheKey = `progress:trends:${patientId}:${analysisType}`;
      let trendAnalysis = await this.cacheService.get(cacheKey);

      if (!trendAnalysis) {
        // Get historical data for trend analysis
        const historicalData = await ProgressTracking.find({
          patientId,
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
        })
          .sort({ createdAt: 1 })
          .exec();

        if (historicalData.length < 3) {
          throw new Error("Insufficient data for trend analysis");
        }

        // Perform AI-powered trend analysis
        const aiTrendAnalysis = await this.aiService.analyzeProgress(
          historicalData.map((p) => p.metrics),
          historicalData.map((p) => p.goals).flat()
        );

        // Calculate statistical trends
        const statisticalTrends =
          this.calculateStatisticalTrends(historicalData);

        // Combine AI and statistical analysis
        trendAnalysis = {
          patientId,
          analysisType,
          aiAnalysis: aiTrendAnalysis.analysis,
          statisticalTrends,
          trendDirection: this.determineTrendDirection(statisticalTrends),
          significantChanges: this.identifySignificantChanges(historicalData),
          projections: this.generateTrendProjections(statisticalTrends),
          confidence: aiTrendAnalysis.confidence || 0.75,
          analyzedAt: new Date(),
          dataPoints: historicalData.length,
        };

        // Cache for 2 hours
        await this.cacheService.set(cacheKey, trendAnalysis, 7200);
      }

      return {
        success: true,
        data: trendAnalysis,
      };
    } catch (error) {
      console.error("Error performing trend analysis:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Goal Achievement Prediction
  async predictGoalAchievement(patientId, goalId) {
    try {
      // Get progress data related to the specific goal
      const goalProgress = await ProgressTracking.find({
        patientId,
        "goals.goalId": goalId,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (goalProgress.length === 0) {
        throw new Error("No progress data found for the specified goal");
      }

      // Extract goal-specific metrics
      const goalMetrics = goalProgress.map((p) => {
        const goal = p.goals.find((g) => g.goalId === goalId);
        return {
          progress: goal?.progress || 0,
          timestamp: p.createdAt,
          interventions: p.interventions.filter((i) => i.goalId === goalId),
        };
      });

      // Use AI to predict goal achievement
      const aiPrediction = await this.aiService.analyzeProgress(goalMetrics, [
        goalId,
      ]);

      // Calculate statistical probability
      const statisticalProbability =
        this.calculateGoalAchievementProbability(goalMetrics);

      const prediction = {
        patientId,
        goalId,
        achievementProbability: statisticalProbability,
        aiInsights: aiPrediction.analysis,
        estimatedTimeToCompletion: this.estimateTimeToCompletion(goalMetrics),
        recommendedActions: this.generateGoalRecommendations(goalMetrics),
        confidenceLevel: Math.min(
          aiPrediction.confidence || 0.7,
          statisticalProbability.confidence
        ),
        predictedAt: new Date(),
      };

      return {
        success: true,
        data: prediction,
      };
    } catch (error) {
      console.error("Error predicting goal achievement:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper Methods for Advanced Analytics

  schedulePeriodicAssessment(patientId, config) {
    // This would integrate with a job scheduler in a real implementation
    setTimeout(async () => {
      try {
        await this.performAdvancedRiskAssessment(patientId);
        // Reschedule
        this.schedulePeriodicAssessment(patientId, config);
      } catch (error) {
        console.error("Error in periodic assessment:", error);
      }
    }, config.monitoringInterval);
  }

  calculateStatisticalTrends(historicalData) {
    const trends = {
      functional: this.calculateTrendForMetric(historicalData, "functional"),
      cognitive: this.calculateTrendForMetric(historicalData, "cognitive"),
      overall: this.calculateTrendForMetric(historicalData, "total"),
    };

    return trends;
  }

  calculateTrendForMetric(data, metricType) {
    const values = data.map((d) => d.scoring?.[metricType] || 0);
    const n = values.length;

    if (n < 2)
      return { slope: 0, correlation: 0, significance: "insufficient_data" };

    // Calculate linear regression
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Calculate correlation coefficient
    const correlation = this.calculateCorrelation(values);

    return {
      slope,
      correlation,
      significance:
        Math.abs(correlation) > 0.5 ? "significant" : "not_significant",
      direction: slope > 0 ? "improving" : slope < 0 ? "declining" : "stable",
    };
  }

  calculateCorrelation(values) {
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = values[i] - yMean;

      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  determineTrendDirection(trends) {
    const directions = Object.values(trends).map((t) => t.direction);
    const improving = directions.filter((d) => d === "improving").length;
    const declining = directions.filter((d) => d === "declining").length;

    if (improving > declining) return "improving";
    if (declining > improving) return "declining";
    return "stable";
  }

  identifySignificantChanges(historicalData) {
    const changes = [];

    for (let i = 1; i < historicalData.length; i++) {
      const current = historicalData[i];
      const previous = historicalData[i - 1];

      const functionalChange =
        (current.scoring?.functional || 0) -
        (previous.scoring?.functional || 0);
      const cognitiveChange =
        (current.scoring?.cognitive || 0) - (previous.scoring?.cognitive || 0);

      if (Math.abs(functionalChange) > 0.2) {
        changes.push({
          type: "functional",
          change: functionalChange,
          date: current.createdAt,
          significance: Math.abs(functionalChange) > 0.4 ? "high" : "medium",
        });
      }

      if (Math.abs(cognitiveChange) > 0.15) {
        changes.push({
          type: "cognitive",
          change: cognitiveChange,
          date: current.createdAt,
          significance: Math.abs(cognitiveChange) > 0.3 ? "high" : "medium",
        });
      }
    }

    return changes;
  }

  generateTrendProjections(trends) {
    const projections = {};

    Object.entries(trends).forEach(([metric, trend]) => {
      if (trend.significance === "significant") {
        const projection = {
          metric,
          projectedChange: trend.slope * 7, // 7 days projection
          confidence: Math.abs(trend.correlation),
          timeframe: "7_days",
        };
        projections[metric] = projection;
      }
    });

    return projections;
  }

  calculateGoalAchievementProbability(goalMetrics) {
    if (goalMetrics.length === 0) {
      return { probability: 0.5, confidence: 0.1 };
    }

    const progressValues = goalMetrics.map((m) => m.progress);
    const latestProgress = progressValues[0];
    const trend = this.calculateTrendForMetric(
      goalMetrics.map((m) => ({ scoring: { total: m.progress } })),
      "total"
    );

    let probability = latestProgress;

    // Adjust based on trend
    if (trend.direction === "improving") {
      probability = Math.min(1.0, probability + trend.slope * 0.5);
    } else if (trend.direction === "declining") {
      probability = Math.max(0.0, probability - Math.abs(trend.slope) * 0.3);
    }

    return {
      probability,
      confidence: Math.abs(trend.correlation),
      trend: trend.direction,
    };
  }

  estimateTimeToCompletion(goalMetrics) {
    const progressValues = goalMetrics.map((m) => m.progress);
    const latestProgress = progressValues[0];

    if (latestProgress >= 1.0) return 0;

    const trend = this.calculateTrendForMetric(
      goalMetrics.map((m) => ({ scoring: { total: m.progress } })),
      "total"
    );

    if (trend.slope <= 0) return null; // No progress or declining

    const remainingProgress = 1.0 - latestProgress;
    const estimatedDays = remainingProgress / trend.slope;

    return Math.max(1, Math.round(estimatedDays));
  }

  generateGoalRecommendations(goalMetrics) {
    const recommendations = [];
    const latestProgress = goalMetrics[0]?.progress || 0;

    if (latestProgress < 0.3) {
      recommendations.push("Consider revising goal or intervention strategy");
      recommendations.push("Increase intervention frequency");
    } else if (latestProgress < 0.7) {
      recommendations.push("Maintain current intervention approach");
      recommendations.push("Monitor progress closely");
    } else {
      recommendations.push("Goal is on track for completion");
      recommendations.push("Prepare for goal transition or advancement");
    }

    return recommendations;
  }
}

export default new ProgressTrackingService();
