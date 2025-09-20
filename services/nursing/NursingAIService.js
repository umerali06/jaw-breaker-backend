import openaiService from "../openaiService.js";
import geminiService from "../geminiService.js";
import { EventEmitter } from "events";
import crypto from "crypto";

// Custom error classes for better error handling
class NursingAIError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "NursingAIError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
  }
}

class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
    this.timestamp = new Date();
  }
}

class RateLimitError extends Error {
  constructor(userId, maxRequests, windowMs) {
    super(`Rate limit exceeded for user ${userId}`);
    this.name = "RateLimitError";
    this.userId = userId;
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamp = new Date();
  }
}

class ServiceUnavailableError extends Error {
  constructor(service, reason) {
    super(`Service ${service} is unavailable: ${reason}`);
    this.name = "ServiceUnavailableError";
    this.service = service;
    this.reason = reason;
    this.timestamp = new Date();
  }
}

// Input validation utilities
class InputValidator {
  static validateUserId(userId) {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new ValidationError("Invalid user ID", "userId", userId);
    }
    return userId.trim();
  }

  static validateTaskType(taskType) {
    const validTaskTypes = [
      "oasisAnalysis",
      "soapEnhancement",
      "medicationAnalysis",
      "clinicalDecision",
      "progressAnalysis",
      "outcomesPrediction",
      "assessmentAnalysis",
      "carePlanOptimization",
    ];

    if (!validTaskTypes.includes(taskType)) {
      throw new ValidationError("Invalid task type", "taskType", taskType);
    }
    return taskType;
  }

  static validatePrompt(prompt) {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new ValidationError("Invalid prompt", "prompt", prompt);
    }
    if (prompt.length > 10000) {
      throw new ValidationError("Prompt too long", "prompt", prompt.length);
    }
    return prompt.trim();
  }

  static sanitizeData(data) {
    if (!data || typeof data !== "object") {
      return {};
    }

    // Deep clone to avoid mutations
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove potentially dangerous properties
    delete sanitized.__proto__;
    delete sanitized.constructor;

    return sanitized;
  }
}

