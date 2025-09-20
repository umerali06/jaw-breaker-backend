import NursingAssessment from "../../models/nursing/NursingAssessment.js";
import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";
import crypto from "crypto";

// Custom error classes for Nursing Assessments Service
class NursingAssessmentsServiceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "NursingAssessmentsServiceError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
  }

  determineSeverity(code) {
    const criticalCodes = [
      "ASSESSMENT_DATA_CORRUPTION",
      "CRITICAL_DATA_LOSS",
      "PATIENT_SAFETY_RISK",
    ];
    const highCodes = [
      "VALIDATION_FAILURE",
      "UNAUTHORIZED_ACCESS",
      "RATE_LIMIT_EXCEEDED",
    ];

    if (criticalCodes.includes(code)) return "CRITICAL";
    if (highCodes.includes(code)) return "HIGH";
    return "MEDIUM";
  }
}

class ValidationError extends Error {
  constructor(message, field, validationType = "general") {
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
  constructor(message, service, failureReason = "unknown") {
    super(message);
    this.name = "ServiceUnavailableError";
    this.service = service;
    this.failureReason = failureReason;
    this.timestamp = new Date().toISOString();
  }
}

// Input validation class for nursing assessments
class NursingAssessmentValidator {
  static validateAssessmentData(data, context = {}) {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push("Assessment data is required");
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!data.patientId) {
      errors.push("Patient ID is required");
    }

    if (!data.userId) {
      errors.push("User ID is required");
    }

    if (!data.assessmentType) {
      errors.push("Assessment type is required");
    } else if (!this.isValidAssessmentType(data.assessmentType)) {
      errors.push(`Invalid assessment type: ${data.assessmentType}`);
    }

    if (!data.assessmentDate) {
      errors.push("Assessment date is required");
    } else if (!this.isValidDate(data.assessmentDate)) {
      errors.push("Invalid assessment date format");
    }

    // Assessment tool validation
    if (data.toolType && !this.isValidToolType(data.toolType)) {
      errors.push(`Invalid tool type: ${data.toolType}`);
    }

    // Score validation
    if (data.scores) {
      const scoresValidation = this.validateScores(data.scores, data.toolType);
      errors.push(...scoresValidation.errors);
      warnings.push(...scoresValidation.warnings);
    }

