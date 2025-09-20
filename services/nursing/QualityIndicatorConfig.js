/**
 * QualityIndicatorConfig - Configuration for clinical, functional, and satisfaction metrics
 * Implements Requirements: 2.3, 3.1, 3.2 - Quality indicator calculations and benchmarking
 *
 * This module defines the configuration for all quality indicators used in outcome measures,
 * including weights, targets, benchmarks, and calculation methods.
 */

export const QualityIndicatorConfig = {
  // Clinical Quality Indicators
  clinical: {
    readmissionRate: {
      weight: 0.25,
      target: 0.15,
      benchmark: 0.18,
      unit: "percentage",
      description: "30-day readmission rate",
      dataSource: ["oasis", "progress"],
      calculationMethod: "rate",
      higherIsBetter: false,
      riskAdjustment: true,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.1,
        good: 0.15,
        acceptable: 0.18,
        needsImprovement: 0.25,
      },
    },
    infectionRate: {
      weight: 0.2,
      target: 0.05,
      benchmark: 0.08,
      unit: "percentage",
      description: "Healthcare-associated infection rate",
      dataSource: ["soap", "manual"],
      calculationMethod: "rate",
      higherIsBetter: false,
      riskAdjustment: true,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.03,
        good: 0.05,
        acceptable: 0.08,
        needsImprovement: 0.12,
      },
    },
    fallRate: {
      weight: 0.15,
      target: 0.02,
      benchmark: 0.04,
      unit: "percentage",
      description: "Patient fall rate per 1000 patient days",
      dataSource: ["soap", "progress", "manual"],
      calculationMethod: "rate",
      higherIsBetter: false,
      riskAdjustment: true,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.01,
        good: 0.02,
        acceptable: 0.04,
        needsImprovement: 0.08,
      },
    },
    pressureUlcerRate: {
      weight: 0.2,
      target: 0.03,
      benchmark: 0.05,
      unit: "percentage",
      description: "Hospital-acquired pressure ulcer rate",
      dataSource: ["oasis", "soap", "manual"],
      calculationMethod: "rate",
      higherIsBetter: false,
      riskAdjustment: true,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.02,
        good: 0.03,
        acceptable: 0.05,
        needsImprovement: 0.08,
      },
    },
    medicationErrors: {
      weight: 0.2,
      target: 0.01,
      benchmark: 0.03,
      unit: "percentage",
      description: "Medication error rate per 1000 doses",
      dataSource: ["soap", "manual"],
      calculationMethod: "rate",
      higherIsBetter: false,
      riskAdjustment: false,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.005,
        good: 0.01,
        acceptable: 0.03,
        needsImprovement: 0.05,
      },
    },
  },

  // Functional Quality Indicators
  functional: {
    mobilityImprovement: {
      weight: 0.3,
      target: 0.8,
      benchmark: 0.7,
      unit: "score",
      description: "Mobility improvement score (0-1 scale)",
      dataSource: ["oasis", "progress"],
      calculationMethod: "improvement",
      higherIsBetter: true,
      riskAdjustment: true,
      reportingFrequency: "quarterly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.85,
        good: 0.8,
        acceptable: 0.7,
        needsImprovement: 0.6,
      },
    },
    adlImprovement: {
      weight: 0.25,
      target: 0.75,
      benchmark: 0.65,
      unit: "score",
      description: "Activities of Daily Living improvement score",
      dataSource: ["oasis", "progress"],
      calculationMethod: "improvement",
      higherIsBetter: true,
      riskAdjustment: true,
      reportingFrequency: "quarterly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.8,
        good: 0.75,
        acceptable: 0.65,
        needsImprovement: 0.55,
      },
    },
    painReduction: {
      weight: 0.25,
      target: 0.7,
      benchmark: 0.6,
      unit: "score",
      description: "Pain reduction effectiveness score",
      dataSource: ["soap", "progress", "manual"],
      calculationMethod: "improvement",
      higherIsBetter: true,
      riskAdjustment: false,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.8,
        good: 0.7,
        acceptable: 0.6,
        needsImprovement: 0.5,
      },
    },
    cognitiveImprovement: {
      weight: 0.2,
      target: 0.6,
      benchmark: 0.5,
      unit: "score",
      description: "Cognitive function improvement score",
      dataSource: ["oasis", "progress"],
      calculationMethod: "improvement",
      higherIsBetter: true,
      riskAdjustment: true,
      reportingFrequency: "quarterly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.7,
        good: 0.6,
        acceptable: 0.5,
        needsImprovement: 0.4,
      },
    },
  },

  // Satisfaction Quality Indicators
  satisfaction: {
    patientSatisfaction: {
      weight: 0.4,
      target: 0.9,
      benchmark: 0.85,
      unit: "score",
      description: "Patient satisfaction score (0-1 scale)",
      dataSource: ["manual", "survey"],
      calculationMethod: "average",
      higherIsBetter: true,
      riskAdjustment: false,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.95,
        good: 0.9,
        acceptable: 0.85,
        needsImprovement: 0.8,
      },
    },
    familySatisfaction: {
      weight: 0.3,
      target: 0.88,
      benchmark: 0.8,
      unit: "score",
      description: "Family satisfaction with care coordination",
      dataSource: ["manual", "survey"],
      calculationMethod: "average",
      higherIsBetter: true,
      riskAdjustment: false,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.92,
        good: 0.88,
        acceptable: 0.8,
        needsImprovement: 0.75,
      },
    },
    careCoordination: {
      weight: 0.3,
      target: 0.85,
      benchmark: 0.78,
      unit: "score",
      description: "Care coordination effectiveness score",
      dataSource: ["soap", "manual"],
      calculationMethod: "average",
      higherIsBetter: true,
      riskAdjustment: false,
      reportingFrequency: "monthly",
      validRange: { min: 0, max: 1 },
      qualityThresholds: {
        excellent: 0.9,
        good: 0.85,
        acceptable: 0.78,
        needsImprovement: 0.7,
      },
    },
  },
};