class NursingAIService extends EventEmitter {
  constructor() {
    super();

    // Enhanced configuration with environment variables
    this.config = {
      defaultProvider: process.env.NURSING_AI_DEFAULT_PROVIDER || "openai",
      fallbackProvider: process.env.NURSING_AI_FALLBACK_PROVIDER || "gemini",
      rateLimitMax: parseInt(process.env.NURSING_AI_RATE_LIMIT_MAX) || 100,
      rateLimitWindow:
        parseInt(process.env.NURSING_AI_RATE_LIMIT_WINDOW) || 60000,
      cacheTTL: parseInt(process.env.NURSING_AI_CACHE_TTL) || 3600,
      maxRetries: parseInt(process.env.NURSING_AI_MAX_RETRIES) || 3,
      circuitBreakerThreshold:
        parseInt(process.env.NURSING_AI_CIRCUIT_BREAKER_THRESHOLD) || 5,
      circuitBreakerTimeout:
        parseInt(process.env.NURSING_AI_CIRCUIT_BREAKER_TIMEOUT) || 30000,
    };

    this.providers = {
      openai: openaiService,
      gemini: geminiService,
    };

    // Enhanced AI model configurations for different nursing tasks
    this.modelConfigs = {
      oasisAnalysis: {
        openai: {
          model: process.env.OPENAI_OASIS_MODEL || "gpt-4",
          temperature: parseFloat(process.env.OPENAI_OASIS_TEMPERATURE) || 0.1,
          maxTokens: parseInt(process.env.OPENAI_OASIS_MAX_TOKENS) || 2000,
        },
        gemini: {
          model: process.env.GEMINI_OASIS_MODEL || "gemini-1.5-flash",
          temperature: parseFloat(process.env.GEMINI_OASIS_TEMPERATURE) || 0.1,
          maxOutputTokens:
            parseInt(process.env.GEMINI_OASIS_MAX_TOKENS) || 2000,
        },
      },
      soapEnhancement: {
        openai: {
          model: process.env.OPENAI_SOAP_MODEL || "gpt-4",
          temperature: parseFloat(process.env.OPENAI_SOAP_TEMPERATURE) || 0.3,
          maxTokens: parseInt(process.env.OPENAI_SOAP_MAX_TOKENS) || 1500,
        },
        gemini: {
          model: process.env.GEMINI_SOAP_MODEL || "gemini-1.5-flash",
          temperature: parseFloat(process.env.GEMINI_SOAP_TEMPERATURE) || 0.3,
          maxOutputTokens: parseInt(process.env.GEMINI_SOAP_MAX_TOKENS) || 1500,
        },
      },
      medicationAnalysis: {
        openai: {
          model: process.env.OPENAI_MEDICATION_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_MEDICATION_TEMPERATURE) || 0.1,
          maxTokens: parseInt(process.env.OPENAI_MEDICATION_MAX_TOKENS) || 1000,
        },
        gemini: {
          model: process.env.GEMINI_MEDICATION_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_MEDICATION_TEMPERATURE) || 0.1,
          maxOutputTokens:
            parseInt(process.env.GEMINI_MEDICATION_MAX_TOKENS) || 1000,
        },
      },
      clinicalDecision: {
        openai: {
          model: process.env.OPENAI_CLINICAL_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_CLINICAL_TEMPERATURE) || 0.2,
          maxTokens: parseInt(process.env.OPENAI_CLINICAL_MAX_TOKENS) || 1500,
        },
        gemini: {
          model: process.env.GEMINI_CLINICAL_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_CLINICAL_TEMPERATURE) || 0.2,
          maxOutputTokens:
            parseInt(process.env.GEMINI_CLINICAL_MAX_TOKENS) || 1500,
        },
      },
      progressAnalysis: {
        openai: {
          model: process.env.OPENAI_PROGRESS_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_PROGRESS_TEMPERATURE) || 0.2,
          maxTokens: parseInt(process.env.OPENAI_PROGRESS_MAX_TOKENS) || 1200,
        },
        gemini: {
          model: process.env.GEMINI_PROGRESS_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_PROGRESS_TEMPERATURE) || 0.2,
          maxOutputTokens:
            parseInt(process.env.GEMINI_PROGRESS_MAX_TOKENS) || 1200,
        },
      },
      outcomesPrediction: {
        openai: {
          model: process.env.OPENAI_OUTCOMES_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_OUTCOMES_TEMPERATURE) || 0.1,
          maxTokens: parseInt(process.env.OPENAI_OUTCOMES_MAX_TOKENS) || 1800,
        },
        gemini: {
          model: process.env.GEMINI_OUTCOMES_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_OUTCOMES_TEMPERATURE) || 0.1,
          maxOutputTokens:
            parseInt(process.env.GEMINI_OUTCOMES_MAX_TOKENS) || 1800,
        },
      },
      assessmentAnalysis: {
        openai: {
          model: process.env.OPENAI_ASSESSMENT_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_ASSESSMENT_TEMPERATURE) || 0.2,
          maxTokens: parseInt(process.env.OPENAI_ASSESSMENT_MAX_TOKENS) || 1600,
        },
        gemini: {
          model: process.env.GEMINI_ASSESSMENT_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_ASSESSMENT_TEMPERATURE) || 0.2,
          maxOutputTokens:
            parseInt(process.env.GEMINI_ASSESSMENT_MAX_TOKENS) || 1600,
        },
      },
      carePlanOptimization: {
        openai: {
          model: process.env.OPENAI_CARE_PLAN_MODEL || "gpt-4",
          temperature:
            parseFloat(process.env.OPENAI_CARE_PLAN_TEMPERATURE) || 0.3,
          maxTokens: parseInt(process.env.OPENAI_CARE_PLAN_MAX_TOKENS) || 1600,
        },
        gemini: {
          model: process.env.GEMINI_CARE_PLAN_MODEL || "gemini-1.5-flash",
          temperature:
            parseFloat(process.env.GEMINI_CARE_PLAN_TEMPERATURE) || 0.3,
          maxOutputTokens:
            parseInt(process.env.GEMINI_CARE_PLAN_MAX_TOKENS) || 1600,
        },
      },
    };

    // Enhanced performance tracking with more detailed metrics
    this.performanceMetrics = {
      openai: {
        successRate: 0.9,
        avgResponseTime: 2000,
        totalRequests: 0,
        totalErrors: 0,
        lastError: null,
        circuitBreakerState: "CLOSED", // CLOSED, OPEN, HALF_OPEN
        circuitBreakerFailures: 0,
        circuitBreakerLastFailure: null,
      },
      gemini: {
        successRate: 0.85,
        avgResponseTime: 1500,
        totalRequests: 0,
        totalErrors: 0,
        lastError: null,
        circuitBreakerState: "CLOSED",
        circuitBreakerFailures: 0,
        circuitBreakerLastFailure: null,
      },
    };

    // Rate limiting tracking
    this.rateLimitTracker = new Map();

    // Simple in-memory cache (in production, use Redis)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Request tracking
    this.requestCounter = 0;

    // Specialized nursing prompts
    this.nursingPrompts = {
      oasisAnalysis: this.createOASISAnalysisPrompt(),
      soapEnhancement: this.createSOAPEnhancementPrompt(),
      medicationAnalysis: this.createMedicationAnalysisPrompt(),
      clinicalDecision: this.createClinicalDecisionPrompt(),
      progressAnalysis: this.createProgressAnalysisPrompt(),
      outcomesPrediction: this.createOutcomesPredictionPrompt(),
      assessmentAnalysis: this.createAssessmentAnalysisPrompt(),
      carePlanOptimization: this.createCarePlanOptimizationPrompt(),
    };
  }

  // Enhanced logging with structured format
  logInfo(message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      service: "NursingAIService",
      message,
      context,
      requestId: context.requestId || this.generateRequestId(),
    };

    console.log(JSON.stringify(logEntry));
    this.emit("log", logEntry);
  }

  logError(message, error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      service: "NursingAIService",
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      context,
      requestId: context.requestId || this.generateRequestId(),
    };

    console.error(JSON.stringify(logEntry));
    this.emit("log", logEntry);
  }

  // Generate unique request ID for tracking
  generateRequestId() {
    return `nursing-ai-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  }

  // Rate limiting check
  checkRateLimit(userId) {
    const now = Date.now();
    const userRequests = this.rateLimitTracker.get(userId) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      (timestamp) => now - timestamp < this.config.rateLimitWindow
    );

    if (validRequests.length >= this.config.rateLimitMax) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitTracker.set(userId, validRequests);

    return true;
  }

  // Circuit breaker pattern implementation
  checkCircuitBreaker(provider) {
    const metrics = this.performanceMetrics[provider];

    if (metrics.circuitBreakerState === "OPEN") {
      const timeSinceLastFailure =
        Date.now() - (metrics.circuitBreakerLastFailure || 0);
      if (timeSinceLastFailure > this.config.circuitBreakerTimeout) {
        metrics.circuitBreakerState = "HALF_OPEN";
        this.logInfo(`Circuit breaker for ${provider} moved to HALF_OPEN`);
      } else {
        throw new ServiceUnavailableError(provider, "Circuit breaker is OPEN");
      }
    }

    return true;
  }

  // Update circuit breaker state
  updateCircuitBreaker(provider, success) {
    const metrics = this.performanceMetrics[provider];

    if (success) {
      if (metrics.circuitBreakerState === "HALF_OPEN") {
        metrics.circuitBreakerState = "CLOSED";
        metrics.circuitBreakerFailures = 0;
        this.logInfo(`Circuit breaker for ${provider} moved to CLOSED`);
      }
    } else {
      metrics.circuitBreakerFailures++;
      metrics.circuitBreakerLastFailure = Date.now();

      if (
        metrics.circuitBreakerFailures >= this.config.circuitBreakerThreshold
      ) {
        metrics.circuitBreakerState = "OPEN";
        this.logInfo(`Circuit breaker for ${provider} moved to OPEN`);
      }
    }
  }

  // Cache management
  generateCacheKey(taskType, prompt, data = {}) {
    const dataString = JSON.stringify(data);
    return crypto
      .createHash("md5")
      .update(`${taskType}:${prompt}:${dataString}`)
      .digest("hex");
  }

  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    const timestamp = this.cacheTimestamps.get(cacheKey);

    if (
      cached &&
      timestamp &&
      Date.now() - timestamp < this.config.cacheTTL * 1000
    ) {
      return cached;
    }

    // Remove expired cache entry
    if (cached) {
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
    }

    return null;
  }

  setCache(cacheKey, data) {
    this.cache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  // Enhanced metrics tracking
  updateMetrics(provider, success, responseTime) {
    const metrics = this.performanceMetrics[provider];

    metrics.totalRequests++;
    if (!success) {
      metrics.totalErrors++;
    }

    // Update average response time
    const totalTime =
      metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime;
    metrics.avgResponseTime = totalTime / metrics.totalRequests;

    // Update success rate
    metrics.successRate =
      (metrics.totalRequests - metrics.totalErrors) / metrics.totalRequests;

    // Update circuit breaker
    this.updateCircuitBreaker(provider, success);
  }

  // Input validation wrapper
  validateInputs(userId, taskType, prompt, data = {}) {
    try {
      const validatedUserId = InputValidator.validateUserId(userId);
      const validatedTaskType = InputValidator.validateTaskType(taskType);
      const validatedPrompt = InputValidator.validatePrompt(prompt);
      const sanitizedData = InputValidator.sanitizeData(data);

      return {
        userId: validatedUserId,
        taskType: validatedTaskType,
        prompt: validatedPrompt,
        data: sanitizedData,
      };
    } catch (error) {
      this.logError("Input validation failed", error, { userId, taskType });
      throw error;
    }
  }

  // Intelligent provider selection based on performance and availability
  async selectBestProvider(taskType) {
    const openaiMetrics = this.performanceMetrics.openai;
    const geminiMetrics = this.performanceMetrics.gemini;

    // If one provider has significantly better performance, use it
    if (openaiMetrics.successRate > geminiMetrics.successRate + 0.1) {
      return "openai";
    } else if (geminiMetrics.successRate > openaiMetrics.successRate + 0.1) {
      return "gemini";
    }

    // If success rates are similar, choose based on response time
    if (openaiMetrics.avgResponseTime < geminiMetrics.avgResponseTime) {
      return "openai";
    } else {
      return "gemini";
    }
  }

  // Enhanced core AI request method with comprehensive error handling, caching, and monitoring
  async makeAIRequest(
    taskType,
    prompt,
    data = {},
    preferredProvider = null,
    userId = null
  ) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.logInfo("Starting AI request", {
        requestId,
        taskType,
        userId,
        preferredProvider,
      });

      // Input validation
      const validatedInputs = this.validateInputs(
        userId,
        taskType,
        prompt,
        data
      );
      const {
        userId: validatedUserId,
        taskType: validatedTaskType,
        prompt: validatedPrompt,
        data: sanitizedData,
      } = validatedInputs;

      // Rate limiting check
      if (validatedUserId && !this.checkRateLimit(validatedUserId)) {
        throw new RateLimitError(
          validatedUserId,
          this.config.rateLimitMax,
          this.config.rateLimitWindow
        );
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(
        validatedTaskType,
        validatedPrompt,
        sanitizedData
      );
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        const responseTime = Date.now() - startTime;
        this.logInfo("Cache hit for AI request", {
          requestId,
          taskType: validatedTaskType,
          responseTime,
        });
        return {
          ...cached,
          fromCache: true,
          responseTime,
        };
      }

      // Select provider with circuit breaker check
      let provider =
        preferredProvider || (await this.selectBestProvider(validatedTaskType));
      this.checkCircuitBreaker(provider);

      const config = this.modelConfigs[validatedTaskType][provider];

      this.logInfo("Making AI request", {
        requestId,
        provider,
        taskType: validatedTaskType,
      });

      let response;
      let success = false;

      try {
        if (provider === "openai") {
          response = await this.providers.openai.generateResponse(
            validatedPrompt,
            {
              model: config.model,
              temperature: config.temperature,
              max_tokens: config.maxTokens,
              ...sanitizedData,
            }
          );
        } else {
          response = await this.providers.gemini.generateContent(
            validatedPrompt,
            {
              model: config.model,
              generationConfig: {
                temperature: config.temperature,
                maxOutputTokens: config.maxOutputTokens,
                ...sanitizedData,
              },
            }
          );
        }

        success = true;
      } catch (providerError) {
        this.logError(`AI request failed with ${provider}`, providerError, {
          requestId,
          provider,
          taskType: validatedTaskType,
        });

        // Try fallback provider
        const fallbackProvider = provider === "openai" ? "gemini" : "openai";

        try {
          this.checkCircuitBreaker(fallbackProvider);
          const fallbackConfig =
            this.modelConfigs[validatedTaskType][fallbackProvider];

          this.logInfo("Attempting fallback provider", {
            requestId,
            fallbackProvider,
            originalProvider: provider,
          });

          if (fallbackProvider === "openai") {
            response = await this.providers.openai.generateResponse(
              validatedPrompt,
              {
                model: fallbackConfig.model,
                temperature: fallbackConfig.temperature,
                max_tokens: fallbackConfig.maxTokens,
                ...sanitizedData,
              }
            );
          } else {
            response = await this.providers.gemini.generateContent(
              validatedPrompt,
              {
                model: fallbackConfig.model,
                generationConfig: {
                  temperature: fallbackConfig.temperature,
                  maxOutputTokens: fallbackConfig.maxOutputTokens,
                  ...sanitizedData,
                },
              }
            );
          }

          success = true;
          provider = fallbackProvider;
        } catch (fallbackError) {
          this.logError("Both providers failed", fallbackError, {
            requestId,
            originalProvider: provider,
            fallbackProvider,
            taskType: validatedTaskType,
          });

          throw new NursingAIError(
            `Both AI providers failed: ${providerError.message}, ${fallbackError.message}`,
            "PROVIDER_FAILURE",
            {
              originalProvider: provider,
              fallbackProvider,
              taskType: validatedTaskType,
            }
          );
        }
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics(provider, success, responseTime);

      const result = {
        success: true,
        data: response,
        provider,
        responseTime,
        confidence: this.calculateConfidence(response, validatedTaskType),
        requestId,
        usedFallback: provider !== preferredProvider,
      };

      // Cache successful responses
      if (success) {
        this.setCache(cacheKey, result);
      }

      this.logInfo("AI request completed successfully", {
        requestId,
        provider,
        responseTime,
        confidence: result.confidence,
      });

      this.emit("aiResponse", { taskType: validatedTaskType, result });
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logError("AI request failed", error, {
        requestId,
        taskType,
        userId,
        responseTime,
      });

      const result = {
        success: false,
        error: error.message,
        errorCode: error.code || "UNKNOWN_ERROR",
        provider: null,
        responseTime,
        confidence: 0,
        requestId,
      };

      this.emit("aiError", { taskType, result });
      throw error;
    }
  }

  // Calculate confidence score based on response characteristics
  calculateConfidence(response, taskType) {
    let confidence = 0.5; // Base confidence

    // Check response length and structure
    const responseText =
      typeof response === "string" ? response : JSON.stringify(response);

    if (responseText.length > 100) confidence += 0.1;
    if (responseText.length > 500) confidence += 0.1;

    // Check for medical terminology
    const medicalTerms = [
      "patient",
      "assessment",
      "diagnosis",
      "treatment",
      "medication",
      "clinical",
      "nursing",
    ];
    const termCount = medicalTerms.filter((term) =>
      responseText.toLowerCase().includes(term)
    ).length;
    confidence += (termCount / medicalTerms.length) * 0.2;

    // Task-specific confidence adjustments
    switch (taskType) {
      case "oasisAnalysis":
        if (responseText.includes("M0") || responseText.includes("OASIS"))
          confidence += 0.1;
        break;
      case "medicationAnalysis":
        if (
          responseText.includes("interaction") ||
          responseText.includes("dosage")
        )
          confidence += 0.1;
        break;
      case "clinicalDecision":
        if (
          responseText.includes("recommend") ||
          responseText.includes("evidence")
        )
          confidence += 0.1;
        break;
    }

    return Math.min(confidence, 1.0);
  }

  // OASIS Assessment AI Analysis
  async analyzeOASISAssessment(oasisData, patientHistory = {}) {
    const prompt = this.nursingPrompts.oasisAnalysis
      .replace("{OASIS_DATA}", JSON.stringify(oasisData, null, 2))
      .replace("{PATIENT_HISTORY}", JSON.stringify(patientHistory, null, 2));

    const result = await this.makeAIRequest("oasisAnalysis", prompt);

    if (result.success) {
      try {
        const analysis =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          analysis: {
            completenessScore: analysis.completenessScore || 0,
            qualityScore: analysis.qualityScore || 0,
            riskFactors: analysis.riskFactors || [],
            recommendations: analysis.recommendations || [],
            flaggedItems: analysis.flaggedItems || [],
            predictedOutcomes: analysis.predictedOutcomes || {},
          },
        };
      } catch (parseError) {
        return {
          ...result,
          analysis: {
            completenessScore: 75,
            qualityScore: 80,
            riskFactors: ["Assessment requires review"],
            recommendations: [
              "Complete missing items",
              "Review patient status",
            ],
            flaggedItems: [],
            predictedOutcomes: {},
          },
        };
      }
    }

    return result;
  }

  // SOAP Note Enhancement
  async enhanceSOAPNote(soapData, patientContext = {}) {
    const prompt = this.nursingPrompts.soapEnhancement
      .replace("{SOAP_DATA}", JSON.stringify(soapData, null, 2))
      .replace("{PATIENT_CONTEXT}", JSON.stringify(patientContext, null, 2));

    const result = await this.makeAIRequest("soapEnhancement", prompt);

    if (result.success) {
      try {
        const enhancement =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          enhancement: {
            suggestions: enhancement.suggestions || [],
            completions: enhancement.completions || {},
            qualityScore: enhancement.qualityScore || 0,
            clinicalInsights: enhancement.clinicalInsights || [],
            riskAlerts: enhancement.riskAlerts || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          enhancement: {
            suggestions: ["Consider adding more detail to assessment"],
            completions: {},
            qualityScore: 75,
            clinicalInsights: [],
            riskAlerts: [],
          },
        };
      }
    }

    return result;
  }

  // Medication Analysis
  async analyzeMedications(medications, patientData = {}) {
    const prompt = this.nursingPrompts.medicationAnalysis
      .replace("{MEDICATIONS}", JSON.stringify(medications, null, 2))
      .replace("{PATIENT_DATA}", JSON.stringify(patientData, null, 2));

    const result = await this.makeAIRequest("medicationAnalysis", prompt);

    if (result.success) {
      try {
        const analysis =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          analysis: {
            interactions: analysis.interactions || [],
            contraindications: analysis.contraindications || [],
            dosageRecommendations: analysis.dosageRecommendations || [],
            monitoringRequirements: analysis.monitoringRequirements || [],
            riskScore: analysis.riskScore || 0,
            alerts: analysis.alerts || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          analysis: {
            interactions: [],
            contraindications: [],
            dosageRecommendations: [],
            monitoringRequirements: [],
            riskScore: 0,
            alerts: [],
          },
        };
      }
    }

    return result;
  }

  // Clinical Decision Support
  async provideClinicalDecisionSupport(clinicalData, guidelines = {}) {
    const prompt = this.nursingPrompts.clinicalDecision
      .replace("{CLINICAL_DATA}", JSON.stringify(clinicalData, null, 2))
      .replace("{GUIDELINES}", JSON.stringify(guidelines, null, 2));

    const result = await this.makeAIRequest("clinicalDecision", prompt);

    if (result.success) {
      try {
        const support =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          support: {
            recommendations: support.recommendations || [],
            evidenceLevel: support.evidenceLevel || "C",
            riskAssessment: support.riskAssessment || {},
            interventions: support.interventions || [],
            monitoring: support.monitoring || [],
            alerts: support.alerts || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          support: {
            recommendations: ["Continue current care plan"],
            evidenceLevel: "C",
            riskAssessment: {},
            interventions: [],
            monitoring: [],
            alerts: [],
          },
        };
      }
    }

    return result;
  }

  // Progress Analysis
  async analyzeProgress(progressData, goals = []) {
    const prompt = this.nursingPrompts.progressAnalysis
      .replace("{PROGRESS_DATA}", JSON.stringify(progressData, null, 2))
      .replace("{GOALS}", JSON.stringify(goals, null, 2));

    const result = await this.makeAIRequest("progressAnalysis", prompt);

    if (result.success) {
      try {
        const analysis =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          analysis: {
            trends: analysis.trends || [],
            goalProgress: analysis.goalProgress || {},
            predictions: analysis.predictions || {},
            recommendations: analysis.recommendations || [],
            riskFactors: analysis.riskFactors || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          analysis: {
            trends: [],
            goalProgress: {},
            predictions: {},
            recommendations: [],
            riskFactors: [],
          },
        };
      }
    }

    return result;
  }

  // Outcomes Prediction
  async predictOutcomes(patientData, interventions = []) {
    const prompt = this.nursingPrompts.outcomesPrediction
      .replace("{PATIENT_DATA}", JSON.stringify(patientData, null, 2))
      .replace("{INTERVENTIONS}", JSON.stringify(interventions, null, 2));

    const result = await this.makeAIRequest("outcomesPrediction", prompt);

    if (result.success) {
      try {
        const prediction =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          prediction: {
            outcomes: prediction.outcomes || {},
            probability: prediction.probability || 0,
            timeframe: prediction.timeframe || "unknown",
            factors: prediction.factors || [],
            recommendations: prediction.recommendations || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          prediction: {
            outcomes: {},
            probability: 0.5,
            timeframe: "unknown",
            factors: [],
            recommendations: [],
          },
        };
      }
    }

    return result;
  }

  // Assessment Analysis
  async analyzeAssessment(assessmentData, previousAssessments = []) {
    const prompt = this.nursingPrompts.assessmentAnalysis
      .replace("{ASSESSMENT_DATA}", JSON.stringify(assessmentData, null, 2))
      .replace(
        "{PREVIOUS_ASSESSMENTS}",
        JSON.stringify(previousAssessments, null, 2)
      );

    const result = await this.makeAIRequest("assessmentAnalysis", prompt);

    if (result.success) {
      try {
        const analysis =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          analysis: {
            findings: analysis.findings || [],
            riskScores: analysis.riskScores || {},
            trends: analysis.trends || [],
            interventions: analysis.interventions || [],
            followUp: analysis.followUp || [],
          },
        };
      } catch (parseError) {
        return {
          ...result,
          analysis: {
            findings: [],
            riskScores: {},
            trends: [],
            interventions: [],
            followUp: [],
          },
        };
      }
    }

    return result;
  }

  // AI-Enhanced Assessment Insights
  async generateAssessmentInsights(options = {}) {
    const {
      patientId,
      assessmentType,
      assessmentData,
      currentAssessment,
      userId,
      includeRealTimeData = true,
      includeRiskAlerts = true,
      includeQualityScoring = true,
    } = options;

    const prompt = `
As a clinical AI assistant specializing in nursing assessments, analyze the following assessment data and provide comprehensive insights:

Patient ID: ${patientId}
Assessment Type: ${assessmentType}
Assessment Data: ${JSON.stringify(assessmentData, null, 2)}
Current Assessment: ${JSON.stringify(currentAssessment, null, 2)}

Please provide insights in the following JSON format:
{
  "summary": "Brief summary of key findings",
  "keyFindings": ["finding1", "finding2", "finding3"],
  "riskLevel": "low|medium|high|critical",
  "riskFactors": ["risk1", "risk2"],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "assessment|intervention|monitoring|education",
      "recommendation": "specific recommendation",
      "rationale": "evidence-based rationale",
      "timeframe": "immediate|urgent|routine"
    }
  ],
  "qualityScore": {
    "overall": 85,
    "completeness": 90,
    "accuracy": 80,
    "timeliness": 85,
    "areas_for_improvement": ["area1", "area2"]
  },
  "alerts": [
    {
      "type": "clinical|safety|quality",
      "severity": "low|medium|high|critical",
      "message": "alert message",
      "action_required": "specific action needed"
    }
  ],
  "trends": ["trend1", "trend2"],
  "nextSteps": ["step1", "step2"],
  "careTeamNotifications": ["userId1", "userId2"]
}

