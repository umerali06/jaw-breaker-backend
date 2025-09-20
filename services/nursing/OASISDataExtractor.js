/**
 * OASIS Data Extractor Service
 *
 * Extracts quality indicators and outcome measures from OASIS assessments
 * for integration with the outcome measures system.
 */

const { ObjectId } = require("mongodb");
const OutcomeMeasure = require("../../models/nursing/OutcomeMeasure");
const OASISAssessment = require("../../models/nursing/OASISAssessment");
const { QualityIndicatorConfig } = require("./QualityIndicatorConfig");

class OASISDataExtractor {
  constructor() {
    this.indicatorMappings = this.initializeIndicatorMappings();
    this.extractionRules = this.initializeExtractionRules();
  }

  /**
   * Extract quality indicators from a specific OASIS assessment
   */
  async extractFromAssessment(userId, assessmentId) {
    try {
      const assessment = await OASISAssessment.findOne({
        _id: assessmentId,
        userId: userId,
      });

      if (!assessment) {
        throw new Error(`OASIS assessment not found: ${assessmentId}`);
      }

      const extractedMeasures = [];

      // Extract clinical indicators
      const clinicalMeasures = await this.extractClinicalIndicators(assessment);
      extractedMeasures.push(...clinicalMeasures);

      // Extract functional indicators
      const functionalMeasures = await this.extractFunctionalIndicators(
        assessment
      );
      extractedMeasures.push(...functionalMeasures);

      // Extract safety indicators
      const safetyMeasures = await this.extractSafetyIndicators(assessment);
      extractedMeasures.push(...safetyMeasures);

      // Store extracted measures
      const savedMeasures = [];
      for (const measure of extractedMeasures) {
        const savedMeasure = await this.storeOutcomeMeasure(userId, measure);
        savedMeasures.push(savedMeasure);
      }

      return {
        assessmentId,
        extractedCount: savedMeasures.length,
        measures: savedMeasures,
        extractionTimestamp: new Date(),
        confidence: this.calculateExtractionConfidence(
          assessment,
          extractedMeasures
        ),
      };
    } catch (error) {
      console.error("Error extracting from OASIS assessment:", error);
      throw new Error(`OASIS extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract clinical quality indicators
   */
  async extractClinicalIndicators(assessment) {
    const measures = [];

    try {
      // Wound healing progress
      if (assessment.woundStatus && assessment.woundStatus.length > 0) {
        const woundHealingScore = this.calculateWoundHealingScore(
          assessment.woundStatus
        );
        measures.push({
          indicatorType: "wound_healing_rate",
          category: "clinical",
          value: woundHealingScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "wound_status_analysis",
          confidence: 0.9,
        });
      }

      // Medication management
      if (assessment.medications) {
        const medicationComplianceScore = this.calculateMedicationCompliance(
          assessment.medications
        );
        measures.push({
          indicatorType: "medication_compliance",
          category: "clinical",
          value: medicationComplianceScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "medication_analysis",
          confidence: 0.85,
        });
      }

      // Pain management
      if (assessment.painAssessment) {
        const painManagementScore = this.calculatePainManagementScore(
          assessment.painAssessment
        );
        measures.push({
          indicatorType: "pain_management_effectiveness",
          category: "clinical",
          value: painManagementScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "pain_assessment_analysis",
          confidence: 0.88,
        });
      }

      // Infection prevention
      if (assessment.infectionRisk) {
        const infectionPreventionScore = this.calculateInfectionPreventionScore(
          assessment.infectionRisk
        );
        measures.push({
          indicatorType: "infection_prevention",
          category: "clinical",
          value: infectionPreventionScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "infection_risk_analysis",
          confidence: 0.92,
        });
      }
    } catch (error) {
      console.error("Error extracting clinical indicators:", error);
    }

    return measures;
  }

  /**
   * Extract functional quality indicators
   */
  async extractFunctionalIndicators(assessment) {
    const measures = [];

    try {
      // Activities of Daily Living (ADL)
      if (assessment.adlScores) {
        const adlImprovementScore = this.calculateADLImprovement(
          assessment.adlScores
        );
        measures.push({
          indicatorType: "adl_improvement",
          category: "functional",
          value: adlImprovementScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "adl_score_analysis",
          confidence: 0.95,
        });
      }

      // Mobility assessment
      if (assessment.mobilityStatus) {
        const mobilityScore = this.calculateMobilityImprovement(
          assessment.mobilityStatus
        );
        measures.push({
          indicatorType: "mobility_improvement",
          category: "functional",
          value: mobilityScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "mobility_status_analysis",
          confidence: 0.93,
        });
      }

      // Cognitive function
      if (assessment.cognitiveStatus) {
        const cognitiveScore = this.calculateCognitiveImprovement(
          assessment.cognitiveStatus
        );
        measures.push({
          indicatorType: "cognitive_improvement",
          category: "functional",
          value: cognitiveScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "cognitive_status_analysis",
          confidence: 0.87,
        });
      }

      // Self-care ability
      if (assessment.selfCareStatus) {
        const selfCareScore = this.calculateSelfCareImprovement(
          assessment.selfCareStatus
        );
        measures.push({
          indicatorType: "self_care_improvement",
          category: "functional",
          value: selfCareScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "self_care_analysis",
          confidence: 0.91,
        });
      }
    } catch (error) {
      console.error("Error extracting functional indicators:", error);
    }

    return measures;
  }

  /**
   * Extract safety quality indicators
   */
  async extractSafetyIndicators(assessment) {
    const measures = [];

    try {
      // Fall risk assessment
      if (assessment.fallRisk) {
        const fallPreventionScore = this.calculateFallPreventionScore(
          assessment.fallRisk
        );
        measures.push({
          indicatorType: "fall_prevention_effectiveness",
          category: "safety",
          value: fallPreventionScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "fall_risk_analysis",
          confidence: 0.89,
        });
      }

      // Emergency department utilization
      if (assessment.emergencyVisits !== undefined) {
        const edUtilizationScore = this.calculateEDUtilizationScore(
          assessment.emergencyVisits
        );
        measures.push({
          indicatorType: "emergency_department_utilization",
          category: "safety",
          value: edUtilizationScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "emergency_visits_analysis",
          confidence: 0.96,
        });
      }

      // Hospitalization risk
      if (assessment.hospitalizationRisk) {
        const hospitalizationScore = this.calculateHospitalizationRiskScore(
          assessment.hospitalizationRisk
        );
        measures.push({
          indicatorType: "hospitalization_risk_reduction",
          category: "safety",
          value: hospitalizationScore,
          patientId: assessment.patientId,
          source: "oasis",
          sourceId: assessment._id,
          extractionMethod: "hospitalization_risk_analysis",
          confidence: 0.84,
        });
      }
    } catch (error) {
      console.error("Error extracting safety indicators:", error);
    }

    return measures;
  }

  /**
   * Calculate wound healing score from wound status data
   */
  calculateWoundHealingScore(woundStatus) {
    if (!Array.isArray(woundStatus) || woundStatus.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let woundCount = 0;

    woundStatus.forEach((wound) => {
      if (wound.healingStage && wound.size) {
        // Higher healing stage and smaller size indicate better healing
        const stageScore = (wound.healingStage / 4) * 0.6; // Normalize to 0-0.6
        const sizeScore = Math.max(0, 1 - wound.size / 100) * 0.4; // Normalize to 0-0.4
        totalScore += stageScore + sizeScore;
        woundCount++;
      }
    });

    return woundCount > 0 ? Math.min(1, totalScore / woundCount) : 0;
  }

  /**
   * Calculate medication compliance score
   */
  calculateMedicationCompliance(medications) {
    if (!medications || !medications.compliance) {
      return 0;
    }

    const compliance = medications.compliance;

    // Convert compliance percentage to 0-1 scale
    if (typeof compliance === "number") {
      return Math.min(1, Math.max(0, compliance / 100));
    }

    // Handle compliance categories
    const complianceMap = {
      excellent: 0.95,
      good: 0.85,
      fair: 0.65,
      poor: 0.35,
      "non-compliant": 0.1,
    };

    return complianceMap[compliance.toLowerCase()] || 0.5;
  }

  /**
   * Calculate pain management effectiveness score
   */
  calculatePainManagementScore(painAssessment) {
    if (!painAssessment) return 0;

    const { currentPain, targetPain, painReduction } = painAssessment;

    if (currentPain !== undefined && targetPain !== undefined) {
      // Calculate based on pain reduction towards target
      const maxPain = 10; // Assuming 0-10 pain scale
      const improvement = Math.max(0, (maxPain - currentPain) / maxPain);
      const targetAchievement = currentPain <= targetPain ? 1 : 0.5;
      return Math.min(1, improvement * 0.7 + targetAchievement * 0.3);
    }

    if (painReduction !== undefined) {
      // Direct pain reduction percentage
      return Math.min(1, Math.max(0, painReduction / 100));
    }

    return 0.5; // Default moderate score if data is incomplete
  }

  /**
   * Calculate infection prevention score
   */
  calculateInfectionPreventionScore(infectionRisk) {
    if (!infectionRisk) return 0;

    const { riskLevel, preventiveMeasures, infectionOccurred } = infectionRisk;

    let score = 0.5; // Base score

    // Risk level assessment (lower risk = higher score)
    const riskScores = {
      low: 0.9,
      moderate: 0.7,
      high: 0.4,
      critical: 0.2,
    };

    if (riskLevel && riskScores[riskLevel.toLowerCase()]) {
      score = riskScores[riskLevel.toLowerCase()];
    }

    // Adjust for preventive measures
    if (preventiveMeasures && preventiveMeasures.length > 0) {
      const measureBonus = Math.min(0.2, preventiveMeasures.length * 0.05);
      score += measureBonus;
    }

    // Penalize if infection occurred
    if (infectionOccurred === true) {
      score *= 0.3;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate ADL improvement score
   */
  calculateADLImprovement(adlScores) {
    if (!adlScores || !adlScores.current) return 0;

    const { current, baseline, target } = adlScores;

    if (baseline !== undefined) {
      // Calculate improvement from baseline
      const maxImprovement = target ? target - baseline : 100 - baseline;
      const actualImprovement = current - baseline;

      if (maxImprovement > 0) {
        return Math.min(1, Math.max(0, actualImprovement / maxImprovement));
      }
    }

    // If no baseline, use current score as percentage
    return Math.min(1, Math.max(0, current / 100));
  }

  /**
   * Calculate mobility improvement score
   */
  calculateMobilityImprovement(mobilityStatus) {
    if (!mobilityStatus) return 0;

    const { currentLevel, baselineLevel, assistanceRequired } = mobilityStatus;

    // Mobility levels: 1 = bedbound, 2 = wheelchair, 3 = walker, 4 = cane, 5 = independent
    if (currentLevel !== undefined && baselineLevel !== undefined) {
      const improvement = (currentLevel - baselineLevel) / 4; // Normalize to 0-1
      return Math.min(1, Math.max(0, improvement + 0.5)); // Add base score
    }

    // Calculate based on assistance required
    if (assistanceRequired !== undefined) {
      const assistanceScores = {
        total: 0.2,
        extensive: 0.4,
        moderate: 0.6,
        minimal: 0.8,
        none: 1.0,
      };
      return assistanceScores[assistanceRequired.toLowerCase()] || 0.5;
    }

    return 0.5;
  }

  /**
   * Calculate cognitive improvement score
   */
  calculateCognitiveImprovement(cognitiveStatus) {
    if (!cognitiveStatus) return 0;

    const { currentScore, baselineScore, cognitiveTests } = cognitiveStatus;

    if (currentScore !== undefined && baselineScore !== undefined) {
      const maxScore = 30; // Assuming MMSE or similar scale
      const improvement = (currentScore - baselineScore) / maxScore;
      const currentPerformance = currentScore / maxScore;

      return Math.min(
        1,
        Math.max(0, improvement * 0.6 + currentPerformance * 0.4)
      );
    }

    // Calculate from cognitive test results
    if (cognitiveTests && Array.isArray(cognitiveTests)) {
      const averageScore =
        cognitiveTests.reduce((sum, test) => sum + (test.score || 0), 0) /
        cognitiveTests.length;
      return Math.min(1, Math.max(0, averageScore / 100));
    }

    return 0.5;
  }

  /**
   * Calculate self-care improvement score
   */
  calculateSelfCareImprovement(selfCareStatus) {
    if (!selfCareStatus) return 0;

    const { activities, independenceLevel, assistanceNeeded } = selfCareStatus;

    if (activities && Array.isArray(activities)) {
      const totalActivities = activities.length;
      const independentActivities = activities.filter(
        (activity) =>
          activity.independenceLevel === "independent" ||
          activity.independenceLevel === "modified_independent"
      ).length;

      return totalActivities > 0 ? independentActivities / totalActivities : 0;
    }

    if (independenceLevel !== undefined) {
      const levelScores = {
        dependent: 0.2,
        minimal_assistance: 0.4,
        moderate_assistance: 0.6,
        modified_independent: 0.8,
        independent: 1.0,
      };
      return levelScores[independenceLevel.toLowerCase()] || 0.5;
    }

    return 0.5;
  }

  /**
   * Calculate fall prevention effectiveness score
   */
  calculateFallPreventionScore(fallRisk) {
    if (!fallRisk) return 0;

    const { riskLevel, preventiveMeasures, fallsOccurred, riskFactors } =
      fallRisk;

    let score = 0.5; // Base score

    // Risk level (lower risk = higher prevention effectiveness)
    const riskScores = {
      low: 0.9,
      moderate: 0.7,
      high: 0.5,
      very_high: 0.3,
    };

    if (riskLevel && riskScores[riskLevel.toLowerCase()]) {
      score = riskScores[riskLevel.toLowerCase()];
    }

    // Adjust for preventive measures implemented
    if (preventiveMeasures && preventiveMeasures.length > 0) {
      const measureBonus = Math.min(0.3, preventiveMeasures.length * 0.1);
      score += measureBonus;
    }

    // Penalize for falls that occurred
    if (fallsOccurred && fallsOccurred > 0) {
      score *= Math.max(0.1, 1 - fallsOccurred * 0.3);
    }

    // Adjust for number of risk factors
    if (riskFactors && riskFactors.length > 0) {
      const riskPenalty = Math.min(0.4, riskFactors.length * 0.1);
      score -= riskPenalty;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate emergency department utilization score
   */
  calculateEDUtilizationScore(emergencyVisits) {
    if (emergencyVisits === undefined) return 0;

    // Lower ED visits = higher score (better outcome)
    if (emergencyVisits === 0) return 1.0;
    if (emergencyVisits === 1) return 0.8;
    if (emergencyVisits === 2) return 0.6;
    if (emergencyVisits === 3) return 0.4;

    return Math.max(0.1, 1 - emergencyVisits * 0.2);
  }

  /**
   * Calculate hospitalization risk reduction score
   */
  calculateHospitalizationRiskScore(hospitalizationRisk) {
    if (!hospitalizationRisk) return 0;

    const { currentRisk, baselineRisk, riskFactors, interventions } =
      hospitalizationRisk;

    if (currentRisk !== undefined && baselineRisk !== undefined) {
      // Calculate risk reduction
      const riskReduction = (baselineRisk - currentRisk) / baselineRisk;
      return Math.min(1, Math.max(0, riskReduction));
    }

    // Calculate based on risk factors and interventions
    let score = 0.5;

    if (riskFactors && riskFactors.length > 0) {
      score -= Math.min(0.4, riskFactors.length * 0.1);
    }

    if (interventions && interventions.length > 0) {
      score += Math.min(0.4, interventions.length * 0.1);
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Store extracted outcome measure in database
   */
  async storeOutcomeMeasure(userId, measureData) {
    try {
      const qualityConfig =
        QualityIndicatorConfig[measureData.category]?.[
          measureData.indicatorType
        ];

      const outcomeMeasure = new OutcomeMeasure({
        userId: userId,
        patientId: measureData.patientId,
        indicatorType: measureData.indicatorType,
        category: measureData.category,
        value: measureData.value,

        qualityScores: {
          target: qualityConfig?.target || 0.8,
          benchmark: qualityConfig?.benchmark || 0.7,
          weighted: measureData.value * (qualityConfig?.weight || 1),
        },

        benchmarkComparison: this.calculateBenchmarkComparison(
          measureData.value,
          qualityConfig?.target || 0.8,
          qualityConfig?.benchmark || 0.7
        ),

        metadata: {
          source: measureData.source,
          sourceId: measureData.sourceId,
          confidence: measureData.confidence || 0.8,
          collectionMethod: measureData.extractionMethod,
          dataQuality: {
            completeness: 0.95,
            accuracy: measureData.confidence || 0.8,
            timeliness: 1.0,
          },
        },
      });

      return await outcomeMeasure.save();
    } catch (error) {
      console.error("Error storing outcome measure:", error);
      throw error;
    }
  }

  /**
   * Calculate benchmark comparison
   */
  calculateBenchmarkComparison(value, target, benchmark) {
    return {
      vsTarget: {
        difference: value - target,
        percentage: target > 0 ? ((value - target) / target) * 100 : 0,
        status: value >= target ? "above" : "below",
      },
      vsBenchmark: {
        difference: value - benchmark,
        percentage: benchmark > 0 ? ((value - benchmark) / benchmark) * 100 : 0,
        status: value >= benchmark ? "above" : "below",
      },
    };
  }

  /**
   * Calculate overall extraction confidence
   */
  calculateExtractionConfidence(assessment, extractedMeasures) {
    if (extractedMeasures.length === 0) return 0;

    const avgConfidence =
      extractedMeasures.reduce(
        (sum, measure) => sum + (measure.confidence || 0.5),
        0
      ) / extractedMeasures.length;

    // Adjust based on data completeness
    const completenessScore = this.assessDataCompleteness(assessment);

    return Math.min(1, avgConfidence * completenessScore);
  }

  /**
   * Assess data completeness of OASIS assessment
   */
  assessDataCompleteness(assessment) {
    const requiredFields = [
      "patientId",
      "assessmentDate",
      "adlScores",
      "mobilityStatus",
      "cognitiveStatus",
      "woundStatus",
      "medications",
      "painAssessment",
    ];

    const presentFields = requiredFields.filter(
      (field) => assessment[field] !== undefined && assessment[field] !== null
    );

    return presentFields.length / requiredFields.length;
  }

  /**
   * Initialize indicator mappings
   */
  initializeIndicatorMappings() {
    return {
      clinical: [
        "wound_healing_rate",
        "medication_compliance",
        "pain_management_effectiveness",
        "infection_prevention",
      ],
      functional: [
        "adl_improvement",
        "mobility_improvement",
        "cognitive_improvement",
        "self_care_improvement",
      ],
      safety: [
        "fall_prevention_effectiveness",
        "emergency_department_utilization",
        "hospitalization_risk_reduction",
      ],
    };
  }

  /**
   * Initialize extraction rules
   */
  initializeExtractionRules() {
    return {
      minimumConfidence: 0.7,
      requiredDataPoints: 3,
      maxExtractionAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      validationRules: {
        valueRange: { min: 0, max: 1 },
        requiredFields: ["patientId", "indicatorType", "category", "value"],
      },
    };
  }

  /**
   * Batch extract from multiple assessments
   */
  async batchExtractFromAssessments(userId, assessmentIds) {
    const results = [];
    const errors = [];

    for (const assessmentId of assessmentIds) {
      try {
        const result = await this.extractFromAssessment(userId, assessmentId);
        results.push(result);
      } catch (error) {
        errors.push({
          assessmentId,
          error: error.message,
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      totalProcessed: assessmentIds.length,
      successRate: results.length / assessmentIds.length,
    };
  }
}

module.exports = OASISDataExtractor;