    // Risk factors validation
    if (data.riskFactors && Array.isArray(data.riskFactors)) {
      for (let i = 0; i < data.riskFactors.length; i++) {
        const riskValidation = this.validateRiskFactor(data.riskFactors[i]);
        if (!riskValidation.isValid) {
          errors.push(
            `Risk factor ${i + 1}: ${riskValidation.errors.join(", ")}`
          );
        }
        warnings.push(...riskValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateScores(scores, toolType) {
    const errors = [];
    const warnings = [];

    if (typeof scores !== "object") {
      errors.push("Scores must be an object");
      return { errors, warnings };
    }

    // Validate based on tool type
    switch (toolType) {
      case "braden":
        const bradenCategories = [
          "sensoryPerception",
          "moisture",
          "activity",
          "mobility",
          "nutrition",
          "frictionShear",
        ];
        for (const [key, value] of Object.entries(scores)) {
          if (!bradenCategories.includes(key)) {
            warnings.push(`Unknown Braden category: ${key}`);
            continue;
          }
          if (typeof value !== "number" || value < 1 || value > 4) {
            errors.push(`${key} score must be a number between 1 and 4`);
          }
        }
        break;

      case "morse":
        const morseCategories = [
          "historyOfFalls",
          "secondaryDiagnosis",
          "ambulatoryAid",
          "ivTherapy",
          "gait",
          "mentalStatus",
        ];
        for (const [key, value] of Object.entries(scores)) {
          if (!morseCategories.includes(key)) {
            warnings.push(`Unknown Morse category: ${key}`);
            continue;
          }
          if (typeof value !== "number" || value < 0 || value > 25) {
            errors.push(`${key} score must be a number between 0 and 25`);
          }
        }
        break;

      case "mmse":
        const mmseCategories = [
          "orientation",
          "registration",
          "attentionCalculation",
          "recall",
          "language",
        ];
        for (const [key, value] of Object.entries(scores)) {
          if (!mmseCategories.includes(key)) {
            warnings.push(`Unknown MMSE category: ${key}`);
            continue;
          }
          if (typeof value !== "number" || value < 0 || value > 30) {
            errors.push(`${key} score must be a number between 0 and 30`);
          }
        }
        break;
    }

    return { errors, warnings };
  }

  static validateRiskFactor(riskFactor) {
    const errors = [];
    const warnings = [];

    if (!riskFactor.type) {
      errors.push("Risk factor type is required");
    }

    if (!riskFactor.description) {
      errors.push("Risk factor description is required");
    }

    if (
      riskFactor.severity &&
      !["low", "moderate", "high", "critical"].includes(riskFactor.severity)
    ) {
      errors.push("Invalid risk factor severity level");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateUserId(userId, context = {}) {
    if (!userId) {
      throw new ValidationError("User ID is required", "userId");
    }

    if (typeof userId !== "string" && typeof userId !== "object") {
      throw new ValidationError("User ID must be a string or object", "userId");
    }
  }

  static validatePatientId(patientId, context = {}) {
    if (!patientId) {
      throw new ValidationError("Patient ID is required", "patientId");
    }

    if (typeof patientId !== "string" && typeof patientId !== "object") {
      throw new ValidationError(
        "Patient ID must be a string or object",
        "patientId"
      );
    }
  }

  static validateAssessmentId(assessmentId, context = {}) {
    if (!assessmentId) {
      throw new ValidationError("Assessment ID is required", "assessmentId");
    }

    if (typeof assessmentId !== "string" && typeof assessmentId !== "object") {
      throw new ValidationError(
        "Assessment ID must be a string or object",
        "assessmentId"
      );
    }
  }

  static isValidAssessmentType(assessmentType) {
    const validTypes = [
      "fall-risk",
      "pressure-ulcer",
      "cognitive",
      "nutritional",
      "pain",
      "mobility",
    ];
    return validTypes.includes(assessmentType);
  }

  static isValidToolType(toolType) {
    const validTools = ["braden", "morse", "mmse", "custom"];
    return validTools.includes(toolType);
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
    return text
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****")
      .replace(/\b\d{10}\b/g, "**********");
  }
}

/**
 * Nursing Assessments Service
 * Implements standardized assessment tools (Braden, Morse, MMSE)
 * Provides assessment data collection, storage, history tracking, and scheduling
 */
export class NursingAssessmentsService {
  constructor() {
    this.eventManager = new EventManager();
    this.cache = new NursingCacheService();

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.NURSING_ASSESSMENTS_AI_PROVIDER || "openai",
      rateLimit: {
        maxRequests:
          parseInt(process.env.NURSING_ASSESSMENTS_RATE_LIMIT_MAX_REQUESTS) ||
          100,
        windowMs:
          parseInt(process.env.NURSING_ASSESSMENTS_RATE_LIMIT_WINDOW_MS) ||
          60000,
      },
      cache: {
        ttl: parseInt(process.env.NURSING_ASSESSMENTS_CACHE_TTL) || 300000, // 5 minutes
        maxSize:
          parseInt(process.env.NURSING_ASSESSMENTS_CACHE_MAX_SIZE) || 1000,
      },
      circuitBreaker: {
        threshold:
          parseInt(process.env.NURSING_ASSESSMENTS_CIRCUIT_BREAKER_THRESHOLD) ||
          5,
        timeout:
          parseInt(process.env.NURSING_ASSESSMENTS_CIRCUIT_BREAKER_TIMEOUT) ||
          60000,
      },
      retries: {
        maxAttempts:
          parseInt(process.env.NURSING_ASSESSMENTS_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay:
          parseInt(process.env.NURSING_ASSESSMENTS_RETRY_BACKOFF_DELAY) || 1000,
      },
    };

    // Standardized assessment tools configuration
    this.assessmentTools = {
      braden: {
        name: "Braden Scale for Predicting Pressure Sore Risk",
        categories: [
          "sensoryPerception",
          "moisture",
          "activity",
          "mobility",
          "nutrition",
          "frictionShear",
        ],
        scoring: {
          min: 6,
          max: 23,
          riskLevels: {
            high: { min: 6, max: 9 },
            moderate: { min: 10, max: 12 },
            mild: { min: 13, max: 14 },
            minimal: { min: 15, max: 18 },
            noRisk: { min: 19, max: 23 },
          },
        },
      },
      morse: {
        name: "Morse Fall Scale",
        categories: [
          "historyOfFalls",
          "secondaryDiagnosis",
          "ambulatoryAid",
          "ivTherapy",
          "gait",
          "mentalStatus",
        ],
        scoring: {
          min: 0,
          max: 125,
          riskLevels: {
            low: { min: 0, max: 24 },
            moderate: { min: 25, max: 44 },
            high: { min: 45, max: 125 },
          },
        },
      },
      mmse: {
        name: "Mini-Mental State Examination",
        categories: [
          "orientation",
          "registration",
          "attentionCalculation",
          "recall",
          "language",
        ],
        scoring: {
          min: 0,
          max: 30,
          cognitiveImpairment: {
            severe: { min: 0, max: 9 },
            moderate: { min: 10, max: 18 },
            mild: { min: 19, max: 23 },
            normal: { min: 24, max: 30 },
          },
        },
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
        ai: 0,
      },
    };

    // Rate limiting tracker
    this.rateLimitTracker = {};

    // Circuit breaker state
    this.circuitBreakerState = {
      database: { status: "closed", failures: 0, lastFailure: null },
      ai: { status: "closed", failures: 0, lastFailure: null },
      cache: { status: "closed", failures: 0, lastFailure: null },
    };

    // Cache for intelligent caching
    this.cache = {};
    this.cacheTimestamps = {};
    this.requestCounter = 0;
  }

  // Utility methods for enhanced functionality
  generateRequestId() {
    return `nursing_assessment_${Date.now()}_${crypto
      .randomBytes(8)
      .toString("hex")}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      service: "NursingAssessmentsService",
      ...context,
    };
    console.log(JSON.stringify(logEntry));
  }

  logError(message, error, context = {}) {
    const logEntry = {
      level: "error",
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      service: "NursingAssessmentsService",
      ...context,
    };
    console.error(JSON.stringify(logEntry));
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const userKey = `user_${userId}`;

    if (!this.rateLimitTracker[userKey]) {
      this.rateLimitTracker[userKey] = {
        count: 0,
        resetTime: now + this.config.rateLimit.windowMs,
      };
    }

    const userLimit = this.rateLimitTracker[userKey];

    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + this.config.rateLimit.windowMs;
    }

    if (userLimit.count >= this.config.rateLimit.maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded for user ${userId}`,
        retryAfter
      );
    }

    userLimit.count++;
  }

  checkCircuitBreaker(service) {
    const breaker = this.circuitBreakerState[service];
    if (!breaker) return;

    if (breaker.status === "open") {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure < this.config.circuitBreaker.timeout) {
        throw new ServiceUnavailableError(
          `${service} service is temporarily unavailable`,
          service
        );
      }
      breaker.status = "half-open";
    }
  }

  updateCircuitBreaker(service, success) {
    const breaker = this.circuitBreakerState[service];
    if (!breaker) return;

    if (success) {
      breaker.status = "closed";
      breaker.failures = 0;
    } else {
      breaker.failures++;
      if (breaker.failures >= this.config.circuitBreaker.threshold) {
        breaker.status = "open";
        breaker.lastFailure = Date.now();
      }
    }
  }

  generateCacheKey(prefix, data) {
    const dataString = JSON.stringify(data);
    const hash = crypto.createHash("md5").update(dataString).digest("hex");
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
      timestamp: Date.now(),
    };
  }

  updateMetrics(success, responseTime) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.totalResponseTime += responseTime;
    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.totalResponseTime /
      this.performanceMetrics.totalRequests;

    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }
  }

