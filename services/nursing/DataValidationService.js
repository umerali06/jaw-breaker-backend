import mongoose from "mongoose";

/**
 * Core data validation service for outcome measures
 * Handles user ID normalization, data validation, and error handling
 */
class DataValidationService {
  constructor() {
    this.validIndicatorTypes = [
      "readmissionRate",
      "infectionRate",
      "mobilityImprovement",
      "adlImprovement",
      "painManagement",
      "medicationCompliance",
      "patientSatisfaction",
      "caregiverSatisfaction",
      "functionalStatus",
      "cognitiveStatus",
    ];

    this.validCategories = ["clinical", "functional", "satisfaction"];
    this.validSources = ["oasis", "soap", "progress", "manual"];
  }

  /**
   * Validates and normalizes user ID to handle both ObjectId and string formats
   * @param {string|ObjectId} userId - User ID to validate
   * @returns {string} Normalized user ID string
   * @throws {ValidationError} If user ID is invalid
   */
  validateUserId(userId) {
    if (!userId) {
      throw new ValidationError("User ID is required", "MISSING_USER_ID");
    }

    // Handle ObjectId format
    if (mongoose.Types.ObjectId.isValid(userId)) {
      return userId.toString();
    }

    // Handle string format
    if (typeof userId === "string" && userId.trim().length > 0) {
      // Check if it's a valid ObjectId string
      if (mongoose.Types.ObjectId.isValid(userId.trim())) {
        return userId.trim();
      }

      // For non-ObjectId strings, validate basic format
      if (userId.trim().length >= 3 && userId.trim().length <= 50) {
        return userId.trim();
      }
    }

    throw new ValidationError("Invalid user ID format", "INVALID_USER_ID");
  }

  /**
   * Validates outcome measure data structure and values
   * @param {Object} measureData - Outcome measure data to validate
   * @returns {Object} Validated and normalized measure data
   * @throws {ValidationError} If data is invalid
   */
  validateOutcomeMeasure(measureData) {
    const errors = [];

    if (!measureData || typeof measureData !== "object") {
      throw new ValidationError(
        "Outcome measure data is required",
        "MISSING_MEASURE_DATA"
      );
    }

    // Validate required fields
    const requiredFields = ["patientId", "indicatorType", "category", "value"];
    for (const field of requiredFields) {
      if (!measureData[field]) {
        errors.push(`${field} is required`);
      }
    }

    // Validate indicator type
    if (
      measureData.indicatorType &&
      !this.validIndicatorTypes.includes(measureData.indicatorType)
    ) {
      errors.push(
        `Invalid indicator type. Must be one of: ${this.validIndicatorTypes.join(
          ", "
        )}`
      );
    }

    // Validate category
    if (
      measureData.category &&
      !this.validCategories.includes(measureData.category)
    ) {
      errors.push(
        `Invalid category. Must be one of: ${this.validCategories.join(", ")}`
      );
    }

    // Validate value range
    if (measureData.value !== undefined) {
      const value = parseFloat(measureData.value);
      if (isNaN(value) || value < 0 || value > 1) {
        errors.push("Value must be a number between 0 and 1");
      }
    }

    // Validate patient ID
    if (measureData.patientId) {
      try {
        this.validateUserId(measureData.patientId);
      } catch (error) {
        errors.push("Invalid patient ID format");
      }
    }

    // Validate optional fields
    if (measureData.qualityScores) {
      this.validateQualityScores(measureData.qualityScores, errors);
    }

    if (measureData.metadata) {
      this.validateMetadata(measureData.metadata, errors);
    }

    if (errors.length > 0) {
      throw new ValidationError(
        "Validation failed",
        "VALIDATION_FAILED",
        errors
      );
    }

    return this.normalizeOutcomeMeasure(measureData);
  }

  /**
   * Validates quality scores object
   * @param {Object} qualityScores - Quality scores to validate
   * @param {Array} errors - Array to collect validation errors
   */
  validateQualityScores(qualityScores, errors) {
    if (typeof qualityScores !== "object") {
      errors.push("Quality scores must be an object");
      return;
    }

    const scoreFields = ["target", "benchmark", "weighted"];
    for (const field of scoreFields) {
      if (qualityScores[field] !== undefined) {
        const score = parseFloat(qualityScores[field]);
        if (isNaN(score) || score < 0 || score > 1) {
          errors.push(
            `Quality score ${field} must be a number between 0 and 1`
          );
        }
      }
    }
  }

  /**
   * Validates metadata object
   * @param {Object} metadata - Metadata to validate
   * @param {Array} errors - Array to collect validation errors
   */
  validateMetadata(metadata, errors) {
    if (typeof metadata !== "object") {
      errors.push("Metadata must be an object");
      return;
    }

    // Validate source
    if (metadata.source && !this.validSources.includes(metadata.source)) {
      errors.push(
        `Invalid source. Must be one of: ${this.validSources.join(", ")}`
      );
    }

    // Validate confidence
    if (metadata.confidence !== undefined) {
      const confidence = parseFloat(metadata.confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        errors.push("Confidence must be a number between 0 and 1");
      }
    }

    // Validate data quality scores
    if (metadata.dataQuality) {
      const qualityFields = ["completeness", "accuracy", "timeliness"];
      for (const field of qualityFields) {
        if (metadata.dataQuality[field] !== undefined) {
          const score = parseFloat(metadata.dataQuality[field]);
          if (isNaN(score) || score < 0 || score > 1) {
            errors.push(
              `Data quality ${field} must be a number between 0 and 1`
            );
          }
        }
      }
    }
  }

