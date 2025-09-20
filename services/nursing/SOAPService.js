import crypto from "crypto";
import SOAPNote from "../../models/nursing/SOAPNote.js";
import NursingAIService from "./NursingAIService.js";
import EventManager from "./EventManager.js";
import NursingCacheService from "./NursingCacheService.js";

// Custom error classes for SOAP Service
class SOAPServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SOAPServiceError";
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.timestamp = new Date().toISOString();
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.timestamp = new Date().toISOString();
  }
}

class ServiceUnavailableError extends Error {
  constructor(message, service) {
    super(message);
    this.name = "ServiceUnavailableError";
    this.service = service;
    this.timestamp = new Date().toISOString();
  }
}

// Input validation class
class InputValidator {
  static validateSOAPData(data, context = {}) {
    const errors = [];
    
    if (!data) {
      errors.push("SOAP data is required");
      return { isValid: false, errors };
    }
    
    if (!data.patientId) {
      errors.push("Patient ID is required");
    }
    
    if (!data.userId) {
      errors.push("User ID is required");
    }
    
    if (data.soapData && typeof data.soapData !== 'object') {
      errors.push("SOAP data must be an object");
    }
    
    // Validate SOAP sections
    const requiredSections = ['subjective', 'objective', 'assessment', 'plan'];
    for (const section of requiredSections) {
      if (data.soapData && data.soapData[section] && typeof data.soapData[section] !== 'string') {
        errors.push(`${section} section must be a string`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
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
  
  static validateNoteId(noteId, context = {}) {
    if (!noteId) {
      throw new ValidationError("Note ID is required", "noteId");
    }
    
    if (typeof noteId !== 'string' && typeof noteId !== 'object') {
      throw new ValidationError("Note ID must be a string or object", "noteId");
    }
  }
  
  static sanitizeData(data) {
    if (!data) return data;
    
    // Deep clone to avoid mutating original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove potentially dangerous properties
    delete sanitized.__proto__;
    delete sanitized.constructor;
    
    return sanitized;
  }
}

class SOAPService {
  constructor() {
    this.aiService = NursingAIService;
    this.eventManager = EventManager;
    this.cacheService = NursingCacheService;

    // Enhanced configuration with environment variables
    this.config = {
      aiProvider: process.env.SOAP_AI_PROVIDER || 'openai',
      rateLimit: {
        maxRequests: parseInt(process.env.SOAP_RATE_LIMIT_MAX_REQUESTS) || 100,
        windowMs: parseInt(process.env.SOAP_RATE_LIMIT_WINDOW_MS) || 60000
      },
      cache: {
        ttl: parseInt(process.env.SOAP_CACHE_TTL) || 300000, // 5 minutes
        maxSize: parseInt(process.env.SOAP_CACHE_MAX_SIZE) || 1000
      },
      circuitBreaker: {
        threshold: parseInt(process.env.SOAP_CIRCUIT_BREAKER_THRESHOLD) || 5,
        timeout: parseInt(process.env.SOAP_CIRCUIT_BREAKER_TIMEOUT) || 60000
      },
      retries: {
        maxAttempts: parseInt(process.env.SOAP_RETRY_MAX_ATTEMPTS) || 3,
        backoffDelay: parseInt(process.env.SOAP_RETRY_BACKOFF_DELAY) || 1000
      },
      autoSave: {
        interval: parseInt(process.env.SOAP_AUTO_SAVE_INTERVAL) || 5000,
        enabled: process.env.SOAP_AUTO_SAVE_ENABLED === 'true'
      }
    };

    // SOAP note templates
    this.templates = this.initializeTemplates();

    // Auto-save interval (5 seconds)
    this.autoSaveInterval = this.config.autoSave.interval;

    // Voice-to-text integration placeholder
    this.voiceToTextEnabled = false;

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

    // Auto-save tracking
    this.autoSaveTimers = new Map();
  }

  // Utility methods for enhanced functionality
  generateRequestId() {
    return `soap_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  logInfo(message, context = {}) {
    const logEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      service: 'SOAPService',
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
      service: 'SOAPService',
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
    const validation = InputValidator.validateSOAPData(data, context);
    if (!validation.isValid) {
      this.performanceMetrics.errors.validation++;
      throw new ValidationError(`Validation failed: ${validation.errors.join(', ')}`, 'soapData');
    }
    
    if (context.userId) {
      InputValidator.validateUserId(context.userId, context);
    }
    
    if (context.noteId) {
      InputValidator.validateNoteId(context.noteId, context);
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
        service: 'SOAPService',
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
          circuitBreakerThreshold: this.config.circuitBreaker.threshold,
          autoSaveEnabled: this.config.autoSave.enabled
        }
      };
    } catch (error) {
      this.logError("Error getting service status", error, {});
      return {
        service: 'SOAPService',
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
      templates: Object.keys(this.templates).length,
      autoSaveTimers: this.autoSaveTimers.size
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
        service: 'SOAPService',
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
          },
          autoSave: {
            status: this.config.autoSave.enabled ? 'enabled' : 'disabled',
            activeTimers: this.autoSaveTimers.size
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
        service: 'SOAPService',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        error: error.message
      };
    }
  }

  // Generate template (alias for generateSOAPTemplate)
  async generateTemplate(assessmentType, patientData) {
    return this.generateSOAPTemplate(assessmentType, patientData);
  }

  // Validate note (alias for validateSOAPNote)
  async validateNote(soapNote) {
    return this.validateSOAPNote(soapNote);
  }

  // Generate SOAP note template
  async generateSOAPTemplate(assessmentType, patientData = {}) {
    try {
      const template = {
        type: assessmentType || "general",
        subjective: this.generateSubjectiveTemplate(
          assessmentType,
          patientData
        ),
        objective: this.generateObjectiveTemplate(assessmentType, patientData),
        assessment: this.generateAssessmentTemplate(
          assessmentType,
          patientData
        ),
        plan: this.generatePlanTemplate(assessmentType, patientData),
        metadata: {
          templateVersion: "1.0",
          generatedAt: new Date(),
          assessmentType,
        },
      };

      return {
        success: true,
        template,
        message: `SOAP template generated for ${assessmentType} assessment`,
      };
    } catch (error) {
      console.error("Error generating SOAP template:", error);
      return {
        success: false,
        template: null,
        error: error.message,
      };
    }
  }

  // Validate SOAP note
  async validateSOAPNote(soapNote) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        score: 0,
        completeness: 0,
      };

      // Check required sections
      const requiredSections = [
        "subjective",
        "objective",
        "assessment",
        "plan",
      ];
      let completedSections = 0;

      for (const section of requiredSections) {
        const content = soapNote.soapData?.[section] || soapNote[section];
        if (!content || content.trim().length === 0) {
          validation.errors.push(
            `${
              section.charAt(0).toUpperCase() + section.slice(1)
            } section is required`
          );
          validation.isValid = false;
        } else {
          completedSections++;
          // Check minimum content length
          if (content.trim().length < 10) {
            validation.warnings.push(
              `${
                section.charAt(0).toUpperCase() + section.slice(1)
              } section seems too brief`
            );
          }
        }
      }

      validation.completeness =
        (completedSections / requiredSections.length) * 100;

      // Check for clinical quality indicators
      const qualityChecks = this.performQualityChecks(soapNote);
      validation.warnings.push(...qualityChecks.warnings);
      validation.score = qualityChecks.score;

      // Overall validation score
      if (validation.errors.length === 0 && validation.warnings.length === 0) {
        validation.score = Math.max(validation.score, 90);
      } else if (validation.errors.length === 0) {
        validation.score = Math.max(validation.score, 75);
      } else {
        validation.score = Math.min(validation.score, 50);
      }

      return validation;
    } catch (error) {
      console.error("Error validating SOAP note:", error);
      return {
        isValid: false,
        errors: ["Validation failed due to system error"],
        warnings: [],
        score: 0,
        completeness: 0,
        error: error.message,
      };
    }
  }

  // Generate subjective template
  generateSubjectiveTemplate(assessmentType, patientData) {
    const templates = {
      admission:
        "Patient reports [chief complaint]. Describes symptoms as [description]. Pain level: [0-10]. Patient states [relevant history].",
      daily:
        "Patient reports [current status]. Sleep: [quality/hours]. Appetite: [status]. Pain: [0-10]. Mood: [description].",
      discharge:
        "Patient reports feeling [status]. Understanding of discharge instructions: [level]. Concerns: [any concerns].",
      general:
        "Patient reports [chief complaint/current status]. [Relevant symptoms or concerns].",
    };

    return templates[assessmentType] || templates.general;
  }

  // Generate objective template
  generateObjectiveTemplate(assessmentType, patientData) {
    const templates = {
      admission:
        "Vital signs: BP [value], HR [value], RR [value], Temp [value], O2 Sat [value]. General appearance: [description]. [Physical assessment findings].",
      daily:
        "Vital signs stable. [Current observations]. Activity level: [description]. [Any changes from previous assessment].",
      discharge:
        "Vital signs: [values]. Patient ambulating [status]. Wound/incision: [status]. [Final assessment findings].",
      general:
        "Vital signs: [values]. Physical assessment: [findings]. [Objective observations].",
    };

    return templates[assessmentType] || templates.general;
  }

  // Generate assessment template
  generateAssessmentTemplate(assessmentType, patientData) {
    const templates = {
      admission:
        "[Primary diagnosis]. [Secondary diagnoses]. Risk factors: [identified risks]. Nursing diagnoses: [relevant nursing diagnoses].",
      daily:
        "[Current status of conditions]. [Progress toward goals]. [Any new concerns or changes].",
      discharge:
        "[Final status of conditions]. Goals met: [list]. Readiness for discharge: [assessment].",
      general:
        "[Clinical assessment]. [Nursing diagnoses]. [Priority concerns].",
    };

    return templates[assessmentType] || templates.general;
  }

  // Generate plan template
  generatePlanTemplate(assessmentType, patientData) {
    const templates = {
      admission:
        "1. [Intervention for primary concern]\n2. [Monitoring plan]\n3. [Patient education needs]\n4. [Discharge planning considerations]",
      daily:
        "1. Continue [current interventions]\n2. Monitor [specific parameters]\n3. [Any plan modifications]\n4. [Patient/family education]",
      discharge:
        "1. [Discharge instructions provided]\n2. [Follow-up appointments scheduled]\n3. [Medications reconciled]\n4. [Home care arrangements]",
      general:
        "1. [Primary intervention]\n2. [Monitoring plan]\n3. [Patient education]\n4. [Follow-up plan]",
    };

    return templates[assessmentType] || templates.general;
  }

  // Perform quality checks
  performQualityChecks(soapNote) {
    const warnings = [];
    let score = 100;

    // Check for specific clinical indicators
    const content = JSON.stringify(soapNote.soapData || soapNote).toLowerCase();

    // Check for pain assessment
    if (!content.includes("pain") && !content.includes("comfort")) {
      warnings.push("Consider including pain/comfort assessment");
      score -= 5;
    }

    // Check for vital signs
    if (
      !content.includes("vital") &&
      !content.includes("bp") &&
      !content.includes("temperature")
    ) {
      warnings.push("Consider including vital signs assessment");
      score -= 5;
    }

    // Check for patient education
    if (
      !content.includes("education") &&
      !content.includes("teaching") &&
      !content.includes("instruction")
    ) {
      warnings.push("Consider including patient education components");
      score -= 5;
    }

    return { warnings, score: Math.max(score, 0) };
  }

  // Create new SOAP note
  async createSOAPNote(noteData, userId) {
    try {
      // Validate user has nursing premium access
      if (!(await this.validatePremiumAccess(userId))) {
        throw new Error("SOAP notes require nursing premium subscription");
      }

      // Apply template if specified
      let soapData = noteData.soapData || {};
      if (noteData.template && this.templates[noteData.template]) {
        soapData = this.applyTemplate(noteData.template, soapData);
      }

      // Create SOAP note
      const soapNote = new SOAPNote({
        ...noteData,
        soapData,
        userId,
        status: "draft",
        metadata: {
          createdAt: new Date(),
          autoSaveCount: 0,
        },
      });

      // Get initial AI enhancements
      const aiEnhancement = await this.aiService.enhanceSOAPNote(soapData, {
        patientId: noteData.patientId,
      });

      if (aiEnhancement.success) {
        soapNote.aiEnhancements = aiEnhancement.enhancement;
      }

      // Calculate initial quality score
      soapNote.calculateQualityScore();

      await soapNote.save();

      // Cache for quick access
      await this.cacheService.setSOAPNote(soapNote._id, soapNote);

      // Emit event for real-time updates
      this.eventManager.emit("soapNoteCreated", {
        noteId: soapNote._id,
        userId,
        patientId: soapNote.patientId,
        template: soapNote.template,
      });

      // Start auto-save for this note
      this.startAutoSave(soapNote._id, userId);

      return {
        success: true,
        soapNote,
        aiEnhancements: aiEnhancement.success
          ? aiEnhancement.enhancement
          : null,
      };
    } catch (error) {
      console.error("Error creating SOAP note:", error);
      throw error;
    }
  }

  // Update SOAP note
  async updateSOAPNote(noteId, updateData, userId, isAutoSave = false) {
    try {
      const soapNote = await SOAPNote.findById(noteId);

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (soapNote.userId.toString() !== userId) {
        throw new Error("Unauthorized access to SOAP note");
      }

      if (soapNote.status === "signed" && !isAutoSave) {
        throw new Error("Cannot modify signed SOAP note");
      }

      // Track changes for version control
      const changes = this.trackChanges(soapNote.soapData, updateData.soapData);

      // Update note
      Object.assign(soapNote, updateData);
      soapNote.metadata.updatedAt = new Date();
      soapNote.metadata.lastModified = new Date();

      if (isAutoSave) {
        soapNote.metadata.autoSaveCount =
          (soapNote.metadata.autoSaveCount || 0) + 1;
      }

      // Get AI enhancements for significant changes
      if (!isAutoSave && this.hasSignificantChanges(changes)) {
        const aiEnhancement = await this.aiService.enhanceSOAPNote(
          soapNote.soapData,
          { patientId: soapNote.patientId }
        );

        if (aiEnhancement.success) {
          soapNote.aiEnhancements = aiEnhancement.enhancement;
        }
      }

      // Recalculate quality score
      soapNote.calculateQualityScore();

      await soapNote.save();

      // Update cache
      await this.cacheService.setSOAPNote(noteId, soapNote);

      // Emit event for real-time collaboration
      this.eventManager.emit("soapNoteUpdated", {
        noteId,
        userId,
        changes,
        isAutoSave,
        aiEnhancements: soapNote.aiEnhancements,
      });

      return {
        success: true,
        soapNote,
        changes,
        isAutoSave,
      };
    } catch (error) {
      console.error("Error updating SOAP note:", error);
      throw error;
    }
  }

  // Get SOAP note by ID
  async getSOAPNote(noteId, userId) {
    try {
      // Try cache first
      let soapNote = await this.cacheService.getSOAPNote(noteId);

      if (!soapNote) {
        soapNote = await SOAPNote.findById(noteId)
          .populate("userId", "profile.firstName profile.lastName")
          .populate("patientId", "demographics.firstName demographics.lastName")
          .populate(
            "collaboration.sharedWith.userId",
            "profile.firstName profile.lastName"
          )
          .populate(
            "collaboration.comments.userId",
            "profile.firstName profile.lastName"
          );

        if (soapNote) {
          await this.cacheService.setSOAPNote(noteId, soapNote);
        }
      }

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      // Check access permissions
      const hasAccess = this.checkAccess(soapNote, userId);
      if (!hasAccess) {
        throw new Error("Unauthorized access to SOAP note");
      }

      return {
        success: true,
        soapNote,
      };
    } catch (error) {
      console.error("Error getting SOAP note:", error);
      throw error;
    }
  }

  // Get SOAP notes for patient
  async getPatientSOAPNotes(patientId, userId, options = {}) {
    try {
      const soapNotes = await SOAPNote.getByPatient(patientId, {
        limit: options.limit || 20,
        sort: options.sort || { createdAt: -1 },
      });

      // Filter by user access
      const accessibleNotes = soapNotes.filter((note) =>
        this.checkAccess(note, userId)
      );

      return {
        success: true,
        soapNotes: accessibleNotes,
        total: accessibleNotes.length,
      };
    } catch (error) {
      console.error("Error getting patient SOAP notes:", error);
      throw error;
    }
  }

  // Share SOAP note with other users
  async shareSOAPNote(noteId, userId, shareData) {
    try {
      const soapNote = await SOAPNote.findById(noteId);

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (soapNote.userId.toString() !== userId) {
        throw new Error("Only note owner can share");
      }

      // Add to shared users
      const existingShare = soapNote.collaboration.sharedWith.find(
        (share) => share.userId.toString() === shareData.userId
      );

      if (existingShare) {
        existingShare.permission = shareData.permission;
      } else {
        soapNote.collaboration.sharedWith.push({
          userId: shareData.userId,
          permission: shareData.permission,
          sharedAt: new Date(),
        });
      }

      await soapNote.save();

      // Update cache
      await this.cacheService.setSOAPNote(noteId, soapNote);

      // Emit event
      this.eventManager.emit("soapNoteShared", {
        noteId,
        ownerId: userId,
        sharedWith: shareData.userId,
        permission: shareData.permission,
      });

      return {
        success: true,
        soapNote,
      };
    } catch (error) {
      console.error("Error sharing SOAP note:", error);
      throw error;
    }
  }

  // Add comment to SOAP note
  async addComment(noteId, userId, comment) {
    try {
      const soapNote = await SOAPNote.findById(noteId);

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (!this.checkAccess(soapNote, userId)) {
        throw new Error("Unauthorized access to SOAP note");
      }

      const result = await soapNote.addComment(userId, comment);

      // Update cache
      await this.cacheService.setSOAPNote(noteId, result);

      // Emit event for real-time collaboration
      this.eventManager.emit("soapNoteCommentAdded", {
        noteId,
        userId,
        comment,
        timestamp: new Date(),
      });

      return {
        success: true,
        soapNote: result,
      };
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  }

  // Sign SOAP note
  async signSOAPNote(noteId, userId, signatureData = {}) {
    try {
      const soapNote = await SOAPNote.findById(noteId);

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (soapNote.userId.toString() !== userId) {
        throw new Error("Only note owner can sign");
      }

      if (soapNote.status === "signed") {
        throw new Error("SOAP note is already signed");
      }

      // Validate completeness before signing
      const qualityScore = soapNote.calculateQualityScore();
      if (qualityScore < 70) {
        throw new Error(
          "SOAP note quality score too low for signing (minimum 70%)"
        );
      }

      // Update signature
      soapNote.signature = {
        signed: true,
        signedBy: userId,
        signedAt: new Date(),
        signatureHash: this.generateSignatureHash(soapNote, userId),
        witnessedBy: signatureData.witnessedBy || null,
      };

      soapNote.status = "signed";

      await soapNote.save();

      // Update cache
      await this.cacheService.setSOAPNote(noteId, soapNote);

      // Emit event
      this.eventManager.emit("soapNoteSigned", {
        noteId,
        userId,
        signedAt: soapNote.signature.signedAt,
      });

      return {
        success: true,
        soapNote,
      };
    } catch (error) {
      console.error("Error signing SOAP note:", error);
      throw error;
    }
  }

  // Generate PDF of SOAP note
  async generatePDF(noteId, userId) {
    try {
      const soapNote = await SOAPNote.findById(noteId)
        .populate("patientId")
        .populate("userId");

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (!this.checkAccess(soapNote, userId)) {
        throw new Error("Unauthorized access to SOAP note");
      }

      const pdf = await soapNote.generatePDF();

      return {
        success: true,
        pdf,
      };
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }

  // Advanced automated quality scoring
  async calculateAdvancedQualityScore(soapData, patientContext = {}) {
    try {
      const qualityMetrics = {
        completeness: 0,
        clinicalAccuracy: 0,
        documentation: 0,
        consistency: 0,
        compliance: 0,
        overall: 0,
      };

      // Completeness scoring (30% weight)
      const completenessScore = this.assessCompleteness(soapData);
      qualityMetrics.completeness = completenessScore;

      // Clinical accuracy scoring (25% weight)
      const accuracyScore = await this.assessClinicalAccuracy(
        soapData,
        patientContext
      );
      qualityMetrics.clinicalAccuracy = accuracyScore;

      // Documentation quality scoring (20% weight)
      const documentationScore = this.assessDocumentationQuality(soapData);
      qualityMetrics.documentation = documentationScore;

      // Clinical consistency scoring (15% weight)
      const consistencyScore = await this.assessClinicalConsistency(soapData);
      qualityMetrics.consistency = consistencyScore;

      // Regulatory compliance scoring (10% weight)
      const complianceScore = this.assessRegulatoryCompliance(soapData);
      qualityMetrics.compliance = complianceScore;

      // Calculate weighted overall score
      qualityMetrics.overall = Math.round(
        completenessScore * 0.3 +
          accuracyScore * 0.25 +
          documentationScore * 0.2 +
          consistencyScore * 0.15 +
          complianceScore * 0.1
      );

      return {
        success: true,
        qualityMetrics,
        recommendations: await this.generateQualityRecommendations(
          qualityMetrics,
          soapData
        ),
        benchmarkComparison: await this.compareToBenchmarks(qualityMetrics),
      };
    } catch (error) {
      console.error("Error calculating quality score:", error);
      return {
        success: false,
        error: error.message,
        qualityMetrics: {
          completeness: 0,
          clinicalAccuracy: 0,
          documentation: 0,
          consistency: 0,
          compliance: 0,
          overall: 0,
        },
      };
    }
  }

  // Assess completeness of SOAP note
  assessCompleteness(soapData) {
    let score = 0;
    const maxScore = 100;

    // Required sections (40 points)
    const requiredSections = ["subjective", "objective", "assessment", "plan"];
    const presentSections = requiredSections.filter(
      (section) =>
        soapData[section] && Object.keys(soapData[section]).length > 0
    );
    score += (presentSections.length / requiredSections.length) * 40;

    // Subjective completeness (15 points)
    if (soapData.subjective) {
      const subjectiveFields = [
        "chiefComplaint",
        "historyOfPresentIllness",
        "painAssessment",
      ];
      const presentSubjective = subjectiveFields.filter(
        (field) =>
          soapData.subjective[field] &&
          (typeof soapData.subjective[field] === "string"
            ? soapData.subjective[field].trim().length > 0
            : Object.keys(soapData.subjective[field]).length > 0)
      );
      score += (presentSubjective.length / subjectiveFields.length) * 15;
    }

    // Objective completeness (15 points)
    if (soapData.objective) {
      const objectiveFields = ["vitalSigns", "physicalExam"];
      const presentObjective = objectiveFields.filter(
        (field) =>
          soapData.objective[field] &&
          Object.keys(soapData.objective[field]).length > 0
      );
      score += (presentObjective.length / objectiveFields.length) * 15;
    }

    // Assessment completeness (15 points)
    if (soapData.assessment) {
      const assessmentFields = ["primaryDiagnosis", "clinicalImpression"];
      const presentAssessment = assessmentFields.filter(
        (field) =>
          soapData.assessment[field] &&
          soapData.assessment[field].trim().length > 0
      );
      score += (presentAssessment.length / assessmentFields.length) * 15;
    }

    // Plan completeness (15 points)
    if (soapData.plan) {
      const planFields = ["interventions", "monitoring"];
      const presentPlan = planFields.filter(
        (field) =>
          soapData.plan[field] &&
          (Array.isArray(soapData.plan[field])
            ? soapData.plan[field].length > 0
            : Object.keys(soapData.plan[field]).length > 0)
      );
      score += (presentPlan.length / planFields.length) * 15;
    }

    return Math.min(Math.round(score), maxScore);
  }

  // Assess clinical accuracy
  async assessClinicalAccuracy(soapData, patientContext) {
    let score = 100;

    try {
      // Check for clinical inconsistencies
      const validation = await this.validateClinicalConsistency(soapData);

      // Deduct points for warnings and errors
      validation.warnings.forEach((warning) => {
        switch (warning.severity) {
          case "high":
            score -= 15;
            break;
          case "medium":
            score -= 10;
            break;
          case "low":
            score -= 5;
            break;
        }
      });

      // Check for appropriate terminology usage
      const terminologyScore = this.assessMedicalTerminology(soapData);
      score = (score + terminologyScore) / 2;

      return Math.max(Math.round(score), 0);
    } catch (error) {
      console.error("Error assessing clinical accuracy:", error);
      return 50; // Default moderate score on error
    }
  }

  // Assess documentation quality
  assessDocumentationQuality(soapData) {
    let score = 0;

    // Grammar and spelling (30 points)
    const grammarScore = this.assessGrammarAndSpelling(soapData);
    score += grammarScore * 0.3;

    // Clarity and conciseness (25 points)
    const clarityScore = this.assessClarity(soapData);
    score += clarityScore * 0.25;

    // Professional language (25 points)
    const professionalScore = this.assessProfessionalLanguage(soapData);
    score += professionalScore * 0.25;

    // Structure and organization (20 points)
    const structureScore = this.assessStructure(soapData);
    score += structureScore * 0.2;

    return Math.round(score);
  }

  // Assess medical terminology usage
  assessMedicalTerminology(soapData) {
    let score = 100;
    const text = JSON.stringify(soapData).toLowerCase();

    // Check for appropriate medical terminology
    const appropriateTerms = [
      "auscultation",
      "palpation",
      "percussion",
      "inspection",
      "systolic",
      "diastolic",
      "tachycardia",
      "bradycardia",
      "hypertension",
      "hypotension",
      "dyspnea",
      "orthopnea",
    ];

    const inappropriateTerms = [
      "feels bad",
      "looks sick",
      "not good",
      "weird",
      "funny feeling",
      "strange",
      "odd",
    ];

    // Bonus for appropriate terms
    const appropriateCount = appropriateTerms.filter((term) =>
      text.includes(term)
    ).length;
    score += Math.min(appropriateCount * 2, 20);

    // Penalty for inappropriate terms
    const inappropriateCount = inappropriateTerms.filter((term) =>
      text.includes(term)
    ).length;
    score -= inappropriateCount * 5;

    return Math.max(Math.min(score, 100), 0);
  }

  // Comprehensive search and filtering
  async searchSOAPNotes(userId, searchCriteria = {}) {
    try {
      const {
        query,
        patientId,
        dateRange,
        status,
        template,
        qualityScore,
        clinicalFindings,
        medications,
        diagnoses,
        limit = 20,
        offset = 0,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = searchCriteria;

      // Build MongoDB aggregation pipeline
      const pipeline = [];

      // Match stage
      const matchConditions = { userId };

      if (patientId) {
        matchConditions.patientId = patientId;
      }

      if (status) {
        matchConditions.status = status;
      }

      if (template) {
        matchConditions.template = template;
      }

      if (dateRange) {
        matchConditions.createdAt = {};
        if (dateRange.start) {
          matchConditions.createdAt.$gte = new Date(dateRange.start);
        }
        if (dateRange.end) {
          matchConditions.createdAt.$lte = new Date(dateRange.end);
        }
      }

      if (qualityScore) {
        matchConditions["qualityMetrics.overall"] = {
          $gte: qualityScore.min || 0,
          $lte: qualityScore.max || 100,
        };
      }

      pipeline.push({ $match: matchConditions });

      // Text search stage
      if (query) {
        pipeline.push({
          $match: {
            $or: [
              { "soapData.subjective": { $regex: query, $options: "i" } },
              { "soapData.objective": { $regex: query, $options: "i" } },
              { "soapData.assessment": { $regex: query, $options: "i" } },
              { "soapData.plan": { $regex: query, $options: "i" } },
            ],
          },
        });
      }

      // Clinical findings filter
      if (clinicalFindings && clinicalFindings.length > 0) {
        pipeline.push({
          $match: {
            $or: clinicalFindings.map((finding) => ({
              "soapData.objective.observations": {
                $elemMatch: { observation: { $regex: finding, $options: "i" } },
              },
            })),
          },
        });
      }

      // Medications filter
      if (medications && medications.length > 0) {
        pipeline.push({
          $match: {
            "soapData.plan.medications": {
              $elemMatch: {
                name: { $in: medications },
              },
            },
          },
        });
      }

      // Diagnoses filter
      if (diagnoses && diagnoses.length > 0) {
        pipeline.push({
          $match: {
            $or: [
              { "soapData.assessment.primaryDiagnosis": { $in: diagnoses } },
              { "soapData.assessment.secondaryDiagnoses": { $in: diagnoses } },
            ],
          },
        });
      }

      // Add lookup stages for population
      pipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $lookup: {
            from: "patients",
            localField: "patientId",
            foreignField: "_id",
            as: "patient",
          },
        }
      );

      // Sort stage
      const sortStage = {};
      sortStage[sortBy] = sortOrder === "desc" ? -1 : 1;
      pipeline.push({ $sort: sortStage });

      // Pagination
      pipeline.push({ $skip: offset });
      pipeline.push({ $limit: limit });

      // Execute search
      const results = await SOAPNote.aggregate(pipeline);

      // Get total count for pagination
      const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
      countPipeline.push({ $count: "total" });
      const countResult = await SOAPNote.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Enhanced search analytics
      const searchAnalytics = await this.generateSearchAnalytics(
        results,
        searchCriteria
      );

      return {
        success: true,
        results,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit),
          currentPage: Math.floor(offset / limit) + 1,
        },
        analytics: searchAnalytics,
        searchCriteria,
      };
    } catch (error) {
      console.error("Error searching SOAP notes:", error);
      throw error;
    }
  }

  // Generate search analytics
  async generateSearchAnalytics(results, searchCriteria) {
    try {
      const analytics = {
        resultCount: results.length,
        qualityDistribution: {},
        templateDistribution: {},
        statusDistribution: {},
        timeDistribution: {},
        clinicalInsights: {},
      };

      // Quality score distribution
      const qualityRanges = {
        "Excellent (90-100)": 0,
        "Good (80-89)": 0,
        "Fair (70-79)": 0,
        "Poor (<70)": 0,
      };
      results.forEach((note) => {
        const score = note.qualityMetrics?.overall || 0;
        if (score >= 90) qualityRanges["Excellent (90-100)"]++;
        else if (score >= 80) qualityRanges["Good (80-89)"]++;
        else if (score >= 70) qualityRanges["Fair (70-79)"]++;
        else qualityRanges["Poor (<70)"]++;
      });
      analytics.qualityDistribution = qualityRanges;

      // Template distribution
      const templates = {};
      results.forEach((note) => {
        const template = note.template || "general";
        templates[template] = (templates[template] || 0) + 1;
      });
      analytics.templateDistribution = templates;

      // Status distribution
      const statuses = {};
      results.forEach((note) => {
        const status = note.status || "draft";
        statuses[status] = (statuses[status] || 0) + 1;
      });
      analytics.statusDistribution = statuses;

      // Time-based distribution (last 30 days)
      const timeRanges = {};
      const now = new Date();
      results.forEach((note) => {
        const daysAgo = Math.floor(
          (now - new Date(note.createdAt)) / (1000 * 60 * 60 * 24)
        );
        const range =
          daysAgo <= 7
            ? "Last 7 days"
            : daysAgo <= 30
            ? "Last 30 days"
            : "Older";
        timeRanges[range] = (timeRanges[range] || 0) + 1;
      });
      analytics.timeDistribution = timeRanges;

      return analytics;
    } catch (error) {
      console.error("Error generating search analytics:", error);
      return {
        resultCount: results.length,
        error: error.message,
      };
    }
  }

  // Get enhanced quality metrics
  async getAdvancedQualityMetrics(userId, dateRange = {}) {
    try {
      const pipeline = [
        { $match: { userId, ...this.buildDateRangeFilter(dateRange) } },
        {
          $group: {
            _id: null,
            totalNotes: { $sum: 1 },
            avgQuality: { $avg: "$qualityMetrics.overall" },
            avgCompleteness: { $avg: "$qualityMetrics.completeness" },
            avgAccuracy: { $avg: "$qualityMetrics.clinicalAccuracy" },
            avgDocumentation: { $avg: "$qualityMetrics.documentation" },
            avgConsistency: { $avg: "$qualityMetrics.consistency" },
            avgCompliance: { $avg: "$qualityMetrics.compliance" },
            signedNotes: {
              $sum: { $cond: [{ $eq: ["$status", "signed"] }, 1, 0] },
            },
            draftNotes: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
            excellentNotes: {
              $sum: {
                $cond: [{ $gte: ["$qualityMetrics.overall", 90] }, 1, 0],
              },
            },
            goodNotes: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$qualityMetrics.overall", 80] },
                      { $lt: ["$qualityMetrics.overall", 90] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            fairNotes: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$qualityMetrics.overall", 70] },
                      { $lt: ["$qualityMetrics.overall", 80] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            poorNotes: {
              $sum: { $cond: [{ $lt: ["$qualityMetrics.overall", 70] }, 1, 0] },
            },
          },
        },
      ];

      const metrics = await SOAPNote.aggregate(pipeline);
      const result = metrics[0] || {
        totalNotes: 0,
        avgQuality: 0,
        avgCompleteness: 0,
        avgAccuracy: 0,
        avgDocumentation: 0,
        avgConsistency: 0,
        avgCompliance: 0,
        signedNotes: 0,
        draftNotes: 0,
        excellentNotes: 0,
        goodNotes: 0,
        fairNotes: 0,
        poorNotes: 0,
      };

      // Calculate trends
      const trends = await this.calculateQualityTrends(userId, dateRange);

      // Generate improvement recommendations
      const recommendations = await this.generateImprovementRecommendations(
        result
      );

      return {
        success: true,
        metrics: {
          ...result,
          qualityDistribution: {
            excellent: result.excellentNotes,
            good: result.goodNotes,
            fair: result.fairNotes,
            poor: result.poorNotes,
          },
          completionRate:
            result.totalNotes > 0
              ? ((result.signedNotes / result.totalNotes) * 100).toFixed(1)
              : 0,
        },
        trends,
        recommendations,
      };
    } catch (error) {
      console.error("Error getting advanced quality metrics:", error);
      throw error;
    }
  }

  // Advanced Voice-to-text integration with medical vocabulary
  async processVoiceInput(noteId, userId, audioData, options = {}) {
    try {
      const soapNote = await SOAPNote.findById(noteId);

      if (!soapNote) {
        throw new Error("SOAP note not found");
      }

      if (!this.checkAccess(soapNote, userId)) {
        throw new Error("Unauthorized access to SOAP note");
      }

      // Enhanced voice processing pipeline
      const transcription = await this.transcribeAudioAdvanced(audioData, {
        medicalVocabulary: true,
        speakerDiarization: options.multipleSpeakers || false,
        punctuation: true,
        confidence: true,
      });

      // Apply advanced medical vocabulary corrections
      const correctedText = await this.applyAdvancedMedicalCorrections(
        transcription
      );

      // Extract medical entities and terminology
      const medicalEntities = await this.extractMedicalEntities(
        correctedText.text
      );

      // Get AI suggestions for SOAP structure with clinical context
      const structuredText = await this.structureVoiceInputAdvanced(
        correctedText.text,
        soapNote.soapData,
        medicalEntities
      );

      // Generate clinical decision support suggestions
      const clinicalSuggestions = await this.generateClinicalSuggestions(
        structuredText,
        soapNote.patientId
      );

      // Auto-update SOAP note if requested
      if (options.autoUpdate) {
        await this.updateSOAPNote(
          noteId,
          {
            soapData: { ...soapNote.soapData, ...structuredText },
          },
          userId
        );
      }

      return {
        success: true,
        transcription: transcription.text,
        confidence: transcription.confidence,
        correctedText: correctedText.text,
        corrections: correctedText.corrections,
        medicalEntities,
        structuredText,
        clinicalSuggestions,
        processingTime: Date.now() - transcription.startTime,
      };
    } catch (error) {
      console.error("Error processing voice input:", error);
      throw error;
    }
  }

  // Advanced voice transcription with medical vocabulary
  async transcribeAudioAdvanced(audioData, options = {}) {
    const startTime = Date.now();

    try {
      // This would integrate with Google Speech-to-Text, Azure Speech, or AWS Transcribe Medical
      // For now, simulating advanced transcription with medical vocabulary

      const medicalTerms = [
        "hypertension",
        "diabetes",
        "myocardial infarction",
        "pneumonia",
        "bradycardia",
        "tachycardia",
        "dyspnea",
        "orthopnea",
        "edema",
        "auscultation",
        "palpation",
        "percussion",
        "inspection",
        "systolic",
        "diastolic",
        "murmur",
        "gallop",
        "friction rub",
      ];

      // Simulate transcription with medical context
      const mockTranscription = {
        text: "Patient presents with chest pain and shortness of breath. Blood pressure is elevated at 160 over 95. Heart rate is 88 beats per minute. Auscultation reveals normal S1 and S2 heart sounds with no murmurs. Patient reports pain as 7 out of 10 on pain scale.",
        confidence: 0.92,
        segments: [
          {
            text: "Patient presents with chest pain and shortness of breath",
            confidence: 0.95,
            startTime: 0,
            endTime: 3.2,
          },
          {
            text: "Blood pressure is elevated at 160 over 95",
            confidence: 0.89,
            startTime: 3.5,
            endTime: 6.1,
          },
          {
            text: "Heart rate is 88 beats per minute",
            confidence: 0.94,
            startTime: 6.3,
            endTime: 8.7,
          },
          {
            text: "Auscultation reveals normal S1 and S2 heart sounds with no murmurs",
            confidence: 0.91,
            startTime: 9.0,
            endTime: 13.2,
          },
          {
            text: "Patient reports pain as 7 out of 10 on pain scale",
            confidence: 0.93,
            startTime: 13.5,
            endTime: 16.8,
          },
        ],
        medicalTermsDetected: [
          "chest pain",
          "shortness of breath",
          "blood pressure",
          "heart rate",
          "auscultation",
          "heart sounds",
          "murmurs",
          "pain scale",
        ],
        startTime,
      };

      return mockTranscription;
    } catch (error) {
      console.error("Error in advanced transcription:", error);
      return {
        text: "",
        confidence: 0,
        segments: [],
        medicalTermsDetected: [],
        startTime,
        error: error.message,
      };
    }
  }

  // Auto-save functionality
  startAutoSave(noteId, userId) {
    const autoSaveKey = `autosave_${noteId}_${userId}`;

    // Clear existing auto-save if any
    if (this.autoSaveTimers && this.autoSaveTimers[autoSaveKey]) {
      clearInterval(this.autoSaveTimers[autoSaveKey]);
    }

    // Initialize timers object if not exists
    if (!this.autoSaveTimers) {
      this.autoSaveTimers = {};
    }

    // Set up auto-save timer
    this.autoSaveTimers[autoSaveKey] = setInterval(async () => {
      try {
        // Get current note from cache
        const currentNote = await this.cacheService.getSOAPNote(noteId);
        if (currentNote && currentNote.status === "draft") {
          await this.updateSOAPNote(
            noteId,
            { soapData: currentNote.soapData },
            userId,
            true
          );
        }
      } catch (error) {
        console.error("Auto-save error:", error);
      }
    }, this.autoSaveInterval);
  }

  // Stop auto-save
  stopAutoSave(noteId, userId) {
    const autoSaveKey = `autosave_${noteId}_${userId}`;

    if (this.autoSaveTimers && this.autoSaveTimers[autoSaveKey]) {
      clearInterval(this.autoSaveTimers[autoSaveKey]);
      delete this.autoSaveTimers[autoSaveKey];
    }
  }

  // Check access permissions
  checkAccess(soapNote, userId) {
    // Owner has full access
    if (
      soapNote.userId.toString() === userId ||
      soapNote.userId._id?.toString() === userId
    ) {
      return true;
    }

    // Check shared access
    const sharedAccess = soapNote.collaboration.sharedWith.find(
      (share) =>
        share.userId.toString() === userId ||
        share.userId._id?.toString() === userId
    );

    return !!sharedAccess;
  }

  // Track changes between versions
  trackChanges(oldData, newData) {
    const changes = [];

    for (const [section, newContent] of Object.entries(newData)) {
      const oldContent = oldData[section];
      if (JSON.stringify(oldContent) !== JSON.stringify(newContent)) {
        changes.push({
          section,
          oldContent,
          newContent,
          timestamp: new Date(),
        });
      }
    }

    return changes;
  }

  // Check if changes are significant for AI re-analysis
  hasSignificantChanges(changes) {
    const significantSections = [
      "subjective",
      "objective",
      "assessment",
      "plan",
    ];
    return changes.some((change) =>
      significantSections.includes(change.section)
    );
  }

  // Generate signature hash
  generateSignatureHash(soapNote, userId) {
    const data = JSON.stringify({
      noteId: soapNote._id,
      userId,
      content: soapNote.soapData,
      timestamp: new Date().toISOString(),
    });
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  // Apply template to SOAP data
  applyTemplate(templateName, existingData) {
    const template = this.templates[templateName];
    if (!template) {
      return existingData;
    }

    return {
      subjective: existingData.subjective || template.subjective || {},
      objective: existingData.objective || template.objective || {},
      assessment: existingData.assessment || template.assessment || {},
      plan: existingData.plan || template.plan || {},
    };
  }

  // Validate premium access
  async validatePremiumAccess(userId) {
    // This would integrate with the billing system
    // For now, return true for nursing premium users
    return true;
  }

  // Transcribe audio (placeholder)
  async transcribeAudio(audioData) {
    // This would integrate with a voice-to-text service like Google Speech-to-Text or Azure Speech
    return "Placeholder transcription text";
  }

  // Apply advanced medical corrections with context awareness
  async applyAdvancedMedicalCorrections(transcription) {
    try {
      const corrections = [];
      let correctedText = transcription.text;

      // Medical terminology corrections database
      const medicalCorrections = {
        // Common misheard medical terms
        "high per tension": "hypertension",
        "die beaties": "diabetes",
        "my cardial": "myocardial",
        "new monia": "pneumonia",
        "brady cardia": "bradycardia",
        "tachy cardia": "tachycardia",
        "dis nea": "dyspnea",
        "ortho nea": "orthopnea",
        "a dema": "edema",
        "aus cultation": "auscultation",
        "pal pation": "palpation",
        "per cussion": "percussion",
        "in spection": "inspection",
        "sis tolic": "systolic",
        "die stolic": "diastolic",
        "mur mur": "murmur",
        "gal lop": "gallop",
        "friction rub": "friction rub",
      };

      // Apply corrections
      for (const [incorrect, correct] of Object.entries(medicalCorrections)) {
        const regex = new RegExp(incorrect, "gi");
        if (regex.test(correctedText)) {
          correctedText = correctedText.replace(regex, correct);
          corrections.push({
            original: incorrect,
            corrected: correct,
            confidence: 0.95,
          });
        }
      }

      // Dosage and measurement corrections
      const dosagePatterns = [
        { pattern: /(\d+)\s*milli\s*grams?/gi, replacement: "$1 mg" },
        { pattern: /(\d+)\s*micro\s*grams?/gi, replacement: "$1 mcg" },
        { pattern: /(\d+)\s*units?/gi, replacement: "$1 units" },
        { pattern: /(\d+)\s*over\s*(\d+)/gi, replacement: "$1/$2" },
        { pattern: /(\d+)\s*beats?\s*per\s*minute/gi, replacement: "$1 bpm" },
        { pattern: /(\d+)\s*breaths?\s*per\s*minute/gi, replacement: "$1 rpm" },
      ];

      dosagePatterns.forEach(({ pattern, replacement }) => {
        if (pattern.test(correctedText)) {
          const matches = correctedText.match(pattern);
          correctedText = correctedText.replace(pattern, replacement);
          if (matches) {
            corrections.push({
              original: matches[0],
              corrected: replacement,
              type: "dosage_standardization",
              confidence: 0.98,
            });
          }
        }
      });

      // Medical abbreviation expansion
      const abbreviations = {
        BP: "blood pressure",
        HR: "heart rate",
        RR: "respiratory rate",
        "O2 sat": "oxygen saturation",
        SOB: "shortness of breath",
        DOE: "dyspnea on exertion",
        PND: "paroxysmal nocturnal dyspnea",
        JVD: "jugular venous distension",
        PMI: "point of maximal impulse",
        S1: "first heart sound",
        S2: "second heart sound",
        S3: "third heart sound",
        S4: "fourth heart sound",
      };

      // Context-aware abbreviation expansion
      for (const [abbrev, expansion] of Object.entries(abbreviations)) {
        const regex = new RegExp(`\\b${abbrev}\\b`, "gi");
        if (regex.test(correctedText)) {
          // Only expand if context suggests it's medical
          const contextWords = [
            "patient",
            "assessment",
            "examination",
            "findings",
            "normal",
            "abnormal",
          ];
          const hasContext = contextWords.some((word) =>
            correctedText.toLowerCase().includes(word)
          );

          if (hasContext) {
            correctedText = correctedText.replace(regex, expansion);
            corrections.push({
              original: abbrev,
              corrected: expansion,
              type: "abbreviation_expansion",
              confidence: 0.9,
            });
          }
        }
      }

      return {
        text: correctedText,
        corrections,
        originalText: transcription.text,
        correctionCount: corrections.length,
      };
    } catch (error) {
      console.error("Error applying medical corrections:", error);
      return {
        text: transcription.text,
        corrections: [],
        originalText: transcription.text,
        correctionCount: 0,
        error: error.message,
      };
    }
  }

  // Extract medical entities and terminology
  async extractMedicalEntities(text) {
    try {
      const entities = {
        symptoms: [],
        diagnoses: [],
        medications: [],
        procedures: [],
        anatomicalSites: [],
        vitalSigns: [],
        labValues: [],
        assessmentFindings: [],
      };

      // Symptom patterns
      const symptomPatterns = [
        /chest pain/gi,
        /shortness of breath/gi,
        /dyspnea/gi,
        /palpitations/gi,
        /dizziness/gi,
        /fatigue/gi,
        /nausea/gi,
        /vomiting/gi,
        /headache/gi,
        /fever/gi,
        /chills/gi,
        /sweating/gi,
      ];

      symptomPatterns.forEach((pattern) => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            entities.symptoms.push({
              text: match,
              confidence: 0.85,
              position: text.indexOf(match),
            });
          });
        }
      });

      // Vital signs patterns
      const vitalSignsPatterns = [
        { pattern: /blood pressure.*?(\d+)\/(\d+)/gi, type: "blood_pressure" },
        { pattern: /heart rate.*?(\d+)/gi, type: "heart_rate" },
        { pattern: /respiratory rate.*?(\d+)/gi, type: "respiratory_rate" },
        { pattern: /temperature.*?(\d+\.?\d*)/gi, type: "temperature" },
        { pattern: /oxygen saturation.*?(\d+)%?/gi, type: "oxygen_saturation" },
      ];

      vitalSignsPatterns.forEach(({ pattern, type }) => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach((match) => {
          entities.vitalSigns.push({
            text: match[0],
            type,
            value: match[1],
            confidence: 0.92,
            position: match.index,
          });
        });
      });

      // Assessment findings patterns
      const assessmentPatterns = [
        /normal.*?heart sounds/gi,
        /murmur/gi,
        /gallop/gi,
        /friction rub/gi,
        /clear.*?lungs/gi,
        /crackles/gi,
        /wheezes/gi,
        /diminished.*?sounds/gi,
        /edema/gi,
        /cyanosis/gi,
        /pallor/gi,
        /diaphoresis/gi,
      ];

      assessmentPatterns.forEach((pattern) => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            entities.assessmentFindings.push({
              text: match,
              confidence: 0.88,
              position: text.indexOf(match),
            });
          });
        }
      });

      // Anatomical sites
      const anatomicalPatterns = [
        /chest/gi,
        /heart/gi,
        /lungs?/gi,
        /abdomen/gi,
        /extremities/gi,
        /neck/gi,
        /head/gi,
        /back/gi,
        /skin/gi,
      ];

      anatomicalPatterns.forEach((pattern) => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            entities.anatomicalSites.push({
              text: match,
              confidence: 0.8,
              position: text.indexOf(match),
            });
          });
        }
      });

      return entities;
    } catch (error) {
      console.error("Error extracting medical entities:", error);
      return {
        symptoms: [],
        diagnoses: [],
        medications: [],
        procedures: [],
        anatomicalSites: [],
        vitalSigns: [],
        labValues: [],
        assessmentFindings: [],
        error: error.message,
      };
    }
  }

  // Advanced voice input structuring with clinical context
  async structureVoiceInputAdvanced(text, existingData, medicalEntities) {
    try {
      // Use AI to intelligently structure free-form text into SOAP sections
      const structuringPrompt = `
        Analyze the following clinical text and structure it into SOAP note format.
        Consider the medical entities identified: ${JSON.stringify(
          medicalEntities
        )}
        
        Text to structure: "${text}"
        
        Existing SOAP data: ${JSON.stringify(existingData)}
        
        Please structure this into:
        - Subjective: Patient's reported symptoms, complaints, history
        - Objective: Observable findings, vital signs, examination results
        - Assessment: Clinical impressions, diagnoses, analysis
        - Plan: Treatment plans, interventions, follow-up
        
        Maintain clinical accuracy and professional terminology.
      `;

      const aiResult = await this.aiService.enhanceSOAPNote(
        { freeText: text, structuringPrompt },
        {
          structureOnly: true,
          medicalEntities,
          existingData,
        }
      );

      if (aiResult.success) {
        // Merge with existing data intelligently
        const structuredData = this.mergeSOAPData(
          existingData,
          aiResult.enhancement
        );

        // Validate clinical consistency
        const validationResult = await this.validateClinicalConsistency(
          structuredData
        );

        return {
          ...structuredData,
          validation: validationResult,
          confidence: aiResult.confidence || 0.85,
          processingMethod: "ai_structured",
        };
      }

      // Fallback to rule-based structuring
      return await this.ruleBasedStructuring(
        text,
        existingData,
        medicalEntities
      );
    } catch (error) {
      console.error("Error structuring voice input:", error);
      return {
        freeText: text,
        error: error.message,
        processingMethod: "fallback",
      };
    }
  }

  // Rule-based structuring fallback
  async ruleBasedStructuring(text, existingData, medicalEntities) {
    const structured = {
      subjective: { ...existingData.subjective },
      objective: { ...existingData.objective },
      assessment: { ...existingData.assessment },
      plan: { ...existingData.plan },
    };

    // Subjective indicators
    const subjectiveKeywords = [
      "patient reports",
      "patient states",
      "complains of",
      "describes",
      "feels",
      "experiences",
      "history of",
      "denies",
      "admits to",
    ];

    // Objective indicators
    const objectiveKeywords = [
      "vital signs",
      "examination reveals",
      "auscultation",
      "palpation",
      "inspection",
      "percussion",
      "observed",
      "measured",
      "findings",
    ];

    // Assessment indicators
    const assessmentKeywords = [
      "diagnosis",
      "impression",
      "likely",
      "consistent with",
      "suggests",
      "indicates",
      "differential",
      "rule out",
    ];

    // Plan indicators
    const planKeywords = [
      "treatment",
      "medication",
      "intervention",
      "follow up",
      "monitor",
      "educate",
      "discharge",
      "continue",
      "start",
      "stop",
    ];

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();

      if (
        subjectiveKeywords.some((keyword) => lowerSentence.includes(keyword))
      ) {
        if (!structured.subjective.patientStatements) {
          structured.subjective.patientStatements = [];
        }
        structured.subjective.patientStatements.push({
          statement: sentence.trim(),
          timestamp: new Date(),
          source: "voice_input",
        });
      } else if (
        objectiveKeywords.some((keyword) => lowerSentence.includes(keyword))
      ) {
        if (!structured.objective.observations) {
          structured.objective.observations = [];
        }
        structured.objective.observations.push({
          observation: sentence.trim(),
          timestamp: new Date(),
          source: "voice_input",
        });
      } else if (
        assessmentKeywords.some((keyword) => lowerSentence.includes(keyword))
      ) {
        if (!structured.assessment.clinicalImpression) {
          structured.assessment.clinicalImpression = "";
        }
        structured.assessment.clinicalImpression += sentence.trim() + " ";
      } else if (
        planKeywords.some((keyword) => lowerSentence.includes(keyword))
      ) {
        if (!structured.plan.interventions) {
          structured.plan.interventions = [];
        }
        structured.plan.interventions.push({
          intervention: sentence.trim(),
          timestamp: new Date(),
          source: "voice_input",
        });
      }
    });

    // Add vital signs from entities
    if (medicalEntities.vitalSigns && medicalEntities.vitalSigns.length > 0) {
      structured.objective.vitalSigns = structured.objective.vitalSigns || {};
      medicalEntities.vitalSigns.forEach((vital) => {
        structured.objective.vitalSigns[vital.type] = {
          value: vital.value,
          timestamp: new Date(),
          source: "voice_input",
        };
      });
    }

    return {
      ...structured,
      processingMethod: "rule_based",
      confidence: 0.75,
    };
  }

  // Generate clinical decision support suggestions
  async generateClinicalSuggestions(structuredData, patientId) {
    try {
      // Import clinical decision support service
      const ClinicalDecisionSupportService = await import(
        "./ClinicalDecisionSupportService.js"
      );

      const suggestions =
        await ClinicalDecisionSupportService.default.generateSuggestions({
          soapData: structuredData,
          patientId,
          context: "voice_input_processing",
        });

      return {
        clinicalAlerts: suggestions.alerts || [],
        drugInteractions: suggestions.drugInteractions || [],
        guidelineRecommendations: suggestions.guidelines || [],
        riskAssessments: suggestions.riskAssessments || [],
        qualityMetrics: suggestions.qualityMetrics || {},
        confidence: suggestions.confidence || 0.8,
      };
    } catch (error) {
      console.error("Error generating clinical suggestions:", error);
      return {
        clinicalAlerts: [],
        drugInteractions: [],
        guidelineRecommendations: [],
        riskAssessments: [],
        qualityMetrics: {},
        confidence: 0,
        error: error.message,
      };
    }
  }

  // Merge SOAP data intelligently
  mergeSOAPData(existingData, newData) {
    const merged = { ...existingData };

    Object.keys(newData).forEach((section) => {
      if (
        section === "subjective" ||
        section === "objective" ||
        section === "assessment" ||
        section === "plan"
      ) {
        merged[section] = { ...merged[section], ...newData[section] };

        // Handle arrays specially
        Object.keys(newData[section]).forEach((key) => {
          if (Array.isArray(newData[section][key])) {
            merged[section][key] = [
              ...(merged[section][key] || []),
              ...newData[section][key],
            ];
          }
        });
      }
    });

    return merged;
  }

  // Validate clinical consistency
  async validateClinicalConsistency(soapData) {
    const validation = {
      isConsistent: true,
      warnings: [],
      suggestions: [],
      score: 100,
    };

    try {
      // Check for contradictions between subjective and objective
      if (soapData.subjective && soapData.objective) {
        // Example: Patient denies chest pain but objective shows signs of cardiac distress
        const subjectiveText = JSON.stringify(
          soapData.subjective
        ).toLowerCase();
        const objectiveText = JSON.stringify(soapData.objective).toLowerCase();

        if (
          subjectiveText.includes("denies chest pain") &&
          objectiveText.includes("cardiac") &&
          objectiveText.includes("distress")
        ) {
          validation.warnings.push({
            type: "contradiction",
            message:
              "Patient denies chest pain but objective findings suggest cardiac distress",
            severity: "medium",
          });
          validation.score -= 10;
        }
      }

      // Check assessment-plan alignment
      if (soapData.assessment && soapData.plan) {
        const assessmentText = JSON.stringify(
          soapData.assessment
        ).toLowerCase();
        const planText = JSON.stringify(soapData.plan).toLowerCase();

        if (
          assessmentText.includes("hypertension") &&
          !planText.includes("blood pressure") &&
          !planText.includes("antihypertensive")
        ) {
          validation.suggestions.push({
            type: "plan_alignment",
            message:
              "Consider adding blood pressure management to plan for hypertension diagnosis",
            priority: "high",
          });
        }
      }

      // Check for missing critical information
      if (!soapData.objective || !soapData.objective.vitalSigns) {
        validation.warnings.push({
          type: "missing_data",
          message: "Vital signs not documented in objective section",
          severity: "high",
        });
        validation.score -= 15;
      }

      validation.isConsistent = validation.score >= 80;

      return validation;
    } catch (error) {
      console.error("Error validating clinical consistency:", error);
      return {
        isConsistent: false,
        warnings: [
          {
            type: "validation_error",
            message: error.message,
            severity: "high",
          },
        ],
        suggestions: [],
        score: 0,
      };
    }
  }

  // Initialize templates
  initializeTemplates() {
    return {
      general: {
        subjective: {
          chiefComplaint: "",
          historyOfPresentIllness: "",
          reviewOfSystems: {},
          painAssessment: {},
          patientStatements: [],
          familyHistory: "",
          socialHistory: "",
        },
        objective: {
          vitalSigns: {},
          physicalExam: {},
          diagnosticResults: [],
          observations: [],
          functionalStatus: "",
          cognitiveStatus: "",
        },
        assessment: {
          primaryDiagnosis: "",
          primaryDiagnosisCode: "",
          secondaryDiagnoses: [],
          differentialDiagnoses: [],
          problemList: [],
          riskFactors: [],
          clinicalImpression: "",
          prognosis: "",
        },
        plan: {
          interventions: [],
          medications: [],
          diagnosticOrders: [],
          monitoring: [],
          patientEducation: [],
          followUp: {},
          goals: [],
        },
      },
      "wound-care": {
        subjective: {
          chiefComplaint: "Wound care assessment and management",
          painAssessment: {
            location: "",
            quality: "",
            severity: null,
            timing: "",
            alleviatingFactors: "",
            aggravatingFactors: "",
          },
        },
        objective: {
          physicalExam: {
            integumentary:
              "Wound assessment: location, size, depth, drainage, healing stage",
          },
        },
        assessment: {
          primaryDiagnosis: "Wound care management",
        },
        plan: {
          interventions: [
            {
              intervention: "Wound cleansing and dressing change",
              frequency: "Daily",
              rationale: "Promote healing and prevent infection",
            },
          ],
        },
      },
      cardiac: {
        subjective: {
          chiefComplaint: "Cardiac assessment and monitoring",
          reviewOfSystems: {
            cardiovascular:
              "Chest pain, shortness of breath, palpitations, edema",
          },
        },
        objective: {
          vitalSigns: {
            bloodPressure: "",
            heartRate: null,
            respiratoryRate: null,
          },
          physicalExam: {
            cardiovascular:
              "Heart sounds, rhythm, murmurs, peripheral pulses, edema",
          },
        },
        assessment: {
          primaryDiagnosis: "Cardiac condition management",
        },
        plan: {
          monitoring: [
            { parameter: "Blood pressure", frequency: "Daily" },
            { parameter: "Heart rate and rhythm", frequency: "Continuous" },
          ],
        },
      },
    };
  }
  // Helper methods for quality assessment
  assessGrammarAndSpelling(soapData) {
    // Simplified grammar and spelling assessment
    const text = JSON.stringify(soapData);
    const commonErrors = [
      /\bteh\b/gi,
      /\brecieve\b/gi,
      /\boccur\b/gi,
      /\bseperate\b/gi,
      /\bdefinately\b/gi,
      /\bneccessary\b/gi,
      /\bexcercise\b/gi,
    ];

    let score = 100;
    commonErrors.forEach((error) => {
      const matches = text.match(error);
      if (matches) {
        score -= matches.length * 5;
      }
    });

    return Math.max(score, 0);
  }

  assessClarity(soapData) {
    let score = 100;
    const text = JSON.stringify(soapData);

    // Check for overly complex sentences
    const sentences = text.split(/[.!?]+/);
    const longSentences = sentences.filter((s) => s.split(" ").length > 30);
    score -= longSentences.length * 5;

    // Check for unclear pronouns
    const unclearPronouns = (text.match(/\b(it|this|that|they)\b/gi) || [])
      .length;
    score -= Math.min(unclearPronouns * 2, 20);

    return Math.max(score, 0);
  }

  assessProfessionalLanguage(soapData) {
    const text = JSON.stringify(soapData).toLowerCase();
    let score = 100;

    // Check for unprofessional language
    const unprofessionalTerms = [
      "really bad",
      "super",
      "awesome",
      "terrible",
      "awful",
      "crazy",
      "insane",
      "stupid",
      "dumb",
      "weird",
    ];

    unprofessionalTerms.forEach((term) => {
      if (text.includes(term)) {
        score -= 10;
      }
    });

    // Bonus for professional medical terminology
    const professionalTerms = [
      "assessment",
      "intervention",
      "monitoring",
      "evaluation",
      "diagnosis",
      "prognosis",
      "therapeutic",
      "clinical",
    ];

    const professionalCount = professionalTerms.filter((term) =>
      text.includes(term)
    ).length;
    score += Math.min(professionalCount * 2, 20);

    return Math.max(Math.min(score, 100), 0);
  }

  assessStructure(soapData) {
    let score = 0;

    // Check if all SOAP sections are present and properly structured
    const sections = ["subjective", "objective", "assessment", "plan"];
    const presentSections = sections.filter(
      (section) => soapData[section] && typeof soapData[section] === "object"
    );

    score += (presentSections.length / sections.length) * 50;

    // Check for logical flow within sections
    if (soapData.subjective && soapData.subjective.chiefComplaint) {
      score += 12.5;
    }
    if (soapData.objective && soapData.objective.vitalSigns) {
      score += 12.5;
    }
    if (soapData.assessment && soapData.assessment.primaryDiagnosis) {
      score += 12.5;
    }
    if (soapData.plan && soapData.plan.interventions) {
      score += 12.5;
    }

    return Math.round(score);
  }

  assessRegulatoryCompliance(soapData) {
    let score = 100;

    // Check for required documentation elements
    const requiredElements = [
      "date and time",
      "patient identification",
      "provider identification",
      "clinical findings",
      "plan of care",
    ];

    // Simplified compliance check
    const text = JSON.stringify(soapData).toLowerCase();

    if (!text.includes("patient") && !text.includes("client")) {
      score -= 20;
    }

    if (!soapData.objective || Object.keys(soapData.objective).length === 0) {
      score -= 25;
    }

    if (!soapData.plan || Object.keys(soapData.plan).length === 0) {
      score -= 25;
    }

    return Math.max(score, 0);
  }

  async assessClinicalConsistency(soapData) {
    const validation = await this.validateClinicalConsistency(soapData);
    return validation.score;
  }

  async generateQualityRecommendations(qualityMetrics, soapData) {
    const recommendations = [];

    if (qualityMetrics.completeness < 80) {
      recommendations.push({
        category: "completeness",
        priority: "high",
        message:
          "Consider adding more detailed information to all SOAP sections",
        specificActions: [
          "Add chief complaint if missing",
          "Include vital signs in objective section",
          "Specify primary diagnosis in assessment",
          "Detail intervention plans",
        ],
      });
    }

    if (qualityMetrics.clinicalAccuracy < 75) {
      recommendations.push({
        category: "clinical_accuracy",
        priority: "high",
        message: "Review clinical consistency and terminology usage",
        specificActions: [
          "Verify alignment between subjective and objective findings",
          "Use appropriate medical terminology",
          "Ensure assessment matches clinical findings",
        ],
      });
    }

    if (qualityMetrics.documentation < 70) {
      recommendations.push({
        category: "documentation",
        priority: "medium",
        message: "Improve documentation clarity and professionalism",
        specificActions: [
          "Use clear, concise language",
          "Avoid unprofessional terminology",
          "Structure information logically",
        ],
      });
    }

    return recommendations;
  }

  async compareToBenchmarks(qualityMetrics) {
    // Industry benchmarks (these would come from a database in production)
    const benchmarks = {
      completeness: 85,
      clinicalAccuracy: 88,
      documentation: 82,
      consistency: 80,
      compliance: 90,
      overall: 85,
    };

    const comparison = {};
    Object.keys(benchmarks).forEach((metric) => {
      const userScore = qualityMetrics[metric] || 0;
      const benchmark = benchmarks[metric];
      comparison[metric] = {
        userScore,
        benchmark,
        difference: userScore - benchmark,
        percentile:
          userScore >= benchmark
            ? Math.min(75 + ((userScore - benchmark) / benchmark) * 25, 95)
            : Math.max(25 - ((benchmark - userScore) / benchmark) * 25, 5),
      };
    });

    return comparison;
  }

  buildDateRangeFilter(dateRange) {
    const filter = {};
    if (dateRange.start || dateRange.end) {
      filter.createdAt = {};
      if (dateRange.start) {
        filter.createdAt.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        filter.createdAt.$lte = new Date(dateRange.end);
      }
    }
    return filter;
  }

  async calculateQualityTrends(userId, dateRange) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const pipeline = [
        {
          $match: {
            userId,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            avgQuality: { $avg: "$qualityMetrics.overall" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const dailyMetrics = await SOAPNote.aggregate(pipeline);

      // Calculate trend direction
      if (dailyMetrics.length >= 2) {
        const recent =
          dailyMetrics.slice(-7).reduce((sum, day) => sum + day.avgQuality, 0) /
          Math.min(7, dailyMetrics.length);
        const earlier =
          dailyMetrics
            .slice(0, -7)
            .reduce((sum, day) => sum + day.avgQuality, 0) /
          Math.max(1, dailyMetrics.length - 7);

        return {
          direction:
            recent > earlier
              ? "improving"
              : recent < earlier
              ? "declining"
              : "stable",
          change: Math.abs(recent - earlier).toFixed(1),
          recentAverage: recent.toFixed(1),
          dailyMetrics,
        };
      }

      return {
        direction: "insufficient_data",
        change: 0,
        recentAverage: dailyMetrics[0]?.avgQuality?.toFixed(1) || 0,
        dailyMetrics,
      };
    } catch (error) {
      console.error("Error calculating quality trends:", error);
      return {
        direction: "error",
        change: 0,
        recentAverage: 0,
        dailyMetrics: [],
      };
    }
  }

  async generateImprovementRecommendations(metrics) {
    const recommendations = [];

    if (metrics.avgQuality < 80) {
      recommendations.push({
        type: "quality_improvement",
        priority: "high",
        title: "Focus on Overall Quality",
        description:
          "Your average quality score is below the recommended threshold of 80%",
        actions: [
          "Review quality scoring criteria",
          "Use SOAP note templates consistently",
          "Seek feedback from supervisors",
          "Attend documentation training",
        ],
      });
    }

    if (metrics.avgCompleteness < 85) {
      recommendations.push({
        type: "completeness",
        priority: "medium",
        title: "Improve Documentation Completeness",
        description:
          "Consider adding more comprehensive information to all SOAP sections",
        actions: [
          "Use checklists for each SOAP section",
          "Review patient charts before documentation",
          "Include all relevant clinical findings",
        ],
      });
    }

    if (metrics.signedNotes / Math.max(metrics.totalNotes, 1) < 0.8) {
      recommendations.push({
        type: "completion_rate",
        priority: "high",
        title: "Increase Note Completion Rate",
        description: "Many notes remain in draft status",
        actions: [
          "Set reminders for note completion",
          "Review and sign notes within 24 hours",
          "Use auto-save features effectively",
        ],
      });
    }

    return recommendations;
  }
}

export default new SOAPService();
