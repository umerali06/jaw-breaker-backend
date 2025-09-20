import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";
import { ClinicalAIEngine } from "./ClinicalAIEngine.js";
import crypto from "crypto";

// Custom error classes for Clinical Decision Support Service
class ClinicalDecisionSupportServiceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "ClinicalDecisionSupportServiceError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
  }

  determineSeverity(code) {
    const criticalCodes = [
      "CLINICAL_DECISION_FAILURE",
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

// Input validation class for clinical decision support
class ClinicalDecisionSupportValidator {
  static validatePatientData(data, context = {}) {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push("Patient data is required");
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!data.patientId) {
      errors.push("Patient ID is required");
    }

    if (!data.userId) {
      errors.push("User ID is required");
    }

    // Clinical data validation
    if (data.assessments) {
      const assessmentsValidation = this.validateAssessments(data.assessments);
      errors.push(...assessmentsValidation.errors);
      warnings.push(...assessmentsValidation.warnings);
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

    // Medications validation
    if (data.medications && Array.isArray(data.medications)) {
      for (let i = 0; i < data.medications.length; i++) {
        const medicationValidation = this.validateMedication(
          data.medications[i]
        );
        if (!medicationValidation.isValid) {
          errors.push(
            `Medication ${i + 1}: ${medicationValidation.errors.join(", ")}`
          );
        }
        warnings.push(...medicationValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateAssessments(assessments) {
    const errors = [];
    const warnings = [];

    if (typeof assessments !== "object") {
      errors.push("Assessments must be an object");
      return { errors, warnings };
    }

    // Validate common assessment scores
    const validAssessments = ["morse", "braden", "mmse", "pain", "nutrition"];

    for (const [key, value] of Object.entries(assessments)) {
      if (!validAssessments.includes(key)) {
        warnings.push(`Unknown assessment type: ${key}`);
        continue;
      }

      if (typeof value !== "number" || value < 0) {
        errors.push(`${key} score must be a positive number`);
      }

      // Range validation for specific assessments
      switch (key) {
        case "morse":
          if (value > 125) {
            warnings.push(
              `Morse score ${value} is outside normal range (0-125)`
            );
          }
          break;
        case "braden":
          if (value < 6 || value > 23) {
            warnings.push(
              `Braden score ${value} is outside normal range (6-23)`
            );
          }
          break;
        case "mmse":
          if (value > 30) {
            warnings.push(`MMSE score ${value} is outside normal range (0-30)`);
          }
          break;
      }
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

    if (
      riskFactor.probability &&
      (typeof riskFactor.probability !== "number" ||
        riskFactor.probability < 0 ||
        riskFactor.probability > 1)
    ) {
      errors.push("Risk factor probability must be a number between 0 and 1");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateMedication(medication) {
    const errors = [];
    const warnings = [];

    if (!medication.name) {
      errors.push("Medication name is required");
    }

    if (!medication.dosage) {
      errors.push("Medication dosage is required");
    }

    if (medication.frequency && typeof medication.frequency !== "string") {
      errors.push("Medication frequency must be a string");
    }

    if (
      medication.riskLevel &&
      !["low", "medium", "high", "critical"].includes(medication.riskLevel)
    ) {
      errors.push("Invalid medication risk level");
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

  static isValidClinicalContext(context) {
    if (!context) return false;

    const validContexts = [
      "emergency",
      "routine",
      "followup",
      "assessment",
      "intervention",
    ];
    return validContexts.includes(context.type);
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
 * Clinical Decision Support Service
 * Implements evidence-based recommendation engine, clinical guideline integration,
 * real-time alert and notification system, and risk assessment algorithms
 */
export class ClinicalDecisionSupportService {
  constructor() {
    this.eventManager = new EventManager();
    this.cache = new NursingCacheService();
    this.clinicalAI = new ClinicalAIEngine();

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.CLINICAL_DECISION_AI_PROVIDER || "azure-openai",
      rateLimit: {
        maxRequests:
          parseInt(process.env.CLINICAL_DECISION_RATE_LIMIT_MAX_REQUESTS) ||
          100,
        windowMs:
          parseInt(process.env.CLINICAL_DECISION_RATE_LIMIT_WINDOW_MS) || 60000,
      },
      cache: {
        ttl: parseInt(process.env.CLINICAL_DECISION_CACHE_TTL) || 300000, // 5 minutes
        maxSize: parseInt(process.env.CLINICAL_DECISION_CACHE_MAX_SIZE) || 1000,
      },
      circuitBreaker: {
        threshold:
          parseInt(process.env.CLINICAL_DECISION_CIRCUIT_BREAKER_THRESHOLD) ||
          5,
        timeout:
          parseInt(process.env.CLINICAL_DECISION_CIRCUIT_BREAKER_TIMEOUT) ||
          60000,
      },
      retries: {
        maxAttempts:
          parseInt(process.env.CLINICAL_DECISION_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay:
          parseInt(process.env.CLINICAL_DECISION_RETRY_BACKOFF_DELAY) || 1000,
      },
    };

    // Clinical guidelines database
    this.clinicalGuidelines = {
      fallPrevention: {
        name: "Fall Prevention Guidelines",
        version: "2024.1",
        source: "Joint Commission",
        recommendations: [
          {
            condition: "morse_score >= 45",
            recommendation: "Implement comprehensive fall prevention protocol",
            evidence: "Level A - Reduces fall incidents by 40%",
            urgency: "immediate",
            interventions: [
              "bed_alarm",
              "hourly_rounding",
              "mobility_assistance",
            ],
          },
          {
            condition: "morse_score >= 25 && morse_score < 45",
            recommendation: "Implement moderate fall prevention measures",
            evidence: "Level B - Reduces fall risk by 25%",
            urgency: "high",
            interventions: ["safety_education", "environmental_modifications"],
          },
        ],
      },
      medicationSafety: {
        name: "Medication Safety Guidelines",
        version: "2024.1",
        source: "ISMP",
        recommendations: [
          {
            condition: "medication_count >= 5",
            recommendation: "Conduct comprehensive medication review",
            evidence: "Level A - Reduces adverse drug events by 30%",
            urgency: "high",
            interventions: ["pharmacist_review", "drug_interaction_screening"],
          },
          {
            condition: "high_risk_medications > 0",
            recommendation: "Enhanced monitoring for high-risk medications",
            evidence: "Level A - Prevents serious adverse events",
            urgency: "immediate",
            interventions: ["frequent_monitoring", "dose_adjustment"],
          },
        ],
      },
      cognitiveAssessment: {
        name: "Cognitive Assessment Guidelines",
        version: "2024.1",
        source: "Alzheimer's Association",
        recommendations: [
          {
            condition: "mmse_score < 24",
            recommendation: "Comprehensive cognitive evaluation",
            evidence: "Level A - Early intervention improves outcomes",
            urgency: "high",
            interventions: ["neuropsychological_testing", "family_education"],
          },
          {
            condition: "mmse_score < 18",
            recommendation: "Immediate cognitive support and safety measures",
            evidence: "Level A - Prevents safety incidents",
            urgency: "immediate",
            interventions: ["safety_supervision", "cognitive_stimulation"],
          },
        ],
      },
    };

    // Risk assessment algorithms
    this.riskAlgorithms = {
      fallRisk: this.calculateFallRisk.bind(this),
      medicationRisk: this.calculateMedicationRisk.bind(this),
      cognitiveRisk: this.calculateCognitiveRisk.bind(this),
      deteriorationRisk: this.calculateDeteriorationRisk.bind(this),
      infectionRisk: this.calculateInfectionRisk.bind(this),
    };

    // Alert thresholds
    this.alertThresholds = {
      critical: 90,
      high: 75,
      moderate: 50,
      low: 25,
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
    return `clinical_decision_${Date.now()}_${crypto
      .randomBytes(8)
      .toString("hex")}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      service: "ClinicalDecisionSupportService",
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
      service: "ClinicalDecisionSupportService",
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
    const validation = ClinicalDecisionSupportValidator.validatePatientData(
      data,
      context
    );
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(
        `Validation failed: ${validation.errors.join(", ")}`,
        "patientData"
      );
    }

    if (validation.warnings.length > 0) {
      this.logInfo(
        `Validation warnings: ${validation.warnings.join(", ")}`,
        context
      );
    }

    if (context.userId) {
      ClinicalDecisionSupportValidator.validateUserId(context.userId, context);
    }

    if (context.patientId) {
      ClinicalDecisionSupportValidator.validatePatientId(
        context.patientId,
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
        service: "ClinicalDecisionSupportService",
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
        service: "ClinicalDecisionSupportService",
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
      clinicalGuidelines: Object.keys(this.clinicalGuidelines).length,
      riskAlgorithms: Object.keys(this.riskAlgorithms).length,
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
        service: "ClinicalDecisionSupportService",
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
        service: "ClinicalDecisionSupportService",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        error: error.message,
      };
    }
  }

  /**
   * Generate evidence-based recommendations
   */
  async generateEvidenceBasedRecommendations(
    patientData,
    clinicalContext = {}
  ) {
    try {
      const recommendations = [];
      const alerts = [];

      // Process each clinical guideline
      for (const [guidelineType, guideline] of Object.entries(
        this.clinicalGuidelines
      )) {
        const guidelineRecommendations = await this.processGuideline(
          guideline,
          patientData,
          clinicalContext
        );

        recommendations.push(...guidelineRecommendations.recommendations);
        alerts.push(...guidelineRecommendations.alerts);
      }

      // Apply AI-powered enhancement
      const enhancedRecommendations = await this.enhanceWithAI(
        recommendations,
        patientData,
        clinicalContext
      );

      // Prioritize recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(
        enhancedRecommendations
      );

      return {
        success: true,
        recommendations: prioritizedRecommendations,
        alerts,
        evidenceLevel: "high",
        guidelinesApplied: Object.keys(this.clinicalGuidelines),
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error generating evidence-based recommendations:", error);
      return {
        success: false,
        error: error.message,
        recommendations: [],
        alerts: [],
      };
    }
  }

  /**
   * Integrate clinical guidelines
   */
  async integrateClinicalguidelines(guidelineData, patientData) {
    try {
      const applicableGuidelines = [];
      const recommendations = [];

      // Evaluate each guideline against patient data
      for (const [type, guideline] of Object.entries(this.clinicalGuidelines)) {
        const evaluation = await this.evaluateGuideline(guideline, patientData);

        if (evaluation.applicable) {
          applicableGuidelines.push({
            type,
            guideline: guideline.name,
            version: guideline.version,
            source: guideline.source,
            applicabilityScore: evaluation.score,
            triggeredRecommendations: evaluation.recommendations,
          });

          recommendations.push(...evaluation.recommendations);
        }
      }

      // Create integration summary
      const integration = {
        totalGuidelines: Object.keys(this.clinicalGuidelines).length,
        applicableGuidelines: applicableGuidelines.length,
        totalRecommendations: recommendations.length,
        highPriorityRecommendations: recommendations.filter(
          (r) => r.urgency === "immediate"
        ).length,
        evidenceQuality: this.assessEvidenceQuality(recommendations),
      };

      return {
        success: true,
        applicableGuidelines,
        recommendations,
        integration,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error integrating clinical guidelines:", error);
      return {
        success: false,
        error: error.message,
        applicableGuidelines: [],
        recommendations: [],
      };
    }
  }

  /**
   * Real-time alert and notification system
   */
  async generateRealTimeAlerts(
    patientData,
    triggerEvent = "assessment_update"
  ) {
    try {
      const alerts = [];
      const notifications = [];

      // Run risk assessments
      const riskAssessments = await this.performRiskAssessments(patientData);

      // Generate alerts based on risk levels
      for (const [riskType, assessment] of Object.entries(riskAssessments)) {
        if (assessment.riskScore >= this.alertThresholds.critical) {
          alerts.push({
            id: `alert_${Date.now()}_${riskType}`,
            type: "critical",
            category: riskType,
            message: `Critical ${riskType} detected`,
            riskScore: assessment.riskScore,
            urgency: "immediate",
            actions: assessment.recommendedActions,
            timestamp: new Date(),
            acknowledged: false,
          });
        } else if (assessment.riskScore >= this.alertThresholds.high) {
          alerts.push({
            id: `alert_${Date.now()}_${riskType}`,
            type: "high",
            category: riskType,
            message: `High ${riskType} identified`,
            riskScore: assessment.riskScore,
            urgency: "high",
            actions: assessment.recommendedActions,
            timestamp: new Date(),
            acknowledged: false,
          });
        }
      }

      // Generate notifications for care team
      if (alerts.length > 0) {
        notifications.push(
          ...this.generateCareTeamNotifications(alerts, patientData)
        );
      }

      // Emit real-time events
      this.eventManager.emit("clinical_alerts_generated", {
        patientId: patientData.patientId,
        alerts,
        notifications,
        triggerEvent,
        timestamp: new Date(),
      });

      return {
        success: true,
        alerts,
        notifications,
        riskAssessments,
        alertsSummary: {
          critical: alerts.filter((a) => a.type === "critical").length,
          high: alerts.filter((a) => a.type === "high").length,
          total: alerts.length,
        },
      };
    } catch (error) {
      console.error("Error generating real-time alerts:", error);
      return {
        success: false,
        error: error.message,
        alerts: [],
        notifications: [],
      };
    }
  }

  /**
   * Risk assessment algorithms
   */
  async performRiskAssessments(patientData) {
    try {
      const assessments = {};

      // Run all risk assessment algorithms
      for (const [riskType, algorithm] of Object.entries(this.riskAlgorithms)) {
        assessments[riskType] = await algorithm(patientData);
      }

      return assessments;
    } catch (error) {
      console.error("Error performing risk assessments:", error);
      return {};
    }
  }

  // Risk Assessment Algorithm Implementations

  async calculateFallRisk(patientData) {
    let riskScore = 0;
    const riskFactors = [];
    const recommendedActions = [];

    // Morse Fall Scale factors
    if (patientData.morseScore) {
      riskScore = patientData.morseScore;
    } else {
      // Calculate from individual factors
      if (patientData.historyOfFalls) {
        riskScore += 25;
        riskFactors.push("History of falls");
      }
      if (patientData.secondaryDiagnosis) {
        riskScore += 15;
        riskFactors.push("Secondary diagnosis");
      }
      if (patientData.ambulatoryAid) {
        riskScore += patientData.ambulatoryAid === "furniture" ? 30 : 15;
        riskFactors.push("Ambulatory aid dependency");
      }
      if (patientData.ivTherapy) {
        riskScore += 20;
        riskFactors.push("IV therapy");
      }
      if (patientData.gaitImpairment) {
        riskScore += patientData.gaitImpairment === "impaired" ? 20 : 10;
        riskFactors.push("Gait impairment");
      }
      if (patientData.mentalStatusImpaired) {
        riskScore += 15;
        riskFactors.push("Mental status impairment");
      }
    }

    // Additional risk factors
    if (patientData.age >= 75) {
      riskScore += 5;
      riskFactors.push("Advanced age");
    }
    if (patientData.medicationCount >= 5) {
      riskScore += 10;
      riskFactors.push("Polypharmacy");
    }

    // Determine risk level and actions
    let riskLevel = "low";
    if (riskScore >= 45) {
      riskLevel = "high";
      recommendedActions.push(
        "Implement comprehensive fall prevention protocol"
      );
      recommendedActions.push("Bed alarm activation");
      recommendedActions.push("Hourly safety rounds");
    } else if (riskScore >= 25) {
      riskLevel = "moderate";
      recommendedActions.push("Fall prevention education");
      recommendedActions.push("Environmental safety assessment");
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendedActions,
      algorithm: "Morse Fall Scale Enhanced",
      confidence: 0.92,
    };
  }

  async calculateMedicationRisk(patientData) {
    let riskScore = 0;
    const riskFactors = [];
    const recommendedActions = [];

    // Medication count risk
    if (patientData.medicationCount >= 10) {
      riskScore += 40;
      riskFactors.push("High medication count (10+)");
    } else if (patientData.medicationCount >= 5) {
      riskScore += 25;
      riskFactors.push("Moderate medication count (5-9)");
    }

    // High-risk medications
    if (patientData.highRiskMedications > 0) {
      riskScore += 30;
      riskFactors.push("High-risk medications present");
    }

    // Drug interactions
    if (patientData.drugInteractions > 0) {
      riskScore += 25;
      riskFactors.push("Drug interactions identified");
    }

    // Age-related risk
    if (patientData.age >= 75) {
      riskScore += 15;
      riskFactors.push("Advanced age medication sensitivity");
    }

    // Renal function
    if (patientData.renalFunction === "impaired") {
      riskScore += 20;
      riskFactors.push("Impaired renal function");
    }

    // Determine risk level and actions
    let riskLevel = "low";
    if (riskScore >= 75) {
      riskLevel = "high";
      recommendedActions.push("Immediate pharmacist consultation");
      recommendedActions.push("Comprehensive medication review");
      recommendedActions.push("Enhanced monitoring protocol");
    } else if (riskScore >= 50) {
      riskLevel = "moderate";
      recommendedActions.push("Medication reconciliation");
      recommendedActions.push("Drug interaction screening");
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendedActions,
      algorithm: "Medication Risk Assessment",
      confidence: 0.88,
    };
  }

  async calculateCognitiveRisk(patientData) {
    let riskScore = 0;
    const riskFactors = [];
    const recommendedActions = [];

    // MMSE score
    if (patientData.mmseScore !== undefined) {
      if (patientData.mmseScore < 18) {
        riskScore += 80;
        riskFactors.push("Severe cognitive impairment (MMSE < 18)");
      } else if (patientData.mmseScore < 24) {
        riskScore += 60;
        riskFactors.push("Mild cognitive impairment (MMSE < 24)");
      }
    }

    // Age factor
    if (patientData.age >= 80) {
      riskScore += 20;
      riskFactors.push("Advanced age cognitive risk");
    }

    // Medication effects
    if (patientData.cognitionAffectingMeds > 0) {
      riskScore += 15;
      riskFactors.push("Medications affecting cognition");
    }

    // Determine risk level and actions
    let riskLevel = "low";
    if (riskScore >= 70) {
      riskLevel = "high";
      recommendedActions.push("Comprehensive cognitive evaluation");
      recommendedActions.push("Safety supervision implementation");
      recommendedActions.push("Family education and support");
    } else if (riskScore >= 40) {
      riskLevel = "moderate";
      recommendedActions.push("Cognitive screening");
      recommendedActions.push("Environmental modifications");
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendedActions,
      algorithm: "Cognitive Risk Assessment",
      confidence: 0.85,
    };
  }

  async calculateDeteriorationRisk(patientData) {
    let riskScore = 0;
    const riskFactors = [];
    const recommendedActions = [];

    // Vital signs trends
    if (patientData.vitalSignsTrend === "deteriorating") {
      riskScore += 40;
      riskFactors.push("Deteriorating vital signs");
    }

    // Laboratory values
    if (patientData.abnormalLabValues > 2) {
      riskScore += 30;
      riskFactors.push("Multiple abnormal lab values");
    }

    // Functional decline
    if (patientData.functionalDecline) {
      riskScore += 25;
      riskFactors.push("Functional status decline");
    }

    // Determine risk level and actions
    let riskLevel = "low";
    if (riskScore >= 60) {
      riskLevel = "high";
      recommendedActions.push("Immediate physician notification");
      recommendedActions.push("Enhanced monitoring");
      recommendedActions.push("Consider rapid response team");
    } else if (riskScore >= 35) {
      riskLevel = "moderate";
      recommendedActions.push("Increased monitoring frequency");
      recommendedActions.push("Physician notification");
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendedActions,
      algorithm: "Clinical Deterioration Risk",
      confidence: 0.9,
    };
  }

  async calculateInfectionRisk(patientData) {
    let riskScore = 0;
    const riskFactors = [];
    const recommendedActions = [];

    // Invasive devices
    if (patientData.invasiveDevices > 0) {
      riskScore += 30;
      riskFactors.push("Invasive devices present");
    }

    // Immunocompromised status
    if (patientData.immunocompromised) {
      riskScore += 35;
      riskFactors.push("Immunocompromised status");
    }

    // Recent surgery
    if (patientData.recentSurgery) {
      riskScore += 25;
      riskFactors.push("Recent surgical procedure");
    }

    // Determine risk level and actions
    let riskLevel = "low";
    if (riskScore >= 60) {
      riskLevel = "high";
      recommendedActions.push("Enhanced infection control measures");
      recommendedActions.push("Frequent monitoring for signs of infection");
      recommendedActions.push("Consider prophylactic measures");
    } else if (riskScore >= 35) {
      riskLevel = "moderate";
      recommendedActions.push("Standard infection control precautions");
      recommendedActions.push("Monitor for infection signs");
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendedActions,
      algorithm: "Infection Risk Assessment",
      confidence: 0.87,
    };
  }

  // Generate recommendations (alias for generateEvidenceBasedRecommendations)
  async generateRecommendations(patientData, clinicalContext = {}) {
    return this.generateEvidenceBasedRecommendations(
      patientData,
      clinicalContext
    );
  }

  // Check guidelines compliance and applicability
  async checkGuidelines(patientData, guidelineTypes = null) {
    try {
      const guidelineResults = {};
      const overallCompliance = {
        compliant: 0,
        nonCompliant: 0,
        notApplicable: 0,
        total: 0,
      };

      // Determine which guidelines to check
      const guidelinesToCheck = guidelineTypes
        ? Object.entries(this.clinicalGuidelines).filter(([type]) =>
            guidelineTypes.includes(type)
          )
        : Object.entries(this.clinicalGuidelines);

      for (const [guidelineType, guideline] of guidelinesToCheck) {
        const guidelineResult = await this.evaluateGuideline(
          guideline,
          patientData
        );

        // Determine compliance status
        let complianceStatus = "not_applicable";
        if (guidelineResult.applicable) {
          // Check if current care meets guideline recommendations
          const currentCareCompliance = await this.assessCurrentCareCompliance(
            guideline,
            patientData
          );
          complianceStatus = currentCareCompliance.compliant
            ? "compliant"
            : "non_compliant";
        }

        guidelineResults[guidelineType] = {
          guideline: guideline.name,
          version: guideline.version,
          source: guideline.source,
          applicable: guidelineResult.applicable,
          complianceStatus,
          score: guidelineResult.score,
          recommendations: guidelineResult.recommendations,
          gaps:
            complianceStatus === "non_compliant"
              ? await this.identifyComplianceGaps(guideline, patientData)
              : [],
          lastChecked: new Date(),
        };

        // Update overall compliance metrics
        overallCompliance.total++;
        if (complianceStatus === "compliant") {
          overallCompliance.compliant++;
        } else if (complianceStatus === "non_compliant") {
          overallCompliance.nonCompliant++;
        } else {
          overallCompliance.notApplicable++;
        }
      }

      // Calculate compliance percentage
      const applicableGuidelines =
        overallCompliance.total - overallCompliance.notApplicable;
      const compliancePercentage =
        applicableGuidelines > 0
          ? (overallCompliance.compliant / applicableGuidelines) * 100
          : 100;

      return {
        success: true,
        overallCompliance: {
          ...overallCompliance,
          percentage: compliancePercentage,
          status:
            compliancePercentage >= 90
              ? "excellent"
              : compliancePercentage >= 75
              ? "good"
              : compliancePercentage >= 50
              ? "fair"
              : "poor",
        },
        guidelines: guidelineResults,
        checkedAt: new Date(),
        patientId: patientData.patientId,
      };
    } catch (error) {
      console.error("Error checking guidelines:", error);
      return {
        success: false,
        error: error.message,
        guidelines: null,
      };
    }
  }

  // Assess risk using multiple algorithms
  async assessRisk(patientData, riskTypes = null) {
    try {
      const riskAssessments = {};
      const overallRisk = {
        highRisk: 0,
        moderateRisk: 0,
        lowRisk: 0,
        total: 0,
        criticalAlerts: [],
      };

      // Determine which risk assessments to perform
      const risksToAssess = riskTypes
        ? Object.entries(this.riskAlgorithms).filter(([type]) =>
            riskTypes.includes(type)
          )
        : Object.entries(this.riskAlgorithms);

      for (const [riskType, riskAlgorithm] of risksToAssess) {
        const riskResult = await riskAlgorithm(patientData);

        // Standardize risk result format
        const standardizedResult = {
          riskType,
          riskScore: riskResult.riskScore || 0,
          riskLevel: riskResult.riskLevel || "low",
          riskFactors: riskResult.riskFactors || [],
          recommendedActions: riskResult.recommendedActions || [],
          algorithm: riskResult.algorithm || `${riskType} Assessment`,
          confidence: riskResult.confidence || 0.8,
          assessedAt: new Date(),
          nextAssessment: this.calculateNextAssessmentDate(
            riskResult.riskLevel
          ),
        };

        riskAssessments[riskType] = standardizedResult;

        // Update overall risk metrics
        overallRisk.total++;
        if (
          standardizedResult.riskLevel === "high" ||
          standardizedResult.riskScore >= 75
        ) {
          overallRisk.highRisk++;
          if (standardizedResult.riskScore >= 90) {
            overallRisk.criticalAlerts.push({
              riskType,
              message: `Critical ${riskType} risk detected`,
              score: standardizedResult.riskScore,
              urgency: "immediate",
            });
          }
        } else if (
          standardizedResult.riskLevel === "moderate" ||
          standardizedResult.riskScore >= 50
        ) {
          overallRisk.moderateRisk++;
        } else {
          overallRisk.lowRisk++;
        }
      }

      // Calculate composite risk score
      const riskScores = Object.values(riskAssessments).map((r) => r.riskScore);
      const compositeRiskScore =
        riskScores.length > 0
          ? riskScores.reduce((sum, score) => sum + score, 0) /
            riskScores.length
          : 0;

      // Determine overall risk level
      let overallRiskLevel = "low";
      if (compositeRiskScore >= 75 || overallRisk.highRisk > 0) {
        overallRiskLevel = "high";
      } else if (compositeRiskScore >= 50 || overallRisk.moderateRisk > 0) {
        overallRiskLevel = "moderate";
      }

      // Generate risk-based recommendations
      const riskRecommendations = await this.generateRiskBasedRecommendations(
        riskAssessments,
        overallRiskLevel
      );

      // Create care team notifications for high-risk patients
      const notifications =
        overallRisk.criticalAlerts.length > 0
          ? this.generateCareTeamNotifications(
              overallRisk.criticalAlerts,
              patientData
            )
          : [];

      return {
        success: true,
        overallRisk: {
          ...overallRisk,
          level: overallRiskLevel,
          compositeScore: compositeRiskScore,
          status:
            overallRiskLevel === "high"
              ? "requires_immediate_attention"
              : overallRiskLevel === "moderate"
              ? "requires_monitoring"
              : "stable",
        },
        riskAssessments,
        recommendations: riskRecommendations,
        notifications,
        assessedAt: new Date(),
        patientId: patientData.patientId,
      };
    } catch (error) {
      console.error("Error assessing risk:", error);
      return {
        success: false,
        error: error.message,
        riskAssessments: null,
      };
    }
  }

  // Helper method to assess current care compliance
  async assessCurrentCareCompliance(guideline, patientData) {
    // This would integrate with the patient's current care plan
    // For now, return a simplified assessment
    const currentInterventions = patientData.currentInterventions || [];
    const requiredInterventions = guideline.recommendations.flatMap(
      (rec) => rec.interventions || []
    );

    const implementedCount = requiredInterventions.filter((intervention) =>
      currentInterventions.includes(intervention)
    ).length;

    const complianceRate =
      requiredInterventions.length > 0
        ? implementedCount / requiredInterventions.length
        : 1;

    return {
      compliant: complianceRate >= 0.8, // 80% compliance threshold
      complianceRate,
      implementedInterventions: implementedCount,
      requiredInterventions: requiredInterventions.length,
    };
  }

  // Helper method to identify compliance gaps
  async identifyComplianceGaps(guideline, patientData) {
    const gaps = [];
    const currentInterventions = patientData.currentInterventions || [];

    for (const recommendation of guideline.recommendations) {
      const applicable = await this.evaluateCondition(
        recommendation.condition,
        patientData
      );
      if (applicable) {
        const missingInterventions = (
          recommendation.interventions || []
        ).filter(
          (intervention) => !currentInterventions.includes(intervention)
        );

        if (missingInterventions.length > 0) {
          gaps.push({
            recommendation: recommendation.recommendation,
            missingInterventions,
            urgency: recommendation.urgency,
            evidence: recommendation.evidence,
          });
        }
      }
    }

    return gaps;
  }

  // Helper method to calculate next assessment date
  calculateNextAssessmentDate(riskLevel) {
    const now = new Date();
    const nextAssessment = new Date(now);

    switch (riskLevel) {
      case "high":
        nextAssessment.setHours(now.getHours() + 4); // Every 4 hours
        break;
      case "moderate":
        nextAssessment.setHours(now.getHours() + 12); // Every 12 hours
        break;
      default:
        nextAssessment.setDate(now.getDate() + 1); // Daily
    }

    return nextAssessment;
  }

  // Helper method to generate risk-based recommendations
  async generateRiskBasedRecommendations(riskAssessments, overallRiskLevel) {
    const recommendations = [];

    for (const [riskType, assessment] of Object.entries(riskAssessments)) {
      if (assessment.riskLevel === "high") {
        recommendations.push({
          id: `risk_rec_${Date.now()}_${riskType}`,
          type: "risk_mitigation",
          riskType,
          priority: "high",
          recommendations: assessment.recommendedActions,
          rationale: `High ${riskType} risk detected (score: ${assessment.riskScore})`,
          timeframe: "immediate",
        });
      }
    }

    // Add overall recommendations based on composite risk
    if (overallRiskLevel === "high") {
      recommendations.push({
        id: `overall_risk_rec_${Date.now()}`,
        type: "comprehensive_care",
        priority: "high",
        recommendations: [
          "Increase monitoring frequency",
          "Consider multidisciplinary team consultation",
          "Review and update care plan",
          "Implement enhanced safety measures",
        ],
        rationale: "Multiple high-risk factors identified",
        timeframe: "immediate",
      });
    }

    return recommendations;
  }

  // Helper Methods

  async processGuideline(guideline, patientData, clinicalContext) {
    const recommendations = [];
    const alerts = [];

    for (const rule of guideline.recommendations) {
      const applicable = await this.evaluateCondition(
        rule.condition,
        patientData
      );

      if (applicable) {
        recommendations.push({
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          guideline: guideline.name,
          recommendation: rule.recommendation,
          evidence: rule.evidence,
          urgency: rule.urgency,
          interventions: rule.interventions,
          source: guideline.source,
          version: guideline.version,
        });

        if (rule.urgency === "immediate") {
          alerts.push({
            type: "guideline_alert",
            message: rule.recommendation,
            urgency: rule.urgency,
            source: guideline.name,
          });
        }
      }
    }

    return { recommendations, alerts };
  }

  async evaluateCondition(condition, patientData) {
    // Simple condition evaluation (in production, use a more sophisticated parser)
    try {
      // Replace condition variables with actual data
      let evaluableCondition = condition;

      // Replace common variables
      evaluableCondition = evaluableCondition.replace(
        /morse_score/g,
        patientData.morseScore || 0
      );
      evaluableCondition = evaluableCondition.replace(
        /medication_count/g,
        patientData.medicationCount || 0
      );
      evaluableCondition = evaluableCondition.replace(
        /mmse_score/g,
        patientData.mmseScore || 30
      );
      evaluableCondition = evaluableCondition.replace(
        /high_risk_medications/g,
        patientData.highRiskMedications || 0
      );

      // Simple evaluation (in production, use a safe expression evaluator)
      return eval(evaluableCondition);
    } catch (error) {
      console.error("Error evaluating condition:", condition, error);
      return false;
    }
  }

  async evaluateGuideline(guideline, patientData) {
    let applicableCount = 0;
    const recommendations = [];

    for (const rule of guideline.recommendations) {
      const applicable = await this.evaluateCondition(
        rule.condition,
        patientData
      );
      if (applicable) {
        applicableCount++;
        recommendations.push({
          recommendation: rule.recommendation,
          evidence: rule.evidence,
          urgency: rule.urgency,
          interventions: rule.interventions,
        });
      }
    }

    return {
      applicable: applicableCount > 0,
      score: (applicableCount / guideline.recommendations.length) * 100,
      recommendations,
    };
  }

  async enhanceWithAI(recommendations, patientData, clinicalContext) {
    try {
      const aiEnhancement = await this.clinicalAI.enhanceRecommendations({
        recommendations,
        patientData,
        clinicalContext,
      });

      return recommendations.map((rec) => ({
        ...rec,
        aiConfidence: aiEnhancement.confidence || 0.8,
        aiInsights: aiEnhancement.insights || [],
        personalizedFactors: aiEnhancement.personalizedFactors || [],
      }));
    } catch (error) {
      console.error("Error enhancing recommendations with AI:", error);
      return recommendations;
    }
  }

  prioritizeRecommendations(recommendations) {
    const urgencyOrder = { immediate: 4, high: 3, moderate: 2, low: 1 };

    return recommendations.sort((a, b) => {
      const urgencyDiff =
        (urgencyOrder[b.urgency] || 1) - (urgencyOrder[a.urgency] || 1);
      if (urgencyDiff !== 0) return urgencyDiff;

      // Secondary sort by AI confidence
      return (b.aiConfidence || 0) - (a.aiConfidence || 0);
    });
  }

  generateCareTeamNotifications(alerts, patientData) {
    const notifications = [];

    // Critical alerts notify physician immediately
    const criticalAlerts = alerts.filter((a) => a.type === "critical");
    if (criticalAlerts.length > 0) {
      notifications.push({
        id: `notif_${Date.now()}_physician`,
        recipient: "physician",
        type: "immediate",
        message: `Critical alerts for patient ${patientData.patientId}`,
        alerts: criticalAlerts,
        deliveryMethod: ["sms", "email", "app_notification"],
      });
    }

    // High alerts notify nursing supervisor
    const highAlerts = alerts.filter((a) => a.type === "high");
    if (highAlerts.length > 0) {
      notifications.push({
        id: `notif_${Date.now()}_supervisor`,
        recipient: "nursing_supervisor",
        type: "urgent",
        message: `High priority alerts for patient ${patientData.patientId}`,
        alerts: highAlerts,
        deliveryMethod: ["email", "app_notification"],
      });
    }

    return notifications;
  }

  assessEvidenceQuality(recommendations) {
    const evidenceLevels = recommendations.map((r) => {
      if (r.evidence.includes("Level A")) return "high";
      if (r.evidence.includes("Level B")) return "moderate";
      if (r.evidence.includes("Level C")) return "low";
      return "expert_opinion";
    });

    const highQuality = evidenceLevels.filter((l) => l === "high").length;
    const total = evidenceLevels.length;

    return {
      overallQuality:
        highQuality / total >= 0.7
          ? "high"
          : highQuality / total >= 0.4
          ? "moderate"
          : "low",
      distribution: {
        high: evidenceLevels.filter((l) => l === "high").length,
        moderate: evidenceLevels.filter((l) => l === "moderate").length,
        low: evidenceLevels.filter((l) => l === "low").length,
        expertOpinion: evidenceLevels.filter((l) => l === "expert_opinion")
          .length,
      },
    };
  }
}

export default ClinicalDecisionSupportService;