  /**
   * Normalizes outcome measure data
   * @param {Object} measureData - Raw measure data
   * @returns {Object} Normalized measure data
   */
  normalizeOutcomeMeasure(measureData) {
    const normalized = {
      ...measureData,
      value: parseFloat(measureData.value),
      patientId: this.validateUserId(measureData.patientId),
    };

    // Normalize quality scores
    if (measureData.qualityScores) {
      normalized.qualityScores = {};
      const scoreFields = ["target", "benchmark", "weighted"];
      for (const field of scoreFields) {
        if (measureData.qualityScores[field] !== undefined) {
          normalized.qualityScores[field] = parseFloat(
            measureData.qualityScores[field]
          );
        }
      }
    }

    // Normalize metadata
    if (measureData.metadata) {
      normalized.metadata = { ...measureData.metadata };

      if (measureData.metadata.confidence !== undefined) {
        normalized.metadata.confidence = parseFloat(
          measureData.metadata.confidence
        );
      }

      if (measureData.metadata.dataQuality) {
        normalized.metadata.dataQuality = {};
        const qualityFields = ["completeness", "accuracy", "timeliness"];
        for (const field of qualityFields) {
          if (measureData.metadata.dataQuality[field] !== undefined) {
            normalized.metadata.dataQuality[field] = parseFloat(
              measureData.metadata.dataQuality[field]
            );
          }
        }
      }
    }

    // Add timestamps if not present
    const now = new Date();
    if (!normalized.createdAt) {
      normalized.createdAt = now;
    }
    normalized.updatedAt = now;

    return normalized;
  }

  /**
   * Validates query parameters for outcome measures
   * @param {Object} params - Query parameters to validate
   * @returns {Object} Sanitized query parameters
   * @throws {ValidationError} If parameters are invalid
   */
  validateQueryParameters(params) {
    const sanitized = {};
    const errors = [];

    if (!params || typeof params !== "object") {
      return sanitized;
    }

    // Validate user ID
    if (params.userId) {
      try {
        sanitized.userId = this.validateUserId(params.userId);
      } catch (error) {
        errors.push("Invalid user ID in query parameters");
      }
    }

    // Validate patient ID
    if (params.patientId) {
      try {
        sanitized.patientId = this.validateUserId(params.patientId);
      } catch (error) {
        errors.push("Invalid patient ID in query parameters");
      }
    }

    // Validate indicator type filter
    if (params.indicatorType) {
      if (Array.isArray(params.indicatorType)) {
        const validTypes = params.indicatorType.filter((type) =>
          this.validIndicatorTypes.includes(type)
        );
        if (validTypes.length > 0) {
          sanitized.indicatorType = { $in: validTypes };
        }
      } else if (this.validIndicatorTypes.includes(params.indicatorType)) {
        sanitized.indicatorType = params.indicatorType;
      }
    }

    // Validate category filter
    if (params.category) {
      if (Array.isArray(params.category)) {
        const validCategories = params.category.filter((cat) =>
          this.validCategories.includes(cat)
        );
        if (validCategories.length > 0) {
          sanitized.category = { $in: validCategories };
        }
      } else if (this.validCategories.includes(params.category)) {
        sanitized.category = params.category;
      }
    }

    // Validate date range
    if (params.startDate || params.endDate) {
      const dateFilter = {};

      if (params.startDate) {
        const startDate = new Date(params.startDate);
        if (!isNaN(startDate.getTime())) {
          dateFilter.$gte = startDate;
        } else {
          errors.push("Invalid start date format");
        }
      }

      if (params.endDate) {
        const endDate = new Date(params.endDate);
        if (!isNaN(endDate.getTime())) {
          dateFilter.$lte = endDate;
        } else {
          errors.push("Invalid end date format");
        }
      }

      if (Object.keys(dateFilter).length > 0) {
        sanitized.createdAt = dateFilter;
      }
    }

    // Validate pagination parameters
    if (params.limit) {
      const limit = parseInt(params.limit);
      if (!isNaN(limit) && limit > 0 && limit <= 1000) {
        sanitized.limit = limit;
      }
    }

    if (params.skip) {
      const skip = parseInt(params.skip);
      if (!isNaN(skip) && skip >= 0) {
        sanitized.skip = skip;
      }
    }

    // Validate sort parameters
    if (params.sort) {
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "value",
        "indicatorType",
      ];
      if (validSortFields.includes(params.sort)) {
        const sortOrder = params.sortOrder === "desc" ? -1 : 1;
        sanitized.sort = { [params.sort]: sortOrder };
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        "Query parameter validation failed",
        "INVALID_QUERY_PARAMS",
        errors
      );
    }

    return sanitized;
  }

  /**
   * Handles validation errors and formats them for API responses
   * @param {Error} error - Validation error to handle
   * @returns {Object} Formatted error response
   */
  handleValidationErrors(error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: {
          type: "VALIDATION_ERROR",
          code: error.code,
          message: error.message,
          details: error.details || [],
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Handle other types of errors
    return {
      success: false,
      error: {
        type: "UNKNOWN_ERROR",
        code: "UNKNOWN",
        message: "An unexpected error occurred during validation",
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Custom validation error class
 */
class ValidationError extends Error {
  constructor(message, code, details = []) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.details = details;
  }
}

export { DataValidationService, ValidationError };
