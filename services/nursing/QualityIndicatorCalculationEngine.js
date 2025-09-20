/**
 * QualityIndicatorCalculationEngine - Core calculation engine for quality scores and benchmarks
 * Implements Requirements: 2.3, 3.1, 3.2 - Quality indicator calculations and trend analysis
 *
 * This service provides comprehensive calculation methods for quality scores,
 * benchmark comparisons, and trend analysis algorithms.
 */

import {
  QualityIndicatorConfig,
  getIndicatorConfig,
} from "./QualityIndicatorConfig.js";

export class QualityIndicatorCalculationEngine {
  constructor() {
    this.config = QualityIndicatorConfig;
  }

  /**
   * Calculate quality scores for a given indicator
   * @param {Object} params - Calculation parameters
   * @param {string} params.type - Indicator type
   * @param {number} params.value - Raw indicator value
   * @param {Object} params.context - Additional context (patient risk factors, etc.)
   * @returns {Promise<Object>} Quality scores object
   */
  async calculateQualityScores({ type, value, context = {} }) {
    try {
      const config = getIndicatorConfig(type);
      if (!config) {
        throw new Error(`Unknown indicator type: ${type}`);
      }

      // Validate value is within acceptable range
      if (config.validRange) {
        if (value < config.validRange.min || value > config.validRange.max) {
          throw new Error(`Value ${value} outside valid range for ${type}`);
        }
      }

      // Apply risk adjustment if configured
      let adjustedValue = value;
      if (config.riskAdjustment && context.riskFactors) {
        adjustedValue = await this.applyRiskAdjustment(
          value,
          context.riskFactors,
          config
        );
      }

      // Calculate target score (how close to target)
      const targetScore = this.calculateTargetScore(adjustedValue, config);

      // Calculate benchmark score (how close to benchmark)
      const benchmarkScore = this.calculateBenchmarkScore(
        adjustedValue,
        config
      );

      // Calculate weighted score based on category weight
      const weightedScore = this.calculateWeightedScore(adjustedValue, config);

      // Determine quality level
      const qualityLevel = this.determineQualityLevel(adjustedValue, config);

      // Calculate percentile ranking
      const percentileRank = await this.calculatePercentileRank(
        adjustedValue,
        type,
        context
      );

      return {
        raw: value,
        adjusted: adjustedValue,
        target: targetScore,
        benchmark: benchmarkScore,
        weighted: weightedScore,
        qualityLevel,
        percentileRank,
        metadata: {
          calculatedAt: new Date(),
          riskAdjusted: !!(config.riskAdjustment && context.riskFactors),
          confidence: context.confidence || 0.95,
        },
      };
    } catch (error) {
      console.error("Error calculating quality scores:", error);
      throw new Error(`Quality score calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate target score (0-1 scale where 1 is meeting target)
   * @param {number} value - Indicator value
   * @param {Object} config - Indicator configuration
   * @returns {number} Target score
   */
  calculateTargetScore(value, config) {
    const { target, higherIsBetter } = config;

    if (higherIsBetter) {
      // For indicators where higher is better (e.g., satisfaction)
      return Math.min(value / target, 1.0);
    } else {
      // For indicators where lower is better (e.g., infection rate)
      if (value <= target) {
        return 1.0; // Perfect score if at or below target
      }
      // Diminishing score as value increases above target
      return Math.max(0, target / value);
    }
  }

  /**
   * Calculate benchmark score (0-1 scale where 1 is meeting benchmark)
   * @param {number} value - Indicator value
   * @param {Object} config - Indicator configuration
   * @returns {number} Benchmark score
   */
  calculateBenchmarkScore(value, config) {
    const { benchmark, higherIsBetter } = config;

    if (higherIsBetter) {
      return Math.min(value / benchmark, 1.0);
    } else {
      if (value <= benchmark) {
        return 1.0;
      }
      return Math.max(0, benchmark / value);
    }
  }

  /**
   * Calculate weighted score based on category weight
   * @param {number} value - Indicator value
   * @param {Object} config - Indicator configuration
   * @returns {number} Weighted score
   */
  calculateWeightedScore(value, config) {
    const targetScore = this.calculateTargetScore(value, config);
    return targetScore * config.weight;
  }

  /**
   * Determine quality level based on thresholds
   * @param {number} value - Indicator value
   * @param {Object} config - Indicator configuration
   * @returns {string} Quality level
   */
  determineQualityLevel(value, config) {
    const { qualityThresholds, higherIsBetter } = config;

    if (!qualityThresholds) {
      return "unknown";
    }

    if (higherIsBetter) {
      if (value >= qualityThresholds.excellent) return "excellent";
      if (value >= qualityThresholds.good) return "good";
      if (value >= qualityThresholds.acceptable) return "acceptable";
      return "needsImprovement";
    } else {
      if (value <= qualityThresholds.excellent) return "excellent";
      if (value <= qualityThresholds.good) return "good";
      if (value <= qualityThresholds.acceptable) return "acceptable";
      return "needsImprovement";
    }
  }

  /**
   * Apply risk adjustment to raw values
   * @param {number} value - Raw value
   * @param {Object} riskFactors - Patient risk factors
   * @param {Object} config - Indicator configuration
   * @returns {Promise<number>} Risk-adjusted value
   */
  async applyRiskAdjustment(value, riskFactors, config) {
    // Risk adjustment factors based on common healthcare risk models
    const riskAdjustments = {
      age: {
        under65: 1.0,
        "65-74": 1.1,
        "75-84": 1.2,
        over85: 1.3,
      },
      comorbidities: {
        none: 1.0,
        mild: 1.1,
        moderate: 1.25,
        severe: 1.5,
      },
      functionalStatus: {
        independent: 1.0,
        partiallyDependent: 1.15,
        dependent: 1.3,
      },
    };

    let adjustmentFactor = 1.0;

    // Apply age adjustment
    if (riskFactors.ageGroup && riskAdjustments.age[riskFactors.ageGroup]) {
      adjustmentFactor *= riskAdjustments.age[riskFactors.ageGroup];
    }

    // Apply comorbidity adjustment
    if (
      riskFactors.comorbidityLevel &&
      riskAdjustments.comorbidities[riskFactors.comorbidityLevel]
    ) {
      adjustmentFactor *=
        riskAdjustments.comorbidities[riskFactors.comorbidityLevel];
    }

    // Apply functional status adjustment
    if (
      riskFactors.functionalStatus &&
      riskAdjustments.functionalStatus[riskFactors.functionalStatus]
    ) {
      adjustmentFactor *=
        riskAdjustments.functionalStatus[riskFactors.functionalStatus];
    }

    // For indicators where lower is better, divide by adjustment factor
    // For indicators where higher is better, multiply by adjustment factor
    if (config.higherIsBetter) {
      return value * adjustmentFactor;
    } else {
      return value / adjustmentFactor;
    }
  }

  /**
   * Calculate percentile rank for an indicator value
   * @param {number} value - Indicator value
   * @param {string} type - Indicator type
   * @param {Object} context - Additional context
   * @returns {Promise<number>} Percentile rank (0-100)
   */
  async calculatePercentileRank(value, type, context = {}) {
    // This would typically query historical data to determine percentile
    // For now, we'll use a simplified calculation based on target and benchmark
    const config = getIndicatorConfig(type);
    if (!config) return 50; // Default to 50th percentile

    const { target, benchmark, higherIsBetter } = config;

    if (higherIsBetter) {
      if (value >= target) return 90;
      if (value >= benchmark) return 70;
      if (value >= benchmark * 0.8) return 50;
      if (value >= benchmark * 0.6) return 30;
      return 10;
    } else {
      if (value <= target) return 90;
      if (value <= benchmark) return 70;
      if (value <= benchmark * 1.2) return 50;
      if (value <= benchmark * 1.5) return 30;
      return 10;
    }
  }

  /**
   * Compare indicator value to benchmark standards
   * @param {Object} params - Comparison parameters
   * @param {string} params.type - Indicator type
   * @param {number} params.value - Indicator value
   * @param {Object} params.context - Additional context
   * @returns {Promise<Object>} Benchmark comparison results
   */
  async compareToBenchmark({ type, value, context = {} }) {
    try {
      const config = getIndicatorConfig(type);
      if (!config) {
        throw new Error(`Unknown indicator type: ${type}`);
      }

      const { target, benchmark, higherIsBetter } = config;

      // Calculate differences
      const vsTarget = {
        difference: higherIsBetter ? value - target : target - value,
        percentage: higherIsBetter
          ? ((value - target) / target) * 100
          : ((target - value) / target) * 100,
        status: this.getComparisonStatus(value, target, higherIsBetter),
      };

      const vsBenchmark = {
        difference: higherIsBetter ? value - benchmark : benchmark - value,
        percentage: higherIsBetter
          ? ((value - benchmark) / benchmark) * 100
          : ((benchmark - value) / benchmark) * 100,
        status: this.getComparisonStatus(value, benchmark, higherIsBetter),
      };

      // Calculate improvement needed
      const improvementNeeded = this.calculateImprovementNeeded(
        value,
        target,
        higherIsBetter
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        type,
        value,
        config
      );

      return {
        vsTarget,
        vsBenchmark,
        improvementNeeded,
        recommendations,
        qualityLevel: this.determineQualityLevel(value, config),
        metadata: {
          comparedAt: new Date(),
          confidence: context.confidence || 0.95,
        },
      };
    } catch (error) {
      console.error("Error comparing to benchmark:", error);
      throw new Error(`Benchmark comparison failed: ${error.message}`);
    }
  }

  /**
   * Get comparison status (above/below/meeting)
   * @param {number} value - Current value
   * @param {number} reference - Reference value (target or benchmark)
   * @param {boolean} higherIsBetter - Whether higher values are better
   * @returns {string} Status string
   */
  getComparisonStatus(value, reference, higherIsBetter) {
    const tolerance = 0.005; // 0.5% tolerance for "meeting" status

    if (Math.abs(value - reference) <= tolerance) {
      return "meeting";
    }

    if (higherIsBetter) {
      return value > reference ? "above" : "below";
    } else {
      return value < reference ? "above" : "below";
    }
  }

  /**
   * Calculate improvement needed to reach target
   * @param {number} current - Current value
   * @param {number} target - Target value
   * @param {boolean} higherIsBetter - Whether higher values are better
   * @returns {Object} Improvement calculation
   */
  calculateImprovementNeeded(current, target, higherIsBetter) {
    const difference = higherIsBetter ? target - current : current - target;
    const percentage = Math.abs((difference / current) * 100);

    return {
      needed: difference > 0,
      absolute: Math.abs(difference),
      percentage: percentage,
      direction: higherIsBetter
        ? current < target
          ? "increase"
          : "maintain"
        : current > target
        ? "decrease"
        : "maintain",
    };
  }

  /**
   * Generate recommendations based on indicator performance
   * @param {string} type - Indicator type
   * @param {number} value - Current value
   * @param {Object} config - Indicator configuration
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateRecommendations(type, value, config) {
    const recommendations = [];
    const qualityLevel = this.determineQualityLevel(value, config);

    // General recommendations based on quality level
    switch (qualityLevel) {
      case "excellent":
        recommendations.push(
          "Maintain current practices and share best practices with team"
        );
        recommendations.push(
          "Consider mentoring other units to improve overall performance"
        );
        break;

      case "good":
        recommendations.push(
          "Continue current practices with minor optimizations"
        );
        recommendations.push(
          "Identify specific areas for incremental improvement"
        );
        break;

      case "acceptable":
        recommendations.push(
          "Review current processes for improvement opportunities"
        );
        recommendations.push("Consider additional training or resources");
        break;

      case "needsImprovement":
        recommendations.push("Immediate review of current practices required");
        recommendations.push("Implement quality improvement initiatives");
        recommendations.push("Consider additional oversight and support");
        break;
    }

    // Indicator-specific recommendations
    const specificRecommendations = this.getIndicatorSpecificRecommendations(
      type,
      qualityLevel
    );
    recommendations.push(...specificRecommendations);

    return recommendations;
  }

  /**
   * Get indicator-specific recommendations
   * @param {string} type - Indicator type
   * @param {string} qualityLevel - Current quality level
   * @returns {Array} Specific recommendations
   */
  getIndicatorSpecificRecommendations(type, qualityLevel) {
    const recommendations = {
      readmissionRate: {
        needsImprovement: [
          "Review discharge planning processes",
          "Enhance patient education before discharge",
          "Improve care coordination with primary care providers",
        ],
        acceptable: [
          "Strengthen follow-up protocols",
          "Review medication reconciliation processes",
        ],
      },
      infectionRate: {
        needsImprovement: [
          "Review hand hygiene compliance",
          "Audit infection control procedures",
          "Enhance environmental cleaning protocols",
        ],
        acceptable: [
          "Continue monitoring infection control practices",
          "Review antibiotic stewardship protocols",
        ],
      },
      patientSatisfaction: {
        needsImprovement: [
          "Conduct patient feedback sessions",
          "Review communication training for staff",
          "Assess pain management protocols",
        ],
        acceptable: [
          "Continue patient-centered care initiatives",
          "Monitor response times to patient requests",
        ],
      },
    };

    return recommendations[type]?.[qualityLevel] || [];
  }

  /**
   * Calculate category-level composite scores
   * @param {Array} indicators - Array of indicator results
   * @param {string} category - Category name (clinical, functional, satisfaction)
   * @returns {Object} Composite score results
   */
  calculateCategoryCompositeScore(indicators, category) {
    const categoryConfig = this.config[category];
    if (!categoryConfig) {
      throw new Error(`Unknown category: ${category}`);
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const indicatorScores = {};

    indicators.forEach((indicator) => {
      const config = categoryConfig[indicator.type];
      if (config) {
        const weightedScore = indicator.qualityScores.weighted;
        weightedSum += weightedScore;
        totalWeight += config.weight;
        indicatorScores[indicator.type] = {
          score: indicator.qualityScores.target,
          weight: config.weight,
          contribution: weightedScore,
        };
      }
    });

    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      category,
      compositeScore,
      totalWeight,
      indicatorCount: indicators.length,
      indicatorScores,
      qualityLevel: this.getCompositeQualityLevel(compositeScore),
      metadata: {
        calculatedAt: new Date(),
      },
    };
  }

  /**
   * Determine quality level for composite scores
   * @param {number} score - Composite score (0-1)
   * @returns {string} Quality level
   */
  getCompositeQualityLevel(score) {
    if (score >= 0.9) return "excellent";
    if (score >= 0.8) return "good";
    if (score >= 0.7) return "acceptable";
    return "needsImprovement";
  }
}

export default QualityIndicatorCalculationEngine;