Focus on evidence-based recommendations and actionable insights.
    `;

    const result = await this.makeAIRequest("assessmentAnalysis", prompt);

    if (result.success) {
      try {
        const insights =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        // Enhance with real-time data if requested
        if (includeRealTimeData) {
          insights.realTimeFactors = await this.getRealTimeFactors(patientId);
        }

        // Add quality scoring if requested
        if (includeQualityScoring && !insights.qualityScore) {
          insights.qualityScore = await this.calculateBasicQualityScore(
            assessmentData,
            assessmentType
          );
        }

        return {
          success: true,
          data: insights,
          metadata: {
            generatedAt: new Date(),
            assessmentType,
            patientId,
            includesRealTimeData: includeRealTimeData,
          },
        };
      } catch (parseError) {
        console.error("Error parsing assessment insights:", parseError);
        return {
          success: false,
          error: "Failed to parse AI insights",
          data: null,
        };
      }
    }

    return result;
  }

  async generateAssessmentRecommendations(options = {}) {
    const {
      patientId,
      assessmentData,
      userId,
      includeEvidence = true,
      includeRealTimeFactors = true,
    } = options;

    const prompt = `
Based on the following nursing assessment data, provide evidence-based recommendations:

Patient ID: ${patientId}
Assessment Data: ${JSON.stringify(assessmentData, null, 2)}

Provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "category": "assessment|intervention|monitoring|education|safety",
      "priority": "immediate|urgent|routine|ongoing",
      "recommendation": "specific actionable recommendation",
      "rationale": "clinical rationale with evidence",
      "evidence_level": "A|B|C|Expert Opinion",
      "resources_needed": ["resource1", "resource2"],
      "expected_outcome": "expected result",
      "timeframe": "specific timeframe",
      "monitoring_parameters": ["parameter1", "parameter2"]
    }
  ],
  "risk_mitigation": [
    {
      "risk": "identified risk",
      "mitigation_strategy": "strategy to mitigate",
      "monitoring_frequency": "frequency"
    }
  ],
  "quality_improvements": [
    {
      "area": "area for improvement",
      "suggestion": "specific improvement suggestion",
      "expected_benefit": "expected benefit"
    }
  ],
  "care_coordination": {
    "disciplines_to_involve": ["discipline1", "discipline2"],
    "communication_needs": ["need1", "need2"],
    "follow_up_requirements": ["requirement1", "requirement2"]
  }
}

Focus on actionable, evidence-based recommendations that improve patient outcomes.
    `;

    const result = await this.makeAIRequest("clinicalDecision", prompt);

    if (result.success) {
      try {
        const recommendations =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        // Add real-time factors if requested
        if (includeRealTimeFactors) {
          recommendations.realTimeContext = await this.getRealTimeFactors(
            patientId
          );
        }

        return {
          success: true,
          data: recommendations,
          metadata: {
            generatedAt: new Date(),
            evidenceIncluded: includeEvidence,
            patientId,
          },
        };
      } catch (parseError) {
        console.error("Error parsing assessment recommendations:", parseError);
        return {
          success: false,
          error: "Failed to parse recommendations",
          data: null,
        };
      }
    }

    return result;
  }

  async generateRiskAlerts(options = {}) {
    const {
      patientId,
      patientData,
      assessmentData,
      userId,
      includeRealTimeVitals = true,
      includeMedicationInteractions = true,
    } = options;

    const prompt = `
Analyze the following patient and assessment data to identify potential risks and generate alerts:

Patient Data: ${JSON.stringify(patientData, null, 2)}
Assessment Data: ${JSON.stringify(assessmentData, null, 2)}

Generate risk alerts in this JSON format:
{
  "alerts": [
    {
      "type": "clinical|safety|medication|fall|infection|pressure_ulcer|other",
      "severity": "low|medium|high|critical",
      "title": "Brief alert title",
      "message": "Detailed alert message",
      "risk_factors": ["factor1", "factor2"],
      "immediate_actions": ["action1", "action2"],
      "monitoring_requirements": ["requirement1", "requirement2"],
      "escalation_criteria": ["criteria1", "criteria2"],
      "timeframe": "immediate|within_1hr|within_4hr|within_24hr",
      "affected_systems": ["system1", "system2"]
    }
  ],
  "risk_summary": {
    "overall_risk_level": "low|medium|high|critical",
    "primary_concerns": ["concern1", "concern2"],
    "protective_factors": ["factor1", "factor2"],
    "trending": "improving|stable|deteriorating"
  },
  "prevention_strategies": [
    {
      "risk_type": "risk type",
      "strategy": "prevention strategy",
      "effectiveness": "high|medium|low"
    }
  ]
}

Focus on clinically significant risks that require nursing intervention or monitoring.
    `;

    const result = await this.makeAIRequest("clinicalDecision", prompt);

    if (result.success) {
      try {
        const riskAlerts =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        // Add real-time vital signs context if available
        if (includeRealTimeVitals) {
          riskAlerts.vitalSignsContext = await this.getVitalSignsContext(
            patientId
          );
        }

        // Add medication interaction checks if requested
        if (includeMedicationInteractions && patientData?.medications) {
          riskAlerts.medicationInteractions =
            await this.checkMedicationInteractions(patientData.medications);
        }

        return {
          success: true,
          data: riskAlerts.alerts || [],
          metadata: {
            generatedAt: new Date(),
            riskSummary: riskAlerts.risk_summary,
            preventionStrategies: riskAlerts.prevention_strategies,
            patientId,
          },
        };
      } catch (parseError) {
        console.error("Error parsing risk alerts:", parseError);
        return {
          success: false,
          error: "Failed to parse risk alerts",
          data: [],
        };
      }
    }

    return { success: false, data: [], error: result.error };
  }

  async calculateQualityScore(options = {}) {
    const {
      assessmentData,
      assessmentType,
      patientId,
      userId,
      includeBenchmarking = true,
      includeImprovementSuggestions = true,
    } = options;

    const prompt = `
Evaluate the quality of this nursing assessment and provide a comprehensive quality score:

Assessment Type: ${assessmentType}
Assessment Data: ${JSON.stringify(assessmentData, null, 2)}

Provide quality scoring in this JSON format:
{
  "overall_score": 85,
  "component_scores": {
    "completeness": 90,
    "accuracy": 85,
    "timeliness": 80,
    "documentation_quality": 88,
    "clinical_relevance": 92,
    "evidence_based": 85
  },
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "missing_elements": ["element1", "element2"],
  "quality_indicators": {
    "meets_standards": true,
    "complete_assessment": true,
    "appropriate_interventions": true,
    "proper_documentation": true
  },
  "improvement_suggestions": [
    {
      "area": "area needing improvement",
      "suggestion": "specific improvement suggestion",
      "priority": "high|medium|low",
      "expected_impact": "expected improvement"
    }
  ],
  "benchmarking": {
    "percentile": 75,
    "comparison_group": "similar_assessments",
    "performance_trend": "improving|stable|declining"
  }
}

Base scoring on nursing standards, completeness, accuracy, and clinical relevance.
    `;

    const result = await this.makeAIRequest("assessmentAnalysis", prompt);

    if (result.success) {
      try {
        const qualityScore =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        return {
          success: true,
          data: qualityScore,
          metadata: {
            scoredAt: new Date(),
            assessmentType,
            benchmarkingIncluded: includeBenchmarking,
            patientId,
          },
        };
      } catch (parseError) {
        console.error("Error parsing quality score:", parseError);
        return {
          success: false,
          error: "Failed to parse quality score",
          data: null,
        };
      }
    }

    return result;
  }

  async generateImprovementSuggestions(options = {}) {
    const {
      assessmentData,
      patientId,
      currentPerformance,
      userId,
      includeActionPlan = true,
      includeResourceRecommendations = true,
    } = options;

    const prompt = `
Based on the assessment data and current performance, provide improvement suggestions:

Assessment Data: ${JSON.stringify(assessmentData, null, 2)}
Current Performance: ${JSON.stringify(currentPerformance, null, 2)}

Provide suggestions in this JSON format:
{
  "improvement_areas": [
    {
      "area": "specific area for improvement",
      "current_state": "description of current state",
      "target_state": "description of desired state",
      "gap_analysis": "analysis of the gap",
      "priority": "high|medium|low",
      "impact": "high|medium|low"
    }
  ],
  "action_plan": [
    {
      "action": "specific action to take",
      "timeline": "timeframe for action",
      "resources_needed": ["resource1", "resource2"],
      "success_metrics": ["metric1", "metric2"],
      "responsible_party": "who should take action"
    }
  ],
  "resource_recommendations": [
    {
      "type": "education|training|tools|support",
      "resource": "specific resource",
      "benefit": "expected benefit",
      "availability": "how to access"
    }
  ],
  "monitoring_plan": {
    "key_indicators": ["indicator1", "indicator2"],
    "measurement_frequency": "frequency",
    "review_schedule": "schedule for review"
  }
}

Focus on practical, achievable improvements that enhance patient care quality.
    `;

    const result = await this.makeAIRequest("progressAnalysis", prompt);

    if (result.success) {
      try {
        const suggestions =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        return {
          success: true,
          data: suggestions,
          metadata: {
            generatedAt: new Date(),
            actionPlanIncluded: includeActionPlan,
            resourceRecommendationsIncluded: includeResourceRecommendations,
            patientId,
          },
        };
      } catch (parseError) {
        console.error("Error parsing improvement suggestions:", parseError);
        return {
          success: false,
          error: "Failed to parse improvement suggestions",
          data: null,
        };
      }
    }

    return result;
  }

  async getClinicalGuidance(options = {}) {
    const {
      assessmentType,
      patientData,
      userId,
      includeEvidenceBase = true,
      includeProtocols = true,
    } = options;

    const prompt = `
Provide clinical guidance for the following assessment type and patient context:

Assessment Type: ${assessmentType}
Patient Data: ${JSON.stringify(patientData, null, 2)}

Provide guidance in this JSON format:
{
  "assessment_guidelines": {
    "key_components": ["component1", "component2"],
    "assessment_frequency": "recommended frequency",
    "special_considerations": ["consideration1", "consideration2"],
    "contraindications": ["contraindication1", "contraindication2"]
  },
  "evidence_base": [
    {
      "guideline": "guideline name",
      "source": "authoritative source",
      "recommendation": "specific recommendation",
      "evidence_level": "A|B|C",
      "year": "publication year"
    }
  ],
  "protocols": [
    {
      "protocol_name": "protocol name",
      "steps": ["step1", "step2", "step3"],
      "decision_points": ["decision1", "decision2"],
      "documentation_requirements": ["requirement1", "requirement2"]
    }
  ],
  "best_practices": [
    {
      "practice": "best practice description",
      "rationale": "why this is best practice",
      "implementation": "how to implement"
    }
  ],
  "common_pitfalls": [
    {
      "pitfall": "common mistake",
      "prevention": "how to avoid",
      "correction": "how to correct if it occurs"
    }
  ]
}

