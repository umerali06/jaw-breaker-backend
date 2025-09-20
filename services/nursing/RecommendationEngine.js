/**
 * Recommendation Engine for Outcome Measures
 * Generates actionable recommendations based on data patterns and AI analysis
 */

class RecommendationEngine {
  constructor() {
    this.recommendationTypes = {
      INTERVENTION: "intervention",
      MONITORING: "monitoring",
      ASSESSMENT: "assessment",
      CARE_PLAN: "care_plan",
      QUALITY_IMPROVEMENT: "quality_improvement",
      RISK_MITIGATION: "risk_mitigation",
    };

    this.priorityLevels = {
      CRITICAL: { level: 1, urgency: "immediate", color: "red" },
      HIGH: { level: 2, urgency: "within_24h", color: "orange" },
      MEDIUM: { level: 3, urgency: "within_week", color: "yellow" },
      LOW: { level: 4, urgency: "routine", color: "green" },
    };

    this.evidenceStrength = {
      STRONG: { confidence: 0.9, description: "Strong evidence base" },
      MODERATE: { confidence: 0.7, description: "Moderate evidence base" },
      WEAK: { confidence: 0.5, description: "Limited evidence base" },
      EXPERT: { confidence: 0.6, description: "Expert consensus" },
    };
  }

  /**
   * Generate comprehensive recommendations based on data patterns
   * @param {string} userId - User identifier
   * @param {Object} context - Context for recommendations
   * @returns {Object} Generated recommendations
   */
  async generateRecommendations(userId, context = {}) {
    try {
      const {
        patternAnalysis,
        predictiveModel,
        riskAssessment,
        qualityIndicators,
        patientData = [],
        preferences = {},
      } = context;

      if (!patternAnalysis && !predictiveModel && !riskAssessment) {
        return {
          success: false,
          message: "Insufficient data for generating recommendations",
          recommendations: [],
        };
      }

      const recommendations = [];

      // Generate pattern-based recommendations
      if (patternAnalysis) {
        const patternRecs = await this.generatePatternRecommendations(
          patternAnalysis,
          context
        );
        recommendations.push(...patternRecs);
      }

      // Generate predictive recommendations
      if (predictiveModel) {
        const predictiveRecs = await this.generatePredictiveRecommendations(
          predictiveModel,
          context
        );
        recommendations.push(...predictiveRecs);
      }

      // Generate risk-based recommendations
      if (riskAssessment) {
        const riskRecs = await this.generateRiskRecommendations(
          riskAssessment,
          context
        );
        recommendations.push(...riskRecs);
      }

      // Generate quality improvement recommendations
      if (qualityIndicators) {
        const qualityRecs = await this.generateQualityRecommendations(
          qualityIndicators,
          context
        );
        recommendations.push(...qualityRecs);
      }

      // Prioritize and deduplicate recommendations
      const prioritizedRecs = this.prioritizeRecommendations(
        recommendations,
        preferences
      );
      const finalRecs = this.deduplicateRecommendations(prioritizedRecs);

      return {
        success: true,
        userId,
        generatedAt: new Date(),
        totalRecommendations: finalRecs.length,
        recommendations: finalRecs,
        summary: this.generateRecommendationSummary(finalRecs),
        actionPlan: this.generateActionPlan(finalRecs),
      };
    } catch (error) {
      console.error("Recommendation generation error:", error);
      return {
        success: false,
        error: error.message,
        recommendations: [],
      };
    }
  }

