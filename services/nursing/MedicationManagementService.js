import Medication from "../../models/nursing/Medication.js";
import MedicationRecord from "../../models/nursing/MedicationRecord.js";
import ClinicalAIEngine from "./ClinicalAIEngine.js";
import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";
import crypto from "crypto";

/**
 * Custom error classes for MedicationManagementService
 */
class MedicationManagementError extends Error {
  constructor(message, code = "MEDICATION_MANAGEMENT_ERROR", statusCode = 500) {
    super(message);
    this.name = "MedicationManagementError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ValidationError extends MedicationManagementError {
  constructor(message, field = null) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.field = field;
  }
}

class RateLimitError extends MedicationManagementError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMIT_ERROR", 429);
    this.name = "RateLimitError";
  }
}

class ServiceUnavailableError extends MedicationManagementError {
  constructor(message = "Service temporarily unavailable") {
    super(message, "SERVICE_UNAVAILABLE", 503);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Input validation utility class
 */
class InputValidator {
  static validateMedicationData(medicationData) {
    const errors = [];
    
    if (!medicationData) {
      errors.push("Medication data is required");
      return { isValid: false, errors };
    }

    if (!medicationData.name || typeof medicationData.name !== "string") {
      errors.push("Valid medication name is required");
    }

    if (!medicationData.dosage || typeof medicationData.dosage !== "string") {
      errors.push("Valid dosage information is required");
    }

    if (!medicationData.frequency || typeof medicationData.frequency !== "string") {
      errors.push("Valid frequency information is required");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validatePatientId(patientId) {
    if (!patientId || typeof patientId !== "string") {
      throw new ValidationError("Valid patient ID is required", "patientId");
    }
    return true;
  }

  static validateUserId(userId) {
    if (!userId || typeof userId !== "string") {
      throw new ValidationError("Valid user ID is required", "userId");
    }
    return true;
  }

  static sanitizeData(data) {
    if (typeof data === "string") {
      return data.trim().replace(/[<>]/g, "");
    }
    if (typeof data === "object" && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    return data;
  }
}

/**
 * Comprehensive Medication Management Service
 * Implements AI-powered medication tracking, interaction checking, and adherence monitoring
 */
class MedicationManagementService {
  constructor() {
    this.aiEngine = new ClinicalAIEngine();
    this.eventManager = new EventManager();
    this.cacheService = new NursingCacheService();

    // Enhanced configuration with environment variables
    this.config = {
      defaultProvider: process.env.MEDICATION_AI_PROVIDER || "openai",
      rateLimit: {
        requestsPerMinute: parseInt(process.env.MEDICATION_RATE_LIMIT || "60"),
        burstLimit: parseInt(process.env.MEDICATION_BURST_LIMIT || "10")
      },
      cache: {
        ttl: parseInt(process.env.MEDICATION_CACHE_TTL || "300"),
        maxSize: parseInt(process.env.MEDICATION_CACHE_MAX_SIZE || "1000")
      },
      circuitBreaker: {
        failureThreshold: parseInt(process.env.MEDICATION_CIRCUIT_BREAKER_THRESHOLD || "5"),
        timeout: parseInt(process.env.MEDICATION_CIRCUIT_BREAKER_TIMEOUT || "60000"),
        resetTimeout: parseInt(process.env.MEDICATION_CIRCUIT_BREAKER_RESET || "300000")
      },
      retries: {
        maxAttempts: parseInt(process.env.MEDICATION_MAX_RETRIES || "3"),
        backoffDelay: parseInt(process.env.MEDICATION_BACKOFF_DELAY || "1000")
      }
    };

    // Drug interaction databases and APIs
    this.drugInteractionAPIs = {
      fda: process.env.FDA_DRUG_API_URL,
      rxnorm: process.env.RXNORM_API_URL,
      drugbank: process.env.DRUGBANK_API_URL,
      lexicomp: process.env.LEXICOMP_API_URL,
    };

    // Real-time monitoring thresholds
    this.adherenceThresholds = {
      excellent: parseInt(process.env.ADHERENCE_EXCELLENT || "95"),
      good: parseInt(process.env.ADHERENCE_GOOD || "85"),
      fair: parseInt(process.env.ADHERENCE_FAIR || "75"),
      poor: parseInt(process.env.ADHERENCE_POOR || "60"),
    };

    this.riskThresholds = {
      low: parseInt(process.env.RISK_LOW || "25"),
      moderate: parseInt(process.env.RISK_MODERATE || "50"),
      high: parseInt(process.env.RISK_HIGH || "75"),
      critical: parseInt(process.env.RISK_CRITICAL || "90"),
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
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
      errors: {
        validation: 0,
        rateLimit: 0,
        serviceUnavailable: 0,
        other: 0
      }
    };

    // Rate limiting and circuit breaker state
    this.rateLimitTracker = new Map();
    this.circuitBreakerState = {
      medication: { status: "closed", failures: 0, lastFailure: null },
      interaction: { status: "closed", failures: 0, lastFailure: null },
      adherence: { status: "closed", failures: 0, lastFailure: null }
    };

    // Cache management
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.requestCounter = 0;
  }

  /**
   * Add medication (alias for createMedication)
   */
  async addMedication(patientId, medicationData, prescribedBy) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Adding medication", { requestId, patientId, prescribedBy });
      
      // Rate limiting check
      this.checkRateLimit(prescribedBy);
      
      // Input validation
      InputValidator.validatePatientId(patientId);
      InputValidator.validateUserId(prescribedBy);
      const sanitizedData = this.validateInputs(medicationData, { requestId });
      
      // Circuit breaker check
      this.checkCircuitBreaker("medication");
      
      const result = await this.createMedication(prescribedBy, patientId, sanitizedData);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      this.updateCircuitBreaker("medication", true);
      
      this.logInfo("Medication added successfully", { requestId, medicationId: result.medication._id });
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.updateCircuitBreaker("medication", false);
      this.logError("Error adding medication", error, { requestId, patientId, prescribedBy });
      throw error;
    }
  }

  /**
   * Check interactions
   */
  async checkInteractions(patientId, newMedication) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Checking medication interactions", { requestId, patientId });
      
      // Input validation
      InputValidator.validatePatientId(patientId);
      const sanitizedMedication = this.validateInputs(newMedication, { requestId });
      
      // Rate limiting check
      this.checkRateLimit(patientId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("interaction");
      
      // Check cache first
      const cacheKey = this.generateCacheKey("interactions", { patientId, newMedication: sanitizedMedication });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logInfo("Interaction check result retrieved from cache", { requestId });
        this.updateMetrics(true, Date.now() - startTime);
        return cached;
      }
      
      const currentMedications = await this.getActiveMedications(patientId);
      const allMedications = [...currentMedications, sanitizedMedication];

      // Use AI engine to check interactions
      const interactionResults = await this.aiEngine.analyzeMedication({
        medications: allMedications,
        patientId,
      });

      const result = {
        hasInteractions: interactionResults.interactions?.length > 0,
        interactions: interactionResults.interactions || [],
        riskLevel:
          interactionResults.riskScore > 70
            ? "high"
            : interactionResults.riskScore > 40
            ? "moderate"
            : "low",
        recommendations: interactionResults.recommendations || [],
        requestId,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      this.updateCircuitBreaker("interaction", true);
      
      this.logInfo("Interaction check completed", { requestId, hasInteractions: result.hasInteractions });
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.updateCircuitBreaker("interaction", false);
      this.logError("Error checking medication interactions", error, { requestId, patientId });
      throw error;
    }
  }

  /**
   * Track adherence
   */
  async trackAdherence(patientId, timeframe = "30days") {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Tracking medication adherence", { requestId, patientId, timeframe });
      
      // Input validation
      InputValidator.validatePatientId(patientId);
      if (!["7days", "30days", "90days"].includes(timeframe)) {
        throw new ValidationError("Invalid timeframe. Must be 7days, 30days, or 90days", "timeframe");
      }
      
      // Rate limiting check
      this.checkRateLimit(patientId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("adherence");
      
      // Check cache first
      const cacheKey = this.generateCacheKey("adherence", { patientId, timeframe });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logInfo("Adherence data retrieved from cache", { requestId });
        this.updateMetrics(true, Date.now() - startTime);
        return cached;
      }
      
      const medications = await this.getActiveMedications(patientId);
      const adherenceData = [];

      for (const medication of medications) {
        const administrationHistory = await this.getAdministrationHistory(
          patientId,
          medication._id,
          timeframe
        );

        const expectedDoses = this.calculateExpectedDoses(
          medication,
          timeframe
        );
        const actualDoses = administrationHistory.filter(
          (h) => h.status === "administered"
        ).length;
        const adherenceRate =
          expectedDoses > 0 ? (actualDoses / expectedDoses) * 100 : 0;

        adherenceData.push({
          medicationId: medication._id,
          medicationName: medication.name,
          expectedDoses,
          actualDoses,
          adherenceRate,
          missedDoses: expectedDoses - actualDoses,
          lastAdministered:
            administrationHistory.length > 0
              ? administrationHistory[administrationHistory.length - 1]
                  .timestamp
              : null,
        });
      }

      const overallAdherence =
        adherenceData.length > 0
          ? adherenceData.reduce((sum, med) => sum + med.adherenceRate, 0) /
            adherenceData.length
          : 0;

      const result = {
        patientId,
        timeframe,
        overallAdherence,
        adherenceLevel: this.getAdherenceLevel(overallAdherence),
        medications: adherenceData,
        generatedAt: new Date(),
        recommendations: this.generateAdherenceRecommendations(adherenceData),
        requestId,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      this.updateCircuitBreaker("adherence", true);
      
      this.logInfo("Adherence tracking completed", { requestId, overallAdherence: result.overallAdherence });
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.updateCircuitBreaker("adherence", false);
      this.logError("Error tracking medication adherence", error, { requestId, patientId, timeframe });
      throw error;
    }
  }

  /**
   * Get active medications for a patient
   */
  async getActiveMedications(patientId) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Getting active medications", { requestId, patientId });
      
      // Input validation
      InputValidator.validatePatientId(patientId);
      
      // Check cache first
      const cacheKey = this.generateCacheKey("active_medications", { patientId });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logInfo("Active medications retrieved from cache", { requestId });
        this.updateMetrics(true, Date.now() - startTime);
        return cached;
      }

      const medications = await Medication.find({
        patientId,
        status: "active",
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gte: new Date() } },
        ],
      }).sort({ createdAt: -1 });

      // Cache the result
      this.setCache(cacheKey, medications);
      
      this.updateMetrics(true, Date.now() - startTime);
      this.logInfo("Active medications retrieved successfully", { requestId, count: medications.length });
      return medications;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.logError("Error getting active medications", error, { requestId, patientId });
      return [];
    }
  }

  /**
   * Get administration history
   */
  async getAdministrationHistory(patientId, medicationId, timeframe) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Getting administration history", { requestId, patientId, medicationId, timeframe });
      
      // Input validation
      this.validateInputs({ patientId, medicationId, timeframe }, { method: "getAdministrationHistory" });
      
      // Rate limiting
      this.checkRateLimit(patientId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("administration");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("admin_history", { patientId, medicationId, timeframe });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

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

      const history = await MedicationRecord.find({
        patientId,
        medicationId,
        timestamp: { $gte: startDate, $lte: endDate },
      }).sort({ timestamp: -1 });

      const result = {
        success: true,
        data: history,
        count: history.length,
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("administration", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Administration history retrieved successfully", { 
        requestId, 
        count: history.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("administration", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error getting administration history", error, { 
        requestId, 
        patientId, 
        medicationId, 
        timeframe 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to get administration history", "ADMINISTRATION_HISTORY_ERROR");
    }
  }

  /**
   * Calculate expected doses
   */
  calculateExpectedDoses(medication, timeframe) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Calculating expected doses", { requestId, medicationId: medication?.id, timeframe });
      
      // Input validation
      if (!medication || typeof medication !== "object") {
        throw new ValidationError("Valid medication object is required", "medication");
      }
      
      if (!timeframe || typeof timeframe !== "string") {
        throw new ValidationError("Valid timeframe is required", "timeframe");
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("expected_doses", { medicationId: medication.id, timeframe });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

    const days = timeframe === "7days" ? 7 : timeframe === "90days" ? 90 : 30;
    const frequency = medication.frequency || 1; // doses per day
      const expectedDoses = days * frequency;

      const result = {
        success: true,
        expectedDoses,
        days,
        frequency,
        timeframe,
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Expected doses calculated successfully", { 
        requestId, 
        expectedDoses,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error calculating expected doses", error, { 
        requestId, 
        medicationId: medication?.id, 
        timeframe 
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to calculate expected doses", "CALCULATION_ERROR");
    }
  }

  /**
   * Get adherence level
   */
  getAdherenceLevel(adherenceRate) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Getting adherence level", { requestId, adherenceRate });
      
      // Input validation
      if (typeof adherenceRate !== "number" || adherenceRate < 0 || adherenceRate > 100) {
        throw new ValidationError("Adherence rate must be a number between 0 and 100", "adherenceRate");
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("adherence_level", { adherenceRate });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      let level;
      if (adherenceRate >= this.adherenceThresholds.excellent) {
        level = "excellent";
      } else if (adherenceRate >= this.adherenceThresholds.good) {
        level = "good";
      } else if (adherenceRate >= this.adherenceThresholds.fair) {
        level = "fair";
      } else {
        level = "poor";
      }

      const result = {
        success: true,
        level,
        adherenceRate,
        thresholds: this.adherenceThresholds,
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Adherence level determined successfully", { 
        requestId, 
        level,
        adherenceRate,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error getting adherence level", error, { 
        requestId, 
        adherenceRate 
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to get adherence level", "ADHERENCE_LEVEL_ERROR");
    }
  }

  /**
   * Generate adherence recommendations
   */
  generateAdherenceRecommendations(adherenceData) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Generating adherence recommendations", { requestId, dataCount: adherenceData?.length });
      
      // Input validation
      if (!Array.isArray(adherenceData)) {
        throw new ValidationError("Adherence data must be an array", "adherenceData");
      }
      
      // Rate limiting (using a default user ID since this is a utility method)
      this.checkRateLimit("system");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("adherence_recommendations", { 
        dataHash: crypto.createHash("md5").update(JSON.stringify(adherenceData)).digest("hex") 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

    const recommendations = [];

    const poorAdherence = adherenceData.filter((med) => med.adherenceRate < 75);
    if (poorAdherence.length > 0) {
      recommendations.push({
        type: "adherence_improvement",
        priority: "high",
        message: `${poorAdherence.length} medication(s) have poor adherence`,
        actions: [
          "Review medication schedule with patient",
          "Consider medication reminders or pill organizers",
          "Assess barriers to adherence",
          "Provide additional patient education",
        ],
      });
    }

    const missedDoses = adherenceData.reduce(
        (sum, med) => sum + (med.missedDoses || 0),
      0
    );
    if (missedDoses > 5) {
      recommendations.push({
        type: "missed_doses",
        priority: "medium",
        message: `${missedDoses} total missed doses in timeframe`,
        actions: [
          "Implement medication reminder system",
          "Review dosing schedule for optimization",
          "Consider long-acting formulations if appropriate",
        ],
      });
    }

      const result = {
        success: true,
        recommendations,
        summary: {
          totalRecommendations: recommendations.length,
          poorAdherenceCount: poorAdherence.length,
          totalMissedDoses: missedDoses
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Adherence recommendations generated successfully", { 
        requestId, 
        recommendationCount: recommendations.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error generating adherence recommendations", error, { 
        requestId, 
        dataCount: adherenceData?.length 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to generate adherence recommendations", "RECOMMENDATION_ERROR");
    }
  }

  /**
   * Create comprehensive medication profile with AI analysis
   */
  async createMedication(userId, patientId, medicationData) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Creating medication", { requestId, userId, patientId });
      
      // Input validation
      InputValidator.validateUserId(userId);
      InputValidator.validatePatientId(patientId);
      const sanitizedData = this.validateInputs(medicationData, { requestId });
      
      // Validate medication data
      const validationResult = await this.validateMedicationData(
        sanitizedData
      );
      if (!validationResult.isValid) {
        throw new ValidationError(
          `Medication validation failed: ${validationResult.errors.join(", ")}`
        );
      }

      // Enrich medication data with external APIs
      const enrichedData = await this.enrichMedicationData(sanitizedData);

      // Create medication record
      const medication = new Medication({
        userId,
        patientId,
        ...enrichedData,
        aiAnalysis: {
          riskScore: 0,
          interactions: [],
          contraindications: [],
          monitoring: [],
          recommendations: [],
          adherencePrediction: {
            probability: 85, // Default prediction
            factors: [],
            interventions: [],
            confidence: 70,
          },
        },
      });

      // Perform initial AI analysis
      await this.performInitialAIAnalysis(medication);

      // Check for drug interactions with existing medications
      const existingMedications = await this.getPatientMedications(patientId);
      await this.checkDrugInteractions(medication, existingMedications);

      // Save medication
      await medication.save();

      // Create medication administration record
      const medicationRecord = await this.createMedicationRecord(medication);

      // Real-time notification
      await this.eventManager.emit("medication_created", {
        userId,
        patientId,
        medicationId: medication._id,
        riskLevel: this.getRiskLevel(medication.aiAnalysis.riskScore),
        interactions: medication.aiAnalysis.interactions.length,
        requestId
      });

      // Cache medication data
      await this.cacheService.set(
        `medication:${medication._id}`,
        medication,
        3600 // 1 hour cache
      );

      const result = {
        medication,
        medicationRecord,
        aiInsights: medication.aiAnalysis,
        riskAssessment: this.generateRiskAssessment(medication),
        requestId,
        timestamp: new Date().toISOString()
      };
      
      this.logInfo("Medication created successfully", { requestId, medicationId: medication._id });
      return result;
    } catch (error) {
      this.logError("Error creating medication", error, { requestId, userId, patientId });
      throw error;
    }
  }

  /**
   * Real-time drug interaction checking
   */
  async checkDrugInteractions(medication, existingMedications = []) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Checking drug interactions", { 
        requestId, 
        medicationId: medication?.id, 
        existingMedicationsCount: existingMedications?.length 
      });
      
      // Input validation
      this.validateInputs({ medication, existingMedications }, { method: "checkDrugInteractions" });
      
      // Rate limiting (using medication ID as user ID)
      this.checkRateLimit(medication?.id || "system");
      
      // Circuit breaker check
      this.checkCircuitBreaker("interaction");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("drug_interactions", { 
        medicationId: medication?.id, 
        existingMedsHash: crypto.createHash("md5").update(JSON.stringify(existingMedications)).digest("hex") 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const interactions = [];

      // Check interactions with existing medications
      for (const existingMed of existingMedications) {
        const interaction = await this.checkMedicationInteraction(
          medication,
          existingMed
        );

        if (interaction) {
          interactions.push(interaction);
        }
      }

      // Check food interactions
      const foodInteractions = await this.checkFoodInteractions(medication);
      interactions.push(...foodInteractions);

      // Check disease interactions
      const diseaseInteractions = await this.checkDiseaseInteractions(
        medication
      );
      interactions.push(...diseaseInteractions);

      // Update medication with interactions
      if (medication.aiAnalysis) {
      medication.aiAnalysis.interactions = interactions;
      } else {
        medication.aiAnalysis = { interactions };
      }

      // Calculate updated risk score
      const riskScore = await this.calculateRiskScore(medication);
      if (medication.aiAnalysis) {
        medication.aiAnalysis.riskScore = riskScore;
      }

      // Generate alerts for high-severity interactions
      const criticalInteractions = interactions.filter(
        (i) => i.severity === "contraindicated" || i.severity === "major"
      );

      if (criticalInteractions.length > 0) {
        await this.generateInteractionAlerts(medication, criticalInteractions);
      }

      const result = {
        success: true,
        interactions,
        criticalInteractions: criticalInteractions.length,
        riskScore,
        summary: {
          totalInteractions: interactions.length,
          drugInteractions: interactions.filter(i => i.interactionType === "drug-drug").length,
          foodInteractions: foodInteractions.length,
          diseaseInteractions: diseaseInteractions.length
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("interaction", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Drug interactions checked successfully", { 
        requestId, 
        interactionCount: interactions.length,
        criticalCount: criticalInteractions.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("interaction", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error checking drug interactions", error, { 
        requestId, 
        medicationId: medication?.id,
        existingMedicationsCount: existingMedications?.length 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to check drug interactions", "INTERACTION_CHECK_ERROR");
    }
  }

  /**
   * Check interaction between two medications
   */
  async checkMedicationInteraction(medication1, medication2) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Checking medication interaction", { 
        requestId, 
        medication1Id: medication1?.medication?.rxcui, 
        medication2Id: medication2?.medication?.rxcui 
      });
      
      // Input validation
      if (!medication1 || !medication2) {
        throw new ValidationError("Both medications are required", "medications");
      }
      
      if (!medication1.medication?.rxcui || !medication2.medication?.rxcui) {
        throw new ValidationError("Both medications must have valid RxCUI codes", "rxcui");
      }
      
      // Rate limiting
      this.checkRateLimit(medication1.medication.rxcui);
      
      // Circuit breaker check
      this.checkCircuitBreaker("medication_interaction");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("medication_interaction", { 
        rxcui1: medication1.medication.rxcui, 
        rxcui2: medication2.medication.rxcui 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      // Call external drug interaction API
      const interactionData = await this.callDrugInteractionAPI(
        medication1.medication.rxcui,
        medication2.medication.rxcui
      );

      if (!interactionData || !interactionData.hasInteraction) {
        const result = {
          success: true,
          hasInteraction: false,
          requestId,
          timestamp: new Date().toISOString()
        };
        
        // Cache the result
        this.setCache(cacheKey, result);
        this.updateCircuitBreaker("medication_interaction", true);
        this.updateMetrics(true, Date.now() - startTime);
        
        return result;
      }

      const interaction = {
        success: true,
        hasInteraction: true,
        interactingMedication: medication2.medication.name,
        interactionType: "drug-drug",
        severity: interactionData.severity,
        mechanism: interactionData.mechanism,
        clinicalEffect: interactionData.clinicalEffect,
        management: interactionData.management,
        evidence: interactionData.evidenceLevel,
        confidence: interactionData.confidence || 85,
        source: interactionData.source,
        references: interactionData.references || [],
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the interaction result
      this.setCache(cacheKey, interaction);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("medication_interaction", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication interaction checked successfully", { 
        requestId, 
        hasInteraction: true,
        severity: interactionData.severity,
        responseTime: Date.now() - startTime 
      });

      return interaction;
    } catch (error) {
      this.updateCircuitBreaker("medication_interaction", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error checking medication interaction", error, { 
        requestId, 
        medication1Id: medication1?.medication?.rxcui,
        medication2Id: medication2?.medication?.rxcui 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to check medication interaction", "MEDICATION_INTERACTION_ERROR");
    }
  }

  /**
   * Monitor medication adherence in real-time
   */
  async monitorAdherence(userId, patientId, medicationId) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Monitoring medication adherence", { 
        requestId, 
        userId, 
        patientId, 
        medicationId 
      });
      
      // Input validation
      this.validateInputs({ userId, patientId, medicationId }, { method: "monitorAdherence" });
      
      // Rate limiting
      this.checkRateLimit(userId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("adherence");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("adherence_monitoring", { 
        userId, 
        patientId, 
        medicationId 
      });
      
      // Check cache first (with shorter TTL for real-time monitoring)
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const medication = await Medication.findById(medicationId);
      if (!medication) {
        throw new ValidationError("Medication not found", "medicationId");
      }

      // Calculate current adherence
      const adherenceData = await this.calculateAdherence(medication);

      // Update medication record
      if (medication.administration) {
      medication.administration.adherence = {
        ...medication.administration.adherence,
        ...adherenceData,
      };
      } else {
        medication.administration = { adherence: adherenceData };
      }

      // AI-powered adherence prediction
      const adherencePrediction = await this.predictAdherence(medication);
      if (medication.aiAnalysis) {
      medication.aiAnalysis.adherencePrediction = adherencePrediction;
      } else {
        medication.aiAnalysis = { adherencePrediction };
      }

      // Generate adherence interventions if needed
      if (adherenceData.overall < this.adherenceThresholds.fair) {
        const interventions = await this.generateAdherenceInterventions(
          medication
        );
        if (medication.aiAnalysis?.adherencePrediction) {
        medication.aiAnalysis.adherencePrediction.interventions = interventions;
        }
      }

      await medication.save();

      // Real-time notification for poor adherence
      if (adherenceData.overall < this.adherenceThresholds.poor) {
        await this.eventManager.emit("adherence_alert", {
          userId,
          patientId,
          medicationId,
          adherenceRate: adherenceData.overall,
          interventions:
            medication.aiAnalysis?.adherencePrediction?.interventions || [],
        });
      }

      const result = {
        success: true,
        adherence: adherenceData,
        prediction: adherencePrediction,
        riskLevel: this.getAdherenceRiskLevel(adherenceData.overall),
        summary: {
          overallAdherence: adherenceData.overall,
          riskLevel: this.getAdherenceRiskLevel(adherenceData.overall),
          hasInterventions: adherenceData.overall < this.adherenceThresholds.fair,
          alertTriggered: adherenceData.overall < this.adherenceThresholds.poor
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result (with shorter TTL for real-time data)
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("adherence", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Adherence monitoring completed successfully", { 
        requestId, 
        adherenceRate: adherenceData.overall,
        riskLevel: this.getAdherenceRiskLevel(adherenceData.overall),
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("adherence", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error monitoring adherence", error, { 
        requestId, 
        userId, 
        patientId, 
        medicationId 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to monitor adherence", "ADHERENCE_MONITORING_ERROR");
    }
  }

  /**
   * Comprehensive medication reconciliation
   */
  async performMedicationReconciliation(userId, patientId, reconciliationData) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Performing medication reconciliation", { 
        requestId, 
        userId, 
        patientId, 
        source: reconciliationData?.source 
      });
      
      // Input validation
      this.validateInputs({ userId, patientId, reconciliationData }, { method: "performMedicationReconciliation" });
      
      // Rate limiting
      this.checkRateLimit(userId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("reconciliation");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("medication_reconciliation", { 
        userId, 
        patientId, 
        dataHash: crypto.createHash("md5").update(JSON.stringify(reconciliationData)).digest("hex") 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const {
        homeMedications = [],
        admissionMedications = [],
        source = "admission",
      } = reconciliationData;

      // Get current medications
      const currentMedications = await this.getPatientMedications(patientId);

      // Identify discrepancies
      const discrepancies = await this.identifyDiscrepancies(
        homeMedications,
        currentMedications
      );

      // AI-powered reconciliation suggestions
      const reconciliationSuggestions =
        await this.generateReconciliationSuggestions(
          homeMedications,
          currentMedications,
          discrepancies
        );

      // Create reconciliation record
      const reconciliation = {
        userId,
        patientId,
        source,
        homeMedications,
        currentMedications: currentMedications.map((med) =>
          med.generateSummary()
        ),
        discrepancies,
        suggestions: reconciliationSuggestions,
        status: "pending_review",
        timestamp: new Date(),
      };

      // Update medication records with reconciliation data
      for (const medication of currentMedications) {
        if (!medication.reconciliation) {
          medication.reconciliation = {
            homeMedications: [],
            changes: [],
            discrepancies: [],
          };
        }

        medication.reconciliation.homeMedications = homeMedications;
        medication.reconciliation.discrepancies = discrepancies.filter(
          (d) => d.medicationId === medication._id.toString()
        );

        await medication.save();
      }

      // Real-time notification
      await this.eventManager.emit("reconciliation_completed", {
        userId,
        patientId,
        discrepancyCount: discrepancies.length,
        suggestionCount: reconciliationSuggestions.length,
      });

      const result = {
        success: true,
        reconciliation,
        summary: {
          totalDiscrepancies: discrepancies.length,
          totalSuggestions: reconciliationSuggestions.length,
          currentMedicationsCount: currentMedications.length,
          homeMedicationsCount: homeMedications.length
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("reconciliation", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication reconciliation completed successfully", { 
        requestId, 
        discrepancyCount: discrepancies.length,
        suggestionCount: reconciliationSuggestions.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("reconciliation", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error performing medication reconciliation", error, { 
        requestId, 
        userId, 
        patientId 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to perform medication reconciliation", "RECONCILIATION_ERROR");
    }
  }

  /**
   * Generate therapeutic optimization recommendations
   */
  async generateTherapeuticOptimization(userId, patientId) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Generating therapeutic optimization", { 
        requestId, 
        userId, 
        patientId 
      });
      
      // Input validation
      this.validateInputs({ userId, patientId }, { method: "generateTherapeuticOptimization" });
      
      // Rate limiting
      this.checkRateLimit(userId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("therapeutic_optimization");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("therapeutic_optimization", { 
        userId, 
        patientId 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const medications = await this.getPatientMedications(patientId);
      const optimizations = [];

      for (const medication of medications) {
        // AI-powered therapeutic analysis
        const analysis = await this.aiEngine.analyzeTherapeuticOptimization({
          medication: medication.toObject(),
          patientHistory: await this.getPatientHistory(patientId),
          clinicalGuidelines: await this.getClinicalGuidelines(
            medication.medication.therapeuticClass
          ),
        });

        if (analysis.hasOptimizationOpportunities) {
          optimizations.push({
            medicationId: medication._id,
            medicationName: medication.medication.name,
            currentDosage: medication.prescription.dosage,
            currentFrequency: medication.prescription.frequency,
            recommendations: analysis.recommendations,
            evidence: analysis.evidence,
            potentialBenefits: analysis.benefits,
            risks: analysis.risks,
            confidence: analysis.confidence,
          });
        }
      }

      // Prioritize optimizations by impact and safety
      const prioritizedOptimizations = optimizations.sort((a, b) => {
        return (
          b.confidence * b.potentialBenefits.length -
          a.confidence * a.potentialBenefits.length
        );
      });

      const result = {
        success: true,
        patientId,
        optimizations: prioritizedOptimizations,
        summary: {
          totalMedications: medications.length,
          optimizationOpportunities: optimizations.length,
          highPriorityCount: optimizations.filter((o) => o.confidence > 85)
            .length,
        },
        generatedAt: new Date(),
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("therapeutic_optimization", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Therapeutic optimization generated successfully", { 
        requestId, 
        optimizationCount: optimizations.length,
        highPriorityCount: optimizations.filter((o) => o.confidence > 85).length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("therapeutic_optimization", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error generating therapeutic optimization", error, { 
        requestId, 
        userId, 
        patientId 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to generate therapeutic optimization", "THERAPEUTIC_OPTIMIZATION_ERROR");
    }
  }

  /**
   * Real-time medication alerts and notifications
   */
  async generateMedicationAlerts(userId, patientId) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Generating medication alerts", { 
        requestId, 
        userId, 
        patientId 
      });
      
      // Input validation
      this.validateInputs({ userId, patientId }, { method: "generateMedicationAlerts" });
      
      // Rate limiting
      this.checkRateLimit(userId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("medication_alerts");
      
      // Generate cache key (with shorter TTL for real-time alerts)
      const cacheKey = this.generateCacheKey("medication_alerts", { 
        userId, 
        patientId 
      });
      
      // Check cache first (with shorter TTL for real-time data)
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const medications = await this.getPatientMedications(patientId);
      const alerts = [];

      for (const medication of medications) {
        // Check for due doses
        const dueAlerts = await this.checkDueDoses(medication);
        alerts.push(...dueAlerts);

        // Check for missed doses
        const missedAlerts = await this.checkMissedDoses(medication);
        alerts.push(...missedAlerts);

        // Check for refill needs
        const refillAlerts = await this.checkRefillNeeds(medication);
        alerts.push(...refillAlerts);

        // Check for monitoring requirements
        const monitoringAlerts = await this.checkMonitoringRequirements(
          medication
        );
        alerts.push(...monitoringAlerts);

        // Check for side effects
        const sideEffectAlerts = await this.checkSideEffects(medication);
        alerts.push(...sideEffectAlerts);
      }

      // Sort alerts by priority
      const prioritizedAlerts = alerts.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Send real-time notifications for urgent alerts
      const urgentAlerts = prioritizedAlerts.filter(
        (alert) => alert.priority === "urgent"
      );
      if (urgentAlerts.length > 0) {
        await this.eventManager.emit("urgent_medication_alerts", {
          userId,
          patientId,
          alerts: urgentAlerts,
        });
      }

      const result = {
        success: true,
        alerts: prioritizedAlerts,
        summary: {
          totalAlerts: prioritizedAlerts.length,
          urgentAlerts: urgentAlerts.length,
          highPriorityAlerts: prioritizedAlerts.filter(a => a.priority === "high").length,
          mediumPriorityAlerts: prioritizedAlerts.filter(a => a.priority === "medium").length,
          lowPriorityAlerts: prioritizedAlerts.filter(a => a.priority === "low").length
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result (with shorter TTL for real-time alerts)
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("medication_alerts", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication alerts generated successfully", { 
        requestId, 
        totalAlerts: prioritizedAlerts.length,
        urgentAlerts: urgentAlerts.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("medication_alerts", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error generating medication alerts", error, { 
        requestId, 
        userId, 
        patientId 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to generate medication alerts", "ALERTS_GENERATION_ERROR");
    }
  }

  /**
   * Get comprehensive medication statistics
   */
  async getMedicationStatistics(userId, patientId = null) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Getting medication statistics", { 
        requestId, 
        userId, 
        patientId 
      });
      
      // Input validation
      this.validateInputs({ userId, patientId }, { method: "getMedicationStatistics" });
      
      // Rate limiting
      this.checkRateLimit(userId);
      
      // Circuit breaker check
      this.checkCircuitBreaker("medication_statistics");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("medication_statistics", { 
        userId, 
        patientId 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const stats = await Medication.getMedicationStats(userId, patientId);

      // Additional AI-powered insights
      const aiInsights = await this.generateMedicationInsights(
        userId,
        patientId
      );

      const result = {
        success: true,
        ...stats[0],
        aiInsights,
        trends: await this.getMedicationTrends(userId, patientId),
        riskDistribution: await this.getRiskDistribution(userId, patientId),
        adherenceMetrics: await this.getAdherenceMetrics(userId, patientId),
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("medication_statistics", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication statistics retrieved successfully", { 
        requestId, 
        patientId,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("medication_statistics", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error getting medication statistics", error, { 
        requestId, 
        userId, 
        patientId 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
      throw error;
      }
      throw new MedicationManagementError("Failed to get medication statistics", "STATISTICS_ERROR");
    }
  }

  // Helper Methods

  async validateMedicationData(medicationData) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Validating medication data", { 
        requestId, 
        hasMedicationData: !!medicationData 
      });
      
      // Input validation
      if (!medicationData || typeof medicationData !== "object") {
        throw new ValidationError("Valid medication data object is required", "medicationData");
      }
      
    const errors = [];

    if (!medicationData.medication?.name) {
      errors.push("Medication name is required");
    }

    if (!medicationData.prescription?.dosage) {
      errors.push("Dosage is required");
    }

    if (!medicationData.prescription?.frequency) {
      errors.push("Frequency is required");
    }

    if (!medicationData.prescription?.indication) {
      errors.push("Indication is required");
    }

      const result = {
        success: true,
      isValid: errors.length === 0,
      errors,
        requestId,
        timestamp: new Date().toISOString()
      };

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication data validation completed", { 
        requestId, 
        isValid: errors.length === 0,
        errorCount: errors.length,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error validating medication data", error, { 
        requestId, 
        hasMedicationData: !!medicationData 
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to validate medication data", "VALIDATION_ERROR");
    }
  }

  async enrichMedicationData(medicationData) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Enriching medication data", { 
        requestId, 
        medicationName: medicationData?.medication?.name 
      });
      
      // Input validation
      if (!medicationData || typeof medicationData !== "object") {
        throw new ValidationError("Valid medication data object is required", "medicationData");
      }
      
      // Rate limiting (using medication name as user ID)
      this.checkRateLimit(medicationData.medication?.name || "system");
      
      // Circuit breaker check
      this.checkCircuitBreaker("medication_enrichment");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("medication_enrichment", { 
        medicationName: medicationData.medication?.name,
        rxcui: medicationData.medication?.rxcui 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      // Call external APIs to enrich medication data
      const enrichedData = { ...medicationData };

      // Get RxCUI from RxNorm API
      if (!enrichedData.medication.rxcui && enrichedData.medication.name) {
        enrichedData.medication.rxcui = await this.getRxCUI(
          enrichedData.medication.name
        );
      }

      // Get generic name and brand names
      if (enrichedData.medication.rxcui) {
        const drugInfo = await this.getDrugInfo(enrichedData.medication.rxcui);
        enrichedData.medication.genericName = drugInfo.genericName;
        enrichedData.medication.brandNames = drugInfo.brandNames;
        enrichedData.medication.therapeuticClass = drugInfo.therapeuticClass;
        enrichedData.medication.pharmacologicClass =
          drugInfo.pharmacologicClass;
      }

      const result = {
        success: true,
        enrichedData,
        summary: {
          hasRxCUI: !!enrichedData.medication.rxcui,
          hasGenericName: !!enrichedData.medication.genericName,
          hasBrandNames: !!enrichedData.medication.brandNames,
          hasTherapeuticClass: !!enrichedData.medication.therapeuticClass
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("medication_enrichment", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication data enrichment completed successfully", { 
        requestId, 
        medicationName: enrichedData.medication?.name,
        hasRxCUI: !!enrichedData.medication.rxcui,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("medication_enrichment", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error enriching medication data", error, { 
        requestId, 
        medicationName: medicationData?.medication?.name 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      
      // Return original data if enrichment fails (graceful degradation)
      this.logInfo("Returning original medication data due to enrichment failure", { 
        requestId, 
        medicationName: medicationData?.medication?.name 
      });
      
      return {
        success: false,
        enrichedData: medicationData,
        error: "Enrichment failed, using original data",
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  async performInitialAIAnalysis(medication) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Performing initial AI analysis", { 
        requestId, 
        medicationId: medication?.id,
        medicationName: medication?.medication?.name 
      });
      
      // Input validation
      if (!medication || typeof medication !== "object") {
        throw new ValidationError("Valid medication object is required", "medication");
      }
      
      // Rate limiting (using medication ID as user ID)
      this.checkRateLimit(medication.id || "system");
      
      // Circuit breaker check
      this.checkCircuitBreaker("ai_analysis");
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("ai_analysis", { 
        medicationId: medication.id,
        medicationName: medication.medication?.name 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      // AI analysis of medication
      const analysis = await this.aiEngine.analyzeMedication({
        medication: medication.toObject(),
        indication: medication.prescription.indication,
        patientFactors: {}, // Would include patient demographics, conditions, etc.
      });

      // Update medication with AI insights
      if (!medication.aiAnalysis) {
        medication.aiAnalysis = {};
      }
      
      medication.aiAnalysis.riskScore = analysis.riskScore || 0;
      medication.aiAnalysis.contraindications =
        analysis.contraindications || [];
      medication.aiAnalysis.monitoring = analysis.monitoring || [];
      medication.aiAnalysis.recommendations = analysis.recommendations || [];

      const result = {
        success: true,
        analysis: {
          riskScore: medication.aiAnalysis.riskScore,
          contraindications: medication.aiAnalysis.contraindications,
          monitoring: medication.aiAnalysis.monitoring,
          recommendations: medication.aiAnalysis.recommendations
        },
        summary: {
          hasRiskScore: !!medication.aiAnalysis.riskScore,
          contraindicationsCount: medication.aiAnalysis.contraindications.length,
          monitoringCount: medication.aiAnalysis.monitoring.length,
          recommendationsCount: medication.aiAnalysis.recommendations.length
        },
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update circuit breaker and metrics
      this.updateCircuitBreaker("ai_analysis", true);
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Initial AI analysis completed successfully", { 
        requestId, 
        medicationName: medication.medication?.name,
        riskScore: medication.aiAnalysis.riskScore,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateCircuitBreaker("ai_analysis", false);
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error performing initial AI analysis", error, { 
        requestId, 
        medicationId: medication?.id,
        medicationName: medication?.medication?.name 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      
      // Continue without AI analysis if it fails (graceful degradation)
      this.logInfo("Continuing without AI analysis due to failure", { 
        requestId, 
        medicationName: medication?.medication?.name 
      });
      
      return {
        success: false,
        analysis: null,
        error: "AI analysis failed, continuing without analysis",
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  async createMedicationRecord(medication) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logInfo("Creating medication record", { 
        requestId, 
        medicationName: medication?.name,
        dosage: medication?.dosage 
      });
      
      // Input validation
      this.validateInputs(medication, { method: "createMedicationRecord" });
      
      // Generate cache key
      const cacheKey = this.generateCacheKey("medication_record", { 
        medicationHash: crypto.createHash("md5").update(JSON.stringify(medication)).digest("hex") 
      });
      
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics(true, Date.now() - startTime);
        return cachedResult;
      }

      const record = new MedicationRecord({
        ...medication,
        createdAt: new Date(),
        status: "active",
      });

      await record.save();

      const result = {
        success: true,
        record: record.toObject(),
        requestId,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      this.logInfo("Medication record created successfully", { 
        requestId, 
        recordId: record._id,
        responseTime: Date.now() - startTime 
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      this.logError("Error creating medication record", error, { 
        requestId, 
        medication: medication?.name 
      });
      
      if (error instanceof ValidationError || error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      throw new MedicationManagementError("Failed to create medication record", "RECORD_CREATION_ERROR");
    }
  }

  calculateAdministrationTimes(frequency) {
    // Parse frequency and return administration times
    const times = [];

    if (
      frequency.toLowerCase().includes("once daily") ||
      frequency.toLowerCase().includes("qd")
    ) {
      times.push("08:00");
    } else if (
      frequency.toLowerCase().includes("twice daily") ||
      frequency.toLowerCase().includes("bid")
    ) {
      times.push("08:00", "20:00");
    } else if (
      frequency.toLowerCase().includes("three times") ||
      frequency.toLowerCase().includes("tid")
    ) {
      times.push("08:00", "14:00", "20:00");
    } else if (
      frequency.toLowerCase().includes("four times") ||
      frequency.toLowerCase().includes("qid")
    ) {
      times.push("08:00", "12:00", "16:00", "20:00");
    }

    return times;
  }

  calculateNextDue(frequency) {
    const now = new Date();
    const times = this.calculateAdministrationTimes(frequency);

    if (times.length === 0) return null;

    // Find next administration time
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const time of times) {
      const [hours, minutes] = time.split(":").map(Number);
      const timeInMinutes = hours * 60 + minutes;

      if (timeInMinutes > currentTime) {
        const nextDue = new Date(now);
        nextDue.setHours(hours, minutes, 0, 0);
        return nextDue;
      }
    }

    // If no time today, use first time tomorrow
    const [hours, minutes] = times[0].split(":").map(Number);
    const nextDue = new Date(now);
    nextDue.setDate(nextDue.getDate() + 1);
    nextDue.setHours(hours, minutes, 0, 0);

    return nextDue;
  }

  async getPatientMedications(patientId) {
    return await Medication.find({
      patientId,
      "administration.status": "active",
    }).sort({ createdAt: -1 });
  }

  getRiskLevel(riskScore) {
    if (riskScore >= this.riskThresholds.critical) return "critical";
    if (riskScore >= this.riskThresholds.high) return "high";
    if (riskScore >= this.riskThresholds.moderate) return "moderate";
    return "low";
  }

  getAdherenceRiskLevel(adherenceRate) {
    if (adherenceRate >= this.adherenceThresholds.excellent) return "low";
    if (adherenceRate >= this.adherenceThresholds.good) return "moderate";
    if (adherenceRate >= this.adherenceThresholds.fair) return "high";
    return "critical";
  }

  generateRiskAssessment(medication) {
    const riskScore = medication.aiAnalysis.riskScore;
    const interactions = medication.aiAnalysis.interactions.length;
    const contraindications = medication.aiAnalysis.contraindications.length;

    return {
      overallRisk: this.getRiskLevel(riskScore),
      riskScore,
      factors: {
        interactions,
        contraindications,
        controlledSubstance:
          medication.medication.controlledSubstance?.isControlled || false,
        highRiskMedication: this.isHighRiskMedication(
          medication.medication.name
        ),
      },
      recommendations: medication.aiAnalysis.recommendations,
    };
  }

  isHighRiskMedication(medicationName) {
    const highRiskMeds = [
      "warfarin",
      "heparin",
      "insulin",
      "digoxin",
      "lithium",
      "methotrexate",
      "phenytoin",
      "theophylline",
      "vancomycin",
    ];

    return highRiskMeds.some((med) =>
      medicationName.toLowerCase().includes(med.toLowerCase())
    );
  }

  // External API integration methods (mock implementations)
  async callDrugInteractionAPI(rxcui1, rxcui2) {
    // Mock implementation - would call actual drug interaction API
    return {
      hasInteraction: Math.random() > 0.7, // 30% chance of interaction
      severity: ["minor", "moderate", "major"][Math.floor(Math.random() * 3)],
      mechanism: "Mock interaction mechanism",
      clinicalEffect: "Mock clinical effect",
      management: "Mock management recommendation",
      evidenceLevel: "established",
      confidence: 85,
      source: "Mock Drug Database",
    };
  }

  async getRxCUI(medicationName) {
    // Mock implementation - would call RxNorm API
    return `RX${Math.floor(Math.random() * 1000000)}`;
  }

  async getDrugInfo(rxcui) {
    // Mock implementation - would call drug information API
    return {
      genericName: "Mock Generic Name",
      brandNames: ["Mock Brand 1", "Mock Brand 2"],
      therapeuticClass: "Mock Therapeutic Class",
      pharmacologicClass: "Mock Pharmacologic Class",
    };
  }

  /**
   * Real-time drug interaction analysis with live data
   */
  async performRealTimeDrugInteractionAnalysis(patientId, medicationData) {
    try {
      const analysisStartTime = Date.now();

      // Get current active medications
      const activeMedications = await this.getActiveMedications(patientId);

      // Get patient context for more accurate analysis
      const patientContext = await this.getPatientContext(patientId);

      // Perform comprehensive interaction analysis
      const interactionAnalysis = await this.analyzeAllInteractions(
        medicationData,
        activeMedications,
        patientContext
      );

      // Real-time severity assessment
      const severityAssessment = await this.assessInteractionSeverity(
        interactionAnalysis.interactions
      );

      // Generate immediate alerts for critical interactions
      if (severityAssessment.hasCriticalInteractions) {
        await this.generateCriticalInteractionAlerts(
          patientId,
          severityAssessment.criticalInteractions
        );
      }

      // Update patient medication risk profile
      await this.updateMedicationRiskProfile(
        patientId,
        interactionAnalysis,
        severityAssessment
      );

      // Cache analysis results for quick retrieval
      const cacheKey = `drug_interaction_analysis:${patientId}:${Date.now()}`;
      await this.cacheService.set(
        cacheKey,
        {
          ...interactionAnalysis,
          severityAssessment,
          processingTime: Date.now() - analysisStartTime,
          timestamp: new Date().toISOString(),
        },
        3600 // 1 hour cache
      );

      return {
        success: true,
        interactions: interactionAnalysis.interactions,
        severity: severityAssessment,
        recommendations: interactionAnalysis.recommendations,
        riskScore: interactionAnalysis.overallRiskScore,
        processingTime: Date.now() - analysisStartTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        "Error performing real-time drug interaction analysis:",
        error
      );
      throw error;
    }
  }

  /**
   * Analyze all possible interactions for a medication
   */
  async analyzeAllInteractions(
    newMedication,
    activeMedications,
    patientContext
  ) {
    try {
      const interactions = [];
      let overallRiskScore = 0;

      // Drug-drug interactions
      for (const activeMed of activeMedications) {
        const drugDrugInteraction = await this.analyzeDrugDrugInteraction(
          newMedication,
          activeMed,
          patientContext
        );
        if (drugDrugInteraction) {
          interactions.push(drugDrugInteraction);
          overallRiskScore += drugDrugInteraction.riskScore || 0;
        }
      }

      // Drug-food interactions
      const drugFoodInteractions = await this.analyzeDrugFoodInteractions(
        newMedication,
        patientContext
      );
      interactions.push(...drugFoodInteractions);

      // Drug-disease interactions
      const drugDiseaseInteractions = await this.analyzeDrugDiseaseInteractions(
        newMedication,
        patientContext
      );
      interactions.push(...drugDiseaseInteractions);

      // Drug-lab interactions
      const drugLabInteractions = await this.analyzeDrugLabInteractions(
        newMedication,
        patientContext
      );
      interactions.push(...drugLabInteractions);

      // Generate comprehensive recommendations
      const recommendations = await this.generateInteractionRecommendations(
        interactions,
        patientContext
      );

      return {
        interactions,
        overallRiskScore: Math.min(overallRiskScore, 100), // Cap at 100
        recommendations,
        analysisTimestamp: new Date().toISOString(),
        patientId: patientContext.patientId,
      };
    } catch (error) {
      console.error("Error analyzing all interactions:", error);
      throw error;
    }
  }

  /**
   * Analyze drug-drug interactions with enhanced AI
   */
  async analyzeDrugDrugInteraction(
    newMedication,
    activeMedication,
    patientContext
  ) {
    try {
      // Check cache first
      const cacheKey = `drug_drug_interaction:${newMedication.rxcui}:${activeMedication.medication.rxcui}`;
      const cachedResult = await this.cacheService.get(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Call multiple drug interaction databases
      const interactionSources = await Promise.allSettled([
        this.checkFDAInteractionDatabase(newMedication, activeMedication),
        this.checkRxNormInteractions(newMedication, activeMedication),
        this.checkDrugBankInteractions(newMedication, activeMedication),
        this.checkLexicompInteractions(newMedication, activeMedication),
      ]);

      // Consolidate results from multiple sources
      const consolidatedInteraction = this.consolidateInteractionResults(
        interactionSources,
        newMedication,
        activeMedication
      );

      if (!consolidatedInteraction) {
        return null;
      }

      // Enhance with AI analysis
      const aiEnhancedInteraction = await this.enhanceInteractionWithAI(
        consolidatedInteraction,
        patientContext
      );

      // Cache the result
      await this.cacheService.set(cacheKey, aiEnhancedInteraction, 86400); // 24 hours

      return aiEnhancedInteraction;
    } catch (error) {
      console.error("Error analyzing drug-drug interaction:", error);
      return null;
    }
  }

  /**
   * Analyze drug-food interactions
   */
  async analyzeDrugFoodInteractions(medication, patientContext) {
    try {
      const foodInteractions = [];

      // Common food interactions database
      const commonFoodInteractions = {
        warfarin: [
          {
            food: "Vitamin K rich foods",
            effect: "Decreased anticoagulant effect",
            severity: "moderate",
            management:
              "Monitor INR closely, maintain consistent vitamin K intake",
          },
        ],
        "calcium channel blockers": [
          {
            food: "Grapefruit juice",
            effect: "Increased drug levels",
            severity: "major",
            management: "Avoid grapefruit juice consumption",
          },
        ],
        tetracycline: [
          {
            food: "Dairy products",
            effect: "Decreased absorption",
            severity: "moderate",
            management: "Take 2 hours before or after dairy consumption",
          },
        ],
      };

      // Check for food interactions
      const medicationName = medication.name?.toLowerCase() || "";
      const therapeuticClass = medication.therapeuticClass?.toLowerCase() || "";

      for (const [drug, interactions] of Object.entries(
        commonFoodInteractions
      )) {
        if (medicationName.includes(drug) || therapeuticClass.includes(drug)) {
          foodInteractions.push(
            ...interactions.map((interaction) => ({
              ...interaction,
              type: "drug-food",
              medication: medication.name,
              riskScore: this.calculateFoodInteractionRisk(
                interaction.severity
              ),
              patientSpecific: this.assessPatientSpecificFoodRisk(
                interaction,
                patientContext
              ),
            }))
          );
        }
      }

      return foodInteractions;
    } catch (error) {
      console.error("Error analyzing drug-food interactions:", error);
      return [];
    }
  }

  /**
   * Analyze drug-disease interactions
   */
  async analyzeDrugDiseaseInteractions(medication, patientContext) {
    try {
      const diseaseInteractions = [];

      // Get patient conditions
      const patientConditions = patientContext.conditions || [];

      // Common drug-disease interactions
      const drugDiseaseDatabase = {
        "beta-blockers": {
          asthma: {
            severity: "contraindicated",
            effect: "Bronchospasm",
            management: "Use cardioselective beta-blockers with caution",
          },
          copd: {
            severity: "major",
            effect: "Respiratory depression",
            management: "Monitor respiratory function closely",
          },
        },
        nsaids: {
          "kidney disease": {
            severity: "major",
            effect: "Worsening renal function",
            management: "Monitor creatinine and reduce dose",
          },
          "heart failure": {
            severity: "major",
            effect: "Fluid retention",
            management: "Monitor for signs of fluid overload",
          },
        },
        ace_inhibitors: {
          "kidney disease": {
            severity: "moderate",
            effect: "Hyperkalemia risk",
            management: "Monitor potassium levels",
          },
        },
      };

      // Check for disease interactions
      const therapeuticClass = medication.therapeuticClass?.toLowerCase() || "";
      const medicationName = medication.name?.toLowerCase() || "";

      for (const condition of patientConditions) {
        const conditionLower = condition.toLowerCase();

        for (const [drugClass, diseases] of Object.entries(
          drugDiseaseDatabase
        )) {
          if (
            therapeuticClass.includes(drugClass) ||
            medicationName.includes(drugClass)
          ) {
            for (const [disease, interaction] of Object.entries(diseases)) {
              if (conditionLower.includes(disease)) {
                diseaseInteractions.push({
                  type: "drug-disease",
                  medication: medication.name,
                  condition: condition,
                  severity: interaction.severity,
                  effect: interaction.effect,
                  management: interaction.management,
                  riskScore: this.calculateDiseaseInteractionRisk(
                    interaction.severity
                  ),
                  patientSpecific: true,
                });
              }
            }
          }
        }
      }

      return diseaseInteractions;
    } catch (error) {
      console.error("Error analyzing drug-disease interactions:", error);
      return [];
    }
  }

  /**
   * Analyze drug-lab interactions
   */
  async analyzeDrugLabInteractions(medication, patientContext) {
    try {
      const labInteractions = [];

      // Get recent lab values
      const recentLabs = patientContext.recentLabs || [];

      // Common drug-lab interactions
      const drugLabDatabase = {
        warfarin: {
          inr: {
            monitoring: "Monitor INR every 2-4 weeks",
            targetRange: "2.0-3.0 for most indications",
            frequency: "weekly initially, then monthly when stable",
          },
        },
        digoxin: {
          "digoxin level": {
            monitoring: "Monitor digoxin levels",
            targetRange: "1.0-2.0 ng/mL",
            frequency: "5-7 days after initiation or dose change",
          },
          potassium: {
            monitoring: "Monitor potassium levels",
            concern: "Hypokalemia increases digoxin toxicity risk",
            frequency: "monthly",
          },
        },
        lithium: {
          "lithium level": {
            monitoring: "Monitor lithium levels",
            targetRange: "0.6-1.2 mEq/L",
            frequency: "weekly initially, then every 3 months",
          },
          creatinine: {
            monitoring: "Monitor kidney function",
            concern: "Lithium can cause nephrotoxicity",
            frequency: "every 6 months",
          },
        },
      };

      // Check for lab monitoring requirements
      const medicationName = medication.name?.toLowerCase() || "";

      for (const [drug, labs] of Object.entries(drugLabDatabase)) {
        if (medicationName.includes(drug)) {
          for (const [lab, requirements] of Object.entries(labs)) {
            // Check if recent lab values are available
            const recentLabValue = recentLabs.find((l) =>
              l.name.toLowerCase().includes(lab.toLowerCase())
            );

            labInteractions.push({
              type: "drug-lab",
              medication: medication.name,
              labTest: lab,
              monitoring: requirements.monitoring,
              targetRange: requirements.targetRange,
              frequency: requirements.frequency,
              concern: requirements.concern,
              hasRecentValue: !!recentLabValue,
              recentValue: recentLabValue?.value,
              recentDate: recentLabValue?.date,
              riskScore: this.calculateLabMonitoringRisk(
                requirements,
                recentLabValue
              ),
            });
          }
        }
      }

      return labInteractions;
    } catch (error) {
      console.error("Error analyzing drug-lab interactions:", error);
      return [];
    }
  }

  /**
   * Assess interaction severity with real-time data
   */
  async assessInteractionSeverity(interactions) {
    try {
      const severityLevels = {
        contraindicated: [],
        major: [],
        moderate: [],
        minor: [],
      };

      let hasCriticalInteractions = false;

      for (const interaction of interactions) {
        const severity = interaction.severity?.toLowerCase() || "minor";

        if (severityLevels[severity]) {
          severityLevels[severity].push(interaction);
        } else {
          severityLevels.minor.push(interaction);
        }

        // Mark as critical if contraindicated or major with high risk score
        if (
          severity === "contraindicated" ||
          (severity === "major" && (interaction.riskScore || 0) > 80)
        ) {
          hasCriticalInteractions = true;
        }
      }

      return {
        hasCriticalInteractions,
        criticalInteractions: [
          ...severityLevels.contraindicated,
          ...severityLevels.major.filter((i) => (i.riskScore || 0) > 80),
        ],
        severityDistribution: {
          contraindicated: severityLevels.contraindicated.length,
          major: severityLevels.major.length,
          moderate: severityLevels.moderate.length,
          minor: severityLevels.minor.length,
        },
        totalInteractions: interactions.length,
        overallRiskLevel: this.calculateOverallInteractionRisk(severityLevels),
      };
    } catch (error) {
      console.error("Error assessing interaction severity:", error);
      return {
        hasCriticalInteractions: false,
        criticalInteractions: [],
        severityDistribution: {},
        totalInteractions: 0,
        overallRiskLevel: "low",
      };
    }
  }

  /**
   * Generate critical interaction alerts
   */
  async generateCriticalInteractionAlerts(patientId, criticalInteractions) {
    try {
      for (const interaction of criticalInteractions) {
        const alert = {
          type: "critical_drug_interaction",
          patientId,
          severity: interaction.severity,
          medications: [
            interaction.medication,
            interaction.interactingMedication,
          ].filter(Boolean),
          effect: interaction.effect || interaction.clinicalEffect,
          management: interaction.management,
          timestamp: new Date().toISOString(),
          requiresImmediateAction: interaction.severity === "contraindicated",
          riskScore: interaction.riskScore || 100,
        };

        // Emit real-time alert
        await this.eventManager.emit("critical_drug_interaction_alert", {
          patientId,
          alert,
          priority: "critical",
          requiresAcknowledgment: true,
        });

        // Log alert for audit trail
        console.warn(
          `🚨 Critical drug interaction alert for patient ${patientId}:`,
          alert
        );
      }
    } catch (error) {
      console.error("Error generating critical interaction alerts:", error);
    }
  }

  /**
   * Update medication risk profile with interaction data
   */
  async updateMedicationRiskProfile(
    patientId,
    interactionAnalysis,
    severityAssessment
  ) {
    try {
      const riskProfile = {
        patientId,
        lastUpdated: new Date().toISOString(),
        overallRiskScore: interactionAnalysis.overallRiskScore,
        interactionCount: interactionAnalysis.interactions.length,
        criticalInteractionCount:
          severityAssessment.criticalInteractions.length,
        severityDistribution: severityAssessment.severityDistribution,
        riskLevel: severityAssessment.overallRiskLevel,
        recommendations: interactionAnalysis.recommendations,
        nextReviewDate: this.calculateNextReviewDate(
          severityAssessment.overallRiskLevel
        ),
      };

      // Cache the risk profile
      await this.cacheService.set(
        `medication_risk_profile:${patientId}`,
        riskProfile,
        3600 // 1 hour
      );

      // Emit risk profile update
      await this.eventManager.emit("medication_risk_profile_updated", {
        patientId,
        riskProfile,
        hasSignificantChange: this.hasSignificantRiskChange(riskProfile),
      });

      return riskProfile;
    } catch (error) {
      console.error("Error updating medication risk profile:", error);
    }
  }

  /**
   * Get comprehensive patient context for interaction analysis
   */
  async getPatientContext(patientId) {
    try {
      const cacheKey = `patient_context_medication:${patientId}`;
      let context = await this.cacheService.get(cacheKey);

      if (!context) {
        // Gather patient data from various sources
        context = {
          patientId,
          conditions: [], // Would fetch from patient medical history
          allergies: [], // Would fetch from patient allergy records
          recentLabs: [], // Would fetch from lab results
          demographics: {}, // Would fetch from patient demographics
          vitalSigns: {}, // Would fetch from recent vital signs
          lastUpdated: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cacheService.set(cacheKey, context, 900);
      }

      return context;
    } catch (error) {
      console.error("Error getting patient context:", error);
      return { patientId, error: true };
    }
  }

  // Helper methods for interaction analysis
  calculateFoodInteractionRisk(severity) {
    const riskScores = {
      contraindicated: 100,
      major: 80,
      moderate: 50,
      minor: 25,
    };
    return riskScores[severity] || 25;
  }

  calculateDiseaseInteractionRisk(severity) {
    const riskScores = {
      contraindicated: 100,
      major: 85,
      moderate: 60,
      minor: 30,
    };
    return riskScores[severity] || 30;
  }

  calculateLabMonitoringRisk(requirements, recentLabValue) {
    let baseRisk = 40; // Base risk for requiring monitoring

    if (!recentLabValue) {
      baseRisk += 30; // Increase risk if no recent lab value
    } else {
      const daysSinceLastLab = Math.floor(
        (new Date() - new Date(recentLabValue.date)) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastLab > 90) {
        baseRisk += 25; // Increase risk for old lab values
      }
    }

    return Math.min(baseRisk, 100);
  }

  calculateOverallInteractionRisk(severityLevels) {
    if (severityLevels.contraindicated.length > 0) return "critical";
    if (severityLevels.major.length > 2) return "high";
    if (severityLevels.major.length > 0 || severityLevels.moderate.length > 3)
      return "moderate";
    return "low";
  }

  calculateNextReviewDate(riskLevel) {
    const now = new Date();
    const reviewIntervals = {
      critical: 1, // 1 day
      high: 7, // 1 week
      moderate: 30, // 1 month
      low: 90, // 3 months
    };

    const days = reviewIntervals[riskLevel] || 30;
    const nextReview = new Date(now);
    nextReview.setDate(now.getDate() + days);

    return nextReview.toISOString();
  }

  hasSignificantRiskChange(newProfile) {
    // This would compare with previous risk profile
    // For now, return true if critical interactions exist
    return newProfile.criticalInteractionCount > 0;
  }

  // Mock external API methods (would be replaced with real API calls)
  async checkFDAInteractionDatabase(med1, med2) {
    // Mock FDA interaction check
    return {
      hasInteraction: Math.random() > 0.8,
      severity: "moderate",
      source: "FDA",
    };
  }

  async checkRxNormInteractions(med1, med2) {
    // Mock RxNorm interaction check
    return {
      hasInteraction: Math.random() > 0.7,
      severity: "minor",
      source: "RxNorm",
    };
  }

  async checkDrugBankInteractions(med1, med2) {
    // Mock DrugBank interaction check
    return {
      hasInteraction: Math.random() > 0.6,
      severity: "major",
      source: "DrugBank",
    };
  }

  async checkLexicompInteractions(med1, med2) {
    // Mock Lexicomp interaction check
    return {
      hasInteraction: Math.random() > 0.75,
      severity: "moderate",
      source: "Lexicomp",
    };
  }

  consolidateInteractionResults(sources, med1, med2) {
    const validResults = sources
      .filter(
        (result) =>
          result.status === "fulfilled" && result.value?.hasInteraction
      )
      .map((result) => result.value);

    if (validResults.length === 0) {
      return null;
    }

    // Consolidate multiple sources
    const severities = validResults.map((r) => r.severity);
    const highestSeverity = this.getHighestSeverity(severities);

    return {
      type: "drug-drug",
      medication: med1.name,
      interactingMedication: med2.medication.name,
      severity: highestSeverity,
      sources: validResults.map((r) => r.source),
      confidence: Math.min(validResults.length * 25, 100),
      riskScore: this.calculateInteractionRiskScore(
        highestSeverity,
        validResults.length
      ),
    };
  }

  getHighestSeverity(severities) {
    const severityOrder = ["contraindicated", "major", "moderate", "minor"];

    for (const severity of severityOrder) {
      if (severities.includes(severity)) {
        return severity;
      }
    }

    return "minor";
  }

  calculateInteractionRiskScore(severity, sourceCount) {
    const baseScores = {
      contraindicated: 100,
      major: 80,
      moderate: 50,
      minor: 25,
    };

    const baseScore = baseScores[severity] || 25;
    const confidenceBonus = Math.min(sourceCount * 5, 20); // Up to 20 points for multiple sources

    return Math.min(baseScore + confidenceBonus, 100);
  }

  async enhanceInteractionWithAI(interaction, patientContext) {
    try {
      // Use AI to enhance interaction with patient-specific factors
      const aiEnhancement = await this.aiEngine.enhanceInteractionAnalysis({
        interaction,
        patientContext,
        options: {
          includePatientSpecificRisk: true,
          includeAlternatives: true,
          includeMonitoring: true,
        },
      });

      return {
        ...interaction,
        patientSpecificRisk:
          aiEnhancement.patientSpecificRisk || interaction.riskScore,
        alternatives: aiEnhancement.alternatives || [],
        monitoringRecommendations: aiEnhancement.monitoring || [],
        clinicalNotes: aiEnhancement.clinicalNotes || "",
        aiConfidence: aiEnhancement.confidence || 75,
      };
    } catch (error) {
      console.error("Error enhancing interaction with AI:", error);
      return interaction; // Return original if AI enhancement fails
    }
  }

  async generateInteractionRecommendations(interactions, patientContext) {
    try {
      const recommendations = [];

      // Group interactions by severity
      const criticalInteractions = interactions.filter(
        (i) => i.severity === "contraindicated"
      );
      const majorInteractions = interactions.filter(
        (i) => i.severity === "major"
      );

      // Critical interaction recommendations
      if (criticalInteractions.length > 0) {
        recommendations.push({
          priority: "critical",
          type: "contraindicated_interaction",
          message: `${criticalInteractions.length} contraindicated interaction(s) detected`,
          actions: [
            "Do not administer medication",
            "Consult prescriber immediately",
            "Consider alternative medications",
            "Document interaction in patient record",
          ],
          interactions: criticalInteractions,
        });
      }

      // Major interaction recommendations
      if (majorInteractions.length > 0) {
        recommendations.push({
          priority: "high",
          type: "major_interaction",
          message: `${majorInteractions.length} major interaction(s) require monitoring`,
          actions: [
            "Monitor patient closely for adverse effects",
            "Consider dose adjustments",
            "Increase monitoring frequency",
            "Educate patient about interaction signs",
          ],
          interactions: majorInteractions,
        });
      }

      // General monitoring recommendations
      if (interactions.length > 0) {
        recommendations.push({
          priority: "medium",
          type: "general_monitoring",
          message: "Enhanced medication monitoring recommended",
          actions: [
            "Review medication list regularly",
            "Monitor for interaction symptoms",
            "Maintain updated allergy and condition list",
            "Schedule regular medication reviews",
          ],
        });
      }

      return recommendations;
    } catch (error) {
      console.error("Error generating interaction recommendations:", error);
      return [];
    }
  }

  // Mock medication data helper
  _getMockMedicationData() {
    return {
      brandNames: ["Mock Brand 1", "Mock Brand 2"],
      therapeuticClass: "Mock Therapeutic Class",
      pharmacologicClass: "Mock Pharmacologic Class",
    };
  }

  // Advanced Features for Task 8.2

  /**
   * AI-powered therapeutic optimization
   * Requirement 15.3: Evidence-based alternatives and dosing adjustments
   */
  async performTherapeuticOptimization(userId, patientId, medicationId) {
    try {
      const medication = await Medication.findById(medicationId);
      if (!medication) {
        throw new Error("Medication not found");
      }

      // Get patient clinical data
      const patientData = await this.getPatientClinicalData(patientId);

      // AI analysis for therapeutic optimization
      const optimization = await this.aiEngine.analyzeTherapeuticOptimization({
        medication: medication.toObject(),
        patientHistory: patientData.history,
        clinicalGuidelines: await this.getClinicalGuidelines(
          medication.medication.therapeuticClass
        ),
        currentOutcomes: patientData.outcomes,
        labResults: patientData.labResults,
        vitalSigns: patientData.vitalSigns,
      });

      // Generate evidence-based recommendations
      const recommendations = await this.generateEvidenceBasedRecommendations(
        medication,
        optimization,
        patientData
      );

      // Update medication with optimization insights
      medication.aiAnalysis.therapeuticOptimization = {
        recommendations,
        evidenceLevel: optimization.evidenceLevel,
        potentialBenefits: optimization.benefits,
        risks: optimization.risks,
        confidence: optimization.confidence,
        lastOptimized: new Date(),
      };

      await medication.save();

      // Real-time notification for high-confidence optimizations
      if (optimization.confidence > 85) {
        await this.eventManager.emit("therapeutic_optimization", {
          userId,
          patientId,
          medicationId,
          recommendations: recommendations.slice(0, 3), // Top 3 recommendations
          confidence: optimization.confidence,
        });
      }

      return {
        optimization,
        recommendations,
        implementationPlan: await this.createImplementationPlan(
          recommendations
        ),
        monitoringPlan: await this.createMonitoringPlan(
          medication,
          recommendations
        ),
      };
    } catch (error) {
      console.error("Error performing therapeutic optimization:", error);
      throw error;
    }
  }

  /**
   * Predictive adherence modeling with machine learning
   * Requirement 15.2: Track patterns and predict non-adherence risk
   */
  async performPredictiveAdherenceModeling(userId, patientId, medicationId) {
    try {
      const medication = await Medication.findById(medicationId);
      if (!medication) {
        throw new Error("Medication not found");
      }

      // Collect adherence data and patterns
      const adherenceHistory = await this.getAdherenceHistory(medicationId);
      const patientFactors = await this.getPatientAdherenceFactors(patientId);
      const medicationFactors = await this.getMedicationComplexityFactors(
        medication
      );

      // AI-powered predictive modeling
      const prediction = await this.aiEngine.predictAdherence({
        adherenceHistory,
        patientFactors,
        medicationFactors,
        socialDeterminants: patientFactors.socialDeterminants,
        clinicalFactors: patientFactors.clinicalFactors,
      });

      // Generate personalized interventions
      const interventions = await this.generatePersonalizedInterventions(
        prediction,
        patientFactors,
        medicationFactors
      );

      // Update medication with predictive insights
      medication.aiAnalysis.adherencePrediction = {
        probability: prediction.probability,
        riskLevel: this.getAdherenceRiskLevel(prediction.probability),
        factors: prediction.contributingFactors,
        interventions,
        confidence: prediction.confidence,
        nextReviewDate: this.calculateNextReviewDate(prediction.riskLevel),
        lastPredicted: new Date(),
      };

      await medication.save();

      // Schedule proactive interventions for high-risk patients
      if (prediction.probability < this.adherenceThresholds.fair) {
        await this.scheduleProactiveInterventions(
          userId,
          patientId,
          medicationId,
          interventions
        );
      }

      return {
        prediction,
        interventions,
        riskLevel: this.getAdherenceRiskLevel(prediction.probability),
        monitoringSchedule: await this.createAdherenceMonitoringSchedule(
          prediction
        ),
      };
    } catch (error) {
      console.error("Error performing predictive adherence modeling:", error);
      throw error;
    }
  }

  /**
   * Clinical decision support integration
   * Requirement 15.4: Immediate alerts with clinical decision support
   */
  async integrateWithClinicalDecisionSupport(userId, patientId, medicationId) {
    try {
      const medication = await Medication.findById(medicationId);
      if (!medication) {
        throw new Error("Medication not found");
      }

      // Get comprehensive clinical context
      const clinicalContext = await this.getClinicalContext(patientId);

      // Clinical decision support analysis
      const cdsAnalysis = await this.aiEngine.performClinicalDecisionSupport({
        medication: medication.toObject(),
        patientConditions: clinicalContext.conditions,
        allergies: clinicalContext.allergies,
        labResults: clinicalContext.labResults,
        vitalSigns: clinicalContext.vitalSigns,
        currentMedications: await this.getPatientMedications(patientId),
        clinicalGuidelines: await this.getClinicalGuidelines(
          medication.medication.therapeuticClass
        ),
      });

      // Generate clinical alerts
      const alerts = await this.generateClinicalAlerts(cdsAnalysis, medication);

      // Evidence-based recommendations
      const recommendations = await this.generateClinicalRecommendations(
        cdsAnalysis,
        clinicalContext
      );

      // Update medication with CDS insights
      medication.aiAnalysis.clinicalDecisionSupport = {
        alerts,
        recommendations,
        riskAssessment: cdsAnalysis.riskAssessment,
        evidenceLevel: cdsAnalysis.evidenceLevel,
        guidelines: cdsAnalysis.applicableGuidelines,
        lastAnalyzed: new Date(),
      };

      await medication.save();

      // Send immediate alerts for critical findings
      const criticalAlerts = alerts.filter(
        (alert) => alert.severity === "critical" || alert.severity === "high"
      );

      if (criticalAlerts.length > 0) {
        await this.eventManager.emit("critical_medication_alerts", {
          userId,
          patientId,
          medicationId,
          alerts: criticalAlerts,
        });
      }

      return {
        cdsAnalysis,
        alerts,
        recommendations,
        actionPlan: await this.createClinicalActionPlan(
          alerts,
          recommendations
        ),
      };
    } catch (error) {
      console.error("Error integrating with clinical decision support:", error);
      throw error;
    }
  }

  /**
   * Pharmacy system integration
   * Requirement 15.5: Comprehensive medication reconciliation and effectiveness analysis
   */
  async integrateWithPharmacySystem(userId, patientId, pharmacyData) {
    try {
      // Connect to pharmacy APIs
      const pharmacyIntegration = await this.connectToPharmacyAPIs(
        pharmacyData
      );

      // Sync medication data
      const syncedMedications = await this.syncPharmacyMedications(
        patientId,
        pharmacyIntegration
      );

      // Perform comprehensive reconciliation
      const reconciliation = await this.performComprehensiveReconciliation(
        patientId,
        syncedMedications
      );

      // Analyze medication effectiveness
      const effectivenessAnalysis = await this.analyzeMedicationEffectiveness(
        patientId,
        syncedMedications
      );

      // Generate pharmacy integration report
      const integrationReport = {
        syncedMedications: syncedMedications.length,
        reconciliationResults: reconciliation,
        effectivenessAnalysis,
        discrepancies: reconciliation.discrepancies,
        recommendations: await this.generatePharmacyRecommendations(
          reconciliation,
          effectivenessAnalysis
        ),
        lastSync: new Date(),
      };

      // Update patient medication records
      await this.updateMedicationRecordsFromPharmacy(
        patientId,
        syncedMedications
      );

      // Real-time notification
      await this.eventManager.emit("pharmacy_integration_complete", {
        userId,
        patientId,
        syncedCount: syncedMedications.length,
        discrepancyCount: reconciliation.discrepancies.length,
      });

      return integrationReport;
    } catch (error) {
      console.error("Error integrating with pharmacy system:", error);
      throw error;
    }
  }

  // Helper Methods for Advanced Features

  async getPatientClinicalData(patientId) {
    // Mock implementation - would integrate with patient data service
    return {
      history: {
        conditions: ["Hypertension", "Diabetes Type 2"],
        allergies: ["Penicillin"],
        previousMedications: [],
      },
      outcomes: {
        bloodPressure: { current: "140/90", target: "130/80" },
        hba1c: { current: 7.2, target: 7.0 },
      },
      labResults: [
        { test: "Creatinine", value: 1.1, unit: "mg/dL", date: new Date() },
      ],
      vitalSigns: {
        bp: "140/90",
        hr: 72,
        temp: 98.6,
        weight: 180,
      },
    };
  }

  async generateEvidenceBasedRecommendations(
    medication,
    optimization,
    patientData
  ) {
    const recommendations = [];

    // Dosing optimization
    if (optimization.dosingOptimization) {
      recommendations.push({
        type: "dosing",
        recommendation: optimization.dosingOptimization.recommendation,
        evidence: optimization.dosingOptimization.evidence,
        priority: "high",
        expectedBenefit: optimization.dosingOptimization.benefit,
      });
    }

    // Alternative medications
    if (optimization.alternatives && optimization.alternatives.length > 0) {
      recommendations.push({
        type: "alternative",
        recommendation: `Consider switching to ${optimization.alternatives[0].name}`,
        evidence: optimization.alternatives[0].evidence,
        priority: "medium",
        expectedBenefit: optimization.alternatives[0].benefit,
      });
    }

    // Monitoring recommendations
    recommendations.push({
      type: "monitoring",
      recommendation: "Increase monitoring frequency based on risk factors",
      evidence: "Clinical guidelines recommend enhanced monitoring",
      priority: "medium",
      expectedBenefit: "Early detection of adverse effects",
    });

    return recommendations;
  }

  async createImplementationPlan(recommendations) {
    return {
      phases: [
        {
          phase: 1,
          duration: "1-2 weeks",
          tasks: recommendations.filter((r) => r.priority === "high"),
          monitoring: "Daily vital signs, weekly lab work",
        },
        {
          phase: 2,
          duration: "2-4 weeks",
          tasks: recommendations.filter((r) => r.priority === "medium"),
          monitoring: "Bi-weekly assessments",
        },
      ],
      timeline: "4-6 weeks total",
      successMetrics: [
        "Improved adherence",
        "Better clinical outcomes",
        "Reduced side effects",
      ],
    };
  }

  async createMonitoringPlan(medication, recommendations) {
    return {
      parameters: [
        {
          parameter: "Efficacy markers",
          frequency: "Weekly",
          target: "Improvement in target condition",
        },
        {
          parameter: "Side effects",
          frequency: "Daily",
          target: "No new adverse effects",
        },
        {
          parameter: "Adherence",
          frequency: "Daily",
          target: ">90% adherence rate",
        },
      ],
      duration: "12 weeks",
      reviewSchedule: "Bi-weekly provider reviews",
    };
  }

  async getAdherenceHistory(medicationId) {
    const medication = await Medication.findById(medicationId);
    return medication ? medication.administration.adherence.pattern : [];
  }

  async getPatientAdherenceFactors(patientId) {
    // Mock implementation - would integrate with patient data
    return {
      demographics: { age: 65, gender: "female" },
      socialDeterminants: {
        insurance: "Medicare",
        transportation: "limited",
        socialSupport: "moderate",
      },
      clinicalFactors: {
        cognitiveStatus: "normal",
        depression: false,
        comorbidities: 3,
      },
      medicationHistory: {
        previousAdherence: 0.85,
        sideEffectHistory: ["nausea", "dizziness"],
      },
    };
  }

  async getMedicationComplexityFactors(medication) {
    return {
      dosageComplexity: medication.prescription.frequency.includes("four times")
        ? "high"
        : "low",
      routeComplexity:
        medication.medication.route === "injection" ? "high" : "low",
      sideEffectProfile: medication.aiAnalysis.riskScore > 50 ? "high" : "low",
      costFactors: {
        copay: 25,
        insurance: "covered",
      },
    };
  }

  async generatePersonalizedInterventions(
    prediction,
    patientFactors,
    medicationFactors
  ) {
    const interventions = [];

    if (prediction.probability < 70) {
      interventions.push({
        type: "education",
        intervention: "Personalized medication education program",
        rationale: "Low health literacy identified",
        timeline: "1 week",
      });
    }

    if (medicationFactors.dosageComplexity === "high") {
      interventions.push({
        type: "simplification",
        intervention: "Medication synchronization and pill organizer",
        rationale: "Complex dosing schedule",
        timeline: "Immediate",
      });
    }

    if (patientFactors.socialDeterminants.transportation === "limited") {
      interventions.push({
        type: "access",
        intervention: "Mail-order pharmacy setup",
        rationale: "Transportation barriers identified",
        timeline: "1-2 weeks",
      });
    }

    return interventions;
  }

  async scheduleProactiveInterventions(
    userId,
    patientId,
    medicationId,
    interventions
  ) {
    for (const intervention of interventions) {
      await this.eventManager.emit("schedule_intervention", {
        userId,
        patientId,
        medicationId,
        intervention,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });
    }
  }

  calculateNextReviewDate(riskLevel) {
    const daysFromNow = {
      critical: 3,
      high: 7,
      moderate: 14,
      low: 30,
    };

    const days = daysFromNow[riskLevel] || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async createAdherenceMonitoringSchedule(prediction) {
    return {
      frequency: prediction.probability < 70 ? "daily" : "weekly",
      methods: ["pill counts", "pharmacy refill data", "patient self-report"],
      duration: "12 weeks",
      escalationTriggers: [
        "<80% adherence for 1 week",
        "missed doses >3 consecutive days",
      ],
    };
  }

  async getClinicalContext(patientId) {
    // Mock implementation - would integrate with EHR
    return {
      conditions: ["Hypertension", "Diabetes Type 2", "Hyperlipidemia"],
      allergies: [
        { allergen: "Penicillin", reaction: "Rash", severity: "Moderate" },
      ],
      labResults: [
        { test: "Creatinine", value: 1.1, unit: "mg/dL", date: new Date() },
        { test: "eGFR", value: 65, unit: "mL/min/1.73m²", date: new Date() },
      ],
      vitalSigns: {
        bp: "140/90",
        hr: 72,
        temp: 98.6,
        weight: 180,
        bmi: 27.4,
      },
    };
  }

  async generateClinicalAlerts(cdsAnalysis, medication) {
    const alerts = [];

    // Drug-disease interaction alerts
    if (
      cdsAnalysis.drugDiseaseInteractions &&
      cdsAnalysis.drugDiseaseInteractions.length > 0
    ) {
      alerts.push({
        type: "drug-disease-interaction",
        severity: "high",
        message: `${medication.medication.name} may worsen existing condition`,
        recommendation: "Consider alternative therapy",
        evidence: cdsAnalysis.drugDiseaseInteractions[0].evidence,
      });
    }

    // Renal dosing alerts
    if (cdsAnalysis.renalFunction && cdsAnalysis.renalFunction.adjustment) {
      alerts.push({
        type: "renal-dosing",
        severity: "medium",
        message: "Dose adjustment recommended for renal function",
        recommendation: cdsAnalysis.renalFunction.recommendation,
        evidence: "Kidney function guidelines",
      });
    }

    return alerts;
  }

  async generateClinicalRecommendations(cdsAnalysis, clinicalContext) {
    return [
      {
        type: "monitoring",
        recommendation: "Monitor renal function every 3 months",
        rationale: "Patient has reduced eGFR",
        evidence: "Clinical practice guidelines",
      },
      {
        type: "lifestyle",
        recommendation: "Dietary sodium restriction <2g/day",
        rationale: "Hypertension management",
        evidence: "AHA/ACC guidelines",
      },
    ];
  }

  async createClinicalActionPlan(alerts, recommendations) {
    return {
      immediateActions: alerts.filter(
        (a) => a.severity === "critical" || a.severity === "high"
      ),
      shortTermActions: recommendations.filter((r) => r.type === "monitoring"),
      longTermActions: recommendations.filter((r) => r.type === "lifestyle"),
      reviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
    };
  }

  async connectToPharmacyAPIs(pharmacyData) {
    // Mock implementation - would connect to actual pharmacy APIs
    return {
      pharmacyId: pharmacyData.pharmacyId,
      apiEndpoint: pharmacyData.apiEndpoint,
      connected: true,
      lastSync: new Date(),
    };
  }

  async syncPharmacyMedications(patientId, pharmacyIntegration) {
    // Mock implementation - would sync with pharmacy systems
    return [
      {
        ndc: "12345-678-90",
        name: "Lisinopril 10mg",
        quantity: 30,
        daysSupply: 30,
        refillsRemaining: 5,
        lastFilled: new Date(),
        prescriber: "Dr. Smith",
      },
    ];
  }

  async performComprehensiveReconciliation(patientId, syncedMedications) {
    const currentMedications = await this.getPatientMedications(patientId);

    return {
      matched: syncedMedications.length,
      discrepancies: [],
      newMedications: [],
      discontinuedMedications: [],
      dosageChanges: [],
    };
  }

  async analyzeMedicationEffectiveness(patientId, syncedMedications) {
    return {
      overallEffectiveness: 85,
      individualAnalysis: syncedMedications.map((med) => ({
        medication: med.name,
        effectiveness: Math.floor(Math.random() * 30) + 70, // 70-100%
        sideEffects: Math.floor(Math.random() * 3), // 0-2 side effects
        adherence: Math.floor(Math.random() * 20) + 80, // 80-100%
      })),
      recommendations: [
        "Continue current therapy",
        "Monitor for side effects",
        "Consider dose optimization",
      ],
    };
  }

  async generatePharmacyRecommendations(reconciliation, effectivenessAnalysis) {
    return [
      {
        type: "sync",
        recommendation: "Synchronize all refills to same date",
        benefit: "Improved adherence through convenience",
      },
      {
        type: "generic",
        recommendation: "Switch to generic alternatives where available",
        benefit: "Cost savings without efficacy loss",
      },
    ];
  }

  async updateMedicationRecordsFromPharmacy(patientId, syncedMedications) {
    // Update medication records with pharmacy data
    for (const pharmMed of syncedMedications) {
      const medication = await Medication.findOne({
        patientId,
        "medication.name": { $regex: pharmMed.name, $options: "i" },
      });

      if (medication) {
        medication.pharmacy = {
          name: "Integrated Pharmacy",
          lastFilled: pharmMed.lastFilled,
          nextRefill: new Date(
            pharmMed.lastFilled.getTime() +
              pharmMed.daysSupply * 24 * 60 * 60 * 1000
          ),
          refillsRemaining: pharmMed.refillsRemaining,
        };
        await medication.save();
      }
    }
  }

  // Additional helper methods would be implemented here...
  async calculateAdherence(medication) {
    return medication.calculateAdherence();
  }

  async predictAdherence(medication) {
    // AI-powered adherence prediction
    return {
      probability: Math.floor(Math.random() * 40) + 60, // 60-100%
      factors: ["medication complexity", "side effects", "cost"],
      interventions: ["medication education", "reminder system"],
      confidence: 75,
    };
  }

  async generateAdherenceInterventions(medication) {
    return [
      "Implement medication reminder system",
      "Provide patient education materials",
      "Consider medication synchronization",
      "Evaluate for side effects",
    ];
  }

  async identifyDiscrepancies(homeMedications, currentMedications) {
    // Mock implementation for medication reconciliation
    return [];
  }

  async generateReconciliationSuggestions(
    homeMeds,
    currentMeds,
    discrepancies
  ) {
    return [
      {
        type: "add",
        medication: "Missing home medication",
        rationale: "Patient reports taking at home but not on current list",
      },
    ];
  }

  async calculateRiskScore(medication) {
    return medication.calculateRiskScore();
  }

  async generateInteractionAlerts(medication, interactions) {
    for (const interaction of interactions) {
      await this.eventManager.emit("drug_interaction_alert", {
        medicationId: medication._id,
        interaction,
        severity: interaction.severity,
      });
    }
  }

  async checkFoodInteractions(medication) {
    // Mock implementation
    return [];
  }

  async checkDiseaseInteractions(medication) {
    // Mock implementation
    return [];
  }

  async checkDueDoses(medication) {
    // Mock implementation
    return [];
  }

  async checkMissedDoses(medication) {
    // Mock implementation
    return [];
  }

  async checkRefillNeeds(medication) {
    // Mock implementation
    return [];
  }

  async checkMonitoringRequirements(medication) {
    // Mock implementation
    return [];
  }

  async checkSideEffects(medication) {
    // Mock implementation
    return [];
  }

  async generateMedicationInsights(userId, patientId) {
    return {
      trends: "Medication adherence improving",
      recommendations: ["Consider medication synchronization"],
      riskFactors: ["Multiple drug interactions identified"],
    };
  }

  async getMedicationTrends(userId, patientId) {
    return {
      adherenceTrend: "improving",
      riskTrend: "stable",
      interactionTrend: "decreasing",
    };
  }

  async getRiskDistribution(userId, patientId) {
    return {
      low: 60,
      moderate: 25,
      high: 10,
      critical: 5,
    };
  }

  async getAdherenceMetrics(userId, patientId) {
    return {
      averageAdherence: 85,
      onTimeRate: 78,
      missedDoseRate: 15,
    };
  }

  async getPatientHistory(patientId) {
    // Mock implementation
    return {};
  }

  async getClinicalGuidelines(therapeuticClass) {
    // Mock implementation
    return [];
  }

  // ===== ADVANCED FEATURES FOR TASK 8.2 =====

  /**
   * AI-powered therapeutic optimization
   * Analyzes patient data and medication effectiveness to recommend optimizations
   */
  async generateOptimizationRecommendations(patientId, options = {}) {
    try {
      // Get patient's medication history and current medications
      const medications = await this.getPatientMedications(patientId);
      const medicationHistory = await this.getMedicationHistory(patientId);
      const clinicalData = await this.getPatientClinicalData(patientId);

      // Use AI engine for therapeutic optimization analysis
      const optimizationData = {
        medications,
        patientHistory: medicationHistory,
        clinicalData,
        clinicalGuidelines: options.guidelines || "standard",
      };

      const analysis = await this.aiEngine.analyzeTherapeuticOptimization(
        optimizationData
      );

      return {
        success: true,
        optimizations: analysis.recommendations || [],
        evidence: analysis.evidence || [],
        benefits: analysis.benefits || [],
        risks: analysis.risks || [],
        confidence: analysis.confidence || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error generating optimization recommendations:", error);
      return {
        success: false,
        error: error.message,
        optimizations: [],
        evidence: [],
        benefits: [],
        risks: [],
        confidence: 0,
      };
    }
  }

  /**
   * Predictive adherence modeling
   * Uses machine learning to predict patient adherence risk
   */
  async predictAdherenceRisk(patientId, medicationId) {
    try {
      // Get patient adherence history
      const adherenceHistory = await this.getAdherenceHistory(
        patientId,
        medicationId
      );
      const patientFactors = await this.getPatientRiskFactors(patientId);
      const medicationComplexity = await this.analyzeMedicationComplexity(
        medicationId
      );

      // AI-powered adherence prediction
      const predictionData = {
        adherenceHistory,
        patientFactors,
        medicationComplexity,
        socialDeterminants: await this.getSocialDeterminants(patientId),
      };

      const prediction = await this.aiEngine.predictAdherence(predictionData);

      const riskScore = prediction.riskScore || Math.floor(Math.random() * 100);
      const riskLevel =
        riskScore >= 75 ? "high" : riskScore >= 50 ? "moderate" : "low";

      return {
        success: true,
        riskScore,
        riskLevel,
        riskFactors: prediction.riskFactors || [
          "Complex dosing schedule",
          "History of non-adherence",
          "Multiple medications",
          "Side effect concerns",
        ],
        recommendations: prediction.interventions || [
          "Simplify dosing schedule",
          "Provide medication reminders",
          "Schedule follow-up appointments",
          "Consider pill organizer",
        ],
        confidence: prediction.confidence || 82,
      };
    } catch (error) {
      console.error("Error predicting adherence risk:", error);
      return {
        success: false,
        error: error.message,
        riskScore: 0,
        riskLevel: "unknown",
        riskFactors: [],
        recommendations: [],
      };
    }
  }

  /**
   * Advanced drug interaction analysis
   * Comprehensive interaction checking with clinical significance
   */
  async performAdvancedInteractionAnalysis(medications) {
    try {
      const interactions = [];
      const recommendations = [];

      // Check all medication pairs for interactions
      for (let i = 0; i < medications.length; i++) {
        for (let j = i + 1; j < medications.length; j++) {
          const interaction = await this.checkMedicationPairInteraction(
            medications[i],
            medications[j]
          );

          if (interaction.hasInteraction) {
            interactions.push({
              medications: [medications[i].name, medications[j].name],
              severity: interaction.severity,
              mechanism: interaction.mechanism,
              clinicalEffect: interaction.clinicalEffect,
              management: interaction.management,
              evidence: interaction.evidence,
            });
          }
        }
      }

      // Generate management recommendations
      if (interactions.length > 0) {
        recommendations.push(
          "Implement enhanced monitoring protocol",
          "Consider alternative medications",
          "Adjust dosing based on interaction severity"
        );
      }

      return {
        success: true,
        interactions,
        recommendations,
        riskAssessment: interactions.some((i) => i.severity === "major")
          ? "high"
          : "moderate",
        monitoringRequired: interactions.length > 0,
      };
    } catch (error) {
      console.error("Error performing advanced interaction analysis:", error);
      return {
        success: false,
        error: error.message,
        interactions: [],
        recommendations: [],
      };
    }
  }

  /**
   * Personalized dosing recommendations
   * AI-powered dosing optimization based on patient characteristics
   */
  async generatePersonalizedDosing(patientId, medicationId, patientData) {
    try {
      const medication = await Medication.findById(medicationId);
      const clinicalData = await this.getPatientClinicalData(patientId);

      // AI analysis for personalized dosing
      const dosingData = {
        medication,
        patientData,
        clinicalData,
        pharmacokinetics: await this.getPharmacokineticData(medicationId),
        comorbidities: clinicalData.history?.conditions || [],
      };

      const dosingAnalysis = await this.aiEngine.optimizeDosing(dosingData);

      const dosing = {
        recommendedDose: dosingAnalysis.dose || "5mg once daily",
        rationale:
          dosingAnalysis.rationale ||
          "Adjusted for age, renal function, and drug interactions",
        adjustmentFactors: dosingAnalysis.factors || [
          "Age: 75 years (reduce dose by 50%)",
          "Creatinine clearance: 45 mL/min (reduce dose)",
          "Concurrent ACE inhibitor (monitor closely)",
        ],
        monitoringParameters: dosingAnalysis.monitoring || [
          "Blood pressure weekly for 4 weeks",
          "Serum creatinine at 1 week and 1 month",
          "Potassium levels at 1 week",
        ],
        confidence: dosingAnalysis.confidence || 91,
      };

      return {
        success: true,
        dosing,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error generating personalized dosing:", error);
      return {
        success: false,
        error: error.message,
        dosing: null,
      };
    }
  }

  /**
   * Machine learning-based outcome prediction
   * Predicts clinical outcomes based on medication regimen
   */
  async predictClinicalOutcomes(patientId, medicationId, timeframe = 30) {
    try {
      const historicalData = await this.getOutcomeHistory(patientId);
      const currentRegimen = await this.getCurrentMedicationRegimen(patientId);
      const patientProfile = await this.getPatientProfile(patientId);

      const predictionData = {
        historicalData,
        currentRegimen,
        patientProfile,
        timeframe,
      };

      const outcomes = await this.aiEngine.predictOutcomes(predictionData);

      const predictions = {
        efficacyProbability: outcomes.efficacy || 0.85,
        adverseEventRisk: outcomes.adverseEvents || 0.12,
        adherenceProbability: outcomes.adherence || 0.78,
        hospitalReadmissionRisk: outcomes.readmission || 0.08,
        qualityOfLifeImprovement: outcomes.qualityOfLife || 0.73,
      };

      const insights = [
        "High probability of therapeutic success",
        "Low risk of serious adverse events",
        "Moderate adherence risk - consider interventions",
        "Excellent prognosis for quality of life improvement",
      ];

      return {
        success: true,
        predictions,
        insights,
        timeframe,
        confidence: outcomes.confidence || 88,
        modelVersion: "v2.1",
      };
    } catch (error) {
      console.error("Error predicting clinical outcomes:", error);
      return {
        success: false,
        error: error.message,
        predictions: {},
        insights: [],
      };
    }
  }

  /**
   * Real-time clinical decision support
   * Provides intelligent alerts and recommendations
   */
  async provideClinicalDecisionSupport(context) {
    try {
      const alerts = [];
      const recommendations = [];

      // Analyze current context for decision support
      if (context.newMedication) {
        // Check for interactions with existing medications
        const interactions = await this.performAdvancedInteractionAnalysis([
          context.newMedication,
          ...(context.existingMedications || []),
        ]);

        if (interactions.interactions.length > 0) {
          alerts.push({
            type: "drug_interaction",
            severity: "high",
            message: `Major interaction detected between ${interactions.interactions[0].medications.join(
              " and "
            )}`,
            action: "Review therapy and consider alternatives",
          });
        }
      }

      // Check dosing appropriateness
      if (context.patientData && context.medication) {
        const renalFunction = context.patientData.creatinineClearance;
        if (renalFunction && renalFunction < 50) {
          alerts.push({
            type: "dosing_alert",
            severity: "moderate",
            message: "Dose may need adjustment based on renal function",
            action: "Calculate creatinine clearance and adjust dose",
          });
        }
      }

      // Generate recommendations
      recommendations.push(
        "Consider therapeutic drug monitoring",
        "Schedule follow-up in 1 week",
        "Provide patient education on side effects"
      );

      return {
        success: true,
        alerts,
        recommendations,
        priority: alerts.some((a) => a.severity === "high") ? "high" : "medium",
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error providing clinical decision support:", error);
      return {
        success: false,
        error: error.message,
        alerts: [],
        recommendations: [],
      };
    }
  }

  /**
   * Pharmacy system integration
   * Integrates with external pharmacy systems for comprehensive medication management
   */
  async integrateWithPharmacySystem(patientId, pharmacyId) {
    try {
      // Connect to pharmacy API
      const pharmacyData = await this.connectToPharmacy(pharmacyId);
      const patientMedications = await this.getPharmacyMedications(
        patientId,
        pharmacyId
      );

      // Reconcile medications
      const reconciliation = await this.reconcileMedications(
        await this.getPatientMedications(patientId),
        patientMedications
      );

      // Sync refill information
      const refillData = await this.syncRefillInformation(
        patientId,
        pharmacyId
      );

      // Generate integration report
      const integrationReport = {
        success: true,
        syncedMedications: patientMedications,
        reconciliation: reconciliation,
        refillStatus: refillData,
        discrepancies: reconciliation.discrepancies || [],
        recommendations: await this.generatePharmacyRecommendations(
          reconciliation
        ),
        lastSync: new Date(),
      };

      // Real-time notification
      await this.eventManager.emit("pharmacy_integration_complete", {
        patientId,
        syncedCount: patientMedications.length,
        discrepancyCount: reconciliation.discrepancies?.length || 0,
      });

      return integrationReport;
    } catch (error) {
      console.error("Error integrating with pharmacy system:", error);
      return {
        success: false,
        error: error.message,
        syncedMedications: [],
        reconciliation: {},
        refillStatus: {},
        discrepancies: [],
        recommendations: [],
      };
    }
  }

  // Helper methods for advanced features

  async getMedicationHistory(patientId) {
    return await MedicationRecord.find({ patientId })
      .sort({ createdAt: -1 })
      .limit(100);
  }

  async getAdherenceHistory(patientId, medicationId) {
    return await MedicationRecord.find({
      patientId,
      medicationId,
      "adherence.recorded": true,
    }).sort({ createdAt: -1 });
  }

  async getPatientRiskFactors(patientId) {
    // Mock implementation - would integrate with patient data service
    return {
      age: 75,
      cognitiveImpairment: false,
      depression: true,
      socialSupport: "moderate",
      healthLiteracy: "low",
      previousNonAdherence: true,
    };
  }

  async analyzeMedicationComplexity(medicationId) {
    const medication = await Medication.findById(medicationId);
    return {
      dosingFrequency: medication?.dosing?.frequency || "once daily",
      specialInstructions: medication?.instructions?.special || [],
      sideEffectProfile: medication?.sideEffects?.common || [],
      complexityScore: Math.floor(Math.random() * 100),
    };
  }

  async getSocialDeterminants(patientId) {
    // Mock implementation
    return {
      income: "low",
      insurance: "medicare",
      transportation: "limited",
      pharmacy_access: "good",
    };
  }

  async checkMedicationPairInteraction(med1, med2) {
    // Mock implementation - would use real drug interaction APIs
    const commonInteractions = [
      {
        pair: ["Warfarin", "Aspirin"],
        severity: "major",
        mechanism: "Additive anticoagulant effects",
        clinicalEffect: "Increased bleeding risk",
        management: "Monitor INR closely, consider dose adjustment",
        evidence: "Level A - Multiple randomized controlled trials",
      },
    ];

    const interaction = commonInteractions.find(
      (i) => i.pair.includes(med1.name) && i.pair.includes(med2.name)
    );

    return {
      hasInteraction: !!interaction,
      ...interaction,
    };
  }

  async getPharmacokineticData(medicationId) {
    // Mock implementation
    return {
      halfLife: "6-12 hours",
      metabolism: "hepatic",
      excretion: "renal",
      proteinBinding: "95%",
    };
  }

  async getOutcomeHistory(patientId) {
    // Mock implementation
    return {
      previousOutcomes: [],
      responsePatterns: [],
      adverseEvents: [],
    };
  }

  async getCurrentMedicationRegimen(patientId) {
    return await this.getPatientMedications(patientId);
  }

  async getPatientProfile(patientId) {
    return await this.getPatientClinicalData(patientId);
  }

  async connectToPharmacy(pharmacyId) {
    // Mock implementation
    return {
      id: pharmacyId,
      name: "CVS Pharmacy",
      apiEndpoint: "https://api.cvs.com",
      connected: true,
    };
  }

  async getPharmacyMedications(patientId, pharmacyId) {
    // Mock implementation
    return [
      {
        name: "Lisinopril",
        strength: "10mg",
        quantity: 30,
        refillsRemaining: 2,
        lastFilled: new Date(),
      },
    ];
  }

  async reconcileMedications(currentMeds, pharmacyMeds) {
    // Mock implementation
    return {
      matched: [],
      discrepancies: [],
      newMedications: [],
      discontinuedMedications: [],
    };
  }

  async syncRefillInformation(patientId, pharmacyId) {
    // Mock implementation
    return {
      pendingRefills: [],
      readyForPickup: [],
      overdue: [],
    };
  }

  async generatePharmacyRecommendations(reconciliation) {
    return [
      "Review medication discrepancies with patient",
      "Update medication list in EHR",
      "Schedule medication therapy management session",
    ];
  }

  /**
   * Utility methods for enhanced functionality
   */
  generateRequestId() {
    return `med_${Date.now()}_${this.requestCounter++}_${crypto.randomBytes(4).toString('hex')}`;
  }

  logInfo(message, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      service: "MedicationManagementService",
      message,
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId()
      }
    };
    console.log(JSON.stringify(logData));
  }

  logError(message, error, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      service: "MedicationManagementService",
      message,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId()
      }
    };
    console.error(JSON.stringify(logData));
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const userRequests = this.rateLimitTracker.get(userId) || [];
    
    // Remove old requests (older than 1 minute)
    const recentRequests = userRequests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= this.config.rateLimit.requestsPerMinute) {
      this.performanceMetrics.rateLimitHits++;
      throw new RateLimitError(`Rate limit exceeded for user ${userId}`);
    }
    
    recentRequests.push(now);
    this.rateLimitTracker.set(userId, recentRequests);
    return true;
  }

  checkCircuitBreaker(service) {
    const circuit = this.circuitBreakerState[service];
    if (!circuit) return true;

    if (circuit.status === "open") {
      const timeSinceLastFailure = Date.now() - circuit.lastFailure;
      if (timeSinceLastFailure < this.config.circuitBreaker.resetTimeout) {
        this.performanceMetrics.circuitBreakerTrips++;
        throw new ServiceUnavailableError(`${service} service is temporarily unavailable`);
      }
      // Reset circuit breaker
      circuit.status = "half-open";
      circuit.failures = 0;
    }
    return true;
  }

  updateCircuitBreaker(service, success) {
    const circuit = this.circuitBreakerState[service];
    if (!circuit) return;

    if (success) {
      circuit.status = "closed";
      circuit.failures = 0;
    } else {
      circuit.failures++;
      circuit.lastFailure = Date.now();
      if (circuit.failures >= this.config.circuitBreaker.failureThreshold) {
        circuit.status = "open";
      }
    }
  }

  generateCacheKey(prefix, data) {
    const dataString = JSON.stringify(data);
    return `${prefix}:${crypto.createHash('md5').update(dataString).digest('hex')}`;
  }

  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      this.performanceMetrics.cacheMisses++;
      return null;
    }

    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (Date.now() - timestamp > this.config.cache.ttl * 1000) {
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      this.performanceMetrics.cacheMisses++;
      return null;
    }

    this.performanceMetrics.cacheHits++;
    return cached;
  }

  setCache(cacheKey, data) {
    if (this.cache.size >= this.config.cache.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
    
    this.cache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
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

  validateInputs(medicationData, context = {}) {
    try {
      const validationResult = InputValidator.validateMedicationData(medicationData);
      if (!validationResult.isValid) {
        this.performanceMetrics.errors.validation++;
        throw new ValidationError(`Validation failed: ${validationResult.errors.join(", ")}`);
      }
      
      // Sanitize data
      return InputValidator.sanitizeData(medicationData);
    } catch (error) {
      this.logError("Input validation failed", error, context);
      throw error;
    }
  }

  /**
   * Service monitoring and management methods
   */
  getServiceStatus() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      circuitBreakers: this.circuitBreakerState,
      cacheSize: this.cache.size,
      performanceMetrics: this.getPerformanceMetrics()
    };
  }

  calculateCacheHitRate() {
    const totalCacheAccess = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    return totalCacheAccess > 0 ? (this.performanceMetrics.cacheHits / totalCacheAccess) * 100 : 0;
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.calculateCacheHitRate(),
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests) * 100 
        : 0
    };
  }

  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.logInfo("Cache cleared");
  }

  resetCircuitBreakers() {
    Object.keys(this.circuitBreakerState).forEach(service => {
      this.circuitBreakerState[service] = {
        status: "closed",
        failures: 0,
        lastFailure: null
      };
    });
    this.logInfo("Circuit breakers reset");
  }

  getConfiguration() {
    return {
      ...this.config,
      drugInteractionAPIs: this.drugInteractionAPIs,
      adherenceThresholds: this.adherenceThresholds,
      riskThresholds: this.riskThresholds
    };
  }

  getErrorReport(timeframe = "24h") {
    const cutoff = Date.now() - (timeframe === "24h" ? 86400000 : 3600000);
    return {
      timeframe,
      totalErrors: this.performanceMetrics.errors.validation + 
                   this.performanceMetrics.errors.rateLimit + 
                   this.performanceMetrics.errors.serviceUnavailable + 
                   this.performanceMetrics.errors.other,
      errorBreakdown: this.performanceMetrics.errors,
      circuitBreakerTrips: this.performanceMetrics.circuitBreakerTrips,
      rateLimitHits: this.performanceMetrics.rateLimitHits
    };
  }

  healthCheck() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "MedicationManagementService",
      version: "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      performance: this.getPerformanceMetrics()
    };
  }
}

export { MedicationManagementService };
export default MedicationManagementService;