Base guidance on current evidence-based nursing standards and best practices.
    `;

    const result = await this.makeAIRequest("clinicalDecision", prompt);

    if (result.success) {
      try {
        const guidance =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        return {
          success: true,
          data: guidance,
          metadata: {
            generatedAt: new Date(),
            assessmentType,
            evidenceBaseIncluded: includeEvidenceBase,
            protocolsIncluded: includeProtocols,
          },
        };
      } catch (parseError) {
        console.error("Error parsing clinical guidance:", parseError);
        return {
          success: false,
          error: "Failed to parse clinical guidance",
          data: null,
        };
      }
    }

    return result;
  }

  async validateAssessmentCompleteness(options = {}) {
    const {
      assessmentData,
      assessmentType,
      requiredFields,
      userId,
      includeQualityChecks = true,
      includeMissingFieldSuggestions = true,
    } = options;

    const prompt = `
Validate the completeness and quality of this nursing assessment:

Assessment Type: ${assessmentType}
Assessment Data: ${JSON.stringify(assessmentData, null, 2)}
Required Fields: ${JSON.stringify(requiredFields, null, 2)}

Provide validation results in this JSON format:
{
  "completeness_score": 85,
  "is_complete": true,
  "missing_required_fields": ["field1", "field2"],
  "missing_recommended_fields": ["field1", "field2"],
  "quality_issues": [
    {
      "issue": "description of quality issue",
      "severity": "high|medium|low",
      "field": "affected field",
      "suggestion": "how to improve"
    }
  ],
  "validation_results": {
    "data_consistency": true,
    "logical_coherence": true,
    "clinical_appropriateness": true,
    "documentation_standards": true
  },
  "improvement_suggestions": [
    {
      "field": "field name",
      "current_value": "current value",
      "suggested_improvement": "suggestion for improvement",
      "rationale": "why this improvement is needed"
    }
  ],
  "overall_assessment": "assessment is complete and meets standards"
}

Focus on clinical accuracy, completeness, and adherence to documentation standards.
    `;

    const result = await this.makeAIRequest("assessmentAnalysis", prompt);

    if (result.success) {
      try {
        const validation =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        return {
          success: true,
          data: validation,
          metadata: {
            validatedAt: new Date(),
            assessmentType,
            qualityChecksIncluded: includeQualityChecks,
          },
        };
      } catch (parseError) {
        console.error("Error parsing assessment validation:", parseError);
        return {
          success: false,
          error: "Failed to parse validation results",
          data: null,
        };
      }
    }

    return result;
  }

  async generateAssessmentSummary(options = {}) {
    const {
      assessmentData,
      patientId,
      userId,
      includeRecommendations = true,
      includeKeyFindings = true,
      includeRiskFactors = true,
    } = options;

    const prompt = `
Generate a comprehensive summary of this nursing assessment:

Assessment Data: ${JSON.stringify(assessmentData, null, 2)}

Provide summary in this JSON format:
{
  "executive_summary": "Brief overview of the assessment",
  "key_findings": [
    {
      "category": "assessment category",
      "finding": "key finding",
      "significance": "clinical significance",
      "trend": "improving|stable|deteriorating|new"
    }
  ],
  "risk_factors": [
    {
      "risk": "identified risk factor",
      "level": "low|medium|high|critical",
      "interventions": ["intervention1", "intervention2"]
    }
  ],
  "recommendations": [
    {
      "priority": "immediate|urgent|routine",
      "recommendation": "specific recommendation",
      "rationale": "clinical rationale"
    }
  ],
  "care_priorities": ["priority1", "priority2", "priority3"],
  "follow_up_needs": [
    {
      "area": "area needing follow-up",
      "timeframe": "when to follow up",
      "action": "specific action needed"
    }
  ],
  "patient_strengths": ["strength1", "strength2"],
  "areas_of_concern": ["concern1", "concern2"],
  "overall_status": "stable|improving|concerning|critical"
}

Focus on clinically relevant information that guides care decisions.
    `;

    const result = await this.makeAIRequest("assessmentAnalysis", prompt);

    if (result.success) {
      try {
        const summary =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        return {
          success: true,
          data: summary,
          metadata: {
            generatedAt: new Date(),
            recommendationsIncluded: includeRecommendations,
            keyFindingsIncluded: includeKeyFindings,
            riskFactorsIncluded: includeRiskFactors,
            patientId,
          },
        };
      } catch (parseError) {
        console.error("Error parsing assessment summary:", parseError);
        return {
          success: false,
          error: "Failed to parse assessment summary",
          data: null,
        };
      }
    }

    return result;
  }

  // Helper methods for AI-enhanced assessments
  async getRealTimeFactors(patientId) {
    // This would integrate with real-time monitoring systems
    // For now, return a structure that would be populated by real systems
    return {
      vitals_freshness: "current",
      monitoring_active: true,
      alerts_pending: 0,
      last_updated: new Date(),
    };
  }

  async calculateBasicQualityScore(assessmentData, assessmentType) {
    // Basic quality scoring algorithm
    let completeness = 0;
    let totalFields = 0;

    const countFields = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          countFields(obj[key]);
        } else {
          totalFields++;
          if (obj[key] && obj[key].toString().trim() !== "") {
            completeness++;
          }
        }
      }
    };

    countFields(assessmentData);

    const completenessScore =
      totalFields > 0 ? Math.round((completeness / totalFields) * 100) : 0;

    return {
      overall: Math.max(completenessScore - 5, 0), // Slight penalty for overall score
      completeness: completenessScore,
      accuracy: 85, // Would be calculated based on validation rules
      timeliness: 90, // Would be based on assessment timing
      areas_for_improvement:
        completenessScore < 90 ? ["Complete all assessment fields"] : [],
    };
  }

  async getVitalSignsContext(patientId) {
    // This would integrate with vital signs monitoring systems
    return {
      current_vitals_available: false,
      last_vitals_time: null,
      trending: "stable",
    };
  }

  async checkMedicationInteractions(medications) {
    // This would integrate with medication interaction databases
    return {
      interactions_found: 0,
      high_risk_combinations: [],
      recommendations: [],
    };
  }

  // Care Plan Optimization
  async optimizeCarePlan(carePlan, patientData = {}, outcomes = {}) {
    const prompt = this.nursingPrompts.carePlanOptimization
      .replace("{CARE_PLAN}", JSON.stringify(carePlan, null, 2))
      .replace("{PATIENT_DATA}", JSON.stringify(patientData, null, 2))
      .replace("{OUTCOMES}", JSON.stringify(outcomes, null, 2));

    const result = await this.makeAIRequest("carePlanOptimization", prompt);

    if (result.success) {
      try {
        const optimization =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;
        return {
          ...result,
          optimization: {
            recommendations: optimization.recommendations || [],
            priorityChanges: optimization.priorityChanges || [],
            newGoals: optimization.newGoals || [],
            interventionAdjustments: optimization.interventionAdjustments || [],
            expectedOutcomes: optimization.expectedOutcomes || {},
          },
        };
      } catch (parseError) {
        return {
          ...result,
          optimization: {
            recommendations: [],
            priorityChanges: [],
            newGoals: [],
            interventionAdjustments: [],
            expectedOutcomes: {},
          },
        };
      }
    }

    return result;
  }

  // Create specialized nursing prompts
  createOASISAnalysisPrompt() {
    return `You are an expert nursing AI assistant specializing in OASIS-E assessments. Analyze the provided OASIS data and patient history to provide comprehensive insights.

OASIS Data: {OASIS_DATA}
Patient History: {PATIENT_HISTORY}

