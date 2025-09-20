import ProgressTracking from "../../models/nursing/ProgressTracking.js";
import NursingAIService from "./NursingAIService.js";
import NursingCacheService from "./NursingCacheService.js";
import EventManager from "./EventManager.js";
import crypto from "crypto";

// Custom error classes for Progress Analytics Service
class ProgressAnalyticsServiceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "ProgressAnalyticsServiceError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
  }

  determineSeverity(code) {
    const criticalCodes = ['ANALYTICS_DATA_CORRUPTION', 'CRITICAL_DATA_LOSS', 'PATIENT_SAFETY_RISK'];
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

// Input validation class for progress analytics
class ProgressAnalyticsValidator {
  static validateAnalyticsRequest(data, context = {}) {
    const errors = [];
    const warnings = [];
    
    if (!data) {
      errors.push("Analytics request data is required");
      return { isValid: false, errors, warnings };
    }
    
    // Required fields validation
    if (!data.patientId) {
      errors.push("Patient ID is required");
    }
    
    if (!data.userId) {
      errors.push("User ID is required");
    }
    
    // Model type validation
    if (data.modelType && !this.isValidModelType(data.modelType)) {
      errors.push(`Invalid model type: ${data.modelType}`);
    }
    
    // Analysis options validation
    if (data.analysisOptions) {
      const optionsValidation = this.validateAnalysisOptions(data.analysisOptions);
      errors.push(...optionsValidation.errors);
      warnings.push(...optionsValidation.warnings);
    }
    
    // Date range validation
    if (data.dateRange) {
      const dateValidation = this.validateDateRange(data.dateRange);
      errors.push(...dateValidation.errors);
      warnings.push(...dateValidation.warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateAnalysisOptions(options) {
    const errors = [];
    const warnings = [];
    
    if (typeof options !== 'object') {
      errors.push("Analysis options must be an object");
      return { errors, warnings };
    }
    
    // Validate analysis types
    const validAnalysisTypes = ['comprehensive', 'summary', 'trend', 'risk', 'intervention'];
    if (options.analysisType && !validAnalysisTypes.includes(options.analysisType)) {
      errors.push(`Invalid analysis type: ${options.analysisType}`);
    }
    
    // Validate confidence level
    if (options.confidenceLevel && (typeof options.confidenceLevel !== 'number' || options.confidenceLevel < 0 || options.confidenceLevel > 1)) {
      errors.push("Confidence level must be a number between 0 and 1");
    }
    
    return { errors, warnings };
  }
  
  static validateDateRange(dateRange) {
    const errors = [];
    const warnings = [];
    
    if (typeof dateRange !== 'object') {
      errors.push("Date range must be an object");
      return { errors, warnings };
    }
    
    if (dateRange.startDate && !this.isValidDate(dateRange.startDate)) {
      errors.push("Invalid start date format");
    }
    
    if (dateRange.endDate && !this.isValidDate(dateRange.endDate)) {
      errors.push("Invalid end date format");
    }
    
    if (dateRange.startDate && dateRange.endDate) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      if (start > end) {
        errors.push("Start date must be before end date");
      }
    }
    
    return { errors, warnings };
  }
  
  static validateProgressData(progressData) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(progressData)) {
      errors.push("Progress data must be an array");
      return { errors, warnings };
    }
    
    for (let i = 0; i < progressData.length; i++) {
      const dataPoint = progressData[i];
      if (!dataPoint.patientId) {
        errors.push(`Progress data point ${i + 1}: Patient ID is required`);
      }
      
      if (dataPoint.score !== undefined && (typeof dataPoint.score !== 'number' || dataPoint.score < 0 || dataPoint.score > 100)) {
        errors.push(`Progress data point ${i + 1}: Score must be a number between 0 and 100`);
      }
      
      if (dataPoint.date && !this.isValidDate(dataPoint.date)) {
        errors.push(`Progress data point ${i + 1}: Invalid date format`);
      }
    }
    
    return { errors, warnings };
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
  
  static isValidModelType(modelType) {
    const validTypes = ['recovery', 'readmission', 'deterioration', 'functional', 'cognitive'];
    return validTypes.includes(modelType);
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

class ProgressAnalyticsService {
  constructor() {
    this.aiService = NursingAIService;
    this.cacheService = new NursingCacheService();
    this.eventManager = EventManager;

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.PROGRESS_ANALYTICS_AI_PROVIDER || 'openai',
      rateLimit: {
        maxRequests: parseInt(process.env.PROGRESS_ANALYTICS_RATE_LIMIT_MAX_REQUESTS) || 100,
        windowMs: parseInt(process.env.PROGRESS_ANALYTICS_RATE_LIMIT_WINDOW_MS) || 60000
      },
      cache: {
        ttl: parseInt(process.env.PROGRESS_ANALYTICS_CACHE_TTL) || 300000, // 5 minutes
        maxSize: parseInt(process.env.PROGRESS_ANALYTICS_CACHE_MAX_SIZE) || 1000
      },
      circuitBreaker: {
        threshold: parseInt(process.env.PROGRESS_ANALYTICS_CIRCUIT_BREAKER_THRESHOLD) || 5,
        timeout: parseInt(process.env.PROGRESS_ANALYTICS_CIRCUIT_BREAKER_TIMEOUT) || 60000
      },
      retries: {
        maxAttempts: parseInt(process.env.PROGRESS_ANALYTICS_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay: parseInt(process.env.PROGRESS_ANALYTICS_RETRY_BACKOFF_DELAY) || 1000
      }
    };

    // Analytics configuration
    this.analyticsConfig = {
      predictionModels: {
        recovery: {
          algorithm: "linear_regression",
          features: [
            "functional_score",
            "cognitive_score",
            "intervention_count",
            "days_since_admission",
          ],
          accuracy: 0.85,
        },
        readmission: {
          algorithm: "random_forest",
          features: [
            "comorbidity_count",
            "medication_adherence",
            "social_support",
            "discharge_planning",
          ],
          accuracy: 0.78,
        },
        deterioration: {
          algorithm: "neural_network",
          features: [
            "vital_trends",
            "lab_values",
            "symptom_severity",
            "medication_changes",
          ],
          accuracy: 0.82,
        },
      },
      riskThresholds: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
      },
    };

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
    return `progress_analytics_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      service: 'ProgressAnalyticsService',
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
      service: 'ProgressAnalyticsService',
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
    const validation = ProgressAnalyticsValidator.validateAnalyticsRequest(data, context);
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(`Validation failed: ${validation.errors.join(', ')}`, 'analyticsData');
    }
    
    if (validation.warnings.length > 0) {
      this.logInfo(`Validation warnings: ${validation.warnings.join(', ')}`, context);
    }
    
    if (context.userId) {
      ProgressAnalyticsValidator.validateUserId(context.userId, context);
    }
    
    if (context.patientId) {
      ProgressAnalyticsValidator.validatePatientId(context.patientId, context);
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
        service: 'ProgressAnalyticsService',
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
        service: 'ProgressAnalyticsService',
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
      analyticsConfig: Object.keys(this.analyticsConfig.predictionModels).length
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
        service: 'ProgressAnalyticsService',
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
        service: 'ProgressAnalyticsService',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        error: error.message
      };
    }
  }

  // Predictive Outcome Modeling
  async generatePredictiveModel(patientId, modelType = "recovery") {
    try {
      const cacheKey = `progress:prediction:${patientId}:${modelType}`;
      let prediction = await this.cacheService.get(cacheKey);

      if (!prediction) {
        // Get historical progress data
        const progressData = await ProgressTracking.find({
          patientId,
          status: "completed",
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .exec();

        if (progressData.length < 5) {
          throw new Error("Insufficient data for predictive modeling");
        }

        // Extract features for prediction
        const features = this.extractPredictiveFeatures(
          progressData,
          modelType
        );

        // Use AI service for prediction
        const aiPrediction = await this.aiService.predictOutcomes(features, {
          modelType,
          patientId,
          historicalData: progressData.slice(0, 10), // Last 10 entries
        });

        // Calculate confidence intervals
        const confidenceIntervals = this.calculateConfidenceIntervals(
          progressData,
          modelType
        );

        prediction = {
          modelType,
          patientId,
          prediction: aiPrediction.prediction,
          confidence: aiPrediction.confidence || 0.75,
          confidenceIntervals,
          features,
          riskLevel: this.calculateRiskLevel(
            aiPrediction.prediction.probability
          ),
          recommendations: aiPrediction.prediction.recommendations || [],
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          generatedAt: new Date(),
          dataPoints: progressData.length,
        };

        // Cache for 6 hours
        await this.cacheService.set(cacheKey, prediction, 21600);
      }

      return {
        success: true,
        data: prediction,
      };
    } catch (error) {
      console.error("Error generating predictive model:", error);
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackPrediction(patientId, modelType),
      };
    }
  }

  // Risk Assessment Algorithms
  async performRiskAssessment(patientId, assessmentType = "comprehensive") {
    try {
      const cacheKey = `progress:risk:${patientId}:${assessmentType}`;
      let riskAssessment = await this.cacheService.get(cacheKey);

      if (!riskAssessment) {
        // Get recent progress data
        const recentProgress = await ProgressTracking.find({
          patientId,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        })
          .sort({ createdAt: -1 })
          .exec();

        // Calculate risk scores for different categories
        const riskScores = {
          functional: this.calculateFunctionalRisk(recentProgress),
          cognitive: this.calculateCognitiveRisk(recentProgress),
          medical: this.calculateMedicalRisk(recentProgress),
          social: this.calculateSocialRisk(recentProgress),
          environmental: this.calculateEnvironmentalRisk(recentProgress),
        };

        // Calculate composite risk score
        const compositeRisk = this.calculateCompositeRisk(riskScores);

        // Generate risk-based recommendations
        const recommendations = await this.generateRiskRecommendations(
          riskScores,
          recentProgress
        );

        riskAssessment = {
          patientId,
          assessmentType,
          riskScores,
          compositeRisk,
          riskLevel: this.calculateRiskLevel(compositeRisk.score),
          recommendations,
          trends: this.calculateRiskTrends(recentProgress),
          alerts: this.generateRiskAlerts(riskScores),
          assessedAt: new Date(),
          validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
          dataPoints: recentProgress.length,
        };

        // Cache for 4 hours
        await this.cacheService.set(cacheKey, riskAssessment, 14400);
      }

      return {
        success: true,
        data: riskAssessment,
      };
    } catch (error) {
      console.error("Error performing risk assessment:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Intervention Optimization Recommendations
  async generateInterventionOptimization(patientId, currentInterventions = []) {
    try {
      // Get progress data with intervention outcomes
      const progressWithInterventions = await ProgressTracking.find({
        patientId,
        "interventions.0": { $exists: true }, // Has interventions
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .exec();

      // Analyze intervention effectiveness
      const interventionAnalysis = this.analyzeInterventionEffectiveness(
        progressWithInterventions
      );

      // Use AI to optimize interventions
      const aiOptimization = await this.aiService.optimizeCarePlan(
        currentInterventions,
        { patientId },
        { interventionAnalysis }
      );

      // Generate optimization recommendations
      const optimization = {
        patientId,
        currentInterventions,
        analysis: interventionAnalysis,
        recommendations: {
          continue: interventionAnalysis.effective,
          modify: interventionAnalysis.partiallyEffective,
          discontinue: interventionAnalysis.ineffective,
          add: aiOptimization.optimization?.newGoals || [],
        },
        expectedOutcomes: aiOptimization.optimization?.expectedOutcomes || {},
        confidenceScore: aiOptimization.confidence || 0.7,
        evidenceLevel: this.calculateEvidenceLevel(
          progressWithInterventions.length
        ),
        generatedAt: new Date(),
      };

      return {
        success: true,
        data: optimization,
      };
    } catch (error) {
      console.error("Error generating intervention optimization:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Comprehensive Progress Reporting
  async generateProgressReport(
    patientId,
    reportType = "comprehensive",
    dateRange = {}
  ) {
    try {
      const { start, end } = this.getDateRange(dateRange);

      const progressData = await ProgressTracking.find({
        patientId,
        createdAt: { $gte: start, $lte: end },
      })
        .sort({ createdAt: 1 })
        .populate("userId", "profile.firstName profile.lastName")
        .exec();

      // Generate different report types
      let report;
      switch (reportType) {
        case "summary":
          report = await this.generateSummaryReport(progressData);
          break;
        case "detailed":
          report = await this.generateDetailedReport(progressData);
          break;
        case "trends":
          report = await this.generateTrendsReport(progressData);
          break;
        case "outcomes":
          report = await this.generateOutcomesReport(progressData);
          break;
        default:
          report = await this.generateComprehensiveReport(progressData);
      }

      // Add metadata
      report.metadata = {
        patientId,
        reportType,
        dateRange: { start, end },
        dataPoints: progressData.length,
        generatedAt: new Date(),
        generatedBy: "ProgressAnalyticsService",
      };

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      console.error("Error generating progress report:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper Methods

  extractPredictiveFeatures(progressData, modelType) {
    const features = {
      temporal: this.extractTemporalFeatures(progressData),
      clinical: this.extractClinicalFeatures(progressData),
      functional: this.extractFunctionalFeatures(progressData),
      psychosocial: this.extractPsychosocialFeatures(progressData),
    };

    // Model-specific feature selection
    switch (modelType) {
      case "recovery":
        return {
          ...features,
          recovery_indicators: this.extractRecoveryIndicators(progressData),
        };
      case "readmission":
        return {
          ...features,
          readmission_risk_factors:
            this.extractReadmissionRiskFactors(progressData),
        };
      case "deterioration":
        return {
          ...features,
          deterioration_markers: this.extractDeteriorationMarkers(progressData),
        };
      default:
        return features;
    }
  }

  extractTemporalFeatures(progressData) {
    return {
      duration:
        progressData.length > 0
          ? (new Date() -
              new Date(progressData[progressData.length - 1].createdAt)) /
            (1000 * 60 * 60 * 24)
          : 0,
      frequency: progressData.length,
      consistency: this.calculateConsistency(progressData),
      trend_direction: this.calculateTrendDirection(progressData),
    };
  }

  extractClinicalFeatures(progressData) {
    const clinicalMetrics = progressData.flatMap((p) => p.metrics || []);
    return {
      avg_vital_stability: this.calculateVitalStability(clinicalMetrics),
      symptom_severity_trend: this.calculateSymptomTrend(clinicalMetrics),
      medication_adherence: this.calculateMedicationAdherence(progressData),
      complication_count: this.countComplications(progressData),
    };
  }

  extractFunctionalFeatures(progressData) {
    return {
      mobility_improvement: this.calculateMobilityImprovement(progressData),
      adl_independence: this.calculateADLIndependence(progressData),
      cognitive_function: this.calculateCognitiveFunction(progressData),
      pain_management: this.calculatePainManagement(progressData),
    };
  }

  extractPsychosocialFeatures(progressData) {
    return {
      mood_stability: this.calculateMoodStability(progressData),
      social_support: this.calculateSocialSupport(progressData),
      motivation_level: this.calculateMotivationLevel(progressData),
      coping_mechanisms: this.calculateCopingMechanisms(progressData),
    };
  }

  calculateRiskLevel(score) {
    const { low, medium, high } = this.analyticsConfig.riskThresholds;

    if (score <= low) return "low";
    if (score <= medium) return "medium";
    if (score <= high) return "high";
    return "critical";
  }

  calculateConfidenceIntervals(progressData, modelType) {
    // Statistical calculation of confidence intervals
    const dataPoints = progressData.length;
    const baseConfidence = Math.min(0.95, 0.5 + dataPoints * 0.02);

    return {
      lower: Math.max(0.1, baseConfidence - 0.15),
      upper: Math.min(0.99, baseConfidence + 0.1),
      level: baseConfidence,
    };
  }

  calculateFunctionalRisk(progressData) {
    // Analyze functional decline patterns
    const functionalScores = progressData.map(
      (p) => p.scoring?.functional || 0
    );
    const trend = this.calculateTrendDirection(functionalScores);

    return {
      score: trend < 0 ? Math.abs(trend) : 0.2,
      factors: this.identifyFunctionalRiskFactors(progressData),
      trend: trend < 0 ? "declining" : trend > 0 ? "improving" : "stable",
    };
  }

  calculateCognitiveRisk(progressData) {
    const cognitiveScores = progressData.map((p) => p.scoring?.cognitive || 0);
    const trend = this.calculateTrendDirection(cognitiveScores);

    return {
      score: trend < 0 ? Math.abs(trend) : 0.15,
      factors: this.identifyCognitiveRiskFactors(progressData),
      trend: trend < 0 ? "declining" : trend > 0 ? "improving" : "stable",
    };
  }

  calculateMedicalRisk(progressData) {
    const complications = this.countComplications(progressData);
    const medicationIssues = this.countMedicationIssues(progressData);

    return {
      score: Math.min(1.0, complications * 0.2 + medicationIssues * 0.15),
      factors: this.identifyMedicalRiskFactors(progressData),
      complications,
      medicationIssues,
    };
  }

  calculateSocialRisk(progressData) {
    const socialSupport = this.calculateSocialSupport(progressData);
    const dischargePlanning = this.assessDischargePlanning(progressData);

    return {
      score: Math.max(0, 1 - socialSupport - dischargePlanning),
      factors: this.identifySocialRiskFactors(progressData),
      socialSupport,
      dischargePlanning,
    };
  }

  calculateEnvironmentalRisk(progressData) {
    const homeReadiness = this.assessHomeReadiness(progressData);
    const equipmentNeeds = this.assessEquipmentNeeds(progressData);

    return {
      score: Math.max(0, 1 - homeReadiness),
      factors: this.identifyEnvironmentalRiskFactors(progressData),
      homeReadiness,
      equipmentNeeds,
    };
  }

  calculateCompositeRisk(riskScores) {
    const weights = {
      functional: 0.25,
      cognitive: 0.2,
      medical: 0.25,
      social: 0.15,
      environmental: 0.15,
    };

    const weightedScore = Object.entries(riskScores).reduce(
      (sum, [category, risk]) => {
        return sum + risk.score * weights[category];
      },
      0
    );

    return {
      score: weightedScore,
      breakdown: riskScores,
      weights,
      interpretation: this.interpretCompositeRisk(weightedScore),
    };
  }

  async generateRiskRecommendations(riskScores, progressData) {
    const recommendations = [];

    // Generate category-specific recommendations
    Object.entries(riskScores).forEach(([category, risk]) => {
      if (risk.score > this.analyticsConfig.riskThresholds.medium) {
        recommendations.push(
          ...this.getCategoryRecommendations(category, risk, progressData)
        );
      }
    });

    // Use AI for additional insights
    try {
      const aiRecommendations =
        await this.aiService.provideClinicalDecisionSupport(
          { riskScores, progressData: progressData.slice(0, 5) },
          { type: "risk_mitigation" }
        );

      if (aiRecommendations.success) {
        recommendations.push(...aiRecommendations.support.recommendations);
      }
    } catch (error) {
      console.error("Error getting AI recommendations:", error);
    }

    return recommendations;
  }

  analyzeInterventionEffectiveness(progressData) {
    const interventionOutcomes = {};
    const effective = [];
    const partiallyEffective = [];
    const ineffective = [];

    progressData.forEach((progress) => {
      if (progress.interventions && progress.interventions.length > 0) {
        progress.interventions.forEach((intervention) => {
          if (!interventionOutcomes[intervention.type]) {
            interventionOutcomes[intervention.type] = {
              count: 0,
              outcomes: [],
              effectiveness: 0,
            };
          }

          interventionOutcomes[intervention.type].count++;
          interventionOutcomes[intervention.type].outcomes.push(
            progress.scoring?.total || 0
          );
        });
      }
    });

    // Categorize interventions by effectiveness
    Object.entries(interventionOutcomes).forEach(([type, data]) => {
      const avgOutcome =
        data.outcomes.reduce((a, b) => a + b, 0) / data.outcomes.length;
      data.effectiveness = avgOutcome;

      if (avgOutcome >= 0.7) {
        effective.push({ type, effectiveness: avgOutcome, count: data.count });
      } else if (avgOutcome >= 0.4) {
        partiallyEffective.push({
          type,
          effectiveness: avgOutcome,
          count: data.count,
        });
      } else {
        ineffective.push({
          type,
          effectiveness: avgOutcome,
          count: data.count,
        });
      }
    });

    return {
      effective,
      partiallyEffective,
      ineffective,
      overall: interventionOutcomes,
    };
  }

  // Report Generation Methods
  async generateComprehensiveReport(progressData) {
    return {
      summary: await this.generateSummaryReport(progressData),
      trends: await this.generateTrendsReport(progressData),
      outcomes: await this.generateOutcomesReport(progressData),
      recommendations: await this.generateRecommendationsSection(progressData),
    };
  }

  async generateSummaryReport(progressData) {
    const totalEntries = progressData.length;
    const avgScore =
      progressData.reduce((sum, p) => sum + (p.scoring?.total || 0), 0) /
      totalEntries;
    const improvementRate = this.calculateImprovementRate(progressData);

    return {
      totalEntries,
      avgScore: Math.round(avgScore * 100) / 100,
      improvementRate: Math.round(improvementRate * 100) / 100,
      timespan: this.calculateTimespan(progressData),
      keyMetrics: this.extractKeyMetrics(progressData),
    };
  }

  // Analyze progress comprehensively
  async analyzeProgress(patientId, analysisOptions = {}) {
    try {
      const {
        timeframe = "30days",
        includeAI = true,
        includePredictions = true,
        includeComparisons = true,
      } = analysisOptions;

      // Get progress data
      const progressData = await this.getProgressData(patientId, timeframe);

      if (!progressData || progressData.length === 0) {
        return {
          success: false,
          message: "No progress data found for analysis",
          patientId,
          timeframe,
        };
      }

      // Core analysis
      const analysis = {
        patientId,
        timeframe,
        analyzedAt: new Date(),
        dataPoints: progressData.length,

        // Basic metrics
        summary: await this.generateSummaryReport(progressData),
        trends: await this.generateTrendsReport(progressData),
        outcomes: await this.generateOutcomesReport(progressData),

        // Advanced analytics
        riskAssessment: await this.assessProgressRisk(progressData),
        qualityMetrics: await this.calculateQualityMetrics(progressData),
        interventionEffectiveness: await this.analyzeInterventionEffectiveness(
          progressData
        ),

        // Performance indicators
        performanceIndicators: {
          improvementRate: this.calculateImprovementRate(progressData),
          consistencyScore: this.calculateConsistency(progressData),
          goalAttainment: this.calculateGoalAttainment(progressData),
          adherenceRate: this.calculateAdherenceRate(progressData),
        },
      };

      // Add AI-powered insights if requested
      if (includeAI) {
        try {
          const aiInsights = await this.aiService.analyzeProgress(progressData);
          analysis.aiInsights = {
            patterns: aiInsights.patterns || [],
            recommendations: aiInsights.recommendations || [],
            riskFactors: aiInsights.riskFactors || [],
            confidence: aiInsights.confidence || 0.75,
          };
        } catch (aiError) {
          console.warn("AI analysis failed:", aiError.message);
          analysis.aiInsights = { error: "AI analysis unavailable" };
        }
      }

      // Add predictions if requested
      if (includePredictions) {
        try {
          analysis.predictions = {
            recovery: await this.generatePredictiveModel(patientId, "recovery"),
            readmission: await this.generatePredictiveModel(
              patientId,
              "readmission"
            ),
            deterioration: await this.generatePredictiveModel(
              patientId,
              "deterioration"
            ),
          };
        } catch (predError) {
          console.warn("Prediction analysis failed:", predError.message);
          analysis.predictions = { error: "Prediction analysis unavailable" };
        }
      }

      // Add benchmark comparisons if requested
      if (includeComparisons) {
        try {
          analysis.benchmarkComparison = await this.compareToBenchmarks(
            progressData
          );
        } catch (compError) {
          console.warn("Benchmark comparison failed:", compError.message);
          analysis.benchmarkComparison = {
            error: "Benchmark comparison unavailable",
          };
        }
      }

      // Generate actionable recommendations
      analysis.recommendations = await this.generateActionableRecommendations(
        analysis
      );

      // Cache the analysis
      const cacheKey = `progress:analysis:${patientId}:${timeframe}`;
      await this.cacheService.set(cacheKey, analysis, 1800); // 30 minutes cache

      // Emit analysis completed event
      this.eventManager.emit("progressAnalysisCompleted", {
        patientId,
        timeframe,
        dataPoints: analysis.dataPoints,
        improvementRate: analysis.performanceIndicators.improvementRate,
        riskLevel: analysis.riskAssessment?.overallRisk || "unknown",
      });

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      console.error("Error analyzing progress:", error);
      this.eventManager.emit("progressAnalysisError", {
        patientId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        patientId,
      };
    }
  }

  // Generate trends (alias for generateTrendsReport for backward compatibility)
  async generateTrends(progressData, trendOptions = {}) {
    return this.generateTrendsReport(progressData, trendOptions);
  }

  async generateTrendsReport(progressData) {
    return {
      functionalTrends: this.calculateFunctionalTrends(progressData),
      cognitiveTrends: this.calculateCognitiveTrends(progressData),
      overallTrend: this.calculateOverallTrend(progressData),
      trendAnalysis: this.analyzeTrends(progressData),
    };
  }

  async generateOutcomesReport(progressData) {
    return {
      achievedGoals: this.calculateAchievedGoals(progressData),
      outcomeMeasures: this.calculateOutcomeMeasures(progressData),
      qualityIndicators: this.calculateQualityIndicators(progressData),
      benchmarkComparison: this.compareToBenchmarks(progressData),
    };
  }

  // Utility Methods
  getDateRange(dateRange) {
    const end = dateRange.end ? new Date(dateRange.end) : new Date();
    const start = dateRange.start
      ? new Date(dateRange.start)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  calculateTrendDirection(values) {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return (secondAvg - firstAvg) / firstAvg;
  }

  calculateConsistency(progressData) {
    if (progressData.length < 2) return 1;

    const intervals = [];
    for (let i = 1; i < progressData.length; i++) {
      const interval =
        new Date(progressData[i].createdAt) -
        new Date(progressData[i - 1].createdAt);
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0
      ) / intervals.length;

    return Math.max(0, 1 - Math.sqrt(variance) / avgInterval);
  }

  generateFallbackPrediction(patientId, modelType) {
    return {
      modelType,
      patientId,
      prediction: {
        probability: 0.5,
        outcomes: { general: "stable" },
        timeframe: "unknown",
      },
      confidence: 0.3,
      riskLevel: "medium",
      recommendations: ["Collect more data for accurate prediction"],
      isFallback: true,
      generatedAt: new Date(),
    };
  }

  // Additional helper methods would be implemented here...
  calculateVitalStability(metrics) {
    return 0.8;
  }
  calculateSymptomTrend(metrics) {
    return 0.7;
  }
  calculateMedicationAdherence(data) {
    return 0.85;
  }
  countComplications(data) {
    return 0;
  }
  calculateMobilityImprovement(data) {
    return 0.6;
  }
  calculateADLIndependence(data) {
    return 0.7;
  }
  calculateCognitiveFunction(data) {
    return 0.8;
  }
  calculatePainManagement(data) {
    return 0.75;
  }
  calculateMoodStability(data) {
    return 0.8;
  }
  calculateSocialSupport(data) {
    return 0.7;
  }
  calculateMotivationLevel(data) {
    return 0.8;
  }
  calculateCopingMechanisms(data) {
    return 0.75;
  }
  identifyFunctionalRiskFactors(data) {
    return [];
  }
  identifyCognitiveRiskFactors(data) {
    return [];
  }
  identifyMedicalRiskFactors(data) {
    return [];
  }
  identifySocialRiskFactors(data) {
    return [];
  }
  identifyEnvironmentalRiskFactors(data) {
    return [];
  }
  countMedicationIssues(data) {
    return 0;
  }
  assessDischargePlanning(data) {
    return 0.8;
  }
  assessHomeReadiness(data) {
    return 0.8;
  }
  assessEquipmentNeeds(data) {
    return 0.9;
  }
  interpretCompositeRisk(score) {
    return `Risk score: ${score.toFixed(2)}`;
  }
  getCategoryRecommendations(category, risk, data) {
    return [`Address ${category} risk factors`];
  }
  calculateEvidenceLevel(dataPoints) {
    return dataPoints > 10 ? "A" : dataPoints > 5 ? "B" : "C";
  }
  calculateImprovementRate(data) {
    return 0.15;
  }
  calculateTimespan(data) {
    return data.length > 0
      ? Math.ceil(
          (new Date() - new Date(data[0].createdAt)) / (1000 * 60 * 60 * 24)
        )
      : 0;
  }
  extractKeyMetrics(data) {
    return {};
  }
  calculateFunctionalTrends(data) {
    return {};
  }
  calculateCognitiveTrends(data) {
    return {};
  }
  calculateOverallTrend(data) {
    return "stable";
  }
  analyzeTrends(data) {
    return {};
  }
  calculateAchievedGoals(data) {
    return [];
  }
  calculateOutcomeMeasures(data) {
    return {};
  }
  calculateQualityIndicators(data) {
    return {};
  }
  compareToBenchmarks(data) {
    return {};
  }
  generateRecommendationsSection(data) {
    return [];
  }
  calculateRiskTrends(data) {
    return {};
  }
  generateRiskAlerts(riskScores) {
    return [];
  }
  extractRecoveryIndicators(data) {
    return {};
  }
  extractReadmissionRiskFactors(data) {
    return {};
  }
  extractDeteriorationMarkers(data) {
    return {};
  }
}

export default new ProgressAnalyticsService();