/**
 * Get quality indicator configuration by type
 * @param {string} indicatorType - Type of indicator
 * @returns {Object|null} Configuration object or null if not found
 */
export function getIndicatorConfig(indicatorType) {
  for (const category of Object.values(QualityIndicatorConfig)) {
    if (category[indicatorType]) {
      return {
        ...category[indicatorType],
        category: Object.keys(QualityIndicatorConfig).find(
          (key) => QualityIndicatorConfig[key][indicatorType]
        ),
      };
    }
  }
  return null;
}

/**
 * Get all indicators for a specific category
 * @param {string} category - Category name (clinical, functional, satisfaction)
 * @returns {Object} All indicators in the category
 */
export function getIndicatorsByCategory(category) {
  return QualityIndicatorConfig[category] || {};
}

/**
 * Get weighted score calculation for a category
 * @param {string} category - Category name
 * @returns {number} Total weight (should equal 1.0)
 */
export function getCategoryTotalWeight(category) {
  const indicators = getIndicatorsByCategory(category);
  return Object.values(indicators).reduce(
    (total, indicator) => total + indicator.weight,
    0
  );
}

/**
 * Validate indicator configuration integrity
 * @returns {Object} Validation results
 */
export function validateConfiguration() {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check that weights sum to approximately 1.0 for each category
  Object.keys(QualityIndicatorConfig).forEach((category) => {
    const totalWeight = getCategoryTotalWeight(category);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      results.errors.push(
        `Category ${category} weights sum to ${totalWeight}, should be 1.0`
      );
      results.valid = false;
    }
  });

  // Check for required fields
  Object.entries(QualityIndicatorConfig).forEach(([category, indicators]) => {
    Object.entries(indicators).forEach(([indicatorType, config]) => {
      const requiredFields = [
        "weight",
        "target",
        "benchmark",
        "unit",
        "description",
      ];
      requiredFields.forEach((field) => {
        if (config[field] === undefined) {
          results.errors.push(
            `${category}.${indicatorType} missing required field: ${field}`
          );
          results.valid = false;
        }
      });

      // Check valid ranges
      if (config.validRange) {
        if (
          config.target < config.validRange.min ||
          config.target > config.validRange.max
        ) {
          results.warnings.push(
            `${category}.${indicatorType} target outside valid range`
          );
        }
        if (
          config.benchmark < config.validRange.min ||
          config.benchmark > config.validRange.max
        ) {
          results.warnings.push(
            `${category}.${indicatorType} benchmark outside valid range`
          );
        }
      }
    });
  });

  return results;
}

export default QualityIndicatorConfig;