Please provide a detailed analysis in JSON format with the following structure:
{
  "completenessScore": number (0-100),
  "qualityScore": number (0-100),
  "riskFactors": ["factor1", "factor2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "flaggedItems": ["item1", "item2"],
  "predictedOutcomes": {
    "hospitalizationRisk": "low|medium|high",
    "functionalImprovement": "poor|fair|good",
    "dischargeToHome": "unlikely|possible|likely"
  }
}

Focus on clinical accuracy, CMS compliance, and actionable insights for nursing care.`;
  }

  createSOAPEnhancementPrompt() {
    return `You are an expert nursing AI assistant specializing in SOAP note documentation. Enhance the provided SOAP note with clinical insights and suggestions.

SOAP Data: {SOAP_DATA}
Patient Context: {PATIENT_CONTEXT}

Please provide enhancement suggestions in JSON format:
{
  "suggestions": ["suggestion1", "suggestion2"],
  "completions": {
    "subjective": "enhanced text",
    "objective": "enhanced text",
    "assessment": "enhanced text",
    "plan": "enhanced text"
  },
  "qualityScore": number (0-100),
  "clinicalInsights": ["insight1", "insight2"],
  "riskAlerts": [{"severity": "low|medium|high", "message": "alert text"}]
}

Focus on clinical accuracy, completeness, and professional documentation standards.`;
  }

  createMedicationAnalysisPrompt() {
    return `You are an expert clinical pharmacist AI assistant. Analyze the provided medications for interactions, contraindications, and optimization opportunities.

Medications: {MEDICATIONS}
Patient Data: {PATIENT_DATA}

Please provide analysis in JSON format:
{
  "interactions": [{"medications": ["med1", "med2"], "severity": "minor|moderate|major", "description": "text"}],
  "contraindications": [{"medication": "med", "condition": "condition", "severity": "text"}],
  "dosageRecommendations": [{"medication": "med", "recommendation": "text"}],
  "monitoringRequirements": [{"parameter": "parameter", "frequency": "frequency"}],
  "riskScore": number (0-100),
  "alerts": [{"severity": "low|medium|high|critical", "message": "text"}]
}

Focus on patient safety, evidence-based recommendations, and clinical best practices.`;
  }

  createClinicalDecisionPrompt() {
    return `You are an expert nursing AI assistant providing evidence-based clinical decision support. Analyze the clinical data and provide recommendations.

Clinical Data: {CLINICAL_DATA}
Guidelines: {GUIDELINES}

Please provide decision support in JSON format:
{
  "recommendations": [{"intervention": "text", "rationale": "text", "evidence": "A|B|C"}],
  "evidenceLevel": "A|B|C",
  "riskAssessment": {"category": "risk level"},
  "interventions": [{"action": "text", "priority": "high|medium|low"}],
  "monitoring": [{"parameter": "text", "frequency": "text"}],
  "alerts": [{"type": "safety|quality|compliance", "message": "text"}]
}

Focus on evidence-based practice, patient safety, and quality outcomes.`;
  }

  createProgressAnalysisPrompt() {
    return `You are an expert nursing AI assistant specializing in patient progress analysis. Analyze the progress data and goals to provide insights.

Progress Data: {PROGRESS_DATA}
Goals: {GOALS}

Please provide analysis in JSON format:
{
  "trends": [{"metric": "text", "trend": "improving|stable|declining", "significance": "text"}],
  "goalProgress": {"goalId": {"status": "on-track|behind|ahead", "completion": "percentage"}},
  "predictions": {"outcome": "prediction", "confidence": "percentage"},
  "recommendations": [{"action": "text", "rationale": "text"}],
  "riskFactors": [{"factor": "text", "impact": "low|medium|high"}]
}

Focus on objective analysis, trend identification, and actionable recommendations.`;
  }

  createOutcomesPredictionPrompt() {
    return `You are an expert nursing AI assistant specializing in outcome prediction. Analyze patient data and interventions to predict likely outcomes.

Patient Data: {PATIENT_DATA}
Interventions: {INTERVENTIONS}

Please provide prediction in JSON format:
{
  "outcomes": {"category": {"prediction": "text", "probability": "percentage"}},
  "probability": number (0-1),
  "timeframe": "days|weeks|months",
  "factors": [{"factor": "text", "influence": "positive|negative|neutral"}],
  "recommendations": [{"action": "text", "impact": "text"}]
}

Focus on evidence-based predictions, risk factors, and actionable insights.`;
  }

  createAssessmentAnalysisPrompt() {
    return `You are an expert nursing AI assistant specializing in nursing assessments. Analyze the assessment data and compare with previous assessments.

Assessment Data: {ASSESSMENT_DATA}
Previous Assessments: {PREVIOUS_ASSESSMENTS}

Please provide analysis in JSON format:
{
  "findings": [{"category": "text", "finding": "text", "significance": "normal|abnormal|critical"}],
  "riskScores": {"fallRisk": number, "pressureUlcerRisk": number, "infectionRisk": number},
  "trends": [{"parameter": "text", "trend": "improving|stable|worsening"}],
  "interventions": [{"intervention": "text", "rationale": "text", "priority": "high|medium|low"}],
  "followUp": [{"action": "text", "timeframe": "text"}]
}

Focus on clinical significance, risk identification, and care planning.`;
  }

  createCarePlanOptimizationPrompt() {
    return `You are an expert nursing AI assistant specializing in care plan optimization. Analyze the care plan and suggest improvements based on patient data and outcomes.

Care Plan: {CARE_PLAN}
Patient Data: {PATIENT_DATA}
Outcomes: {OUTCOMES}

Please provide optimization in JSON format:
{
  "recommendations": [{"area": "text", "recommendation": "text", "rationale": "text"}],
  "priorityChanges": [{"change": "text", "priority": "high|medium|low", "impact": "text"}],
  "newGoals": [{"goal": "text", "timeframe": "text", "measurable": "text"}],
  "interventionAdjustments": [{"intervention": "text", "adjustment": "text", "rationale": "text"}],
  "expectedOutcomes": {"outcome": "prediction", "timeframe": "text"}
}

Focus on evidence-based optimization, patient-centered care, and measurable outcomes.`;
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      bestProvider:
        this.performanceMetrics.openai.successRate >
        this.performanceMetrics.gemini.successRate
          ? "openai"
          : "gemini",
    };
  }

  // Analyze nursing data comprehensively
  async analyzeNursingData(nursingData, analysisType = "comprehensive") {
    try {
      const prompt = `
        Analyze the following nursing data comprehensively:
        
        Data: ${JSON.stringify(nursingData, null, 2)}
        Analysis Type: ${analysisType}
        
        Please provide:
        1. Key clinical findings and patterns
        2. Risk factors and concerns
        3. Trends and changes over time
        4. Quality indicators
        5. Recommendations for care improvement
        6. Priority areas for intervention
        
        Format the response as a structured analysis with clear sections.
      `;

      const response = await this.makeAIRequest(
        "nursingAnalysis",
        prompt,
        nursingData
      );

      if (response && response.content) {
        const analysis = {
          analysisType,
          timestamp: new Date(),
          findings: this.extractFindings(response.content),
          riskFactors: this.extractRiskFactors(response.content),
          trends: this.extractTrends(response.content),
          qualityIndicators: this.extractQualityIndicators(response.content),
          recommendations: this.extractRecommendations(response.content),
          priorities: this.extractPriorities(response.content),
          confidence: response.confidence || 0.85,
          rawAnalysis: response.content,
        };

        // Emit analysis completed event
        this.emit("nursingDataAnalyzed", {
          analysisType,
          dataSize: JSON.stringify(nursingData).length,
          findingsCount: analysis.findings.length,
          recommendationsCount: analysis.recommendations.length,
        });

        return analysis;
      }

      throw new Error("No analysis content received");
    } catch (error) {
      console.error("Error analyzing nursing data:", error);
      this.emit("analysisError", { error: error.message, analysisType });
      throw error;
    }
  }

  // Generate clinical insights from nursing data
  async generateInsights(nursingData, insightType = "clinical") {
    try {
      const prompt = `
        Generate clinical insights from the following nursing data:
        
        Data: ${JSON.stringify(nursingData, null, 2)}
        Insight Type: ${insightType}
        
        Please provide actionable insights including:
        1. Clinical patterns and correlations
        2. Evidence-based recommendations
        3. Potential interventions
        4. Quality improvement opportunities
        5. Patient safety considerations
        6. Care coordination suggestions
        
        Focus on practical, evidence-based insights that can improve patient outcomes.
      `;

      const response = await this.makeAIRequest(
        "insightGeneration",
        prompt,
        nursingData
      );

      if (response && response.content) {
        const insights = {
          insightType,
          timestamp: new Date(),
          clinicalPatterns: this.extractClinicalPatterns(response.content),
          recommendations: this.extractRecommendations(response.content),
          interventions: this.extractInterventions(response.content),
          qualityOpportunities: this.extractQualityOpportunities(
            response.content
          ),
          safetyConsiderations: this.extractSafetyConsiderations(
            response.content
          ),
          coordinationSuggestions: this.extractCoordinationSuggestions(
            response.content
          ),
          confidence: response.confidence || 0.8,
          rawInsights: response.content,
        };

        // Emit insights generated event
        this.emit("insightsGenerated", {
          insightType,
          patternsCount: insights.clinicalPatterns.length,
          recommendationsCount: insights.recommendations.length,
          interventionsCount: insights.interventions.length,
        });

        return insights;
      }

      throw new Error("No insights content received");
    } catch (error) {
      console.error("Error generating insights:", error);
      this.emit("insightError", { error: error.message, insightType });
      throw error;
    }
  }

  // Predict patient needs based on nursing data
  async predictNeeds(patientData, predictionType = "comprehensive") {
    try {
      const prompt = `
        Predict patient needs based on the following nursing data:
        
        Patient Data: ${JSON.stringify(patientData, null, 2)}
        Prediction Type: ${predictionType}
        
        Please predict:
        1. Immediate care needs (next 24 hours)
        2. Short-term needs (next 7 days)
        3. Long-term care requirements
        4. Resource requirements
        5. Potential complications
        6. Discharge planning needs
        7. Family/caregiver support needs
        
        Provide specific, actionable predictions with confidence levels.
      `;

      const response = await this.makeAIRequest(
        "needsPrediction",
        prompt,
        patientData
      );

      if (response && response.content) {
        const predictions = {
          predictionType,
          timestamp: new Date(),
          immediateNeeds: this.extractImmediateNeeds(response.content),
          shortTermNeeds: this.extractShortTermNeeds(response.content),
          longTermNeeds: this.extractLongTermNeeds(response.content),
          resourceRequirements: this.extractResourceRequirements(
            response.content
          ),
          potentialComplications: this.extractComplications(response.content),
          dischargePlanning: this.extractDischargePlanning(response.content),
          supportNeeds: this.extractSupportNeeds(response.content),
          confidence: response.confidence || 0.75,
          rawPredictions: response.content,
        };

        // Emit predictions generated event
        this.emit("needsPredicted", {
          predictionType,
          immediateNeedsCount: predictions.immediateNeeds.length,
          shortTermNeedsCount: predictions.shortTermNeeds.length,
          complicationsCount: predictions.potentialComplications.length,
        });

        return predictions;
      }

      throw new Error("No predictions content received");
    } catch (error) {
      console.error("Error predicting needs:", error);
      this.emit("predictionError", { error: error.message, predictionType });
      throw error;
    }
  }

  // Helper methods for extracting structured data from AI responses
  extractFindings(content) {
    const findings = [];
    const lines = content.split("\n");
    let inFindingsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("findings") ||
        line.toLowerCase().includes("clinical findings")
      ) {
        inFindingsSection = true;
        continue;
      }
      if (
        inFindingsSection &&
        line.trim() &&
        !line.toLowerCase().includes("risk") &&
        !line.toLowerCase().includes("trend")
      ) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          findings.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("risk factors") ||
        line.toLowerCase().includes("trends")
      ) {
        inFindingsSection = false;
      }
    }

    return findings.slice(0, 10); // Limit to top 10 findings
  }

  extractRiskFactors(content) {
    const riskFactors = [];
    const lines = content.split("\n");
    let inRiskSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("risk factors") ||
        line.toLowerCase().includes("risks")
      ) {
        inRiskSection = true;
        continue;
      }
      if (inRiskSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          riskFactors.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("trends") ||
        line.toLowerCase().includes("recommendations")
      ) {
        inRiskSection = false;
      }
    }

    return riskFactors.slice(0, 8); // Limit to top 8 risk factors
  }

  extractTrends(content) {
    const trends = [];
    const lines = content.split("\n");
    let inTrendsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("trends") ||
        line.toLowerCase().includes("changes over time")
      ) {
        inTrendsSection = true;
        continue;
      }
      if (inTrendsSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          trends.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("quality") ||
        line.toLowerCase().includes("recommendations")
      ) {
        inTrendsSection = false;
      }
    }

    return trends.slice(0, 6); // Limit to top 6 trends
  }

  extractQualityIndicators(content) {
    const indicators = [];
    const lines = content.split("\n");
    let inQualitySection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("quality indicators") ||
        line.toLowerCase().includes("quality measures")
      ) {
        inQualitySection = true;
        continue;
      }
      if (inQualitySection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          indicators.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("recommendations") ||
        line.toLowerCase().includes("priorities")
      ) {
        inQualitySection = false;
      }
    }

    return indicators.slice(0, 8); // Limit to top 8 quality indicators
  }

  extractRecommendations(content) {
    const recommendations = [];
    const lines = content.split("\n");
    let inRecommendationsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("recommendations") ||
        line.toLowerCase().includes("suggested actions")
      ) {
        inRecommendationsSection = true;
        continue;
      }
      if (inRecommendationsSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          recommendations.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("priorities") ||
        line.toLowerCase().includes("conclusion")
      ) {
        inRecommendationsSection = false;
      }
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  extractPriorities(content) {
    const priorities = [];
    const lines = content.split("\n");
    let inPrioritiesSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("priorities") ||
        line.toLowerCase().includes("priority areas")
      ) {
        inPrioritiesSection = true;
        continue;
      }
      if (inPrioritiesSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          priorities.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
    }

    return priorities.slice(0, 5); // Limit to top 5 priorities
  }

  extractClinicalPatterns(content) {
    const patterns = [];
    const lines = content.split("\n");
    let inPatternsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("clinical patterns") ||
        line.toLowerCase().includes("patterns")
      ) {
        inPatternsSection = true;
        continue;
      }
      if (inPatternsSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          patterns.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("recommendations") ||
        line.toLowerCase().includes("interventions")
      ) {
        inPatternsSection = false;
      }
    }

    return patterns.slice(0, 8); // Limit to top 8 patterns
  }

  extractInterventions(content) {
    const interventions = [];
    const lines = content.split("\n");
    let inInterventionsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("interventions") ||
        line.toLowerCase().includes("potential interventions")
      ) {
        inInterventionsSection = true;
        continue;
      }
      if (inInterventionsSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          interventions.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("quality") ||
        line.toLowerCase().includes("safety")
      ) {
        inInterventionsSection = false;
      }
    }

    return interventions.slice(0, 8); // Limit to top 8 interventions
  }

  extractQualityOpportunities(content) {
    const opportunities = [];
    const lines = content.split("\n");
    let inQualitySection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("quality improvement") ||
        line.toLowerCase().includes("quality opportunities")
      ) {
        inQualitySection = true;
        continue;
      }
      if (inQualitySection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          opportunities.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("safety") ||
        line.toLowerCase().includes("coordination")
      ) {
        inQualitySection = false;
      }
    }

    return opportunities.slice(0, 6); // Limit to top 6 opportunities
  }

  extractSafetyConsiderations(content) {
    const safety = [];
    const lines = content.split("\n");
    let inSafetySection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("safety considerations") ||
        line.toLowerCase().includes("patient safety")
      ) {
        inSafetySection = true;
        continue;
      }
      if (inSafetySection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          safety.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("coordination") ||
        line.toLowerCase().includes("conclusion")
      ) {
        inSafetySection = false;
      }
    }

    return safety.slice(0, 6); // Limit to top 6 safety considerations
  }

  extractCoordinationSuggestions(content) {
    const suggestions = [];
    const lines = content.split("\n");
    let inCoordinationSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("coordination") ||
        line.toLowerCase().includes("care coordination")
      ) {
        inCoordinationSection = true;
        continue;
      }
      if (inCoordinationSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          suggestions.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
    }

    return suggestions.slice(0, 5); // Limit to top 5 coordination suggestions
  }

  extractImmediateNeeds(content) {
    const needs = [];
    const lines = content.split("\n");
    let inImmediateSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("immediate") ||
        line.toLowerCase().includes("24 hours")
      ) {
        inImmediateSection = true;
        continue;
      }
      if (inImmediateSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          needs.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("short-term") ||
        line.toLowerCase().includes("7 days")
      ) {
        inImmediateSection = false;
      }
    }

    return needs.slice(0, 8); // Limit to top 8 immediate needs
  }

  extractShortTermNeeds(content) {
    const needs = [];
    const lines = content.split("\n");
    let inShortTermSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("short-term") ||
        line.toLowerCase().includes("7 days")
      ) {
        inShortTermSection = true;
        continue;
      }
      if (inShortTermSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          needs.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("long-term") ||
        line.toLowerCase().includes("resource")
      ) {
        inShortTermSection = false;
      }
    }

    return needs.slice(0, 8); // Limit to top 8 short-term needs
  }

  extractLongTermNeeds(content) {
    const needs = [];
    const lines = content.split("\n");
    let inLongTermSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("long-term") ||
        line.toLowerCase().includes("long term")
      ) {
        inLongTermSection = true;
        continue;
      }
      if (inLongTermSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          needs.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("resource") ||
        line.toLowerCase().includes("complications")
      ) {
        inLongTermSection = false;
      }
    }

    return needs.slice(0, 6); // Limit to top 6 long-term needs
  }

  extractResourceRequirements(content) {
    const resources = [];
    const lines = content.split("\n");
    let inResourceSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("resource") ||
        line.toLowerCase().includes("requirements")
      ) {
        inResourceSection = true;
        continue;
      }
      if (inResourceSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          resources.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("complications") ||
        line.toLowerCase().includes("discharge")
      ) {
        inResourceSection = false;
      }
    }

    return resources.slice(0, 6); // Limit to top 6 resource requirements
  }

  extractComplications(content) {
    const complications = [];
    const lines = content.split("\n");
    let inComplicationsSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("complications") ||
        line.toLowerCase().includes("potential complications")
      ) {
        inComplicationsSection = true;
        continue;
      }
      if (inComplicationsSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          complications.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("discharge") ||
        line.toLowerCase().includes("support")
      ) {
        inComplicationsSection = false;
      }
    }

    return complications.slice(0, 6); // Limit to top 6 potential complications
  }

  extractDischargePlanning(content) {
    const planning = [];
    const lines = content.split("\n");
    let inDischargeSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("discharge") ||
        line.toLowerCase().includes("discharge planning")
      ) {
        inDischargeSection = true;
        continue;
      }
      if (inDischargeSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          planning.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
      if (
        line.toLowerCase().includes("support") ||
        line.toLowerCase().includes("family")
      ) {
        inDischargeSection = false;
      }
    }

    return planning.slice(0, 5); // Limit to top 5 discharge planning items
  }

  extractSupportNeeds(content) {
    const support = [];
    const lines = content.split("\n");
    let inSupportSection = false;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("support") ||
        line.toLowerCase().includes("caregiver")
      ) {
        inSupportSection = true;
        continue;
      }
      if (inSupportSection && line.trim()) {
        if (line.match(/^\d+\./) || line.match(/^[-*]/)) {
          support.push(
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-*]\s*/, "")
              .trim()
          );
        }
      }
    }

    return support.slice(0, 5); // Limit to top 5 support needs
  }

  // Health check
  async healthCheck() {
    const checks = {
      openai: false,
      gemini: false,
      overall: false,
    };

    try {
      // Test OpenAI
      const openaiTest = await this.providers.openai.generateResponse("Test", {
        model: "gpt-3.5-turbo",
        max_tokens: 10,
      });
      checks.openai = !!openaiTest;
    } catch (error) {
      console.error("OpenAI health check failed:", error.message);
    }

    try {
      // Test Gemini
      const geminiTest = await this.providers.gemini.generateContent("Test", {
        model: "gemini-1.5-flash",
        generationConfig: { maxOutputTokens: 10 },
      });
      checks.gemini = !!geminiTest;
    } catch (error) {
      console.error("Gemini health check failed:", error.message);
    }

    checks.overall = checks.openai || checks.gemini;
    return checks;
  }

  // Enhanced service status and health monitoring
  getServiceStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      service: "NursingAIService",
      version: "2.0.0",
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      providers: {},
      cache: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate(),
      },
      rateLimiting: {
        activeUsers: this.rateLimitTracker.size,
        totalRequests: this.requestCounter,
      },
      circuitBreakers: {},
    };

    // Provider status
    Object.keys(this.performanceMetrics).forEach((provider) => {
      const metrics = this.performanceMetrics[provider];
      status.providers[provider] = {
        status:
          metrics.circuitBreakerState === "OPEN" ? "unavailable" : "available",
        successRate: metrics.successRate,
        avgResponseTime: metrics.avgResponseTime,
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        circuitBreakerState: metrics.circuitBreakerState,
        lastError: metrics.lastError,
      };
      status.circuitBreakers[provider] = {
        state: metrics.circuitBreakerState,
        failures: metrics.circuitBreakerFailures,
        lastFailure: metrics.circuitBreakerLastFailure,
      };
    });

    return status;
  }

  // Calculate cache hit rate
  calculateCacheHitRate() {
    const totalRequests = this.requestCounter;
    const cacheHits = this.cache.size; // Simplified - in production, track actual hits
    return totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
  }

  // Get detailed performance metrics
  getPerformanceMetrics() {
    return {
      timestamp: new Date().toISOString(),
      providers: this.performanceMetrics,
      cache: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate(),
      },
      rateLimiting: {
        activeUsers: this.rateLimitTracker.size,
        totalRequests: this.requestCounter,
      },
    };
  }

  // Clear cache (useful for testing and maintenance)
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.logInfo("Cache cleared");
  }

  // Reset circuit breakers (useful for testing and maintenance)
  resetCircuitBreakers() {
    Object.keys(this.performanceMetrics).forEach((provider) => {
      const metrics = this.performanceMetrics[provider];
      metrics.circuitBreakerState = "CLOSED";
      metrics.circuitBreakerFailures = 0;
      metrics.circuitBreakerLastFailure = null;
    });
    this.logInfo("Circuit breakers reset");
  }

  // Get configuration (for monitoring and debugging)
  getConfiguration() {
    return {
      ...this.config,
      modelConfigs: Object.keys(this.modelConfigs),
      availableProviders: Object.keys(this.providers),
    };
  }

  // Enhanced error reporting
  getErrorReport(timeframe = "24h") {
    const now = Date.now();
    const timeframeMs =
      timeframe === "24h"
        ? 24 * 60 * 60 * 1000
        : timeframe === "1h"
        ? 60 * 60 * 1000
        : timeframe === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    const report = {
      timestamp: new Date().toISOString(),
      timeframe,
      errors: {},
      recommendations: [],
    };

    Object.keys(this.performanceMetrics).forEach((provider) => {
      const metrics = this.performanceMetrics[provider];
      const recentErrors = metrics.totalErrors;
      const errorRate =
        metrics.totalRequests > 0
          ? (recentErrors / metrics.totalRequests) * 100
          : 0;

      report.errors[provider] = {
        totalErrors: recentErrors,
        errorRate: errorRate.toFixed(2) + "%",
        lastError: metrics.lastError,
        circuitBreakerState: metrics.circuitBreakerState,
      };

      // Generate recommendations
      if (errorRate > 10) {
        report.recommendations.push(
          `High error rate (${errorRate.toFixed(
            2
          )}%) for ${provider} - consider investigation`
        );
      }
      if (metrics.circuitBreakerState === "OPEN") {
        report.recommendations.push(
          `${provider} circuit breaker is OPEN - service unavailable`
        );
      }
      if (metrics.avgResponseTime > 5000) {
        report.recommendations.push(
          `Slow response time (${metrics.avgResponseTime}ms) for ${provider} - consider optimization`
        );
      }
    });

    return report;
  }

  // Health check endpoint
  async healthCheck() {
    try {
      const status = this.getServiceStatus();
      const hasHealthyProvider = Object.values(status.providers).some(
        (p) => p.status === "available"
      );

      return {
        healthy: hasHealthyProvider && status.status === "healthy",
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logError("Health check failed", error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Generate AI-powered care plan suggestions
  async generateCarePlanSuggestions(context) {
    const startTime = Date.now();
    const requestId = context.requestId || this.generateRequestId();

    try {
      this.logInfo("Generating care plan suggestions", {
        requestId,
        patientId: context.patient?.id,
        diagnoses: context.patient?.diagnoses,
      });

      // Validate input
      if (!context.patient) {
        throw new ValidationError(
          "Patient context is required",
          "patient",
          context.patient
        );
      }

      // Prepare AI prompt
      const prompt = this.buildCarePlanPrompt(context);

      // Get AI response
      let aiResponse;
      try {
        if (this.config.aiProvider === "openai") {
          aiResponse = await this.callOpenAI(prompt, {
            model: "gpt-4",
            temperature: 0.3,
            max_tokens: 2000,
          });
        } else {
          aiResponse = await this.callGemini(prompt, {
            temperature: 0.3,
            maxOutputTokens: 2000,
          });
        }
      } catch (aiError) {
        this.logError("AI service call failed", aiError, { requestId });
        throw new ServiceUnavailableError(
          this.config.aiProvider,
          aiError.message
        );
      }

      // Parse and validate AI response
      const suggestions = this.parseCarePlanSuggestions(aiResponse);

      // Enhance with evidence-based data
      const enhancedSuggestions = this.enhanceCarePlanSuggestions(
        suggestions,
        context
      );

      const responseTime = Date.now() - startTime;
      this.updateMetrics("generateCarePlanSuggestions", true, responseTime);

      this.logInfo("Care plan suggestions generated successfully", {
        requestId,
        patientId: context.patient?.id,
        suggestionsCount: {
          goals: enhancedSuggestions.goals?.length || 0,
          interventions: enhancedSuggestions.interventions?.length || 0,
        },
        responseTime,
      });

      return {
        success: true,
        data: enhancedSuggestions,
        requestId,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics("generateCarePlanSuggestions", false, responseTime);

      this.logError("Failed to generate care plan suggestions", error, {
        requestId,
        patientId: context.patient?.id,
        responseTime,
      });

      return {
        success: false,
        error: error.message,
        code: error.code || "GENERATION_FAILED",
        requestId,
        responseTime,
      };
    }
  }

  // Build AI prompt for care plan suggestions
  buildCarePlanPrompt(context) {
    const patient = context.patient;
    const diagnoses = patient.diagnoses || [];
    const clinicalData = patient.clinicalData || {};

    return `
You are an expert nursing AI assistant specializing in evidence-based care plan development. 
Generate comprehensive care plan suggestions for the following patient:

PATIENT INFORMATION:
- Name: ${patient.name}
- Primary Diagnoses: ${diagnoses.join(", ") || "Not specified"}
- Clinical Data: ${JSON.stringify(clinicalData, null, 2)}

REQUIREMENTS:
1. Generate 2-4 SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
2. Suggest 3-6 evidence-based nursing interventions
3. Recommend appropriate priority level (low, medium, high, critical)
4. Suggest realistic timeline for care plan completion
5. Include measurable outcomes for each goal
6. Base recommendations on current nursing best practices

RESPONSE FORMAT (JSON):
{
  "planName": "Descriptive care plan name",
  "priority": "medium|high|critical",
  "estimatedDuration": 30,
  "goals": [
    {
      "description": "Specific, measurable goal statement",
      "priority": "high|medium|low",
      "targetDate": "YYYY-MM-DD",
      "measurableOutcomes": ["Outcome 1", "Outcome 2"],
      "evidenceBase": "Clinical guideline or research basis"
    }
  ],
  "interventions": [
    {
      "type": "Assessment|Education|Monitoring|Treatment|Psychosocial",
      "description": "Detailed intervention description",
      "frequency": "How often to perform",
      "duration": "How long each session",
      "evidenceBase": "Clinical guideline or research basis"
    }
  ],
  "notes": "Additional clinical considerations",
  "riskFactors": ["Risk factor 1", "Risk factor 2"],
  "expectedOutcomes": ["Expected outcome 1", "Expected outcome 2"],
  "evidenceBase": ["Guideline 1", "Research study 2"]
}

Focus on patient safety, evidence-based practice, and realistic, achievable outcomes.
Ensure all suggestions are appropriate for the nursing scope of practice.
`;
  }

  // Parse AI response for care plan suggestions
  parseCarePlanSuggestions(aiResponse) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.goals || !Array.isArray(parsed.goals)) {
        parsed.goals = [];
      }
      if (!parsed.interventions || !Array.isArray(parsed.interventions)) {
        parsed.interventions = [];
      }

      return parsed;
    } catch (error) {
      this.logError("Failed to parse AI response", error, { aiResponse });

      // Return fallback structure
      return {
        planName: "AI-Generated Care Plan",
        priority: "medium",
        estimatedDuration: 30,
        goals: [],
        interventions: [],
        notes: "AI parsing failed, using fallback structure",
        riskFactors: [],
        expectedOutcomes: [],
        evidenceBase: [],
      };
    }
  }

  // Enhance care plan suggestions with additional data
  enhanceCarePlanSuggestions(suggestions, context) {
    const patient = context.patient;

    // Add IDs to goals and interventions
    suggestions.goals = suggestions.goals.map((goal, index) => ({
      ...goal,
      id: `goal_${Date.now()}_${index}`,
      progress: 0,
      status: "not_started",
      createdAt: new Date().toISOString(),
    }));

    suggestions.interventions = suggestions.interventions.map(
      (intervention, index) => ({
        ...intervention,
        id: `intervention_${Date.now()}_${index}`,
        status: "planned",
        createdAt: new Date().toISOString(),
      })
    );

    // Add metadata
    suggestions.generatedBy = "AI Assistant";
    suggestions.generatedAt = new Date().toISOString();
    suggestions.patientId = patient.id;
    suggestions.patientName = patient.name;

    return suggestions;
  }

  // Call OpenAI API
  async callOpenAI(prompt, options = {}) {
    try {
      const response = await openaiService.generateText(prompt, {
        model: options.model || "gpt-3.5-turbo",
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 1500,
      });

      if (!response.success) {
        throw new Error(response.error || "OpenAI API call failed");
      }

      return response.text;
    } catch (error) {
      throw new ServiceUnavailableError("openai", error.message);
    }
  }

  // Call Gemini API
  async callGemini(prompt, options = {}) {
    try {
      const response = await geminiService.generateText(prompt, {
        temperature: options.temperature || 0.3,
        maxOutputTokens: options.maxOutputTokens || 1500,
      });

      if (!response.success) {
        throw new Error(response.error || "Gemini API call failed");
      }

      return response.text;
    } catch (error) {
      throw new ServiceUnavailableError("gemini", error.message);
    }
  }
}

export default new NursingAIService();
