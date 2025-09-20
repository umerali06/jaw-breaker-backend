/**
 * SOAP Data Extractor Service
 *
 * Extracts quality indicators and outcome measures from SOAP notes
 * using natural language processing and pattern recognition.
 */

const { ObjectId } = require("mongodb");
const OutcomeMeasure = require("../../models/nursing/OutcomeMeasure");
const SOAPNote = require("../../models/nursing/SOAPNote");
const { QualityIndicatorConfig } = require("./QualityIndicatorConfig");

class SOAPDataExtractor {
  constructor() {
    this.extractionPatterns = this.initializeExtractionPatterns();
    this.qualityKeywords = this.initializeQualityKeywords();
    this.scoringRules = this.initializeScoringRules();
  }

  /**
   * Extract quality indicators from a specific SOAP note
   */
  async extractFromSOAPNote(userId, noteId) {
    try {
      const soapNote = await SOAPNote.findOne({
        _id: noteId,
        userId: userId,
      });

      if (!soapNote) {
        throw new Error(`SOAP note not found: ${noteId}`);
      }

      const extractedMeasures = [];

      // Extract from each SOAP section
      const subjectiveMeasures = await this.extractFromSubjective(soapNote);
      extractedMeasures.push(...subjectiveMeasures);

      const objectiveMeasures = await this.extractFromObjective(soapNote);
      extractedMeasures.push(...objectiveMeasures);

      const assessmentMeasures = await this.extractFromAssessment(soapNote);
      extractedMeasures.push(...assessmentMeasures);

      const planMeasures = await this.extractFromPlan(soapNote);
      extractedMeasures.push(...planMeasures);

      // Store extracted measures
      const savedMeasures = [];
      for (const measure of extractedMeasures) {
        const savedMeasure = await this.storeOutcomeMeasure(userId, measure);
        savedMeasures.push(savedMeasure);
      }

      return {
        noteId,
        extractedCount: savedMeasures.length,
        measures: savedMeasures,
        extractionTimestamp: new Date(),
        confidence: this.calculateExtractionConfidence(
          soapNote,
          extractedMeasures
        ),
      };
    } catch (error) {
      console.error("Error extracting from SOAP note:", error);
      throw new Error(`SOAP extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract quality indicators from Subjective section
   */
  async extractFromSubjective(soapNote) {
    const measures = [];
    const subjective = soapNote.subjective || "";

    try {
      // Pain assessment from patient reports
      const painScore = this.extractPainScore(subjective);
      if (painScore !== null) {
        measures.push({
          indicatorType: "patient_reported_pain",
          category: "clinical",
          value: this.normalizePainScore(painScore),
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "subjective_pain_analysis",
          confidence: 0.8,
          rawData: { painScore, section: "subjective" },
        });
      }

      // Symptom improvement
      const symptomImprovement = this.extractSymptomImprovement(subjective);
      if (symptomImprovement !== null) {
        measures.push({
          indicatorType: "symptom_improvement",
          category: "clinical",
          value: symptomImprovement,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "subjective_symptom_analysis",
          confidence: 0.75,
          rawData: { section: "subjective" },
        });
      }

      // Functional status from patient perspective
      const functionalStatus = this.extractFunctionalStatus(subjective);
      if (functionalStatus !== null) {
        measures.push({
          indicatorType: "patient_reported_function",
          category: "functional",
          value: functionalStatus,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "subjective_function_analysis",
          confidence: 0.7,
          rawData: { section: "subjective" },
        });
      }

      // Medication adherence indicators
      const medicationAdherence = this.extractMedicationAdherence(subjective);
      if (medicationAdherence !== null) {
        measures.push({
          indicatorType: "medication_adherence_reported",
          category: "clinical",
          value: medicationAdherence,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "subjective_medication_analysis",
          confidence: 0.85,
          rawData: { section: "subjective" },
        });
      }
    } catch (error) {
      console.error("Error extracting from subjective section:", error);
    }

    return measures;
  }

  /**
   * Extract quality indicators from Objective section
   */
  async extractFromObjective(soapNote) {
    const measures = [];
    const objective = soapNote.objective || "";

    try {
      // Vital signs stability
      const vitalSigns = this.extractVitalSigns(objective);
      if (vitalSigns && Object.keys(vitalSigns).length > 0) {
        const stabilityScore = this.calculateVitalSignsStability(vitalSigns);
        measures.push({
          indicatorType: "vital_signs_stability",
          category: "clinical",
          value: stabilityScore,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "objective_vitals_analysis",
          confidence: 0.9,
          rawData: { vitalSigns, section: "objective" },
        });
      }

      // Wound healing progress
      const woundStatus = this.extractWoundStatus(objective);
      if (woundStatus !== null) {
        measures.push({
          indicatorType: "wound_healing_progress",
          category: "clinical",
          value: woundStatus,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "objective_wound_analysis",
          confidence: 0.85,
          rawData: { section: "objective" },
        });
      }

      // Mobility observations
      const mobilityObservation = this.extractMobilityObservation(objective);
      if (mobilityObservation !== null) {
        measures.push({
          indicatorType: "observed_mobility",
          category: "functional",
          value: mobilityObservation,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "objective_mobility_analysis",
          confidence: 0.88,
          rawData: { section: "objective" },
        });
      }

      // Cognitive assessment
      const cognitiveObservation = this.extractCognitiveObservation(objective);
      if (cognitiveObservation !== null) {
        measures.push({
          indicatorType: "observed_cognitive_function",
          category: "functional",
          value: cognitiveObservation,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "objective_cognitive_analysis",
          confidence: 0.82,
          rawData: { section: "objective" },
        });
      }
    } catch (error) {
      console.error("Error extracting from objective section:", error);
    }

    return measures;
  }

  /**
   * Extract quality indicators from Assessment section
   */
  async extractFromAssessment(soapNote) {
    const measures = [];
    const assessment = soapNote.assessment || "";

    try {
      // Clinical progress assessment
      const progressScore = this.extractProgressAssessment(assessment);
      if (progressScore !== null) {
        measures.push({
          indicatorType: "clinical_progress",
          category: "clinical",
          value: progressScore,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "assessment_progress_analysis",
          confidence: 0.9,
          rawData: { section: "assessment" },
        });
      }

      // Risk assessment
      const riskLevel = this.extractRiskAssessment(assessment);
      if (riskLevel !== null) {
        measures.push({
          indicatorType: "risk_level_assessment",
          category: "safety",
          value: riskLevel,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "assessment_risk_analysis",
          confidence: 0.85,
          rawData: { section: "assessment" },
        });
      }

      // Goal achievement
      const goalAchievement = this.extractGoalAchievement(assessment);
      if (goalAchievement !== null) {
        measures.push({
          indicatorType: "goal_achievement",
          category: "functional",
          value: goalAchievement,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "assessment_goal_analysis",
          confidence: 0.88,
          rawData: { section: "assessment" },
        });
      }
    } catch (error) {
      console.error("Error extracting from assessment section:", error);
    }

    return measures;
  }

  /**
   * Extract quality indicators from Plan section
   */
  async extractFromPlan(soapNote) {
    const measures = [];
    const plan = soapNote.plan || "";

    try {
      // Care plan adherence
      const planAdherence = this.extractPlanAdherence(plan);
      if (planAdherence !== null) {
        measures.push({
          indicatorType: "care_plan_adherence",
          category: "clinical",
          value: planAdherence,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "plan_adherence_analysis",
          confidence: 0.8,
          rawData: { section: "plan" },
        });
      }

      // Intervention effectiveness
      const interventionEffectiveness =
        this.extractInterventionEffectiveness(plan);
      if (interventionEffectiveness !== null) {
        measures.push({
          indicatorType: "intervention_effectiveness",
          category: "clinical",
          value: interventionEffectiveness,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "plan_intervention_analysis",
          confidence: 0.82,
          rawData: { section: "plan" },
        });
      }

      // Discharge readiness
      const dischargeReadiness = this.extractDischargeReadiness(plan);
      if (dischargeReadiness !== null) {
        measures.push({
          indicatorType: "discharge_readiness",
          category: "functional",
          value: dischargeReadiness,
          patientId: soapNote.patientId,
          source: "soap",
          sourceId: soapNote._id,
          extractionMethod: "plan_discharge_analysis",
          confidence: 0.85,
          rawData: { section: "plan" },
        });
      }
    } catch (error) {
      console.error("Error extracting from plan section:", error);
    }

    return measures;
  }

  /**
   * Extract pain score from text using pattern matching
   */
  extractPainScore(text) {
    const painPatterns = [
      /pain.*?(\d+)\/10/i,
      /pain.*?level.*?(\d+)/i,
      /(\d+)\/10.*?pain/i,
      /pain.*?scale.*?(\d+)/i,
      /reports.*?pain.*?(\d+)/i,
    ];

    for (const pattern of painPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const score = parseInt(match[1]);
        if (score >= 0 && score <= 10) {
          return score;
        }
      }
    }

    // Check for qualitative pain descriptions
    const qualitativePain = {
      "no pain": 0,
      "mild pain": 2,
      "moderate pain": 5,
      "severe pain": 8,
      excruciating: 10,
    };

    for (const [description, score] of Object.entries(qualitativePain)) {
      if (text.toLowerCase().includes(description)) {
        return score;
      }
    }

    return null;
  }

  /**
   * Normalize pain score to 0-1 scale (inverted - lower pain = higher score)
   */
  normalizePainScore(painScore) {
    return Math.max(0, (10 - painScore) / 10);
  }

  /**
   * Extract symptom improvement indicators
   */
  extractSymptomImprovement(text) {
    const improvementPatterns = [
      /symptoms?\s+(improved|better|improving|resolved)/i,
      /(improved|better|improving|resolved)\s+symptoms?/i,
      /feeling\s+(better|improved)/i,
      /(decreased|reduced|less)\s+(pain|discomfort|symptoms?)/i,
      /no\s+(complaints?|symptoms?)/i,
    ];

    const worseningPatterns = [
      /symptoms?\s+(worse|worsening|deteriorating)/i,
      /(increased|more|worse)\s+(pain|discomfort|symptoms?)/i,
      /new\s+(complaints?|symptoms?)/i,
    ];

    let improvementScore = 0.5; // Neutral baseline

    for (const pattern of improvementPatterns) {
      if (pattern.test(text)) {
        improvementScore += 0.2;
      }
    }

    for (const pattern of worseningPatterns) {
      if (pattern.test(text)) {
        improvementScore -= 0.2;
      }
    }

    return Math.min(1, Math.max(0, improvementScore));
  }

  /**
   * Extract functional status indicators
   */
  extractFunctionalStatus(text) {
    const functionalPatterns = {
      high: [
        /independent/i,
        /able to perform/i,
        /no assistance/i,
        /functioning well/i,
      ],
      moderate: [/minimal assistance/i, /some help/i, /modified independence/i],
      low: [/requires assistance/i, /dependent/i, /unable to/i, /needs help/i],
    };

    let score = 0.5; // Default moderate

    for (const [level, patterns] of Object.entries(functionalPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          switch (level) {
            case "high":
              return 0.9;
            case "moderate":
              return 0.6;
            case "low":
              return 0.3;
          }
        }
      }
    }

    return score;
  }

  /**
   * Extract medication adherence indicators
   */
  extractMedicationAdherence(text) {
    const adherencePatterns = {
      good: [
        /taking.*?medications?.*?(as prescribed|regularly)/i,
        /compliant.*?medications?/i,
        /adherent.*?medications?/i,
      ],
      poor: [
        /not taking.*?medications?/i,
        /missed.*?doses?/i,
        /non-compliant.*?medications?/i,
        /forgot.*?medications?/i,
      ],
    };

    for (const pattern of adherencePatterns.good) {
      if (pattern.test(text)) {
        return 0.9;
      }
    }

    for (const pattern of adherencePatterns.poor) {
      if (pattern.test(text)) {
        return 0.3;
      }
    }

    return null; // No clear indication
  }

  /**
   * Extract vital signs from objective text
   */
  extractVitalSigns(text) {
    const vitalSigns = {};

    // Blood pressure
    const bpMatch = text.match(/bp:?\s*(\d+)\/(\d+)/i);
    if (bpMatch) {
      vitalSigns.systolic = parseInt(bpMatch[1]);
      vitalSigns.diastolic = parseInt(bpMatch[2]);
    }

    // Heart rate
    const hrMatch =
      text.match(/hr:?\s*(\d+)/i) || text.match(/pulse:?\s*(\d+)/i);
    if (hrMatch) {
      vitalSigns.heartRate = parseInt(hrMatch[1]);
    }

    // Temperature
    const tempMatch =
      text.match(/temp:?\s*(\d+\.?\d*)/i) ||
      text.match(/temperature:?\s*(\d+\.?\d*)/i);
    if (tempMatch) {
      vitalSigns.temperature = parseFloat(tempMatch[1]);
    }

    // Respiratory rate
    const rrMatch =
      text.match(/rr:?\s*(\d+)/i) || text.match(/resp:?\s*(\d+)/i);
    if (rrMatch) {
      vitalSigns.respiratoryRate = parseInt(rrMatch[1]);
    }

    // Oxygen saturation
    const o2Match =
      text.match(/o2:?\s*(\d+)%?/i) || text.match(/spo2:?\s*(\d+)%?/i);
    if (o2Match) {
      vitalSigns.oxygenSaturation = parseInt(o2Match[1]);
    }

    return vitalSigns;
  }

  /**
   * Calculate vital signs stability score
   */
  calculateVitalSignsStability(vitalSigns) {
    let stabilityScore = 0;
    let measuredSigns = 0;

    // Normal ranges and scoring
    const normalRanges = {
      systolic: { min: 90, max: 140, optimal: 120 },
      diastolic: { min: 60, max: 90, optimal: 80 },
      heartRate: { min: 60, max: 100, optimal: 80 },
      temperature: { min: 97, max: 99.5, optimal: 98.6 },
      respiratoryRate: { min: 12, max: 20, optimal: 16 },
      oxygenSaturation: { min: 95, max: 100, optimal: 98 },
    };

    for (const [sign, value] of Object.entries(vitalSigns)) {
      if (normalRanges[sign] && typeof value === "number") {
        const range = normalRanges[sign];
        let signScore = 0;

        if (value >= range.min && value <= range.max) {
          // Within normal range
          const distanceFromOptimal = Math.abs(value - range.optimal);
          const maxDistance = Math.max(
            range.optimal - range.min,
            range.max - range.optimal
          );
          signScore = 1 - distanceFromOptimal / maxDistance;
        } else {
          // Outside normal range
          const distanceFromRange = Math.min(
            Math.abs(value - range.min),
            Math.abs(value - range.max)
          );
          signScore = Math.max(0, 0.5 - distanceFromRange / range.optimal);
        }

        stabilityScore += signScore;
        measuredSigns++;
      }
    }

    return measuredSigns > 0 ? stabilityScore / measuredSigns : 0;
  }

  /**
   * Extract wound status from objective text
   */
  extractWoundStatus(text) {
    const healingPatterns = [
      /wound.*?(healing|improved|better)/i,
      /decreased.*?(drainage|size|redness)/i,
      /granulation.*?tissue/i,
      /epithelialization/i,
    ];

    const worseningPatterns = [
      /wound.*?(worse|deteriorating|infected)/i,
      /increased.*?(drainage|size|redness)/i,
      /necrotic.*?tissue/i,
      /signs.*?infection/i,
    ];

    let score = 0.5; // Neutral baseline

    for (const pattern of healingPatterns) {
      if (pattern.test(text)) {
        score += 0.2;
      }
    }

    for (const pattern of worseningPatterns) {
      if (pattern.test(text)) {
        score -= 0.2;
      }
    }

    // Only return if wound-related content is found
    if (
      text.toLowerCase().includes("wound") ||
      text.toLowerCase().includes("ulcer") ||
      text.toLowerCase().includes("incision")
    ) {
      return Math.min(1, Math.max(0, score));
    }

    return null;
  }

  /**
   * Extract mobility observation from objective text
   */
  extractMobilityObservation(text) {
    const mobilityLevels = {
      high: [
        /ambulating.*?independently/i,
        /walks.*?without.*?assistance/i,
        /mobile.*?independently/i,
      ],
      moderate: [
        /ambulating.*?with.*?assistance/i,
        /walks.*?with.*?(walker|cane)/i,
        /transfers.*?with.*?minimal.*?help/i,
      ],
      low: [
        /bedbound/i,
        /wheelchair.*?dependent/i,
        /unable.*?ambulate/i,
        /requires.*?total.*?assistance/i,
      ],
    };

    for (const [level, patterns] of Object.entries(mobilityLevels)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          switch (level) {
            case "high":
              return 0.9;
            case "moderate":
              return 0.6;
            case "low":
              return 0.3;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract cognitive observation from objective text
   */
  extractCognitiveObservation(text) {
    const cognitiveIndicators = {
      good: [
        /alert.*?oriented/i,
        /appropriate.*?responses/i,
        /follows.*?commands/i,
        /cognitive.*?intact/i,
      ],
      impaired: [
        /confused/i,
        /disoriented/i,
        /cognitive.*?impairment/i,
        /memory.*?deficit/i,
      ],
    };

    for (const pattern of cognitiveIndicators.good) {
      if (pattern.test(text)) {
        return 0.9;
      }
    }

    for (const pattern of cognitiveIndicators.impaired) {
      if (pattern.test(text)) {
        return 0.4;
      }
    }

    return null;
  }

  /**
   * Extract progress assessment from assessment text
   */
  extractProgressAssessment(text) {
    const progressPatterns = {
      excellent: [/excellent.*?progress/i, /significant.*?improvement/i],
      good: [/good.*?progress/i, /improving/i, /progress.*?noted/i],
      fair: [/fair.*?progress/i, /slow.*?progress/i, /minimal.*?improvement/i],
      poor: [/poor.*?progress/i, /no.*?improvement/i, /deteriorating/i],
    };

    const progressScores = {
      excellent: 0.95,
      good: 0.8,
      fair: 0.6,
      poor: 0.3,
    };

    for (const [level, patterns] of Object.entries(progressPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return progressScores[level];
        }
      }
    }

    return null;
  }

  /**
   * Extract risk assessment from assessment text
   */
  extractRiskAssessment(text) {
    const riskPatterns = {
      low: [/low.*?risk/i, /minimal.*?risk/i, /stable/i],
      moderate: [/moderate.*?risk/i, /some.*?risk/i],
      high: [/high.*?risk/i, /significant.*?risk/i, /unstable/i],
    };

    // Higher score = lower risk (better outcome)
    const riskScores = {
      low: 0.9,
      moderate: 0.6,
      high: 0.3,
    };

    for (const [level, patterns] of Object.entries(riskPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return riskScores[level];
        }
      }
    }

    return null;
  }

  /**
   * Extract goal achievement from assessment text
   */
  extractGoalAchievement(text) {
    const goalPatterns = {
      achieved: [
        /goals?.*?(met|achieved|accomplished)/i,
        /objectives?.*?(met|achieved)/i,
      ],
      partial: [/goals?.*?(partially|some)/i, /progress.*?toward.*?goals?/i],
      notMet: [
        /goals?.*?(not.*?met|unmet)/i,
        /objectives?.*?(not.*?achieved)/i,
      ],
    };

    const goalScores = {
      achieved: 0.95,
      partial: 0.6,
      notMet: 0.2,
    };

    for (const [level, patterns] of Object.entries(goalPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return goalScores[level];
        }
      }
    }

    return null;
  }

  /**
   * Extract care plan adherence from plan text
   */
  extractPlanAdherence(text) {
    const adherencePatterns = {
      good: [
        /continue.*?current.*?plan/i,
        /plan.*?effective/i,
        /adherent.*?plan/i,
      ],
      modified: [/modify.*?plan/i, /adjust.*?plan/i, /revise.*?approach/i],
      poor: [/plan.*?not.*?effective/i, /non-adherent/i, /change.*?plan/i],
    };

    const adherenceScores = {
      good: 0.9,
      modified: 0.6,
      poor: 0.3,
    };

    for (const [level, patterns] of Object.entries(adherencePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return adherenceScores[level];
        }
      }
    }

    return null;
  }

  /**
   * Extract intervention effectiveness from plan text
   */
  extractInterventionEffectiveness(text) {
    const effectivenessPatterns = {
      effective: [
        /intervention.*?effective/i,
        /treatment.*?working/i,
        /therapy.*?beneficial/i,
      ],
      partial: [/some.*?improvement/i, /partially.*?effective/i],
      ineffective: [
        /intervention.*?ineffective/i,
        /treatment.*?not.*?working/i,
        /no.*?response/i,
      ],
    };

    const effectivenessScores = {
      effective: 0.9,
      partial: 0.6,
      ineffective: 0.2,
    };

    for (const [level, patterns] of Object.entries(effectivenessPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return effectivenessScores[level];
        }
      }
    }

    return null;
  }

  /**
   * Extract discharge readiness from plan text
   */
  extractDischargeReadiness(text) {
    const readinessPatterns = {
      ready: [
        /ready.*?discharge/i,
        /discharge.*?planning/i,
        /prepare.*?discharge/i,
      ],
      preparing: [/working.*?toward.*?discharge/i, /discharge.*?goals/i],
      notReady: [
        /not.*?ready.*?discharge/i,
        /continue.*?care/i,
        /extend.*?stay/i,
      ],
    };

    const readinessScores = {
      ready: 0.9,
      preparing: 0.6,
      notReady: 0.3,
    };

    for (const [level, patterns] of Object.entries(readinessPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return readinessScores[level];
        }
      }
    }

    return null;
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
            completeness: 0.9,
            accuracy: measureData.confidence || 0.8,
            timeliness: 1.0,
          },
          rawData: measureData.rawData,
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
  calculateExtractionConfidence(soapNote, extractedMeasures) {
    if (extractedMeasures.length === 0) return 0;

    const avgConfidence =
      extractedMeasures.reduce(
        (sum, measure) => sum + (measure.confidence || 0.5),
        0
      ) / extractedMeasures.length;

    // Adjust based on note completeness and quality
    const completenessScore = this.assessNoteCompleteness(soapNote);
    const qualityScore = this.assessNoteQuality(soapNote);

    return Math.min(1, avgConfidence * completenessScore * qualityScore);
  }

  /**
   * Assess SOAP note completeness
   */
  assessNoteCompleteness(soapNote) {
    const sections = ["subjective", "objective", "assessment", "plan"];
    const presentSections = sections.filter(
      (section) => soapNote[section] && soapNote[section].trim().length > 0
    );

    return presentSections.length / sections.length;
  }

  /**
   * Assess SOAP note quality based on content richness
   */
  assessNoteQuality(soapNote) {
    let qualityScore = 0;
    let sectionCount = 0;

    const sections = ["subjective", "objective", "assessment", "plan"];

    sections.forEach((section) => {
      if (soapNote[section]) {
        const content = soapNote[section];
        const wordCount = content.split(/\s+/).length;

        // Quality based on content length and structure
        let sectionQuality = 0;
        if (wordCount > 50) sectionQuality = 1.0;
        else if (wordCount > 20) sectionQuality = 0.8;
        else if (wordCount > 10) sectionQuality = 0.6;
        else sectionQuality = 0.4;

        // Bonus for clinical terminology
        const clinicalTerms = this.countClinicalTerms(content);
        sectionQuality += Math.min(0.2, clinicalTerms * 0.05);

        qualityScore += sectionQuality;
        sectionCount++;
      }
    });

    return sectionCount > 0 ? Math.min(1, qualityScore / sectionCount) : 0.5;
  }

  /**
   * Count clinical terms in text
   */
  countClinicalTerms(text) {
    const clinicalTerms = [
      "assessment",
      "diagnosis",
      "treatment",
      "intervention",
      "medication",
      "symptoms",
      "vital signs",
      "pain",
      "mobility",
      "function",
      "cognitive",
      "wound",
      "healing",
      "infection",
      "risk",
      "goal",
      "outcome",
      "progress",
    ];

    let count = 0;
    const lowerText = text.toLowerCase();

    clinicalTerms.forEach((term) => {
      const matches = lowerText.match(new RegExp(term, "g"));
      if (matches) count += matches.length;
    });

    return count;
  }

  /**
   * Initialize extraction patterns
   */
  initializeExtractionPatterns() {
    return {
      pain: [
        /pain.*?(\d+)\/10/i,
        /(\d+)\/10.*?pain/i,
        /(no|mild|moderate|severe|excruciating).*?pain/i,
      ],
      improvement: [
        /(improved|better|worse|deteriorating|stable)/i,
        /(increased|decreased|reduced|elevated)/i,
      ],
      function: [
        /(independent|dependent|assistance|help)/i,
        /(ambulating|walking|mobility|transfers)/i,
      ],
    };
  }

  /**
   * Initialize quality keywords
   */
  initializeQualityKeywords() {
    return {
      positive: [
        "improved",
        "better",
        "healing",
        "stable",
        "independent",
        "effective",
        "successful",
        "achieved",
        "met",
        "compliant",
      ],
      negative: [
        "worse",
        "deteriorating",
        "infected",
        "unstable",
        "dependent",
        "ineffective",
        "unsuccessful",
        "unmet",
        "non-compliant",
      ],
      neutral: ["stable", "unchanged", "monitoring", "continue", "maintain"],
    };
  }

  /**
   * Initialize scoring rules
   */
  initializeScoringRules() {
    return {
      minimumConfidence: 0.6,
      defaultScore: 0.5,
      maxExtractionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      requiredSections: ["subjective", "objective", "assessment", "plan"],
    };
  }

  /**
   * Batch extract from multiple SOAP notes
   */
  async batchExtractFromSOAPNotes(userId, noteIds) {
    const results = [];
    const errors = [];

    for (const noteId of noteIds) {
      try {
        const result = await this.extractFromSOAPNote(userId, noteId);
        results.push(result);
      } catch (error) {
        errors.push({
          noteId,
          error: error.message,
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      totalProcessed: noteIds.length,
      successRate: results.length / noteIds.length,
    };
  }
}

module.exports = SOAPDataExtractor;