  /**
   * Generate recommendations based on pattern analysis
   */
  async generatePatternRecommendations(patternAnalysis, context) {
    const recommendations = [];

    // Trend-based recommendations
    if (patternAnalysis.patterns?.trends) {
      for (const [indicator, trend] of Object.entries(
        patternAnalysis.patterns.trends
      )) {
        if (trend.direction === "declining" && trend.confidence > 0.6) {
          recommendations.push({
            id: `trend_${indicator}_${Date.now()}`,
            type: this.recommendationTypes.INTERVENTION,
            priority: this.priorityLevels.HIGH,
            title: `Address Declining ${this.formatIndicatorName(indicator)}`,
            description: `${indicator} shows a declining trend with ${(
              trend.confidence * 100
            ).toFixed(1)}% confidence`,
            actions: [
              `Review current interventions for ${indicator}`,
              "Analyze contributing factors to decline",
              "Implement targeted improvement strategies",
              "Increase monitoring frequency",
            ],
            evidence: this.evidenceStrength.MODERATE,
            expectedOutcome: "Stabilize or improve indicator performance",
            timeframe: "2-4 weeks",
            resources: this.getResourcesForIndicator(indicator),
            metadata: {
              indicator,
              trendDirection: trend.direction,
              confidence: trend.confidence,
              dataPoints: trend.dataPoints,
            },
          });
        }

        if (trend.direction === "improving" && trend.confidence > 0.7) {
          recommendations.push({
            id: `trend_positive_${indicator}_${Date.now()}`,
            type: this.recommendationTypes.QUALITY_IMPROVEMENT,
            priority: this.priorityLevels.LOW,
            title: `Sustain Improvement in ${this.formatIndicatorName(
              indicator
            )}`,
            description: `${indicator} shows positive improvement trend`,
            actions: [
              "Document successful interventions",
              "Share best practices with team",
              "Monitor for sustainability",
              "Consider expanding successful strategies",
            ],
            evidence: this.evidenceStrength.MODERATE,
            expectedOutcome: "Maintain current improvement trajectory",
            timeframe: "Ongoing",
            resources: [
              "Best practice documentation",
              "Team communication tools",
            ],
            metadata: {
              indicator,
              trendDirection: trend.direction,
              confidence: trend.confidence,
            },
          });
        }
      }
    }

    // Anomaly-based recommendations
    if (patternAnalysis.patterns?.anomalies?.count > 0) {
      const highSeverityAnomalies =
        patternAnalysis.patterns.anomalies.anomalies.filter(
          (a) => a.severity === "high"
        );

      if (highSeverityAnomalies.length > 0) {
        recommendations.push({
          id: `anomaly_investigation_${Date.now()}`,
          type: this.recommendationTypes.ASSESSMENT,
          priority: this.priorityLevels.CRITICAL,
          title: "Investigate High-Severity Data Anomalies",
          description: `${highSeverityAnomalies.length} high-severity anomalies detected`,
          actions: [
            "Review data collection processes",
            "Validate anomalous data points",
            "Investigate potential causes",
            "Implement corrective measures if needed",
          ],
          evidence: this.evidenceStrength.STRONG,
          expectedOutcome: "Improved data quality and reliability",
          timeframe: "Within 48 hours",
          resources: ["Data validation tools", "Quality assurance protocols"],
          metadata: {
            anomalyCount: highSeverityAnomalies.length,
            affectedIndicators: [
              ...new Set(highSeverityAnomalies.map((a) => a.indicator)),
            ],
          },
        });
      }
    }

    // Correlation-based recommendations
    if (patternAnalysis.patterns?.correlations) {
      for (const [correlationKey, correlation] of Object.entries(
        patternAnalysis.patterns.correlations
      )) {
        if (
          correlation.significance === "strong" &&
          Math.abs(correlation.coefficient) > 0.7
        ) {
          const [indicator1, indicator2] = correlationKey.split("_");

          recommendations.push({
            id: `correlation_${correlationKey}_${Date.now()}`,
            type: this.recommendationTypes.CARE_PLAN,
            priority: this.priorityLevels.MEDIUM,
            title: `Leverage Strong Correlation Between Indicators`,
            description: `Strong correlation (${correlation.coefficient.toFixed(
              2
            )}) found between ${indicator1} and ${indicator2}`,
            actions: [
              `Focus interventions on ${indicator1} to potentially improve ${indicator2}`,
              "Monitor both indicators together",
              "Develop integrated care strategies",
              "Track correlation strength over time",
            ],
            evidence: this.evidenceStrength.MODERATE,
            expectedOutcome:
              "Improved efficiency in quality improvement efforts",
            timeframe: "4-6 weeks",
            resources: [
              "Integrated care protocols",
              "Correlation monitoring tools",
            ],
            metadata: {
              correlatedIndicators: [indicator1, indicator2],
              correlationStrength: correlation.coefficient,
              dataPoints: correlation.dataPoints,
            },
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate recommendations based on predictive models
   */
  async generatePredictiveRecommendations(predictiveModel, context) {
    const recommendations = [];

    if (!predictiveModel.success || !predictiveModel.predictions) {
      return recommendations;
    }

    const predictions = predictiveModel.predictions;
    const lastPrediction = predictions[predictions.length - 1];

    // Declining prediction recommendations
    if (predictions.length > 1) {
      const firstPrediction = predictions[0];
      const trendSlope =
        (lastPrediction.predictedValue - firstPrediction.predictedValue) /
        predictions.length;

      if (trendSlope < -0.02) {
        // Significant decline predicted
        recommendations.push({
          id: `predictive_decline_${Date.now()}`,
          type: this.recommendationTypes.INTERVENTION,
          priority: this.priorityLevels.HIGH,
          title: "Proactive Intervention for Predicted Decline",
          description: `Model predicts declining performance over ${predictiveModel.horizon} period`,
          actions: [
            "Implement preventive interventions immediately",
            "Increase monitoring frequency",
            "Review and adjust current care plans",
            "Consider additional resources or support",
          ],
          evidence: this.evidenceStrength.MODERATE,
          expectedOutcome: "Prevention or mitigation of predicted decline",
          timeframe: "Immediate",
          resources: this.getPreventiveResources(),
          metadata: {
            modelType: predictiveModel.modelType,
            confidence: predictiveModel.confidence,
            predictedDecline: Math.abs(trendSlope),
            horizon: predictiveModel.horizon,
          },
        });
      }
    }

    // Low confidence predictions
    if (predictiveModel.confidence < 0.5) {
      recommendations.push({
        id: `improve_prediction_${Date.now()}`,
        type: this.recommendationTypes.MONITORING,
        priority: this.priorityLevels.MEDIUM,
        title: "Improve Data Collection for Better Predictions",
        description: `Prediction confidence is low (${(
          predictiveModel.confidence * 100
        ).toFixed(1)}%)`,
        actions: [
          "Increase data collection frequency",
          "Improve data quality and completeness",
          "Extend historical data collection period",
          "Validate data entry processes",
        ],
        evidence: this.evidenceStrength.STRONG,
        expectedOutcome: "More reliable predictive insights",
        timeframe: "2-4 weeks",
        resources: ["Data collection protocols", "Quality assurance tools"],
        metadata: {
          currentConfidence: predictiveModel.confidence,
          dataPoints: predictiveModel.dataPoints,
          modelType: predictiveModel.modelType,
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate recommendations based on risk assessment
   */
  async generateRiskRecommendations(riskAssessment, context) {
    const recommendations = [];

    if (!riskAssessment.success || !riskAssessment.predictions) {
      return recommendations;
    }

    const highRiskPatients = riskAssessment.predictions.filter(
      (p) => p.riskLevel === "high"
    );
    const mediumRiskPatients = riskAssessment.predictions.filter(
      (p) => p.riskLevel === "medium"
    );

    // High-risk patient recommendations
    if (highRiskPatients.length > 0) {
      recommendations.push({
        id: `high_risk_patients_${Date.now()}`,
        type: this.recommendationTypes.RISK_MITIGATION,
        priority: this.priorityLevels.CRITICAL,
        title: `Immediate Attention for High-Risk Patients`,
        description: `${highRiskPatients.length} patients identified as high-risk`,
        actions: [
          "Schedule immediate assessments for high-risk patients",
          "Implement intensive monitoring protocols",
          "Review and modify care plans",
          "Consider additional interventions or resources",
        ],
        evidence: this.evidenceStrength.STRONG,
        expectedOutcome: "Reduced adverse outcomes for high-risk patients",
        timeframe: "Within 24 hours",
        resources: ["Risk assessment protocols", "Intensive monitoring tools"],
        metadata: {
          highRiskCount: highRiskPatients.length,
          patientIds: highRiskPatients.map((p) => p.patientId),
          averageRiskScore:
            highRiskPatients.reduce((sum, p) => sum + p.riskScore, 0) /
            highRiskPatients.length,
        },
      });

      // Individual high-risk patient recommendations
      highRiskPatients.slice(0, 3).forEach((patient, index) => {
        recommendations.push({
          id: `individual_risk_${patient.patientId}_${Date.now()}`,
          type: this.recommendationTypes.CARE_PLAN,
          priority: this.priorityLevels.HIGH,
          title: `Personalized Risk Mitigation for Patient ${patient.patientId}`,
          description: `Risk score: ${patient.riskScore.toFixed(
            2
          )} - ${patient.recommendations.join(", ")}`,
          actions: patient.recommendations,
          evidence: this.evidenceStrength.MODERATE,
          expectedOutcome: "Reduced individual patient risk",
          timeframe: "Within 48 hours",
          resources: this.getPatientSpecificResources(patient),
          metadata: {
            patientId: patient.patientId,
            riskScore: patient.riskScore,
            contributingFactors: patient.contributingFactors,
            confidence: patient.confidence,
          },
        });
      });
    }

    // Medium-risk patient recommendations
    if (mediumRiskPatients.length > 0) {
      recommendations.push({
        id: `medium_risk_monitoring_${Date.now()}`,
        type: this.recommendationTypes.MONITORING,
        priority: this.priorityLevels.MEDIUM,
        title: "Enhanced Monitoring for Medium-Risk Patients",
        description: `${mediumRiskPatients.length} patients require enhanced monitoring`,
        actions: [
          "Implement enhanced monitoring protocols",
          "Schedule regular check-ins",
          "Monitor for risk escalation",
          "Prepare intervention strategies",
        ],
        evidence: this.evidenceStrength.MODERATE,
        expectedOutcome: "Early detection of risk escalation",
        timeframe: "Within 1 week",
        resources: ["Enhanced monitoring protocols", "Risk tracking tools"],
        metadata: {
          mediumRiskCount: mediumRiskPatients.length,
          averageRiskScore:
            mediumRiskPatients.reduce((sum, p) => sum + p.riskScore, 0) /
            mediumRiskPatients.length,
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate quality improvement recommendations
   */
  async generateQualityRecommendations(qualityIndicators, context) {
    const recommendations = [];

    // Below-benchmark indicators
    const belowBenchmark = qualityIndicators.filter(
      (qi) => qi.benchmarkComparison?.vsBenchmark?.status === "below"
    );

    if (belowBenchmark.length > 0) {
      recommendations.push({
        id: `below_benchmark_${Date.now()}`,
        type: this.recommendationTypes.QUALITY_IMPROVEMENT,
        priority: this.priorityLevels.HIGH,
        title: "Address Below-Benchmark Performance",
        description: `${belowBenchmark.length} indicators performing below benchmark`,
        actions: [
          "Analyze root causes of underperformance",
          "Implement evidence-based improvement strategies",
          "Benchmark against high-performing organizations",
          "Set specific improvement targets and timelines",
        ],
        evidence: this.evidenceStrength.STRONG,
        expectedOutcome: "Improved performance to meet or exceed benchmarks",
        timeframe: "6-12 weeks",
        resources: [
          "Quality improvement frameworks",
          "Benchmarking data",
          "Best practice guidelines",
        ],
        metadata: {
          belowBenchmarkCount: belowBenchmark.length,
          indicators: belowBenchmark.map((qi) => qi.indicatorType),
          averageGap: this.calculateAverageGap(belowBenchmark),
        },
      });
    }

    // Consistently high-performing indicators
    const highPerforming = qualityIndicators.filter(
      (qi) =>
        qi.benchmarkComparison?.vsBenchmark?.status === "above" &&
        qi.benchmarkComparison?.vsTarget?.status === "above"
    );

    if (highPerforming.length > 0) {
      recommendations.push({
        id: `sustain_excellence_${Date.now()}`,
        type: this.recommendationTypes.QUALITY_IMPROVEMENT,
        priority: this.priorityLevels.LOW,
        title: "Sustain Excellence and Share Best Practices",
        description: `${highPerforming.length} indicators consistently exceed benchmarks`,
        actions: [
          "Document successful strategies and processes",
          "Share best practices with other teams",
          "Mentor other units or organizations",
          "Consider raising performance targets",
        ],
        evidence: this.evidenceStrength.STRONG,
        expectedOutcome: "Sustained excellence and knowledge sharing",
        timeframe: "Ongoing",
        resources: [
          "Best practice documentation",
          "Knowledge sharing platforms",
        ],
        metadata: {
          highPerformingCount: highPerforming.length,
          indicators: highPerforming.map((qi) => qi.indicatorType),
        },
      });
    }

    return recommendations;
  }

  /**
   * Prioritize recommendations based on various factors
   */
  prioritizeRecommendations(recommendations, preferences = {}) {
    return recommendations.sort((a, b) => {
      // Primary sort by priority level
      if (a.priority.level !== b.priority.level) {
        return a.priority.level - b.priority.level;
      }

      // Secondary sort by evidence strength
      if (a.evidence.confidence !== b.evidence.confidence) {
        return b.evidence.confidence - a.evidence.confidence;
      }

      // Tertiary sort by user preferences
      const aPreferenceScore = this.calculatePreferenceScore(a, preferences);
      const bPreferenceScore = this.calculatePreferenceScore(b, preferences);

      return bPreferenceScore - aPreferenceScore;
    });
  }

  /**
   * Remove duplicate or similar recommendations
   */
  deduplicateRecommendations(recommendations) {
    const unique = [];
    const seen = new Set();

    for (const rec of recommendations) {
      const key = `${rec.type}_${rec.title.toLowerCase().replace(/\s+/g, "_")}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique;
  }

  /**
   * Generate summary of recommendations
   */
  generateRecommendationSummary(recommendations) {
    const summary = {
      total: recommendations.length,
      byPriority: {},
      byType: {},
      urgentActions: 0,
      estimatedImpact: "medium",
    };

    recommendations.forEach((rec) => {
      // Count by priority
      const priorityKey = Object.keys(this.priorityLevels).find(
        (key) => this.priorityLevels[key].level === rec.priority.level
      );
      summary.byPriority[priorityKey] =
        (summary.byPriority[priorityKey] || 0) + 1;

      // Count by type
      summary.byType[rec.type] = (summary.byType[rec.type] || 0) + 1;

      // Count urgent actions
      if (rec.priority.level <= 2) {
        summary.urgentActions++;
      }
    });

    // Estimate overall impact
    if (summary.urgentActions > 3) {
      summary.estimatedImpact = "high";
    } else if (summary.urgentActions === 0) {
      summary.estimatedImpact = "low";
    }

    return summary;
  }

  /**
   * Generate actionable plan from recommendations
   */
  generateActionPlan(recommendations) {
    const plan = {
      immediate: [], // Within 24 hours
      shortTerm: [], // Within 1 week
      mediumTerm: [], // Within 1 month
      longTerm: [], // Beyond 1 month
    };

    recommendations.forEach((rec) => {
      const timeframe = rec.timeframe?.toLowerCase() || "";

      if (
        timeframe.includes("immediate") ||
        timeframe.includes("24") ||
        rec.priority.level === 1
      ) {
        plan.immediate.push({
          id: rec.id,
          title: rec.title,
          actions: rec.actions.slice(0, 2), // Top 2 actions
          priority: rec.priority,
        });
      } else if (timeframe.includes("week") || rec.priority.level === 2) {
        plan.shortTerm.push({
          id: rec.id,
          title: rec.title,
          actions: rec.actions.slice(0, 3),
          priority: rec.priority,
        });
      } else if (timeframe.includes("month") || rec.priority.level === 3) {
        plan.mediumTerm.push({
          id: rec.id,
          title: rec.title,
          actions: rec.actions,
          priority: rec.priority,
        });
      } else {
        plan.longTerm.push({
          id: rec.id,
          title: rec.title,
          actions: rec.actions,
          priority: rec.priority,
        });
      }
    });

    return plan;
  }

  /**
   * Helper methods
   */
  formatIndicatorName(indicator) {
    return indicator
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  getResourcesForIndicator(indicator) {
    const resourceMap = {
      readmissionRate: [
        "Discharge planning protocols",
        "Follow-up care guidelines",
      ],
      infectionRate: ["Infection control protocols", "Hand hygiene monitoring"],
      mobilityImprovement: [
        "Physical therapy resources",
        "Mobility assessment tools",
      ],
      patientSatisfaction: [
        "Communication training",
        "Patient feedback systems",
      ],
    };

    return resourceMap[indicator] || ["General quality improvement resources"];
  }

  getPreventiveResources() {
    return [
      "Early intervention protocols",
      "Risk assessment tools",
      "Preventive care guidelines",
      "Monitoring equipment",
    ];
  }

  getPatientSpecificResources(patient) {
    const resources = ["Individualized care plan"];

    if (patient.contributingFactors) {
      patient.contributingFactors.forEach((factor) => {
        switch (factor.name) {
          case "mobility":
            resources.push("Physical therapy consultation");
            break;
          case "medication":
            resources.push("Pharmacist review");
            break;
          case "cognitive":
            resources.push("Cognitive assessment tools");
            break;
          default:
            resources.push(`${factor.name} management resources`);
        }
      });
    }

    return resources;
  }

  calculateAverageGap(belowBenchmark) {
    if (belowBenchmark.length === 0) return 0;

    const totalGap = belowBenchmark.reduce((sum, qi) => {
      return (
        sum + Math.abs(qi.benchmarkComparison?.vsBenchmark?.percentage || 0)
      );
    }, 0);

    return totalGap / belowBenchmark.length;
  }

  calculatePreferenceScore(recommendation, preferences) {
    let score = 0;

    // Preference for certain types
    if (preferences.preferredTypes?.includes(recommendation.type)) {
      score += 10;
    }

    // Preference for certain timeframes
    if (preferences.preferredTimeframe === recommendation.timeframe) {
      score += 5;
    }

    // Preference for evidence strength
    if (
      preferences.minEvidenceStrength &&
      recommendation.evidence.confidence >= preferences.minEvidenceStrength
    ) {
      score += 3;
    }

    return score;
  }
}

export default RecommendationEngine;
