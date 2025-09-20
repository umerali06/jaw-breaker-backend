import CarePlan from "../../models/nursing/CarePlan.js";
import NursingAIService from "./NursingAIService.js";
import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";
import mongoose from "mongoose";
import crypto from "crypto";

// Custom error classes for Care Plans Service
class CarePlansServiceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "CarePlansServiceError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
  }

  determineSeverity(code) {
    const criticalCodes = [
      "CARE_PLAN_CORRUPTION",
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

// Input validation class for care plans
class CarePlanValidator {
  static validateCarePlanData(data, context = {}) {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push("Care plan data is required");
      return { isValid: false, errors, warnings };
    }

    // Required fields validation - make them optional for flexibility
    if (!data.patientId && !data.patientName) {
      warnings.push("Patient ID or Patient Name should be provided");
    }

    // User ID will be provided by the controller, not required in data
    if (!data.planName) {
      errors.push("Plan name is required");
    }

    if (!data.diagnosis && !data.diagnoses) {
      warnings.push("Diagnosis information is recommended");
    }

    // Goal validation
    if (data.goals && Array.isArray(data.goals)) {
      for (let i = 0; i < data.goals.length; i++) {
        const goalValidation = this.validateGoal(data.goals[i]);
        if (!goalValidation.isValid) {
          errors.push(`Goal ${i + 1}: ${goalValidation.errors.join(", ")}`);
        }
        warnings.push(...goalValidation.warnings);
      }
    }

    // Intervention validation
    if (data.interventions && Array.isArray(data.interventions)) {
      for (let i = 0; i < data.interventions.length; i++) {
        const interventionValidation = this.validateIntervention(
          data.interventions[i]
        );
        if (!interventionValidation.isValid) {
          errors.push(
            `Intervention ${i + 1}: ${interventionValidation.errors.join(", ")}`
          );
        }
        warnings.push(...interventionValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateGoal(goal) {
    const errors = [];
    const warnings = [];

    if (!goal.description) {
      warnings.push("Goal description is recommended");
    }

    if (!goal.targetDate) {
      warnings.push("Goal target date is recommended");
    } else if (!this.isValidDate(goal.targetDate)) {
      warnings.push("Invalid target date format");
    }

    if (
      goal.priority &&
      !["low", "medium", "high", "critical"].includes(goal.priority)
    ) {
      warnings.push("Invalid priority level, using default");
    }

    if (goal.measurableOutcomes && !Array.isArray(goal.measurableOutcomes)) {
      warnings.push("Measurable outcomes should be an array");
    }

    return {
      isValid: true, // Make goals more flexible
      errors,
      warnings,
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

    if (intervention.frequency && typeof intervention.frequency !== "string") {
      errors.push("Intervention frequency must be a string");
    }

    if (intervention.duration && typeof intervention.duration !== "string") {
      errors.push("Intervention duration must be a string");
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

  static validateCarePlanId(carePlanId, context = {}) {
    if (!carePlanId) {
      throw new ValidationError("Care plan ID is required", "carePlanId");
    }

    if (typeof carePlanId !== "string" && typeof carePlanId !== "object") {
      throw new ValidationError(
        "Care plan ID must be a string or object",
        "carePlanId"
      );
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
    return text
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****")
      .replace(/\b\d{10}\b/g, "**********");
  }
}

class CarePlansService {
  constructor() {
    this.aiService = NursingAIService;
    this.eventManager = new EventManager();
    this.cacheService = NursingCacheService;

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.CARE_PLANS_AI_PROVIDER || "azure-openai",
      rateLimit: {
        maxRequests:
          parseInt(process.env.CARE_PLANS_RATE_LIMIT_MAX_REQUESTS) || 100,
        windowMs:
          parseInt(process.env.CARE_PLANS_RATE_LIMIT_WINDOW_MS) || 60000,
      },
      cache: {
        ttl: parseInt(process.env.CARE_PLANS_CACHE_TTL) || 300000, // 5 minutes
        maxSize: parseInt(process.env.CARE_PLANS_CACHE_MAX_SIZE) || 1000,
      },
      circuitBreaker: {
        threshold:
          parseInt(process.env.CARE_PLANS_CIRCUIT_BREAKER_THRESHOLD) || 5,
        timeout:
          parseInt(process.env.CARE_PLANS_CIRCUIT_BREAKER_TIMEOUT) || 60000,
      },
      retries: {
        maxAttempts: parseInt(process.env.CARE_PLANS_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay:
          parseInt(process.env.CARE_PLANS_RETRY_BACKOFF_DELAY) || 1000,
      },
    };

    // Evidence-based care plan templates
    this.templates = this.initializeTemplates();

    // Care plan status types
    this.statusTypes = [
      "draft",
      "active",
      "on_hold",
      "completed",
      "discontinued",
    ];

    // Goal priority levels
    this.priorityLevels = ["low", "medium", "high", "critical"];

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
    return `care_plan_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      service: "CarePlansService",
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
      service: "CarePlansService",
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
    const validation = CarePlanValidator.validateCarePlanData(data, context);
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(
        `Validation failed: ${validation.errors.join(", ")}`,
        "carePlanData"
      );
    }

    if (validation.warnings.length > 0) {
      this.logInfo(
        `Validation warnings: ${validation.warnings.join(", ")}`,
        context
      );
    }

    if (context.userId) {
      CarePlanValidator.validateUserId(context.userId, context);
    }

    if (context.patientId) {
      CarePlanValidator.validatePatientId(context.patientId, context);
    }

    if (context.carePlanId) {
      CarePlanValidator.validateCarePlanId(context.carePlanId, context);
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
        service: "CarePlansService",
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
        service: "CarePlansService",
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
      templates: Object.keys(this.templates).length,
      statusTypes: this.statusTypes.length,
      priorityLevels: this.priorityLevels.length,
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
        service: "CarePlansService",
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
        service: "CarePlansService",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        error: error.message,
      };
    }
  }

  // Update goals (alias for updateCarePlanGoals)
  async updateGoals(carePlanId, goals, updatedBy) {
    return this.updateCarePlanGoals(carePlanId, goals, updatedBy);
  }

  // Track progress with enhanced error handling and monitoring
  async trackProgress(carePlanId, progressData, userId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Input validation and rate limiting
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("database");

      // Validate inputs
      this.validateInputs(
        { carePlanId, progressData, userId },
        {
          requestId,
          userId,
          carePlanId,
        }
      );

      // Check cache first
      const cacheKey = this.generateCacheKey("care_plan", {
        carePlanId,
        userId,
      });
      const cachedCarePlan = this.getFromCache(cacheKey);

      let carePlan;
      if (cachedCarePlan) {
        carePlan = cachedCarePlan;
        this.logInfo("Care plan retrieved from cache", {
          requestId,
          carePlanId,
          userId,
        });
      } else {
        carePlan = await this.getCarePlan(carePlanId);
        if (!carePlan) {
          throw new CarePlansServiceError(
            "Care plan not found",
            "CARE_PLAN_NOT_FOUND",
            { carePlanId }
          );
        }

        // Cache the care plan
        this.setCache(cacheKey, carePlan);
      }

      // Validate progress data
      if (!Array.isArray(progressData)) {
        throw new ValidationError(
          "Progress data must be an array",
          "progressData"
        );
      }

      // Update progress for each goal with enhanced validation
      const updatedGoals = carePlan.goals.map((goal) => {
        const goalProgress = progressData.find((p) => p.goalId === goal.id);
        if (goalProgress) {
          // Validate progress value
          if (
            typeof goalProgress.progress !== "number" ||
            goalProgress.progress < 0 ||
            goalProgress.progress > 100
          ) {
            throw new ValidationError(
              "Progress must be a number between 0 and 100",
              "progress"
            );
          }

          return {
            ...goal,
            progress: goalProgress.progress,
            status: goalProgress.progress >= 100 ? "completed" : "in_progress",
            lastUpdated: new Date(),
            notes: goalProgress.notes || goal.notes,
            milestones: this.updateMilestones(goal.milestones, goalProgress),
          };
        }
        return goal;
      });

      // Calculate overall progress
      const overallProgress =
        updatedGoals.reduce((sum, goal) => sum + (goal.progress || 0), 0) /
        updatedGoals.length;

      // Update care plan with enhanced data
      const updatedCarePlan = {
        ...carePlan.toObject(),
        goals: updatedGoals,
        overallProgress,
        lastProgressUpdate: new Date(),
        lastUpdatedBy: userId,
        progressHistory: [
          ...(carePlan.progressHistory || []),
          {
            timestamp: new Date(),
            overallProgress,
            updatedGoals: updatedGoals.length,
            completedGoals: updatedGoals.filter((g) => g.status === "completed")
              .length,
            updatedBy: userId,
            requestId,
          },
        ],
      };

      // Update database with circuit breaker protection
      try {
        await CarePlan.findByIdAndUpdate(carePlanId, updatedCarePlan);
        this.updateCircuitBreaker("database", true);
      } catch (dbError) {
        this.updateCircuitBreaker("database", false);
        throw new CarePlansServiceError(
          "Database update failed",
          "DATABASE_ERROR",
          {
            carePlanId,
            error: dbError.message,
          }
        );
      }

      // Update cache
      this.setCache(cacheKey, updatedCarePlan);

      // Emit progress update event
      this.eventManager.emit("carePlanProgressUpdated", {
        carePlanId,
        overallProgress,
        completedGoals: updatedGoals.filter((g) => g.status === "completed")
          .length,
        totalGoals: updatedGoals.length,
        requestId,
        userId,
      });

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      this.logInfo("Care plan progress updated successfully", {
        requestId,
        carePlanId,
        userId,
        overallProgress,
        responseTime,
      });

      return {
        success: true,
        carePlanId,
        overallProgress,
        goalsCompleted: updatedGoals.filter((g) => g.status === "completed")
          .length,
        totalGoals: updatedGoals.length,
        updatedAt: new Date(),
        recommendations: this.generateProgressRecommendations(updatedGoals),
        requestId,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      if (
        error instanceof CarePlansServiceError ||
        error instanceof ValidationError ||
        error instanceof RateLimitError ||
        error instanceof ServiceUnavailableError
      ) {
        this.logError("Care plan progress update failed", error, {
          requestId,
          carePlanId,
          userId,
          responseTime,
        });
        throw error;
      } else {
        this.logError("Unexpected error in trackProgress", error, {
          requestId,
          carePlanId,
          userId,
          responseTime,
        });
        throw new CarePlansServiceError(
          "Unexpected error occurred",
          "UNEXPECTED_ERROR",
          {
            originalError: error.message,
          }
        );
      }
    }
  }

  // Get care plan by ID
  async getCarePlan(carePlanId) {
    try {
      const cacheKey = `care_plan:${carePlanId}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return cached;
      }

      const carePlan = await CarePlan.findById(carePlanId);
      if (carePlan) {
        await this.cacheService.set(cacheKey, carePlan, 600); // 10 minutes cache
      }

      return carePlan;
    } catch (error) {
      console.error("Error getting care plan:", error);
      return null;
    }
  }

  // Update care plan goals
  async updateCarePlanGoals(carePlanId, goals, updatedBy) {
    try {
      const carePlan = await this.getCarePlan(carePlanId);
      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      // Validate goals
      const validatedGoals = goals.map((goal) => this.validateGoal(goal));
      const invalidGoals = validatedGoals.filter((g) => !g.isValid);

      if (invalidGoals.length > 0) {
        throw new Error(
          `Invalid goals: ${invalidGoals.map((g) => g.error).join(", ")}`
        );
      }

      // Update goals with enhanced data
      const enhancedGoals = await Promise.all(
        goals.map(async (goal) => {
          const aiEnhancement = await this.aiService.enhanceCarePlanGoal(goal, {
            patientId: carePlan.patientId,
            existingGoals: carePlan.goals,
          });

          return {
            ...goal,
            id: goal.id || this.generateGoalId(),
            updatedBy,
            updatedAt: new Date(),
            aiSuggestions: aiEnhancement.success
              ? aiEnhancement.suggestions
              : [],
            evidenceBase: this.getEvidenceBase(goal.type),
            measurableOutcomes: this.generateMeasurableOutcomes(goal),
          };
        })
      );

      // Update care plan
      const updatedCarePlan = await CarePlan.findByIdAndUpdate(
        carePlanId,
        {
          goals: enhancedGoals,
          lastModified: new Date(),
          modifiedBy: updatedBy,
          version: carePlan.version + 1,
        },
        { new: true }
      );

      // Clear cache
      await this.cacheService.remove(`care_plan:${carePlanId}`);

      // Emit update event
      this.eventManager.emit("carePlanGoalsUpdated", {
        carePlanId,
        goalsCount: enhancedGoals.length,
        updatedBy,
      });

      return {
        success: true,
        carePlan: updatedCarePlan,
        goalsUpdated: enhancedGoals.length,
        message: "Care plan goals updated successfully",
      };
    } catch (error) {
      console.error("Error updating care plan goals:", error);
      throw error;
    }
  }

  // Update milestones
  updateMilestones(existingMilestones, progressData) {
    if (!existingMilestones || !Array.isArray(existingMilestones)) {
      return [];
    }

    return existingMilestones.map((milestone) => {
      if (
        progressData.progress >= milestone.targetProgress &&
        !milestone.completed
      ) {
        return {
          ...milestone,
          completed: true,
          completedAt: new Date(),
          notes: progressData.notes,
        };
      }
      return milestone;
    });
  }

  // Generate progress recommendations
  generateProgressRecommendations(goals) {
    const recommendations = [];

    const behindSchedule = goals.filter((g) => g.progress < g.expectedProgress);
    if (behindSchedule.length > 0) {
      recommendations.push({
        type: "progress_concern",
        priority: "medium",
        message: `${behindSchedule.length} goal(s) are behind schedule`,
        actions: [
          "Review barriers to goal achievement",
          "Consider modifying intervention strategies",
          "Increase monitoring frequency",
          "Provide additional patient education",
        ],
      });
    }

    const completedGoals = goals.filter((g) => g.status === "completed");
    if (completedGoals.length > 0) {
      recommendations.push({
        type: "goal_achievement",
        priority: "low",
        message: `${completedGoals.length} goal(s) completed successfully`,
        actions: [
          "Document successful interventions",
          "Consider setting new goals",
          "Maintain achieved outcomes",
        ],
      });
    }

    return recommendations;
  }

  // Validate goal
  validateGoal(goal) {
    const validation = { isValid: true, error: null };

    if (!goal.description || goal.description.trim().length === 0) {
      validation.isValid = false;
      validation.error = "Goal description is required";
    }

    if (!goal.targetDate) {
      validation.isValid = false;
      validation.error = "Goal target date is required";
    }

    if (goal.targetDate && new Date(goal.targetDate) <= new Date()) {
      validation.isValid = false;
      validation.error = "Goal target date must be in the future";
    }

    return validation;
  }

  // Generate goal ID
  generateGoalId() {
    return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get evidence base
  getEvidenceBase(goalType) {
    const evidenceBases = {
      mobility:
        "Based on evidence-based mobility protocols and fall prevention guidelines",
      pain: "Following WHO pain management guidelines and evidence-based pain assessment tools",
      medication:
        "Aligned with medication reconciliation best practices and safety protocols",
      education:
        "Based on adult learning principles and health literacy best practices",
      discharge:
        "Following evidence-based discharge planning and care transitions protocols",
    };

    return (
      evidenceBases[goalType] ||
      "Based on current nursing best practices and clinical guidelines"
    );
  }

  // Generate measurable outcomes
  generateMeasurableOutcomes(goal) {
    const outcomes = [];

    if (goal.type === "mobility") {
      outcomes.push("Patient will ambulate [distance] without assistance");
      outcomes.push("Fall risk score will decrease by [percentage]");
    } else if (goal.type === "pain") {
      outcomes.push("Pain score will be [target] or less on 0-10 scale");
      outcomes.push(
        "Patient will demonstrate effective pain management techniques"
      );
    } else if (goal.type === "education") {
      outcomes.push("Patient will demonstrate [skill] with 100% accuracy");
      outcomes.push("Patient will verbalize understanding of [topic]");
    }

    return outcomes;
  }

  // Create new care plan
  async createCarePlan(planData, userId) {
    try {
      // Validate user has nursing premium access
      if (!(await this.validatePremiumAccess(userId))) {
        throw new Error("Care plans require nursing premium subscription");
      }

      // Apply evidence-based template if specified
      let carePlanData = planData;
      if (planData.template && this.templates[planData.template]) {
        carePlanData = this.applyEvidenceBasedTemplate(
          planData.template,
          planData
        );
      }

      // Create care plan
      const carePlan = new CarePlan({
        ...carePlanData,
        userId,
        status: "draft",
        metadata: {
          createdAt: new Date(),
          version: 1,
          lastReviewed: new Date(),
        },
      });

      // Generate initial AI recommendations
      const aiRecommendations =
        await this.aiService.generateCarePlanRecommendations(carePlanData, {
          patientId: planData.patientId,
          diagnoses: planData.diagnoses || [],
        });

      if (aiRecommendations.success) {
        carePlan.aiRecommendations = aiRecommendations.recommendations;
      }

      // Set initial goals and interventions
      if (!carePlan.goals || carePlan.goals.length === 0) {
        carePlan.goals = await this.generateInitialGoals(carePlanData);
      }

      await carePlan.save();

      // Cache for quick access
      await this.cacheService.setCarePlan(carePlan._id, carePlan);

      // Emit event for real-time updates
      this.eventManager.emit("carePlanCreated", {
        planId: carePlan._id,
        userId,
        patientId: carePlan.patientId,
        template: carePlan.template,
      });

      return {
        success: true,
        carePlan,
        aiRecommendations: aiRecommendations.success
          ? aiRecommendations.recommendations
          : null,
      };
    } catch (error) {
      console.error("Error creating care plan:", error);
      throw error;
    }
  }

  // Update care plan
  async updateCarePlan(planId, updateData, userId) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (carePlan.userId.toString() !== userId) {
        throw new Error("Unauthorized access to care plan");
      }

      // Track changes for version control
      const changes = this.trackChanges(carePlan, updateData);

      // Update plan
      Object.assign(carePlan, updateData);
      carePlan.metadata.updatedAt = new Date();
      carePlan.metadata.version += 1;

      // Re-evaluate goals if interventions changed
      if (changes.some((change) => change.field === "interventions")) {
        await this.reevaluateGoals(carePlan);
      }

      // Get updated AI recommendations for significant changes
      if (this.hasSignificantChanges(changes)) {
        const aiRecommendations =
          await this.aiService.generateCarePlanRecommendations(carePlan, {
            patientId: carePlan.patientId,
            changes,
          });

        if (aiRecommendations.success) {
          carePlan.aiRecommendations = aiRecommendations.recommendations;
        }
      }

      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event for real-time updates
      this.eventManager.emit("carePlanUpdated", {
        planId,
        userId,
        changes,
        version: carePlan.metadata.version,
      });

      return {
        success: true,
        carePlan,
        changes,
      };
    } catch (error) {
      console.error("Error updating care plan:", error);
      throw error;
    }
  }

  // Get care plan by ID
  async getCarePlan(planId, userId) {
    try {
      // Try cache first
      let carePlan = await this.cacheService.getCarePlan(planId);

      if (!carePlan) {
        carePlan = await CarePlan.findById(planId)
          .populate("userId", "profile.firstName profile.lastName")
          .populate("patientId", "demographics.firstName demographics.lastName")
          .populate("goals.assignedTo", "profile.firstName profile.lastName")
          .populate(
            "interventions.assignedTo",
            "profile.firstName profile.lastName"
          );

        if (carePlan) {
          await this.cacheService.setCarePlan(planId, carePlan);
        }
      }

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      // Check access permissions
      const hasAccess = this.checkAccess(carePlan, userId);
      if (!hasAccess) {
        throw new Error("Unauthorized access to care plan");
      }

      return {
        success: true,
        carePlan,
      };
    } catch (error) {
      console.error("Error getting care plan:", error);
      throw error;
    }
  }

  // Get care plans for patient
  async getPatientCarePlans(patientId, userId, options = {}) {
    try {
      const carePlans = await CarePlan.getByPatient(patientId, {
        limit: options.limit || 20,
        sort: options.sort || { createdAt: -1 },
        status: options.status,
      });

      // Filter by user access
      const accessiblePlans = carePlans.filter((plan) =>
        this.checkAccess(plan, userId)
      );

      return {
        success: true,
        carePlans: accessiblePlans,
        total: accessiblePlans.length,
      };
    } catch (error) {
      console.error("Error getting patient care plans:", error);
      throw error;
    }
  }

  // Set goal for care plan
  async setGoal(planId, goalData, userId) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      // Create SMART goal structure
      const smartGoal = {
        id: new Date().getTime().toString(),
        description: goalData.description,
        specific: goalData.specific || goalData.description,
        measurable: goalData.measurable || "Progress will be measured",
        achievable: goalData.achievable || "Goal is realistic",
        relevant: goalData.relevant || "Goal is relevant to patient care",
        timebound: goalData.timebound || "Within care plan duration",
        priority: goalData.priority || "medium",
        status: "active",
        targetDate:
          goalData.targetDate ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        assignedTo: goalData.assignedTo || userId,
        interventions: [],
        outcomes: [],
        createdAt: new Date(),
        createdBy: userId,
      };

      carePlan.goals.push(smartGoal);
      carePlan.metadata.updatedAt = new Date();
      carePlan.metadata.version += 1;

      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event
      this.eventManager.emit("carePlanGoalAdded", {
        planId,
        goalId: smartGoal.id,
        userId,
        goal: smartGoal,
      });

      return {
        success: true,
        carePlan,
        goal: smartGoal,
      };
    } catch (error) {
      console.error("Error setting goal:", error);
      throw error;
    }
  }

  // Track goal progress
  async trackGoalProgress(planId, goalId, progressData, userId) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      const goal = carePlan.goals.find((g) => g.id === goalId);
      if (!goal) {
        throw new Error("Goal not found");
      }

      // Add progress entry
      const progressEntry = {
        date: new Date(),
        progress: progressData.progress || 0, // 0-100 percentage
        notes: progressData.notes || "",
        measuredBy: userId,
        metrics: progressData.metrics || {},
        status: progressData.status || goal.status,
      };

      if (!goal.progressTracking) {
        goal.progressTracking = [];
      }
      goal.progressTracking.push(progressEntry);

      // Update goal status based on progress
      if (progressData.progress >= 100) {
        goal.status = "completed";
        goal.completedAt = new Date();
      } else if (progressData.progress > 0) {
        goal.status = "in_progress";
      }

      carePlan.metadata.updatedAt = new Date();
      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event
      this.eventManager.emit("carePlanGoalProgress", {
        planId,
        goalId,
        userId,
        progress: progressEntry,
      });

      return {
        success: true,
        goal,
        progressEntry,
      };
    } catch (error) {
      console.error("Error tracking goal progress:", error);
      throw error;
    }
  }

  // Add intervention to care plan
  async addIntervention(planId, interventionData, userId) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      const intervention = {
        id: new Date().getTime().toString(),
        type: interventionData.type || "nursing",
        description: interventionData.description,
        rationale: interventionData.rationale || "",
        frequency: interventionData.frequency || "As needed",
        duration: interventionData.duration || "Ongoing",
        assignedTo: interventionData.assignedTo || userId,
        priority: interventionData.priority || "medium",
        status: "active",
        relatedGoals: interventionData.relatedGoals || [],
        outcomes: [],
        createdAt: new Date(),
        createdBy: userId,
      };

      if (!carePlan.interventions) {
        carePlan.interventions = [];
      }
      carePlan.interventions.push(intervention);

      // Link intervention to related goals
      if (intervention.relatedGoals.length > 0) {
        intervention.relatedGoals.forEach((goalId) => {
          const goal = carePlan.goals.find((g) => g.id === goalId);
          if (goal) {
            if (!goal.interventions) {
              goal.interventions = [];
            }
            goal.interventions.push(intervention.id);
          }
        });
      }

      carePlan.metadata.updatedAt = new Date();
      carePlan.metadata.version += 1;

      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event
      this.eventManager.emit("carePlanInterventionAdded", {
        planId,
        interventionId: intervention.id,
        userId,
        intervention,
      });

      return {
        success: true,
        carePlan,
        intervention,
      };
    } catch (error) {
      console.error("Error adding intervention:", error);
      throw error;
    }
  }

  // Monitor intervention effectiveness
  async monitorIntervention(planId, interventionId, monitoringData, userId) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      const intervention = carePlan.interventions.find(
        (i) => i.id === interventionId
      );
      if (!intervention) {
        throw new Error("Intervention not found");
      }

      // Add monitoring entry
      const monitoringEntry = {
        date: new Date(),
        effectiveness: monitoringData.effectiveness || "unknown", // effective, partially_effective, ineffective, unknown
        patientResponse: monitoringData.patientResponse || "",
        sideEffects: monitoringData.sideEffects || [],
        modifications: monitoringData.modifications || "",
        continuePlan: monitoringData.continuePlan !== false, // default true
        monitoredBy: userId,
        notes: monitoringData.notes || "",
      };

      if (!intervention.monitoring) {
        intervention.monitoring = [];
      }
      intervention.monitoring.push(monitoringEntry);

      // Update intervention status based on monitoring
      if (
        monitoringData.effectiveness === "ineffective" ||
        !monitoringData.continuePlan
      ) {
        intervention.status = "discontinued";
        intervention.discontinuedAt = new Date();
        intervention.discontinuationReason =
          monitoringData.notes || "Ineffective intervention";
      } else if (monitoringData.effectiveness === "effective") {
        intervention.status = "active";
      }

      carePlan.metadata.updatedAt = new Date();
      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event
      this.eventManager.emit("carePlanInterventionMonitored", {
        planId,
        interventionId,
        userId,
        monitoring: monitoringEntry,
      });

      return {
        success: true,
        intervention,
        monitoringEntry,
      };
    } catch (error) {
      console.error("Error monitoring intervention:", error);
      throw error;
    }
  }

  // Generate care plan summary
  async generateCarePlanSummary(planId, userId) {
    try {
      const carePlan = await CarePlan.findById(planId)
        .populate("patientId", "demographics")
        .populate("userId", "profile");

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      const summary = {
        planId: carePlan._id,
        patient: carePlan.patientId,
        createdBy: carePlan.userId,
        status: carePlan.status,
        duration: this.calculatePlanDuration(carePlan),
        goals: {
          total: carePlan.goals.length,
          active: carePlan.goals.filter((g) => g.status === "active").length,
          completed: carePlan.goals.filter((g) => g.status === "completed")
            .length,
          overdue: carePlan.goals.filter(
            (g) => g.status === "active" && new Date(g.targetDate) < new Date()
          ).length,
        },
        interventions: {
          total: carePlan.interventions.length,
          active: carePlan.interventions.filter((i) => i.status === "active")
            .length,
          completed: carePlan.interventions.filter(
            (i) => i.status === "completed"
          ).length,
          discontinued: carePlan.interventions.filter(
            (i) => i.status === "discontinued"
          ).length,
        },
        outcomes: await this.calculateOutcomes(carePlan),
        nextReviewDate:
          carePlan.nextReviewDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        riskFactors: carePlan.riskFactors || [],
        qualityIndicators: await this.calculateQualityIndicators(carePlan),
      };

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error("Error generating care plan summary:", error);
      throw error;
    }
  }

  // Helper methods
  checkAccess(carePlan, userId) {
    // Owner has full access
    if (
      carePlan.userId.toString() === userId ||
      carePlan.userId._id?.toString() === userId
    ) {
      return true;
    }

    // Check team access
    const teamAccess = carePlan.team?.find(
      (member) =>
        member.userId.toString() === userId ||
        member.userId._id?.toString() === userId
    );

    return !!teamAccess;
  }

  trackChanges(oldPlan, newData) {
    const changes = [];

    for (const [field, newValue] of Object.entries(newData)) {
      const oldValue = oldPlan[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    return changes;
  }

  hasSignificantChanges(changes) {
    const significantFields = [
      "goals",
      "interventions",
      "diagnoses",
      "riskFactors",
      "status",
    ];
    return changes.some((change) => significantFields.includes(change.field));
  }

  async reevaluateGoals(carePlan) {
    // Re-evaluate goals based on current interventions and patient status
    for (const goal of carePlan.goals) {
      if (goal.status === "active") {
        // Check if goal is still relevant and achievable
        const relevantInterventions = carePlan.interventions.filter(
          (i) => i.relatedGoals.includes(goal.id) && i.status === "active"
        );

        if (relevantInterventions.length === 0) {
          goal.status = "needs_review";
          goal.reviewReason = "No active interventions supporting this goal";
        }
      }
    }
  }

  calculatePlanDuration(carePlan) {
    const startDate = new Date(carePlan.createdAt);
    const endDate = carePlan.endDate ? new Date(carePlan.endDate) : new Date();
    const durationMs = endDate - startDate;
    return Math.ceil(durationMs / (1000 * 60 * 60 * 24)); // days
  }

  async calculateOutcomes(carePlan) {
    const outcomes = {
      goalsAchieved: 0,
      interventionsCompleted: 0,
      patientSatisfaction: null,
      clinicalImprovement: null,
      readmissionPrevented: null,
    };

    // Calculate basic outcomes
    outcomes.goalsAchieved = carePlan.goals.filter(
      (g) => g.status === "completed"
    ).length;
    outcomes.interventionsCompleted = carePlan.interventions.filter(
      (i) => i.status === "completed"
    ).length;

    // Additional outcome calculations would go here
    // This would integrate with other services for comprehensive outcome measurement

    return outcomes;
  }

  async calculateQualityIndicators(carePlan) {
    return {
      evidenceBasedInterventions:
        this.countEvidenceBasedInterventions(carePlan),
      goalAchievementRate: this.calculateGoalAchievementRate(carePlan),
      interventionEffectivenessRate:
        this.calculateInterventionEffectivenessRate(carePlan),
      patientEngagement: this.assessPatientEngagement(carePlan),
      careCoordination: this.assessCareCoordination(carePlan),
    };
  }

  countEvidenceBasedInterventions(carePlan) {
    // Count interventions that are based on evidence-based practices
    return carePlan.interventions.filter(
      (i) =>
        i.evidenceBased === true || this.isEvidenceBasedIntervention(i.type)
    ).length;
  }

  calculateGoalAchievementRate(carePlan) {
    if (carePlan.goals.length === 0) return 0;
    const completedGoals = carePlan.goals.filter(
      (g) => g.status === "completed"
    ).length;
    return ((completedGoals / carePlan.goals.length) * 100).toFixed(1);
  }

  calculateInterventionEffectivenessRate(carePlan) {
    const monitoredInterventions = carePlan.interventions.filter(
      (i) => i.monitoring && i.monitoring.length > 0
    );

    if (monitoredInterventions.length === 0) return 0;

    const effectiveInterventions = monitoredInterventions.filter((i) =>
      i.monitoring.some((m) => m.effectiveness === "effective")
    ).length;

    return (
      (effectiveInterventions / monitoredInterventions.length) *
      100
    ).toFixed(1);
  }

  assessPatientEngagement(carePlan) {
    // Assess patient engagement based on goal participation and feedback
    let engagementScore = 0;

    // Check for patient-set goals
    const patientGoals = carePlan.goals.filter(
      (g) => g.patientInvolved === true
    );
    engagementScore +=
      (patientGoals.length / Math.max(carePlan.goals.length, 1)) * 30;

    // Check for patient feedback
    const interventionsWithFeedback = carePlan.interventions.filter(
      (i) => i.monitoring && i.monitoring.some((m) => m.patientResponse)
    );
    engagementScore +=
      (interventionsWithFeedback.length /
        Math.max(carePlan.interventions.length, 1)) *
      40;

    // Check for patient education completion
    const educationInterventions = carePlan.interventions.filter(
      (i) => i.type === "education" && i.status === "completed"
    );
    engagementScore +=
      (educationInterventions.length /
        Math.max(carePlan.interventions.length, 1)) *
      30;

    return Math.min(engagementScore, 100).toFixed(1);
  }

  assessCareCoordination(carePlan) {
    // Assess care coordination based on team involvement and communication
    let coordinationScore = 0;

    // Check for multidisciplinary team involvement
    const teamSize = carePlan.team ? carePlan.team.length : 1;
    coordinationScore += Math.min(teamSize * 20, 60);

    // Check for regular reviews
    const daysSinceLastReview =
      (new Date() - new Date(carePlan.metadata.lastReviewed)) /
      (1000 * 60 * 60 * 24);
    if (daysSinceLastReview <= 7) coordinationScore += 20;
    else if (daysSinceLastReview <= 14) coordinationScore += 10;

    // Check for communication notes
    const communicationNotes = carePlan.interventions.filter(
      (i) =>
        i.monitoring && i.monitoring.some((m) => m.notes && m.notes.length > 0)
    ).length;
    coordinationScore += Math.min(communicationNotes * 5, 20);

    return Math.min(coordinationScore, 100).toFixed(1);
  }

  isEvidenceBasedIntervention(type) {
    const evidenceBasedTypes = [
      "medication_management",
      "wound_care",
      "fall_prevention",
      "infection_control",
      "pain_management",
      "nutrition_therapy",
    ];
    return evidenceBasedTypes.includes(type);
  }

  async generateInitialGoals(carePlanData) {
    const initialGoals = [];

    // Generate goals based on diagnoses
    if (carePlanData.diagnoses && carePlanData.diagnoses.length > 0) {
      for (const diagnosis of carePlanData.diagnoses) {
        const goal = await this.generateGoalForDiagnosis(diagnosis);
        if (goal) {
          initialGoals.push(goal);
        }
      }
    }

    // Add default safety and comfort goals
    initialGoals.push({
      id: `safety_${Date.now()}`,
      description: "Maintain patient safety and prevent adverse events",
      specific: "Implement safety measures and monitor for potential risks",
      measurable: "Zero safety incidents during care period",
      achievable: "Through consistent safety protocols and monitoring",
      relevant: "Essential for quality patient care",
      timebound: "Ongoing throughout care plan",
      priority: "high",
      status: "active",
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    return initialGoals;
  }

  async generateGoalForDiagnosis(diagnosis) {
    // Generate appropriate goals based on diagnosis
    const diagnosisGoals = {
      hypertension: {
        description: "Achieve and maintain blood pressure control",
        specific: "Maintain blood pressure below 140/90 mmHg",
        measurable:
          "Blood pressure readings within target range 80% of the time",
        priority: "high",
      },
      diabetes: {
        description: "Achieve optimal blood glucose control",
        specific:
          "Maintain HbA1c below 7% and daily glucose levels within target range",
        measurable: "HbA1c test results and daily glucose monitoring",
        priority: "high",
      },
      heart_failure: {
        description: "Improve cardiac function and reduce symptoms",
        specific: "Reduce shortness of breath and improve exercise tolerance",
        measurable: "Improved NYHA class and 6-minute walk test results",
        priority: "high",
      },
    };

    const goalTemplate = diagnosisGoals[diagnosis.toLowerCase()];
    if (goalTemplate) {
      return {
        id: `${diagnosis}_${Date.now()}`,
        ...goalTemplate,
        achievable: "Through medication compliance and lifestyle modifications",
        relevant: `Directly addresses ${diagnosis} management`,
        timebound: "Within 30 days of care plan initiation",
        status: "active",
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
    }

    return null;
  }

  applyEvidenceBasedTemplate(templateName, planData) {
    const template = this.templates[templateName];
    if (!template) {
      return planData;
    }

    return {
      ...planData,
      goals: [...(planData.goals || []), ...(template.goals || [])],
      interventions: [
        ...(planData.interventions || []),
        ...(template.interventions || []),
      ],
      riskFactors: [
        ...(planData.riskFactors || []),
        ...(template.riskFactors || []),
      ],
      template: templateName,
    };
  }

  async validatePremiumAccess(userId) {
    // This would integrate with the billing system
    // For now, return true for nursing premium users
    return true;
  }

  initializeTemplates() {
    return {
      cardiac: {
        goals: [
          {
            id: "cardiac_goal_1",
            description: "Improve cardiac function and reduce symptoms",
            priority: "high",
            status: "active",
          },
        ],
        interventions: [
          {
            id: "cardiac_intervention_1",
            type: "medication_management",
            description: "Administer cardiac medications as prescribed",
            priority: "high",
          },
        ],
        riskFactors: ["cardiac_arrest", "arrhythmia", "fluid_overload"],
      },
      diabetes: {
        goals: [
          {
            id: "diabetes_goal_1",
            description: "Achieve optimal blood glucose control",
            priority: "high",
            status: "active",
          },
        ],
        interventions: [
          {
            id: "diabetes_intervention_1",
            type: "medication_management",
            description:
              "Monitor blood glucose and administer insulin as needed",
            priority: "high",
          },
        ],
        riskFactors: ["hypoglycemia", "hyperglycemia", "diabetic_ketoacidosis"],
      },
      wound_care: {
        goals: [
          {
            id: "wound_goal_1",
            description: "Promote wound healing and prevent infection",
            priority: "high",
            status: "active",
          },
        ],
        interventions: [
          {
            id: "wound_intervention_1",
            type: "wound_care",
            description: "Perform wound assessment and dressing changes",
            priority: "high",
          },
        ],
        riskFactors: ["infection", "delayed_healing", "wound_dehiscence"],
      },
    };
  }

  // AI-powered care plan optimization
  async optimizeCarePlan(planId, userId, optimizationOptions = {}) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      // Analyze current care plan performance
      const performanceAnalysis = await this.analyzeCarePlanPerformance(
        carePlan
      );

      // Generate AI-powered optimization recommendations
      const optimizationRecommendations = await this.aiService.optimizeCarePlan(
        carePlan,
        {
          performanceAnalysis,
          patientData: await this.getPatientData(carePlan.patientId),
          evidenceBase: optimizationOptions.includeEvidenceBase !== false,
          riskFactors: carePlan.riskFactors || [],
          currentOutcomes: performanceAnalysis.outcomes,
        }
      );

      if (optimizationRecommendations.success) {
        // Apply optimization recommendations if auto-apply is enabled
        if (optimizationOptions.autoApply) {
          await this.applyOptimizationRecommendations(
            carePlan,
            optimizationRecommendations.recommendations
          );
        }

        // Track optimization history
        if (!carePlan.optimizationHistory) {
          carePlan.optimizationHistory = [];
        }

        carePlan.optimizationHistory.push({
          date: new Date(),
          performanceAnalysis,
          recommendations: optimizationRecommendations.recommendations,
          appliedRecommendations: optimizationOptions.autoApply
            ? optimizationRecommendations.recommendations
            : [],
          optimizedBy: userId,
          aiConfidence: optimizationRecommendations.confidence,
        });

        carePlan.metadata.lastOptimized = new Date();
        await carePlan.save();

        // Update cache
        await this.cacheService.setCarePlan(planId, carePlan);

        // Emit event
        this.eventManager.emit("carePlanOptimized", {
          planId,
          userId,
          recommendations: optimizationRecommendations.recommendations,
          autoApplied: optimizationOptions.autoApply,
        });
      }

      return {
        success: true,
        performanceAnalysis,
        optimizationRecommendations: optimizationRecommendations.success
          ? optimizationRecommendations.recommendations
          : [],
        confidence: optimizationRecommendations.confidence || 0,
        applied: optimizationOptions.autoApply,
      };
    } catch (error) {
      console.error("Error optimizing care plan:", error);
      throw error;
    }
  }

  // Predict care plan outcomes using AI
  async predictOutcomes(planId, userId, predictionTimeframe = 30) {
    try {
      const carePlan = await CarePlan.findById(planId).populate("patientId");

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      // Gather historical data for prediction
      const historicalData = await this.gatherHistoricalData(carePlan);

      // Use AI to predict outcomes
      const outcomePredictions = await this.aiService.predictCarePlanOutcomes(
        carePlan,
        {
          historicalData,
          timeframe: predictionTimeframe,
          patientFactors: await this.getPatientRiskFactors(carePlan.patientId),
          interventionEffectiveness:
            await this.calculateInterventionEffectiveness(carePlan),
          similarCases: await this.findSimilarCases(carePlan),
        }
      );

      if (outcomePredictions.success) {
        // Store predictions for tracking accuracy
        if (!carePlan.outcomePredictions) {
          carePlan.outcomePredictions = [];
        }

        const prediction = {
          date: new Date(),
          timeframe: predictionTimeframe,
          predictions: outcomePredictions.predictions,
          confidence: outcomePredictions.confidence,
          factors: outcomePredictions.factors,
          predictedBy: userId,
          actualOutcomes: null, // Will be filled in later for accuracy tracking
        };

        carePlan.outcomePredictions.push(prediction);
        await carePlan.save();

        // Update cache
        await this.cacheService.setCarePlan(planId, carePlan);

        // Emit event
        this.eventManager.emit("carePlanOutcomesPredicted", {
          planId,
          userId,
          predictions: outcomePredictions.predictions,
          confidence: outcomePredictions.confidence,
        });
      }

      return {
        success: true,
        predictions: outcomePredictions.success
          ? outcomePredictions.predictions
          : {},
        confidence: outcomePredictions.confidence || 0,
        factors: outcomePredictions.factors || [],
        timeframe: predictionTimeframe,
      };
    } catch (error) {
      console.error("Error predicting outcomes:", error);
      throw error;
    }
  }

  // Enable interdisciplinary collaboration
  async enableCollaboration(planId, userId, collaborationSettings) {
    try {
      const carePlan = await CarePlan.findById(planId);

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (carePlan.userId.toString() !== userId) {
        throw new Error("Only plan owner can enable collaboration");
      }

      // Initialize collaboration structure
      if (!carePlan.collaboration) {
        carePlan.collaboration = {
          enabled: false,
          team: [],
          communications: [],
          sharedDecisions: [],
          conflictResolution: [],
        };
      }

      carePlan.collaboration.enabled = true;
      carePlan.collaboration.settings = {
        ...collaborationSettings,
        enabledAt: new Date(),
        enabledBy: userId,
      };

      // Add team members
      if (
        collaborationSettings.teamMembers &&
        collaborationSettings.teamMembers.length > 0
      ) {
        for (const member of collaborationSettings.teamMembers) {
          await this.addTeamMember(carePlan, member, userId);
        }
      }

      // Set up communication channels
      if (collaborationSettings.communicationChannels) {
        carePlan.collaboration.communicationChannels =
          collaborationSettings.communicationChannels;
      }

      // Configure decision-making protocols
      if (collaborationSettings.decisionProtocols) {
        carePlan.collaboration.decisionProtocols =
          collaborationSettings.decisionProtocols;
      }

      await carePlan.save();

      // Update cache
      await this.cacheService.setCarePlan(planId, carePlan);

      // Emit event
      this.eventManager.emit("carePlanCollaborationEnabled", {
        planId,
        userId,
        teamMembers: collaborationSettings.teamMembers || [],
        settings: collaborationSettings,
      });

      return {
        success: true,
        carePlan,
        collaboration: carePlan.collaboration,
      };
    } catch (error) {
      console.error("Error enabling collaboration:", error);
      throw error;
    }
  }

  // Generate comprehensive care plan report
  async generateComprehensiveReport(planId, userId, reportOptions = {}) {
    try {
      const carePlan = await CarePlan.findById(planId)
        .populate("userId", "profile")
        .populate("patientId", "demographics")
        .populate("collaboration.team.userId", "profile");

      if (!carePlan) {
        throw new Error("Care plan not found");
      }

      if (!this.checkAccess(carePlan, userId)) {
        throw new Error("Unauthorized access to care plan");
      }

      const report = {
        metadata: {
          generatedAt: new Date(),
          generatedBy: userId,
          reportType: reportOptions.type || "comprehensive",
          planId: carePlan._id,
          planVersion: carePlan.metadata.version,
        },
        patient: {
          id: carePlan.patientId._id,
          name: `${carePlan.patientId.demographics.firstName} ${carePlan.patientId.demographics.lastName}`,
          demographics: carePlan.patientId.demographics,
        },
        carePlan: {
          status: carePlan.status,
          createdAt: carePlan.metadata.createdAt,
          duration: this.calculatePlanDuration(carePlan),
          template: carePlan.template,
          primaryNurse: carePlan.userId.profile,
        },
        goals: await this.generateGoalsReport(carePlan),
        interventions: await this.generateInterventionsReport(carePlan),
        outcomes: await this.generateOutcomesReport(carePlan),
        qualityMetrics: await this.calculateQualityIndicators(carePlan),
        riskAssessment: await this.generateRiskAssessmentReport(carePlan),
        collaboration: await this.generateCollaborationReport(carePlan),
        aiInsights: await this.generateAIInsightsReport(carePlan),
        recommendations: await this.generateRecommendationsReport(carePlan),
      };

      // Include optimization history if requested
      if (
        reportOptions.includeOptimizationHistory &&
        carePlan.optimizationHistory
      ) {
        report.optimizationHistory = carePlan.optimizationHistory;
      }

      // Include outcome predictions if requested
      if (
        reportOptions.includeOutcomePredictions &&
        carePlan.outcomePredictions
      ) {
        report.outcomePredictions = carePlan.outcomePredictions;
      }

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error("Error generating comprehensive report:", error);
      throw error;
    }
  }

  // Helper methods for advanced features
  async analyzeCarePlanPerformance(carePlan) {
    const analysis = {
      goalProgress: {
        total: carePlan.goals.length,
        completed: carePlan.goals.filter((g) => g.status === "completed")
          .length,
        onTrack: carePlan.goals.filter(
          (g) => g.status === "active" && this.isGoalOnTrack(g)
        ).length,
        delayed: carePlan.goals.filter(
          (g) => g.status === "active" && !this.isGoalOnTrack(g)
        ).length,
      },
      interventionEffectiveness: {
        total: carePlan.interventions.length,
        effective: carePlan.interventions.filter((i) =>
          this.isInterventionEffective(i)
        ).length,
        partiallyEffective: carePlan.interventions.filter((i) =>
          this.isInterventionPartiallyEffective(i)
        ).length,
        ineffective: carePlan.interventions.filter((i) =>
          this.isInterventionIneffective(i)
        ).length,
      },
      patientEngagement: await this.calculatePatientEngagement(carePlan),
      careCoordination: await this.calculateCareCoordination(carePlan),
      outcomes: await this.calculateCurrentOutcomes(carePlan),
      riskFactors: await this.assessCurrentRiskFactors(carePlan),
    };

    // Calculate overall performance score
    analysis.overallScore = this.calculateOverallPerformanceScore(analysis);

    return analysis;
  }

  isGoalOnTrack(goal) {
    if (!goal.progressTracking || goal.progressTracking.length === 0) {
      return false;
    }

    const latestProgress =
      goal.progressTracking[goal.progressTracking.length - 1];
    const daysElapsed =
      (new Date() - new Date(goal.createdAt)) / (1000 * 60 * 60 * 24);
    const targetDays =
      (new Date(goal.targetDate) - new Date(goal.createdAt)) /
      (1000 * 60 * 60 * 24);
    const expectedProgress = (daysElapsed / targetDays) * 100;

    return latestProgress.progress >= expectedProgress * 0.8; // 80% of expected progress
  }

  isInterventionEffective(intervention) {
    if (!intervention.monitoring || intervention.monitoring.length === 0) {
      return false;
    }

    const effectiveCount = intervention.monitoring.filter(
      (m) => m.effectiveness === "effective"
    ).length;
    return effectiveCount / intervention.monitoring.length >= 0.7; // 70% effective
  }

  isInterventionPartiallyEffective(intervention) {
    if (!intervention.monitoring || intervention.monitoring.length === 0) {
      return false;
    }

    const effectiveCount = intervention.monitoring.filter(
      (m) =>
        m.effectiveness === "effective" ||
        m.effectiveness === "partially_effective"
    ).length;
    const ratio = effectiveCount / intervention.monitoring.length;
    return ratio >= 0.4 && ratio < 0.7; // 40-70% effective
  }

  isInterventionIneffective(intervention) {
    if (!intervention.monitoring || intervention.monitoring.length === 0) {
      return true; // No monitoring = unknown effectiveness
    }

    const effectiveCount = intervention.monitoring.filter(
      (m) =>
        m.effectiveness === "effective" ||
        m.effectiveness === "partially_effective"
    ).length;
    return effectiveCount / intervention.monitoring.length < 0.4; // Less than 40% effective
  }

  calculateOverallPerformanceScore(analysis) {
    let score = 0;

    // Goal progress (30%)
    if (analysis.goalProgress.total > 0) {
      const goalScore =
        ((analysis.goalProgress.completed +
          analysis.goalProgress.onTrack * 0.7) /
          analysis.goalProgress.total) *
        100;
      score += goalScore * 0.3;
    }

    // Intervention effectiveness (25%)
    if (analysis.interventionEffectiveness.total > 0) {
      const interventionScore =
        ((analysis.interventionEffectiveness.effective +
          analysis.interventionEffectiveness.partiallyEffective * 0.5) /
          analysis.interventionEffectiveness.total) *
        100;
      score += interventionScore * 0.25;
    }

    // Patient engagement (20%)
    score += parseFloat(analysis.patientEngagement) * 0.2;

    // Care coordination (15%)
    score += parseFloat(analysis.careCoordination) * 0.15;

    // Risk management (10%)
    const riskScore = Math.max(0, 100 - analysis.riskFactors.length * 10);
    score += riskScore * 0.1;

    return Math.round(score);
  }

  async calculatePatientEngagement(carePlan) {
    // Mock calculation - in real implementation, this would analyze patient participation
    return "75.5";
  }

  async calculateCareCoordination(carePlan) {
    // Mock calculation - in real implementation, this would analyze team collaboration
    return "82.3";
  }

  async calculateCurrentOutcomes(carePlan) {
    return {
      goalAchievementRate: this.calculateGoalAchievementRate(carePlan),
      interventionSuccessRate: this.calculateInterventionSuccessRate(carePlan),
      patientSatisfaction: 85,
      qualityOfLife: 78,
      functionalImprovement: 72,
    };
  }

  async assessCurrentRiskFactors(carePlan) {
    return carePlan.riskFactors || [];
  }

  calculateInterventionSuccessRate(carePlan) {
    if (carePlan.interventions.length === 0) return 0;

    const successfulInterventions = carePlan.interventions.filter((i) =>
      this.isInterventionEffective(i)
    ).length;

    return (
      (successfulInterventions / carePlan.interventions.length) *
      100
    ).toFixed(1);
  }

  // Mock methods for advanced features (would be implemented with real AI services)
  async generateGoalsReport(carePlan) {
    return {
      total: carePlan.goals.length,
      completed: carePlan.goals.filter((g) => g.status === "completed").length,
      active: carePlan.goals.filter((g) => g.status === "active").length,
      overdue: carePlan.goals.filter(
        (g) => g.status === "active" && new Date(g.targetDate) < new Date()
      ).length,
    };
  }

  async generateInterventionsReport(carePlan) {
    return {
      total: carePlan.interventions.length,
      active: carePlan.interventions.filter((i) => i.status === "active")
        .length,
      completed: carePlan.interventions.filter((i) => i.status === "completed")
        .length,
      discontinued: carePlan.interventions.filter(
        (i) => i.status === "discontinued"
      ).length,
    };
  }

  async generateOutcomesReport(carePlan) {
    return {
      goalAchievementRate: this.calculateGoalAchievementRate(carePlan),
      interventionSuccessRate: this.calculateInterventionSuccessRate(carePlan),
      patientSatisfaction: 85,
      overallProgress: 78,
    };
  }

  async generateRiskAssessmentReport(carePlan) {
    return {
      currentRisks: carePlan.riskFactors || [],
      riskLevel: carePlan.riskFactors
        ? carePlan.riskFactors.length > 3
          ? "high"
          : "moderate"
        : "low",
      mitigationStrategies: [
        "Regular monitoring",
        "Patient education",
        "Family involvement",
      ],
    };
  }

  async generateCollaborationReport(carePlan) {
    if (!carePlan.collaboration || !carePlan.collaboration.enabled) {
      return { enabled: false };
    }

    return {
      enabled: true,
      teamSize: carePlan.collaboration.team.length,
      communicationScore: 85,
      decisionMakingEfficiency: 78,
    };
  }

  async generateAIInsightsReport(carePlan) {
    return {
      optimizationOpportunities: [
        "Consider adjusting medication timing for better compliance",
        "Add patient education intervention for self-management",
        "Increase monitoring frequency for high-risk interventions",
      ],
      predictedOutcomes: {
        goalCompletion: "85%",
        patientSatisfaction: "88%",
        readmissionRisk: "Low",
      },
    };
  }

  async generateRecommendationsReport(carePlan) {
    return {
      immediate: [
        "Review medication adherence with patient",
        "Schedule follow-up appointment within 7 days",
      ],
      shortTerm: [
        "Implement patient education program",
        "Coordinate with family members for support",
      ],
      longTerm: [
        "Develop transition plan for discharge",
        "Establish community resource connections",
      ],
    };
  }
  // Real-time Care Plan Management Methods
  async createCarePlan(userId, carePlanData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("database");

      // Validate inputs
      this.validateInputs(carePlanData, { requestId, userId });

      // Create care plan with enhanced data
      const enhancedCarePlan = {
        ...carePlanData,
        _id: new Date().getTime().toString(),
        id: new Date().getTime().toString(),
        userId,
        status: carePlanData.status || "active",
        priority: carePlanData.priority || "medium",
        overallProgress: 0,
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
        goals: (carePlanData.goals || []).map((goal) => ({
          ...goal,
          id: goal.id || this.generateGoalId(),
          progress: goal.progress || 0,
          status: goal.status || "not_started",
          createdAt: new Date(),
        })),
        interventions: (carePlanData.interventions || []).map(
          (intervention) => ({
            ...intervention,
            id: intervention.id || this.generateInterventionId(),
            status: intervention.status || "pending",
            createdAt: new Date(),
          })
        ),
      };

      // **FIX: Actually store the care plan in memory/database**
      if (!this.carePlansStorage) {
        this.carePlansStorage = new Map();
      }

      // Data now matches frontend structure - no transformation needed
      console.log(
        "🔍 [CarePlansService] Care plan data received:",
        JSON.stringify(
          {
            goals: enhancedCarePlan.goals,
            interventions: enhancedCarePlan.interventions,
          },
          null,
          2
        )
      );

      // Save to MongoDB database - data structure now matches frontend
      const carePlanDoc = new CarePlan({
        userId: new mongoose.Types.ObjectId(userId),
        patientId: enhancedCarePlan.patientId
          ? new mongoose.Types.ObjectId(enhancedCarePlan.patientId)
          : new mongoose.Types.ObjectId(),
        planName: enhancedCarePlan.planName,
        planType: enhancedCarePlan.planType || "ongoing",
        priority: enhancedCarePlan.priority || "medium",
        assessmentSummary: {
          primaryDiagnosis: enhancedCarePlan.primaryDiagnosis || "",
          secondaryDiagnoses: enhancedCarePlan.secondaryDiagnoses || [],
          riskFactors: enhancedCarePlan.riskFactors || [],
        },
        goals: enhancedCarePlan.goals || [],
        interventions: enhancedCarePlan.interventions || [],
        status: enhancedCarePlan.status || "active",
      });

      const savedCarePlan = await carePlanDoc.save();

      // Update the enhanced care plan with the saved ID
      enhancedCarePlan._id = savedCarePlan._id.toString();
      enhancedCarePlan.id = savedCarePlan._id.toString();

      console.log(
        `✅ [CarePlansService] Care plan saved to database for user ${userId}:`,
        {
          planId: savedCarePlan._id,
          planName: enhancedCarePlan.planName,
          mongoId: savedCarePlan._id,
        }
      );

      // Emit creation event
      this.eventManager.emit("carePlanCreated", {
        carePlanId: enhancedCarePlan._id,
        userId,
        patientId: enhancedCarePlan.patientId,
        planName: enhancedCarePlan.planName,
        requestId,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      this.logInfo("Care plan created successfully", {
        requestId,
        carePlanId: enhancedCarePlan._id,
        userId,
        responseTime,
      });

      return {
        success: true,
        carePlan: enhancedCarePlan,
        message: "Care plan created successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to create care plan", error, { requestId, userId });

      return {
        success: false,
        message: error.message || "Failed to create care plan",
        error: error.code || "CREATION_ERROR",
        requestId,
      };
    }
  }

  async getCarePlans(userId, filters = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Build query
      const query = { userId: new mongoose.Types.ObjectId(userId) };

      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.patientId) {
        query.patientId = new mongoose.Types.ObjectId(filters.patientId);
      }

      // Retrieve from MongoDB database with patient population
      const carePlans = await CarePlan.find(query)
        .populate("patientId", "name medicalRecordNumber primaryDiagnosis")
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .lean();

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      // Format care plans for frontend with patient information
      const formattedCarePlans = carePlans.map((plan) => ({
        ...plan,
        id: plan._id.toString(),
        _id: plan._id.toString(),
        // Patient information
        patientName: plan.patientId?.name || "Unknown Patient",
        patientMRN: plan.patientId?.medicalRecordNumber || "",
        // Diagnosis information
        primaryDiagnosis:
          plan.assessmentSummary?.primaryDiagnosis ||
          plan.patientId?.primaryDiagnosis ||
          "",
        secondaryDiagnoses: plan.assessmentSummary?.secondaryDiagnoses || [],
        riskFactors: plan.assessmentSummary?.riskFactors || [],
      }));

      return {
        success: true,
        data: formattedCarePlans,
        count: formattedCarePlans.length,
        message: "Care plans retrieved successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to get care plans", error, {
        requestId,
        userId,
        filters,
      });

      return {
        success: false,
        message: error.message || "Failed to retrieve care plans",
        data: [],
        error: error.code || "RETRIEVAL_ERROR",
        requestId,
      };
    }
  }

  async getCarePlan(userId, carePlanId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Retrieve from MongoDB database with patient population
      const carePlan = await CarePlan.findOne({
        _id: new mongoose.Types.ObjectId(carePlanId),
        userId: new mongoose.Types.ObjectId(userId),
      })
        .populate("patientId", "name medicalRecordNumber primaryDiagnosis")
        .lean();

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      if (!carePlan) {
        return {
          success: false,
          message: "Care plan not found",
          error: "NOT_FOUND",
          requestId,
        };
      }

      // Format the care plan for frontend with patient information
      const formattedCarePlan = {
        ...carePlan,
        id: carePlan._id.toString(),
        _id: carePlan._id.toString(),
        // Patient information
        patientName: carePlan.patientId?.name || "Unknown Patient",
        patientMRN: carePlan.patientId?.medicalRecordNumber || "",
        // Diagnosis information
        primaryDiagnosis:
          carePlan.assessmentSummary?.primaryDiagnosis ||
          carePlan.patientId?.primaryDiagnosis ||
          "",
        secondaryDiagnoses:
          carePlan.assessmentSummary?.secondaryDiagnoses || [],
        riskFactors: carePlan.assessmentSummary?.riskFactors || [],
      };

      return {
        success: true,
        data: formattedCarePlan,
        message: "Care plan retrieved successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to get care plan", error, {
        requestId,
        userId,
        carePlanId,
      });

      return {
        success: false,
        message: error.message || "Failed to retrieve care plan",
        error: error.code || "RETRIEVAL_ERROR",
        requestId,
      };
    }
  }

  async updateCarePlan(userId, carePlanId, updates) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("database");

      // Get existing care plan
      const existingPlan = await this.getCarePlan(userId, carePlanId);
      if (!existingPlan.success) {
        throw new Error(existingPlan.message || "Care plan not found");
      }

      console.log("🔍 Updating care plan:", {
        carePlanId,
        userId,
        updates: Object.keys(updates),
      });
      console.log("📋 Existing plan version:", existingPlan.data?.version);

      // Update care plan in database
      const updatedCarePlan = await CarePlan.findByIdAndUpdate(
        carePlanId,
        {
          ...updates,
          lastModified: new Date(),
          modifiedBy: userId,
          version: (existingPlan.data?.version || 1) + 1,
        },
        { new: true, runValidators: true }
      );

      if (!updatedCarePlan) {
        throw new Error("Failed to update care plan in database");
      }

      this.updateCircuitBreaker("database", true);

      // Clear cache
      const cacheKey = this.generateCacheKey("care_plan", {
        carePlanId,
        userId,
      });
      this.setCache(cacheKey, updatedCarePlan);

      // Emit update event
      this.eventManager.emit("carePlanUpdated", {
        carePlanId,
        userId,
        changes: Object.keys(updates),
        carePlan: updatedCarePlan,
        requestId,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        carePlan: updatedCarePlan,
        message: "Care plan updated successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      // Update circuit breaker on database errors
      if (error.name === "MongoError" || error.name === "ValidationError") {
        this.updateCircuitBreaker("database", false);
      }

      this.logError("Failed to update care plan", error, {
        requestId,
        userId,
        carePlanId,
      });

      return {
        success: false,
        message: error.message || "Failed to update care plan",
        error: error.code || "UPDATE_ERROR",
        requestId,
      };
    }
  }

  async deleteCarePlan(userId, carePlanId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("database");

      // Get existing care plan for event data
      const existingPlan = await this.getCarePlan(userId, carePlanId);
      if (!existingPlan.success) {
        throw new Error(existingPlan.message || "Care plan not found");
      }

      console.log("🗑️ Deleting care plan:", {
        carePlanId,
        userId,
        planName: existingPlan.data?.planName,
      });

      // Actually delete the care plan from database
      const deletedCarePlan = await CarePlan.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(carePlanId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deletedCarePlan) {
        throw new Error("Failed to delete care plan from database");
      }

      this.updateCircuitBreaker("database", true);

      // Clear cache
      const cacheKey = this.generateCacheKey("care_plan", {
        carePlanId,
        userId,
      });
      this.clearCache(cacheKey);

      // Emit deletion event
      this.eventManager.emit("carePlanDeleted", {
        carePlanId,
        userId,
        planName: existingPlan.data?.planName || "Unknown Plan",
        requestId,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        message: "Care plan deleted successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to delete care plan", error, {
        requestId,
        userId,
        carePlanId,
      });

      return {
        success: false,
        message: error.message || "Failed to delete care plan",
        error: error.code || "DELETE_ERROR",
        requestId,
      };
    }
  }

  async updateGoalProgress(userId, carePlanId, goalId, progress, notes = "") {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Get existing care plan
      const existingPlan = await this.getCarePlan(userId, carePlanId);
      if (!existingPlan.success) {
        throw new Error("Care plan not found");
      }

      // Update goal progress
      const updatedGoals = existingPlan.carePlan.goals.map((goal) => {
        if (goal.id === goalId) {
          return {
            ...goal,
            progress,
            notes,
            lastUpdated: new Date(),
            status:
              progress >= 100
                ? "completed"
                : progress > 0
                ? "in_progress"
                : "not_started",
          };
        }
        return goal;
      });

      // Calculate overall progress
      const overallProgress =
        updatedGoals.reduce((sum, goal) => sum + (goal.progress || 0), 0) /
        updatedGoals.length;

      // Emit progress update event
      this.eventManager.emit("goalProgressUpdated", {
        carePlanId,
        goalId,
        progress,
        overallProgress,
        userId,
        requestId,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        goal: updatedGoals.find((g) => g.id === goalId),
        overallProgress,
        message: "Goal progress updated successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to update goal progress", error, {
        requestId,
        userId,
        carePlanId,
        goalId,
      });

      return {
        success: false,
        message: error.message || "Failed to update goal progress",
        error: error.code || "PROGRESS_UPDATE_ERROR",
        requestId,
      };
    }
  }

  async completeIntervention(userId, carePlanId, interventionId, notes = "") {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Get existing care plan
      const existingPlan = await this.getCarePlan(userId, carePlanId);
      if (!existingPlan.success) {
        throw new Error("Care plan not found");
      }

      // Update intervention status
      const updatedInterventions = existingPlan.carePlan.interventions.map(
        (intervention) => {
          if (intervention.id === interventionId) {
            return {
              ...intervention,
              status: "completed",
              completedAt: new Date(),
              completionNotes: notes,
              completedBy: userId,
            };
          }
          return intervention;
        }
      );

      // Emit intervention completion event
      this.eventManager.emit("interventionCompleted", {
        carePlanId,
        interventionId,
        userId,
        notes,
        requestId,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        intervention: updatedInterventions.find((i) => i.id === interventionId),
        message: "Intervention completed successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to complete intervention", error, {
        requestId,
        userId,
        carePlanId,
        interventionId,
      });

      return {
        success: false,
        message: error.message || "Failed to complete intervention",
        error: error.code || "INTERVENTION_COMPLETION_ERROR",
        requestId,
      };
    }
  }

  async getCarePlanProgress(userId, carePlanId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Get care plan
      const carePlan = await this.getCarePlan(userId, carePlanId);
      if (!carePlan.success) {
        throw new Error("Care plan not found");
      }

      // Calculate detailed progress
      const progress = {
        overallProgress: carePlan.carePlan.overallProgress || 0,
        goalsProgress: carePlan.carePlan.goals.map((goal) => ({
          id: goal.id,
          description: goal.description,
          progress: goal.progress || 0,
          status: goal.status,
          targetDate: goal.targetDate,
        })),
        interventionsStatus: carePlan.carePlan.interventions.map(
          (intervention) => ({
            id: intervention.id,
            description: intervention.description,
            status: intervention.status,
            completedAt: intervention.completedAt,
          })
        ),
        timeline: [
          {
            date: carePlan.carePlan.createdAt,
            event: "Care plan created",
            type: "creation",
          },
        ],
      };

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        progress,
        message: "Care plan progress retrieved successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to get care plan progress", error, {
        requestId,
        userId,
        carePlanId,
      });

      return {
        success: false,
        message: error.message || "Failed to get care plan progress",
        error: error.code || "PROGRESS_RETRIEVAL_ERROR",
        requestId,
      };
    }
  }

  async getCarePlanAnalytics(userId, options = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.checkRateLimit(userId);

      // Mock analytics data
      const analytics = {
        summary: {
          totalCarePlans: 5,
          activeCarePlans: 3,
          completedCarePlans: 2,
          averageProgress: 72,
          averageCompletionTime: 28, // days
        },
        progressTrends: [
          { date: "2024-01-01", progress: 45 },
          { date: "2024-01-15", progress: 62 },
          { date: "2024-02-01", progress: 72 },
        ],
        goalCompletionRates: {
          mobility: 85,
          pain_management: 78,
          medication_adherence: 92,
          patient_education: 68,
        },
        interventionEffectiveness: [
          { type: "Physical Therapy", successRate: 88 },
          { type: "Medication Management", successRate: 94 },
          { type: "Patient Education", successRate: 76 },
        ],
      };

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      return {
        success: true,
        analytics,
        message: "Care plan analytics retrieved successfully",
        requestId,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.logError("Failed to get care plan analytics", error, {
        requestId,
        userId,
      });

      return {
        success: false,
        message: error.message || "Failed to get care plan analytics",
        error: error.code || "ANALYTICS_ERROR",
        requestId,
      };
    }
  }

  // Helper methods
  generateGoalId() {
    return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateInterventionId() {
    return `intervention_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // AI-powered care plan suggestions
  async generateCarePlanSuggestions(patientContext, userId) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Input validation and rate limiting
      this.checkRateLimit(userId);
      this.checkCircuitBreaker("ai");

      this.logInfo("Generating AI care plan suggestions", {
        requestId,
        userId,
        patientId: patientContext.patientId,
      });

      // Get patient clinical data if available
      let clinicalData = {};
      if (patientContext.patientId) {
        try {
          // This would integrate with your patient data service
          clinicalData = await this.getPatientClinicalData(
            patientContext.patientId
          );
        } catch (error) {
          this.logInfo(
            "Could not retrieve clinical data, using provided context",
            {
              requestId,
              error: error.message,
            }
          );
        }
      }

      // Prepare AI context
      const aiContext = {
        patient: {
          id: patientContext.patientId,
          name: patientContext.patientName,
          diagnoses: patientContext.diagnoses || [],
          clinicalData: clinicalData,
          selectedPatient: patientContext.selectedPatient,
        },
        requestId,
        timestamp: new Date().toISOString(),
      };

      // Generate AI suggestions using the AI service
      const aiResponse = await this.aiService.generateCarePlanSuggestions(
        aiContext
      );

      if (!aiResponse.success) {
        throw new Error(
          aiResponse.error || "AI service failed to generate suggestions"
        );
      }

      // Process and enhance AI suggestions
      const suggestions = this.processAISuggestions(
        aiResponse.data,
        patientContext
      );

      // Update circuit breaker and metrics
      this.updateCircuitBreaker("ai", true);
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      this.logInfo("AI care plan suggestions generated successfully", {
        requestId,
        userId,
        patientId: patientContext.patientId,
        suggestionsCount: {
          goals: suggestions.goals?.length || 0,
          interventions: suggestions.interventions?.length || 0,
        },
        responseTime,
      });

      return {
        success: true,
        data: suggestions,
        requestId,
        generatedAt: new Date().toISOString(),
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      this.updateCircuitBreaker("ai", false);

      this.logError("Failed to generate AI care plan suggestions", error, {
        requestId,
        userId,
        patientId: patientContext.patientId,
        responseTime,
      });

      // Return fallback suggestions instead of throwing error
      const fallbackSuggestions =
        this.generateFallbackSuggestions(patientContext);

      return {
        success: true,
        data: fallbackSuggestions,
        requestId,
        generatedAt: new Date().toISOString(),
        responseTime,
        fallback: true,
        warning: "AI service unavailable, using evidence-based templates",
      };
    }
  }

  // Process AI suggestions and add evidence-based enhancements
  processAISuggestions(aiData, patientContext) {
    const diagnoses = patientContext.diagnoses || [];
    const primaryDiagnosis = diagnoses[0] || "General Care";

    return {
      planName:
        aiData.planName || `Care Plan for ${patientContext.patientName}`,
      priority: this.determinePriority(diagnoses, aiData.priority),
      targetEndDate: this.calculateTargetEndDate(
        diagnoses,
        aiData.estimatedDuration
      ),
      diagnoses:
        diagnoses.length > 0 ? diagnoses : aiData.suggestedDiagnoses || [],
      goals: this.enhanceGoals(aiData.goals || [], diagnoses),
      interventions: this.enhanceInterventions(
        aiData.interventions || [],
        diagnoses
      ),
      notes: aiData.notes || `AI-generated care plan for ${primaryDiagnosis}`,
      evidenceBase: aiData.evidenceBase || [],
      riskFactors: aiData.riskFactors || [],
      expectedOutcomes: aiData.expectedOutcomes || [],
    };
  }

  // Generate fallback suggestions when AI is unavailable
  generateFallbackSuggestions(patientContext) {
    const diagnoses = patientContext.diagnoses || [];
    const primaryDiagnosis = diagnoses[0] || "General Care";
    const patientName = patientContext.patientName || "Patient";

    // Use evidence-based templates
    const template = this.getEvidenceBasedTemplate(primaryDiagnosis);

    return {
      planName: `${primaryDiagnosis} Care Plan - ${patientName}`,
      priority: template.defaultPriority || "medium",
      targetEndDate: this.calculateTargetEndDate(diagnoses),
      diagnoses: diagnoses.length > 0 ? diagnoses : [primaryDiagnosis],
      goals: template.standardGoals || this.getStandardGoals(primaryDiagnosis),
      interventions:
        template.standardInterventions ||
        this.getStandardInterventions(primaryDiagnosis),
      notes: `Evidence-based care plan template for ${primaryDiagnosis}`,
      evidenceBase: template.evidenceBase || [],
      fallback: true,
    };
  }

  // Get evidence-based template for diagnosis
  getEvidenceBasedTemplate(diagnosis) {
    const templates = {
      Diabetes: {
        defaultPriority: "high",
        standardGoals: [
          {
            id: this.generateGoalId(),
            description:
              "Maintain blood glucose levels within target range (80-130 mg/dL pre-meal)",
            targetDate: this.addDays(new Date(), 30)
              .toISOString()
              .split("T")[0],
            priority: "high",
            measurableOutcomes: [
              "HbA1c < 7%",
              "Fasting glucose 80-130 mg/dL",
              "Post-meal glucose < 180 mg/dL",
            ],
            progress: 0,
            status: "not_started",
          },
          {
            id: this.generateGoalId(),
            description: "Demonstrate proper self-monitoring of blood glucose",
            targetDate: this.addDays(new Date(), 14)
              .toISOString()
              .split("T")[0],
            priority: "medium",
            measurableOutcomes: [
              "Accurate technique demonstration",
              "Daily glucose logging",
              "Recognition of abnormal values",
            ],
            progress: 0,
            status: "not_started",
          },
        ],
        standardInterventions: [
          {
            id: this.generateInterventionId(),
            type: "Education",
            description:
              "Diabetes self-management education including diet, exercise, and medication compliance",
            frequency: "Weekly sessions x 4 weeks",
            duration: "1 hour per session",
            status: "planned",
          },
          {
            id: this.generateInterventionId(),
            type: "Monitoring",
            description: "Blood glucose monitoring and documentation",
            frequency: "4 times daily",
            duration: "Ongoing",
            status: "planned",
          },
        ],
        evidenceBase: [
          "ADA Standards of Medical Care",
          "AACE Clinical Practice Guidelines",
        ],
      },
      Hypertension: {
        defaultPriority: "high",
        standardGoals: [
          {
            id: this.generateGoalId(),
            description: "Achieve and maintain blood pressure < 130/80 mmHg",
            targetDate: this.addDays(new Date(), 60)
              .toISOString()
              .split("T")[0],
            priority: "high",
            measurableOutcomes: [
              "Systolic BP < 130 mmHg",
              "Diastolic BP < 80 mmHg",
              "Consistent readings over 2 weeks",
            ],
            progress: 0,
            status: "not_started",
          },
        ],
        standardInterventions: [
          {
            id: this.generateInterventionId(),
            type: "Lifestyle Modification",
            description:
              "DASH diet education and sodium restriction counseling",
            frequency: "Bi-weekly",
            duration: "30 minutes",
            status: "planned",
          },
        ],
        evidenceBase: ["AHA/ACC Hypertension Guidelines", "JNC 8 Guidelines"],
      },
      "Heart Failure": {
        defaultPriority: "critical",
        standardGoals: [
          {
            id: this.generateGoalId(),
            description: "Maintain fluid balance and prevent exacerbations",
            targetDate: this.addDays(new Date(), 30)
              .toISOString()
              .split("T")[0],
            priority: "critical",
            measurableOutcomes: [
              "Daily weight stable ±2 lbs",
              "No peripheral edema",
              "Clear lung sounds",
            ],
            progress: 0,
            status: "not_started",
          },
        ],
        standardInterventions: [
          {
            id: this.generateInterventionId(),
            type: "Monitoring",
            description:
              "Daily weight monitoring and fluid intake/output tracking",
            frequency: "Daily",
            duration: "Ongoing",
            status: "planned",
          },
        ],
        evidenceBase: [
          "AHA Heart Failure Guidelines",
          "HFSA Comprehensive Heart Failure Practice Guideline",
        ],
      },
    };

    return (
      templates[diagnosis] ||
      templates["General Care"] || {
        defaultPriority: "medium",
        standardGoals: this.getStandardGoals("General Care"),
        standardInterventions: this.getStandardInterventions("General Care"),
        evidenceBase: ["Evidence-Based Nursing Practice Guidelines"],
      }
    );
  }

  // Get standard goals for diagnosis
  getStandardGoals(diagnosis) {
    return [
      {
        id: this.generateGoalId(),
        description: `Improve overall health status related to ${diagnosis}`,
        targetDate: this.addDays(new Date(), 30).toISOString().split("T")[0],
        priority: "medium",
        measurableOutcomes: [
          "Improved symptom management",
          "Enhanced quality of life",
          "Increased knowledge of condition",
        ],
        progress: 0,
        status: "not_started",
      },
    ];
  }

  // Get standard interventions for diagnosis
  getStandardInterventions(diagnosis) {
    return [
      {
        id: this.generateInterventionId(),
        type: "Education",
        description: `Patient education regarding ${diagnosis} management`,
        frequency: "As needed",
        duration: "30 minutes",
        status: "planned",
      },
      {
        id: this.generateInterventionId(),
        type: "Assessment",
        description: `Regular assessment of ${diagnosis} symptoms and progression`,
        frequency: "Daily",
        duration: "15 minutes",
        status: "planned",
      },
    ];
  }

  // Helper methods
  determinePriority(diagnoses, aiPriority) {
    const criticalConditions = [
      "Heart Failure",
      "Myocardial Infarction",
      "Stroke",
      "Sepsis",
    ];
    const highPriorityConditions = [
      "Diabetes",
      "Hypertension",
      "COPD",
      "Pneumonia",
    ];

    for (const diagnosis of diagnoses) {
      if (
        criticalConditions.some((condition) =>
          diagnosis.toLowerCase().includes(condition.toLowerCase())
        )
      ) {
        return "critical";
      }
      if (
        highPriorityConditions.some((condition) =>
          diagnosis.toLowerCase().includes(condition.toLowerCase())
        )
      ) {
        return "high";
      }
    }

    return aiPriority || "medium";
  }

  calculateTargetEndDate(diagnoses, estimatedDuration) {
    const days =
      estimatedDuration || this.getEstimatedDurationByDiagnosis(diagnoses);
    return this.addDays(new Date(), days).toISOString().split("T")[0];
  }

  getEstimatedDurationByDiagnosis(diagnoses) {
    const durationMap = {
      Diabetes: 90,
      Hypertension: 60,
      "Heart Failure": 45,
      COPD: 60,
      Pneumonia: 21,
      Stroke: 120,
    };

    for (const diagnosis of diagnoses) {
      for (const [condition, duration] of Object.entries(durationMap)) {
        if (diagnosis.toLowerCase().includes(condition.toLowerCase())) {
          return duration;
        }
      }
    }

    return 30; // Default 30 days
  }

  enhanceGoals(aiGoals, diagnoses) {
    return aiGoals.map((goal) => ({
      ...goal,
      id: goal.id || this.generateGoalId(),
      evidenceBase: this.getGoalEvidenceBase(goal.description, diagnoses),
      clinicalRationale: this.getGoalRationale(goal.description, diagnoses),
    }));
  }

  enhanceInterventions(aiInterventions, diagnoses) {
    return aiInterventions.map((intervention) => ({
      ...intervention,
      id: intervention.id || this.generateInterventionId(),
      evidenceBase: this.getInterventionEvidenceBase(
        intervention.type,
        diagnoses
      ),
      clinicalRationale: this.getInterventionRationale(
        intervention.type,
        diagnoses
      ),
    }));
  }

  getGoalEvidenceBase(goalDescription, diagnoses) {
    // Return relevant evidence base for the goal
    return ["Evidence-Based Nursing Practice", "Clinical Practice Guidelines"];
  }

  getGoalRationale(goalDescription, diagnoses) {
    return `Goal established based on evidence-based practice for ${diagnoses.join(
      ", "
    )}`;
  }

  getInterventionEvidenceBase(interventionType, diagnoses) {
    return ["Evidence-Based Nursing Interventions", "Clinical Best Practices"];
  }

  getInterventionRationale(interventionType, diagnoses) {
    return `Intervention selected based on clinical evidence for ${diagnoses.join(
      ", "
    )}`;
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Get patient clinical data (placeholder - integrate with your patient data service)
  async getPatientClinicalData(patientId) {
    try {
      // This would integrate with your actual patient data service
      // For now, return empty object
      return {};
    } catch (error) {
      this.logError("Error retrieving patient clinical data", error, {
        patientId,
      });
      return {};
    }
  }
}

export default new CarePlansService();