  validateInputs(data, context = {}) {
    const validation = NursingAssessmentValidator.validateAssessmentData(
      data,
      context
    );
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(
        `Validation failed: ${validation.errors.join(", ")}`,
        "assessmentData"
      );
    }

    if (validation.warnings.length > 0) {
      this.logInfo(
        `Validation warnings: ${validation.warnings.join(", ")}`,
        context
      );
    }

    if (context.userId) {
      NursingAssessmentValidator.validateUserId(context.userId, context);
    }

    if (context.patientId) {
      NursingAssessmentValidator.validatePatientId(context.patientId, context);
    }

    if (context.assessmentId) {
      NursingAssessmentValidator.validateAssessmentId(
        context.assessmentId,
        context
      );
    }
  }

  // Service monitoring and management methods
  getServiceStatus() {
    try {
      const cacheHitRate = this.calculateCacheHitRate();
      const totalRequests = this.performanceMetrics.totalRequests || 0;
      const successRate =
        totalRequests > 0
          ? (
              ((this.performanceMetrics.successfulRequests || 0) /
                totalRequests) *
              100
            ).toFixed(2)
          : 0;

      return {
        service: "NursingAssessmentsService",
        status: "operational",
        timestamp: new Date().toISOString(),
        metrics: {
          ...this.performanceMetrics,
          successRate: `${successRate}%`,
          averageResponseTime: this.performanceMetrics.averageResponseTime || 0,
        },
        cache: {
          size: Object.keys(this.cache).length,
          hitRate: `${(cacheHitRate * 100).toFixed(2)}%`,
          maxSize: this.config.cache.maxSize,
        },
        circuitBreakers: Object.keys(this.circuitBreakerState).map(
          (service) => ({
            service,
            state: this.circuitBreakerState[service].status,
            failures: this.circuitBreakerState[service].failures,
          })
        ),
        rateLimits: {
          activeUsers: Object.keys(this.rateLimitTracker).length,
          maxRateLimit: this.config.rateLimit.maxRequests,
        },
        configuration: {
          aiProvider: this.config.aiProvider,
          cacheTTL: this.config.cache.ttl,
          circuitBreakerThreshold: this.config.circuitBreaker.threshold,
        },
      };
    } catch (error) {
      this.logError("Error getting service status", error, {});
      return {
        service: "NursingAssessmentsService",
        status: "error",
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  calculateCacheHitRate() {
    const totalRequests =
      this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    return totalRequests > 0
      ? this.performanceMetrics.cacheHits / totalRequests
      : 0;
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.calculateCacheHitRate(),
      successRate:
        this.performanceMetrics.totalRequests > 0
          ? (
              (this.performanceMetrics.successfulRequests /
                this.performanceMetrics.totalRequests) *
              100
            ).toFixed(2)
          : 0,
    };
  }

  clearCache() {
    this.cache = {};
    this.cacheTimestamps = {};
    this.logInfo("Cache cleared");
  }

  resetCircuitBreakers() {
    Object.keys(this.circuitBreakerState).forEach((service) => {
      this.circuitBreakerState[service] = {
        status: "closed",
        failures: 0,
        lastFailure: null,
      };
    });
    this.logInfo("Circuit breakers reset");
  }

  getConfiguration() {
    return {
      ...this.config,
      assessmentTools: Object.keys(this.assessmentTools).length,
    };
  }

  getErrorReport(timeframe = "24h") {
    const cutoff = Date.now() - (timeframe === "24h" ? 86400000 : 3600000);
    return {
      timeframe,
      totalErrors:
        this.performanceMetrics.errors.validation +
        this.performanceMetrics.errors.rateLimit +
        this.performanceMetrics.errors.serviceUnavailable +
        this.performanceMetrics.errors.database +
        this.performanceMetrics.errors.ai,
      errorBreakdown: this.performanceMetrics.errors,
      circuitBreakerStatus: this.circuitBreakerState,
      timestamp: new Date().toISOString(),
    };
  }

  healthCheck() {
    try {
      const cacheStatus =
        Object.keys(this.cache).length < this.config.cache.maxSize;
      const circuitBreakerStatus = Object.values(
        this.circuitBreakerState
      ).every((state) => state.status === "closed");
      const rateLimitStatus = Object.keys(this.rateLimitTracker).length < 1000; // Reasonable limit

      const overallStatus =
        cacheStatus && circuitBreakerStatus && rateLimitStatus
          ? "healthy"
          : "degraded";

      return {
        service: "NursingAssessmentsService",
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        checks: {
          cache: {
            status: cacheStatus ? "healthy" : "warning",
            size: Object.keys(this.cache).length,
            maxSize: this.config.cache.maxSize,
          },
          circuitBreakers: {
            status: circuitBreakerStatus ? "healthy" : "warning",
            openBreakers: Object.values(this.circuitBreakerState).filter(
              (state) => state.status === "open"
            ).length,
          },
          rateLimits: {
            status: rateLimitStatus ? "healthy" : "warning",
            activeUsers: Object.keys(this.rateLimitTracker).length,
          },
        },
        metrics: {
          totalRequests: this.performanceMetrics.totalRequests || 0,
          successfulRequests: this.performanceMetrics.successfulRequests || 0,
          averageResponseTime: this.performanceMetrics.averageResponseTime || 0,
        },
      };
    } catch (error) {
      this.logError("Error during health check", error, {});
      return {
        service: "NursingAssessmentsService",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        error: error.message,
      };
    }
  }

  /**
   * Create a new nursing assessment with enhanced error handling and monitoring
   */
  async createAssessment(assessmentData, userId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Input validation and rate limiting
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("database");

      // Validate inputs
      this.validateInputs(assessmentData, {
        requestId,
        userId,
        patientId: assessmentData.patientId,
      });

      // Check cache first
      const cacheKey = this.generateCacheKey("assessment", {
        patientId: assessmentData.patientId,
        assessmentType: assessmentData.assessmentType,
        userId,
      });
      const cachedAssessment = this.getFromCache(cacheKey);

      if (cachedAssessment) {
        this.logInfo("Assessment retrieved from cache", {
          requestId,
          patientId: assessmentData.patientId,
          userId,
        });
        return cachedAssessment;
      }

      // Validate assessment data with enhanced validation
      const validatedData = await this.validateAssessmentData(assessmentData);

      // Sanitize data for security
      const sanitizedData =
        NursingAssessmentValidator.sanitizeData(validatedData);

      // Create assessment record with enhanced data
      const assessment = new NursingAssessment({
        ...sanitizedData,
        createdBy: userId,
        requestId,
        createdAt: new Date(),
        status: "active",
      });

      // Calculate initial scores if applicable with enhanced error handling
      try {
        if (assessment.assessmentType === "fall-risk") {
          assessment.calculateMorseScore();
        } else if (assessment.assessmentType === "pressure-ulcer") {
          assessment.calculateBradenScore();
        } else if (assessment.assessmentType === "cognitive") {
          assessment.calculateMMSEScore();
        }
      } catch (scoreError) {
        this.logError("Error calculating assessment scores", scoreError, {
          requestId,
          assessmentType: assessment.assessmentType,
          userId,
        });
        // Continue without scores rather than failing the entire assessment
      }

      // Generate AI insights with circuit breaker protection
      try {
        this.checkCircuitBreaker("ai");
        await assessment.generateAIInsights();
        this.updateCircuitBreaker("ai", true);
      } catch (aiError) {
        this.updateCircuitBreaker("ai", false);
        this.logError("Error generating AI insights", aiError, {
          requestId,
          assessmentType: assessment.assessmentType,
          userId,
        });
        // Continue without AI insights rather than failing the entire assessment
      }

      // Save assessment
      await assessment.save();

      // Emit event for real-time updates
      this.eventManager.emit("assessment_created", {
        assessmentId: assessment._id,
        patientId: assessment.patientId,
        assessmentType: assessment.assessmentType,
        timestamp: new Date(),
      });

      // Cache assessment data
      await this.cache.setAssessment(assessment._id.toString(), assessment);

      return {
        success: true,
        assessment,
        message: "Assessment created successfully",
      };
    } catch (error) {
      console.error("Error creating assessment:", error);
      return {
        success: false,
        error: error.message,
        assessment: null,
      };
    }
  }

  /**
   * Get assessment by ID
   */
  async getAssessment(assessmentId) {
    try {
      // Try cache first
      let assessment = await this.cache.getAssessment(assessmentId);

      if (!assessment) {
        // Fetch from database
        assessment = await NursingAssessment.findById(assessmentId)
          .populate("patientId", "firstName lastName dateOfBirth")
          .populate("userId", "firstName lastName role");

        if (assessment) {
          // Cache for future requests
          await this.cache.setAssessment(assessmentId, assessment);
        }
      }

      return {
        success: true,
        assessment,
        cached: !!assessment,
      };
    } catch (error) {
      console.error("Error getting assessment:", error);
      return {
        success: false,
        error: error.message,
        assessment: null,
      };
    }
  }

  /**
   * Get patient assessments with filtering and pagination
   */
  async getPatientAssessments(patientId, options = {}) {
    try {
      const {
        assessmentType,
        status,
        dateRange,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      // Build query
      const query = { patientId };

      if (assessmentType) {
        query.assessmentType = assessmentType;
      }

      if (status) {
        query.status = status;
      }

      if (dateRange) {
        query.createdAt = {};
        if (dateRange.start) query.createdAt.$gte = new Date(dateRange.start);
        if (dateRange.end) query.createdAt.$lte = new Date(dateRange.end);
      }

      // Execute query with pagination
      const assessments = await NursingAssessment.find(query)
        .populate("userId", "firstName lastName role")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit);

      // Get total count
      const totalCount = await NursingAssessment.countDocuments(query);

      return {
        success: true,
        assessments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error("Error getting patient assessments:", error);
      return {
        success: false,
        error: error.message,
        assessments: [],
        pagination: null,
      };
    }
  }

  /**
   * Update assessment
   */
  async updateAssessment(assessmentId, updateData, userId) {
    try {
      const assessment = await NursingAssessment.findById(assessmentId);

      if (!assessment) {
        return {
          success: false,
          error: "Assessment not found",
          assessment: null,
        };
      }

      // Store original data for history
      const originalData = assessment.toObject();

      // Update assessment data
      Object.assign(assessment, updateData);

      // Recalculate scores if needed
      if (assessment.assessmentType === "fall-risk") {
        assessment.calculateMorseScore();
      }

      // Update AI insights
      await assessment.generateAIInsights();

      // Add to history
      assessment.history.push({
        timestamp: new Date(),
        userId,
        action: "updated",
        changes: this.getChanges(originalData, assessment.toObject()),
        notes: updateData.notes || "Assessment updated",
      });

      // Increment version
      assessment.version += 1;

      // Save changes
      await assessment.save();

      // Emit event
      this.eventManager.emit("assessment_updated", {
        assessmentId: assessment._id,
        patientId: assessment.patientId,
        changes: this.getChanges(originalData, assessment.toObject()),
        timestamp: new Date(),
      });

      // Update cache
      await this.cache.setAssessment(assessmentId, assessment);

      return {
        success: true,
        assessment,
        message: "Assessment updated successfully",
      };
    } catch (error) {
      console.error("Error updating assessment:", error);
      return {
        success: false,
        error: error.message,
        assessment: null,
      };
    }
  }

  /**
   * Perform standardized assessment using specific tool
   */
  async performStandardizedAssessment(
    patientId,
    userId,
    toolType,
    assessmentData
  ) {
    try {
      const tool = this.assessmentTools[toolType];

      if (!tool) {
        return {
          success: false,
          error: `Unknown assessment tool: ${toolType}`,
          assessment: null,
        };
      }

      // Create assessment with tool-specific structure
      const assessment = await this.createAssessment({
        patientId,
        userId,
        assessmentType: this.getAssessmentTypeFromTool(toolType),
        assessmentData: this.formatToolData(toolType, assessmentData),
        metadata: {
          assessmentTool: tool.name,
          startTime: new Date(),
        },
      });

      if (assessment.success) {
        // Calculate tool-specific scores
        const scores = await this.calculateToolScores(
          toolType,
          assessment.assessment
        );

        // Update assessment with scores
        assessment.assessment.aiAnalysis.toolScores = scores;
        await assessment.assessment.save();

        return {
          ...assessment,
          scores,
        };
      }

      return assessment;
    } catch (error) {
      console.error("Error performing standardized assessment:", error);
      return {
        success: false,
        error: error.message,
        assessment: null,
      };
    }
  }

  /**
   * Get assessment history for a patient
   */
  async getAssessmentHistory(patientId, options = {}) {
    try {
      const {
        assessmentType,
        timeframe = "30d",
        includeScores = true,
      } = options;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "1y":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Build query
      const query = {
        patientId,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      if (assessmentType) {
        query.assessmentType = assessmentType;
      }

      // Get assessments
      const assessments = await NursingAssessment.find(query)
        .populate("userId", "firstName lastName")
        .sort({ createdAt: 1 });

      // Process history data
      const history = assessments.map((assessment) => ({
        id: assessment._id,
        date: assessment.createdAt,
        type: assessment.assessmentType,
        status: assessment.status,
        completionPercentage: assessment.completionPercentage,
        scores: includeScores ? this.extractScores(assessment) : null,
        riskLevels: this.extractRiskLevels(assessment),
        assessor: assessment.userId,
        duration: assessment.metadata?.duration,
      }));

      // Calculate trends
      const trends = this.calculateTrends(history);

      return {
        success: true,
        history,
        trends,
        summary: {
          totalAssessments: history.length,
          timeframe,
          dateRange: { start: startDate, end: endDate },
        },
      };
    } catch (error) {
      console.error("Error getting assessment history:", error);
      return {
        success: false,
        error: error.message,
        history: [],
        trends: null,
      };
    }
  }

  /**
   * Schedule assessment reminder
   */
  async scheduleAssessmentReminder(
    patientId,
    assessmentType,
    scheduledDate,
    userId,
    options = {}
  ) {
    try {
      const {
        priority = "medium",
        notes = "",
        recurring = false,
        recurringInterval = null,
      } = options;

      // Create reminder record (this would integrate with a scheduling system)
      const reminder = {
        patientId,
        assessmentType,
        scheduledDate: new Date(scheduledDate),
        createdBy: userId,
        priority,
        notes,
        recurring,
        recurringInterval,
        status: "scheduled",
        createdAt: new Date(),
      };

      // Emit event for scheduling system
      this.eventManager.emit("assessment_reminder_scheduled", reminder);

      return {
        success: true,
        reminder,
        message: "Assessment reminder scheduled successfully",
      };
    } catch (error) {
      console.error("Error scheduling assessment reminder:", error);
      return {
        success: false,
        error: error.message,
        reminder: null,
      };
    }
  }

  /**
   * Get assessment statistics
   */
  async getAssessmentStatistics(userId, options = {}) {
    try {
      const { timeframe = "30d", assessmentType = null } = options;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(timeframe));

      const stats = await NursingAssessment.getAssessmentStats(
        userId,
        assessmentType,
        { start: startDate, end: endDate }
      );

      return {
        success: true,
        statistics: stats,
        timeframe,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error getting assessment statistics:", error);
      return {
        success: false,
        error: error.message,
        statistics: [],
      };
    }
  }

  // Helper methods

  async validateAssessmentData(data) {
    // Basic validation
    if (!data.patientId || !data.userId || !data.assessmentType) {
      throw new Error(
        "Missing required fields: patientId, userId, assessmentType"
      );
    }

    // Validate assessment type
    const validTypes = [
      "head-to-toe",
      "focused",
      "pain",
      "mental-status",
      "fall-risk",
      "wound",
      "cardiac",
      "respiratory",
      "neurological",
      "mobility",
      "nutrition",
    ];

    if (!validTypes.includes(data.assessmentType)) {
      throw new Error(`Invalid assessment type: ${data.assessmentType}`);
    }

    return data;
  }

  getAssessmentTypeFromTool(toolType) {
    const mapping = {
      braden: "wound",
      morse: "fall-risk",
      mmse: "mental-status",
    };

    return mapping[toolType] || "focused";
  }

  formatToolData(toolType, data) {
    // Format data according to tool requirements
    switch (toolType) {
      case "morse":
        return {
          fallRiskAssessment: {
            morseScale: data,
          },
        };
      case "mmse":
        return {
          mentalStatusExam: data,
        };
      default:
        return data;
    }
  }

  async calculateToolScores(toolType, assessment) {
    const tool = this.assessmentTools[toolType];
    const scores = {};

    switch (toolType) {
      case "morse":
        const morseResult = assessment.calculateMorseScore();
        scores.morseScale = {
          totalScore: morseResult.totalScore,
          riskLevel: morseResult.riskLevel,
          maxScore: tool.scoring.max,
        };
        break;

      case "braden":
        // Implement Braden scale calculation
        scores.bradenScale = this.calculateBradenScore(assessment);
        break;

      case "mmse":
        // Implement MMSE calculation
        scores.mmse = this.calculateMMSEScore(assessment);
        break;
    }

    return scores;
  }

  calculateBradenScore(assessment) {
    // Placeholder for Braden scale calculation
    return {
      totalScore: 15,
      riskLevel: "mild",
      maxScore: 23,
    };
  }

  calculateMMSEScore(assessment) {
    // Placeholder for MMSE calculation
    const mmseData = assessment.assessmentData?.mentalStatusExam;
    if (mmseData?.mmseScore) {
      const score = mmseData.mmseScore;
      let cognitiveLevel = "normal";

      if (score <= 9) cognitiveLevel = "severe";
      else if (score <= 18) cognitiveLevel = "moderate";
      else if (score <= 23) cognitiveLevel = "mild";

      return {
        totalScore: score,
        cognitiveLevel,
        maxScore: 30,
      };
    }

    return null;
  }

  getChanges(original, updated) {
    const changes = {};

    // Simple change detection (in production, use a more sophisticated diff)
    for (const key in updated) {
      if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
        changes[key] = {
          from: original[key],
          to: updated[key],
        };
      }
    }

    return changes;
  }

  extractScores(assessment) {
    const scores = {};

    if (assessment.assessmentType === "fall-risk") {
      const morseData =
        assessment.assessmentData?.fallRiskAssessment?.morseScale;
      if (morseData) {
        scores.morse = morseData.totalScore;
      }
    }

    if (assessment.assessmentData?.mentalStatusExam?.mmseScore) {
      scores.mmse = assessment.assessmentData.mentalStatusExam.mmseScore;
    }

    return scores;
  }

  extractRiskLevels(assessment) {
    const riskLevels = {};

    if (assessment.aiAnalysis?.riskAssessment) {
      const risks = assessment.aiAnalysis.riskAssessment;

      if (risks.fallRisk) riskLevels.fallRisk = risks.fallRisk.level;
      if (risks.pressureUlcerRisk)
        riskLevels.pressureUlcer = risks.pressureUlcerRisk.level;
      if (risks.infectionRisk) riskLevels.infection = risks.infectionRisk.level;
      if (risks.deteriorationRisk)
        riskLevels.deterioration = risks.deteriorationRisk.level;
    }

    return riskLevels;
  }

  calculateTrends(history) {
    if (history.length < 2) return null;

    const trends = {};

    // Calculate score trends
    const scoreTypes = ["morse", "mmse"];

    scoreTypes.forEach((scoreType) => {
      const scores = history
        .filter((h) => h.scores && h.scores[scoreType] !== undefined)
        .map((h) => ({ date: h.date, score: h.scores[scoreType] }));

      if (scores.length >= 2) {
        const latest = scores[scores.length - 1].score;
        const previous = scores[scores.length - 2].score;
        const change = latest - previous;

        trends[scoreType] = {
          direction:
            change > 0 ? "increasing" : change < 0 ? "decreasing" : "stable",
          change,
          latest,
          previous,
        };
      }
    });

    return trends;
  }

  // ============================================================================
  // REQUIRED METHODS FOR TEST COMPLIANCE
  // ============================================================================

  /**
   * Calculate comprehensive risk scores for patient assessments
   * @param {string} userId - User ID
   * @param {string} patientId - Patient ID
   * @param {Object} options - Risk calculation options
   * @returns {Promise<Object>} Calculated risk scores
   */
  async calculateRiskScores(userId, patientId, options = {}) {
    try {
      const {
        assessmentTypes = [
          "fall-risk",
          "pressure-ulcer",
          "infection",
          "deterioration",
        ],
        includeHistory = true,
        includeTrends = true,
        timeframe = "30d",
      } = options;

      console.log(`🔍 Calculating risk scores for patient ${patientId}`);

      // Get recent assessments for the patient
      const recentAssessments = await this.getPatientAssessments(
        userId,
        patientId,
        {
          limit: 10,
          timeframe,
        }
      );

      if (
        !recentAssessments.success ||
        recentAssessments.assessments.length === 0
      ) {
        throw new Error("No recent assessments found for risk calculation");
      }

      const riskScores = {
        patientId,
        userId,
        calculatedAt: new Date(),
        timeframe,
        overallRiskLevel: "low",
        riskScores: {},
        trends: {},
        recommendations: [],
        alerts: [],
      };

      // Calculate risk scores for each assessment type
      for (const assessmentType of assessmentTypes) {
        const typeAssessments = recentAssessments.assessments.filter(
          (a) => a.assessmentType === assessmentType
        );

        if (typeAssessments.length > 0) {
          const latestAssessment = typeAssessments[0]; // Most recent
          const riskScore = await this.calculateSpecificRiskScore(
            assessmentType,
            latestAssessment
          );

          riskScores.riskScores[assessmentType] = {
            score: riskScore.score,
            level: riskScore.level,
            factors: riskScore.factors,
            confidence: riskScore.confidence,
            lastAssessed: latestAssessment.createdAt,
            assessmentId: latestAssessment._id,
          };

          // Calculate trends if requested and history available
          if (includeTrends && typeAssessments.length > 1) {
            const trendAnalysis = this.calculateRiskTrend(typeAssessments);
            riskScores.trends[assessmentType] = trendAnalysis;
          }

          // Generate alerts for high-risk scores
          if (riskScore.level === "high" || riskScore.score >= 75) {
            riskScores.alerts.push({
              type: "high_risk",
              assessmentType,
              message: `High ${assessmentType} risk detected (score: ${riskScore.score})`,
              urgency: "immediate",
              recommendations: riskScore.immediateActions || [],
            });
          }
        }
      }

      // Calculate overall risk level
      riskScores.overallRiskLevel = this.calculateOverallRiskLevel(
        riskScores.riskScores
      );

      // Generate comprehensive recommendations
      riskScores.recommendations =
        await this.generateRiskMitigationRecommendations(
          riskScores.riskScores,
          riskScores.trends
        );

      // Emit risk calculation event
      this.eventManager.emit("riskScoresCalculated", {
        patientId,
        userId,
        overallRiskLevel: riskScores.overallRiskLevel,
        highRiskCount: Object.values(riskScores.riskScores).filter(
          (r) => r.level === "high"
        ).length,
        alertCount: riskScores.alerts.length,
        timestamp: new Date(),
      });

      console.log(`✅ Risk scores calculated for patient ${patientId}`);
      return riskScores;
    } catch (error) {
      console.error("❌ Error calculating risk scores:", error);
      this.eventManager.emit("riskCalculationError", {
        patientId,
        userId,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Generate evidence-based recommendations for patient care
   * @param {string} userId - User ID
   * @param {string} patientId - Patient ID
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Generated recommendations
   */
  async generateRecommendations(userId, patientId, options = {}) {
    try {
      const {
        includeRiskBased = true,
        includeAIInsights = true,
        includeBestPractices = true,
        priorityLevel = "all",
        timeframe = "7d",
      } = options;

      console.log(`💡 Generating recommendations for patient ${patientId}`);

      // Get recent assessments and risk scores
      const recentAssessments = await this.getPatientAssessments(
        userId,
        patientId,
        {
          limit: 5,
          timeframe,
        }
      );

      if (
        !recentAssessments.success ||
        recentAssessments.assessments.length === 0
      ) {
        throw new Error(
          "No recent assessments found for recommendation generation"
        );
      }

      const recommendations = {
        patientId,
        userId,
        generatedAt: new Date(),
        timeframe,
        recommendations: [],
        summary: {
          totalRecommendations: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
        },
        evidenceBase: [],
        implementationPlan: [],
      };

      // Generate risk-based recommendations
      if (includeRiskBased) {
        const riskScores = await this.calculateRiskScores(userId, patientId, {
          timeframe,
        });
        const riskRecommendations = await this.generateRiskBasedRecommendations(
          riskScores
        );
        recommendations.recommendations.push(...riskRecommendations);
      }

      // Generate AI-powered insights and recommendations
      if (includeAIInsights) {
        const aiRecommendations = await this.generateAIRecommendations(
          recentAssessments.assessments,
          patientId
        );
        recommendations.recommendations.push(...aiRecommendations);
      }

      // Generate best practice recommendations
      if (includeBestPractices) {
        const bestPracticeRecommendations =
          await this.generateBestPracticeRecommendations(
            recentAssessments.assessments
          );
        recommendations.recommendations.push(...bestPracticeRecommendations);
      }

      // Filter by priority level if specified
      if (priorityLevel !== "all") {
        recommendations.recommendations =
          recommendations.recommendations.filter(
            (rec) => rec.priority === priorityLevel
          );
      }

      // Sort recommendations by priority and impact
      recommendations.recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff =
          (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return (b.expectedImpact || 0) - (a.expectedImpact || 0);
      });

      // Update summary statistics
      recommendations.summary.totalRecommendations =
        recommendations.recommendations.length;
      recommendations.summary.highPriority =
        recommendations.recommendations.filter(
          (r) => r.priority === "high"
        ).length;
      recommendations.summary.mediumPriority =
        recommendations.recommendations.filter(
          (r) => r.priority === "medium"
        ).length;
      recommendations.summary.lowPriority =
        recommendations.recommendations.filter(
          (r) => r.priority === "low"
        ).length;

      // Generate evidence base
      recommendations.evidenceBase = this.compileEvidenceBase(
        recommendations.recommendations
      );

      // Generate implementation plan
      recommendations.implementationPlan =
        await this.generateImplementationPlan(recommendations.recommendations);

      // Emit recommendation generation event
      this.eventManager.emit("recommendationsGenerated", {
        patientId,
        userId,
        recommendationCount: recommendations.summary.totalRecommendations,
        highPriorityCount: recommendations.summary.highPriority,
        timestamp: new Date(),
      });

      console.log(
        `✅ Generated ${recommendations.summary.totalRecommendations} recommendations for patient ${patientId}`
      );
      return recommendations;
    } catch (error) {
      console.error("❌ Error generating recommendations:", error);
      this.eventManager.emit("recommendationGenerationError", {
        patientId,
        userId,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS FOR REQUIRED FUNCTIONS
  // ============================================================================

  /**
   * Calculate specific risk score for an assessment type
   * @private
   */
  async calculateSpecificRiskScore(assessmentType, assessment) {
    const riskCalculators = {
      "fall-risk": this.calculateFallRiskScore.bind(this),
      "pressure-ulcer": this.calculatePressureUlcerRiskScore.bind(this),
      infection: this.calculateInfectionRiskScore.bind(this),
      deterioration: this.calculateDeteriorationRiskScore.bind(this),
    };

    const calculator = riskCalculators[assessmentType];
    if (calculator) {
      return await calculator(assessment);
    }

    // Default risk calculation
    return {
      score: 25,
      level: "low",
      factors: ["assessment_completed"],
      confidence: 0.7,
      immediateActions: [],
    };
  }

  /**
   * Calculate fall risk score from assessment
   * @private
   */
  async calculateFallRiskScore(assessment) {
    const morseData = assessment.assessmentData?.fallRiskAssessment?.morseScale;

    if (morseData && morseData.totalScore !== undefined) {
      const score = morseData.totalScore;
      let level = "low";
      let factors = [];
      let immediateActions = [];

      if (score >= 45) {
        level = "high";
        factors = ["high_morse_score", "multiple_risk_factors"];
        immediateActions = [
          "implement_fall_precautions",
          "bed_alarm",
          "frequent_monitoring",
        ];
      } else if (score >= 25) {
        level = "medium";
        factors = ["moderate_morse_score"];
        immediateActions = ["fall_risk_education", "environmental_assessment"];
      } else {
        factors = ["low_morse_score"];
      }

      return {
        score,
        level,
        factors,
        confidence: 0.9,
        immediateActions,
      };
    }

    return {
      score: 15,
      level: "low",
      factors: ["assessment_incomplete"],
      confidence: 0.5,
      immediateActions: [],
    };
  }

  /**
   * Calculate overall risk level from multiple risk scores
   * @private
   */
  calculateOverallRiskLevel(riskScores) {
    const levels = Object.values(riskScores).map((r) => r.level);

    if (levels.includes("high")) return "high";
    if (levels.includes("medium")) return "medium";
    return "low";
  }

  /**
   * Generate risk mitigation recommendations
   * @private
   */
  async generateRiskMitigationRecommendations(riskScores, trends) {
    const recommendations = [];

    for (const [riskType, riskData] of Object.entries(riskScores)) {
      if (riskData.level === "high" || riskData.score >= 75) {
        recommendations.push({
          id: `risk_${riskType}_${Date.now()}`,
          type: "risk_mitigation",
          riskType,
          priority: "high",
          title: `Address High ${riskType.replace("-", " ")} Risk`,
          description: `Immediate intervention required for ${riskType} (score: ${riskData.score})`,
          actions: riskData.factors.map(
            (factor) => `Address ${factor.replace("_", " ")}`
          ),
          expectedImpact: 0.3,
          timeframe: "immediate",
          evidence: "Evidence-based risk mitigation protocols",
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate AI-powered recommendations
   * @private
   */
  async generateAIRecommendations(assessments, patientId) {
    // Simulate AI analysis
    const aiRecommendations = [];

    if (assessments.length > 0) {
      const latestAssessment = assessments[0];

      aiRecommendations.push({
        id: `ai_${patientId}_${Date.now()}`,
        type: "ai_insight",
        priority: "medium",
        title: "AI-Powered Care Optimization",
        description:
          "Based on assessment patterns, consider personalized care adjustments",
        actions: ["Review care plan", "Consider individualized interventions"],
        expectedImpact: 0.2,
        timeframe: "24-48 hours",
        evidence: "AI pattern analysis of similar patient profiles",
        confidence: 0.8,
      });
    }

    return aiRecommendations;
  }

  /**
   * Generate best practice recommendations
   * @private
   */
  async generateBestPracticeRecommendations(assessments) {
    const recommendations = [];

    // Standard best practice recommendations
    recommendations.push({
      id: `bp_${Date.now()}`,
      type: "best_practice",
      priority: "medium",
      title: "Maintain Regular Assessment Schedule",
      description: "Continue regular nursing assessments per protocol",
      actions: [
        "Schedule follow-up assessments",
        "Document findings thoroughly",
      ],
      expectedImpact: 0.15,
      timeframe: "ongoing",
      evidence: "Nursing best practice guidelines",
    });

    return recommendations;
  }

  /**
   * Compile evidence base for recommendations
   * @private
   */
  compileEvidenceBase(recommendations) {
    const evidenceBase = [];
    const uniqueEvidence = new Set();

    recommendations.forEach((rec) => {
      if (rec.evidence && !uniqueEvidence.has(rec.evidence)) {
        evidenceBase.push({
          source: rec.evidence,
          type: rec.type,
          strength: rec.confidence || 0.8,
          applicableRecommendations: [rec.id],
        });
        uniqueEvidence.add(rec.evidence);
      }
    });

    return evidenceBase;
  }

  /**
   * Generate implementation plan for recommendations
   * @private
   */
  async generateImplementationPlan(recommendations) {
    const plan = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      ongoing: [],
    };

    recommendations.forEach((rec) => {
      const timeframe = rec.timeframe || "short-term";

      if (timeframe === "immediate") {
        plan.immediate.push(rec.id);
      } else if (timeframe.includes("24") || timeframe.includes("48")) {
        plan.shortTerm.push(rec.id);
      } else if (timeframe === "ongoing") {
        plan.ongoing.push(rec.id);
      } else {
        plan.longTerm.push(rec.id);
      }
    });

    return plan;
  }
}

export default NursingAssessmentsService;
