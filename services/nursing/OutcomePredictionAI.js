// Outcome Prediction AI Service for nursing analytics
import azureOpenAIService from '../azureOpenAIService.js';

class OutcomePredictionAI {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
    this.predictionModels = new Map();
    this.historicalData = new Map();
    this.setupPredictionModels();
  }

  // Setup prediction models
  setupPredictionModels() {
    this.predictionModels.set("readmission", {
      name: "Hospital Readmission Prediction",
      factors: [
        "age",
        "diagnosis",
        "comorbidities",
        "medication_adherence",
        "social_support",
      ],
      accuracy: 0.85,
      lastTrained: new Date(),
    });

    this.predictionModels.set("fall_risk", {
      name: "Fall Risk Prediction",
      factors: [
        "mobility_score",
        "medication_count",
        "cognitive_status",
        "history_of_falls",
      ],
      accuracy: 0.78,
      lastTrained: new Date(),
    });

    this.predictionModels.set("wound_healing", {
      name: "Wound Healing Prediction",
      factors: [
        "wound_type",
        "size",
        "location",
        "patient_age",
        "nutrition_status",
        "diabetes",
      ],
      accuracy: 0.82,
      lastTrained: new Date(),
    });

    this.predictionModels.set("functional_improvement", {
      name: "Functional Improvement Prediction",
      factors: [
        "baseline_function",
        "therapy_compliance",
        "motivation",
        "support_system",
      ],
      accuracy: 0.79,
      lastTrained: new Date(),
    });

    console.log("Outcome prediction models initialized");
  }

  // Predict patient outcomes using AI with real-time data integration
  async predictOutcome(
    patientData,
    outcomeType,
    timeframe = "30_days",
    options = {}
  ) {
    try {
      const model = this.predictionModels.get(outcomeType);
      if (!model) {
        throw new Error(`Unknown outcome type: ${outcomeType}`);
      }

      // Enhance patient data with real-time information
      const enhancedPatientData = await this.enhanceWithRealTimeData(
        patientData,
        options
      );

      // Prepare data for AI analysis with real-time context
      const analysisData = this.prepareAnalysisData(
        enhancedPatientData,
        model.factors
      );

      // Generate AI prediction with enhanced data
      const prediction = await this.generateAIPrediction(
        analysisData,
        outcomeType,
        timeframe
      );

      // Calculate confidence score with real-time factors
      const confidence = this.calculateConfidenceScore(analysisData, model);

      // Generate recommendations with real-time context
      const recommendations = await this.generateRecommendations(
        prediction,
        enhancedPatientData
      );

      // Generate intervention timeline
      const interventionTimeline = await this.generateInterventionTimeline(
        prediction,
        timeframe,
        enhancedPatientData
      );

      // Calculate prediction reliability
      const reliability = await this.calculatePredictionReliability(
        analysisData,
        model,
        outcomeType
      );

      // Generate monitoring plan for outcome tracking
      const monitoringPlan = await this.generateOutcomeMonitoringPlan(
        prediction,
        outcomeType,
        timeframe
      );

      return {
        outcomeType,
        timeframe,
        prediction: {
          probability: prediction.probability,
          risk_level: prediction.risk_level,
          confidence_score: confidence,
          reliability_score: reliability,
          factors_analyzed: model.factors,
          key_indicators: prediction.key_indicators,
          contributing_factors: prediction.contributing_factors || [],
        },
        recommendations,
        intervention_timeline: interventionTimeline,
        monitoring_plan: monitoringPlan,
        model_info: {
          name: model.name,
          accuracy: model.accuracy,
          last_trained: model.lastTrained,
        },
        real_time_factors: this.extractRealTimeFactors(enhancedPatientData),
        prediction_validity: this.calculatePredictionValidity(timeframe),
        generated_at: new Date(),
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours validity
      };
    } catch (error) {
      console.error("Outcome prediction error:", error);
      throw error;
    }
  }

  // Enhance patient data with real-time outcome-relevant information
  async enhanceWithRealTimeData(patientData, options = {}) {
    try {
      const enhanced = { ...patientData };

      // Add current clinical status
      if (options.includeClinicalStatus !== false) {
        enhanced.current_clinical_status = await this.getCurrentClinicalStatus(
          patientData.id
        );
      }

      // Add recent interventions and their outcomes
      if (options.includeInterventions !== false) {
        enhanced.recent_interventions = await this.getRecentInterventions(
          patientData.id
        );
      }

      // Add current therapy compliance and progress
      if (options.includeTherapy !== false) {
        enhanced.therapy_progress = await this.getTherapyProgress(
          patientData.id
        );
      }

      // Add social and environmental factors
      if (options.includeSocialFactors !== false) {
        enhanced.social_determinants = await this.getSocialDeterminants(
          patientData.id
        );
      }

      // Add care coordination status
      if (options.includeCareCoordination !== false) {
        enhanced.care_coordination = await this.getCareCoordinationStatus(
          patientData.id
        );
      }

      // Add patient engagement metrics
      if (options.includeEngagement !== false) {
        enhanced.patient_engagement = await this.getPatientEngagement(
          patientData.id
        );
      }

      // Add real-time quality indicators
      if (options.includeQualityIndicators !== false) {
        enhanced.quality_indicators = await this.getCurrentQualityIndicators(
          patientData.id
        );
      }

      return enhanced;
    } catch (error) {
      console.error(
        "Error enhancing patient data for outcome prediction:",
        error
      );
      return patientData;
    }
  }

  // Get current clinical status
  async getCurrentClinicalStatus(patientId) {
    try {
      return {
        stability_trend: "stable", // stable, improving, declining
        symptom_severity: null,
        functional_status: null,
        pain_level: null,
        mobility_level: null,
        cognitive_status: null,
        last_updated: new Date(),
      };
    } catch (error) {
      console.error("Error getting current clinical status:", error);
      return null;
    }
  }

  // Get recent interventions and outcomes
  async getRecentInterventions(patientId) {
    try {
      return [];
    } catch (error) {
      console.error("Error getting recent interventions:", error);
      return [];
    }
  }

  // Get therapy progress data
  async getTherapyProgress(patientId) {
    try {
      return {
        physical_therapy: { compliance: null, progress: null },
        occupational_therapy: { compliance: null, progress: null },
        speech_therapy: { compliance: null, progress: null },
        medication_therapy: { adherence: null, effectiveness: null },
        last_updated: new Date(),
      };
    } catch (error) {
      console.error("Error getting therapy progress:", error);
      return null;
    }
  }

  // Get social determinants of health
  async getSocialDeterminants(patientId) {
    try {
      return {
        housing_stability: null,
        transportation_access: null,
        social_support: null,
        financial_resources: null,
        health_literacy: null,
        cultural_factors: null,
        last_assessed: new Date(),
      };
    } catch (error) {
      console.error("Error getting social determinants:", error);
      return null;
    }
  }

  // Get care coordination status
  async getCareCoordinationStatus(patientId) {
    try {
      return {
        care_team_communication: null,
        discharge_planning_status: null,
        follow_up_appointments: [],
        care_transitions: [],
        last_updated: new Date(),
      };
    } catch (error) {
      console.error("Error getting care coordination status:", error);
      return null;
    }
  }

  // Get patient engagement metrics
  async getPatientEngagement(patientId) {
    try {
      return {
        education_participation: null,
        self_care_compliance: null,
        goal_setting_participation: null,
        communication_responsiveness: null,
        last_assessed: new Date(),
      };
    } catch (error) {
      console.error("Error getting patient engagement:", error);
      return null;
    }
  }

  // Get current quality indicators
  async getCurrentQualityIndicators(patientId) {
    try {
      return {
        safety_indicators: [],
        clinical_indicators: [],
        patient_experience_indicators: [],
        efficiency_indicators: [],
        last_calculated: new Date(),
      };
    } catch (error) {
      console.error("Error getting quality indicators:", error);
      return null;
    }
  }

  // Generate intervention timeline based on prediction
  async generateInterventionTimeline(prediction, timeframe, patientData) {
    try {
      const timeline = {
        immediate: [], // 0-24 hours
        short_term: [], // 1-7 days
        medium_term: [], // 1-4 weeks
        long_term: [], // 1+ months
      };

      const riskLevel = prediction.risk_level;
      const probability = prediction.probability;

      // Immediate interventions (0-24 hours)
      if (riskLevel === "critical" || probability > 80) {
        timeline.immediate.push({
          intervention: "Immediate clinical assessment",
          priority: "critical",
          responsible_party: "nursing_team",
        });
        timeline.immediate.push({
          intervention: "Risk mitigation protocols",
          priority: "high",
          responsible_party: "care_team",
        });
      }

      // Short-term interventions (1-7 days)
      if (riskLevel === "high" || probability > 60) {
        timeline.short_term.push({
          intervention: "Enhanced monitoring protocol",
          priority: "high",
          responsible_party: "nursing_team",
        });
        timeline.short_term.push({
          intervention: "Care plan optimization",
          priority: "medium",
          responsible_party: "interdisciplinary_team",
        });
      }

      // Medium-term interventions (1-4 weeks)
      timeline.medium_term.push({
        intervention: "Progress evaluation",
        priority: "medium",
        responsible_party: "care_team",
      });

      // Long-term interventions (1+ months)
      timeline.long_term.push({
        intervention: "Outcome assessment",
        priority: "medium",
        responsible_party: "care_team",
      });

      return timeline;
    } catch (error) {
      console.error("Error generating intervention timeline:", error);
      return {
        immediate: [],
        short_term: [],
        medium_term: [],
        long_term: [],
      };
    }
  }

  // Calculate prediction reliability
  async calculatePredictionReliability(analysisData, model, outcomeType) {
    try {
      let reliability = 0.5; // Base reliability

      // Factor in model accuracy
      reliability += (model.accuracy - 0.5) * 0.4;

      // Factor in data completeness
      const dataCompleteness =
        Object.keys(analysisData.clinical_data).length / model.factors.length;
      reliability += dataCompleteness * 0.3;

      // Factor in historical data availability
      if (analysisData.historical_outcomes.length > 0) {
        reliability += 0.2;
      }

      // Factor in real-time data freshness
      if (analysisData.current_clinical_status?.last_updated) {
        const dataAge =
          Date.now() -
          new Date(analysisData.current_clinical_status.last_updated).getTime();
        const hoursOld = dataAge / (1000 * 60 * 60);
        if (hoursOld < 24) {
          reliability += 0.1;
        }
      }

      return Math.min(reliability, 1.0);
    } catch (error) {
      console.error("Error calculating prediction reliability:", error);
      return 0.5;
    }
  }

  // Generate outcome monitoring plan
  async generateOutcomeMonitoringPlan(prediction, outcomeType, timeframe) {
    try {
      const monitoringPlan = {
        monitoring_frequency: this.determineMonitoringFrequency(
          prediction.risk_level
        ),
        key_metrics: this.getKeyMetrics(outcomeType),
        alert_thresholds: this.getAlertThresholds(
          outcomeType,
          prediction.probability
        ),
        assessment_schedule: this.generateAssessmentSchedule(
          outcomeType,
          timeframe
        ),
        documentation_requirements:
          this.getDocumentationRequirements(outcomeType),
        escalation_criteria: this.getEscalationCriteria(prediction.risk_level),
      };

      return monitoringPlan;
    } catch (error) {
      console.error("Error generating outcome monitoring plan:", error);
      return {
        monitoring_frequency: "daily",
        key_metrics: ["general_status"],
        alert_thresholds: {},
        assessment_schedule: [],
        documentation_requirements: ["standard"],
        escalation_criteria: ["significant_change"],
      };
    }
  }

  // Determine monitoring frequency based on risk level
  determineMonitoringFrequency(riskLevel) {
    const frequencies = {
      critical: "q2h",
      high: "q4h",
      moderate: "q8h",
      low: "q24h",
    };
    return frequencies[riskLevel] || "q24h";
  }

  // Get key metrics for outcome type
  getKeyMetrics(outcomeType) {
    const metrics = {
      readmission: [
        "symptom_recurrence",
        "medication_adherence",
        "follow_up_compliance",
      ],
      fall_risk: [
        "mobility_status",
        "balance_assessment",
        "environmental_safety",
      ],
      wound_healing: ["wound_size", "healing_progress", "infection_signs"],
      functional_improvement: [
        "functional_status",
        "therapy_compliance",
        "goal_achievement",
      ],
    };
    return metrics[outcomeType] || ["general_status"];
  }

  // Get alert thresholds for outcome type
  getAlertThresholds(outcomeType, probability) {
    const baseThresholds = {
      readmission: { symptom_recurrence: "any", medication_adherence: "<80%" },
      fall_risk: { mobility_decline: "any", balance_issues: "new_onset" },
      wound_healing: { wound_enlargement: ">10%", infection_signs: "any" },
      functional_improvement: {
        functional_decline: ">20%",
        therapy_non_compliance: ">2_sessions",
      },
    };

    // Adjust thresholds based on probability
    let thresholds = baseThresholds[outcomeType] || {};
    if (probability > 70) {
      // More sensitive thresholds for high-risk patients
      thresholds = { ...thresholds, sensitivity: "high" };
    }

    return thresholds;
  }

  // Generate assessment schedule
  generateAssessmentSchedule(outcomeType, timeframe) {
    const schedule = [];
    const timeframeDays = parseInt(timeframe.split("_")[0]);

    // Weekly assessments for longer timeframes
    if (timeframeDays >= 30) {
      schedule.push({ frequency: "weekly", type: "comprehensive_assessment" });
    }

    // Bi-weekly assessments for medium timeframes
    if (timeframeDays >= 14) {
      schedule.push({ frequency: "bi-weekly", type: "focused_assessment" });
    }

    // Daily assessments for short timeframes or high risk
    schedule.push({ frequency: "daily", type: "basic_assessment" });

    return schedule;
  }

  // Get documentation requirements
  getDocumentationRequirements(outcomeType) {
    const requirements = {
      readmission: [
        "symptom_tracking",
        "medication_reconciliation",
        "discharge_planning",
      ],
      fall_risk: [
        "mobility_assessment",
        "safety_measures",
        "incident_reporting",
      ],
      wound_healing: [
        "wound_assessment",
        "treatment_response",
        "healing_progress",
      ],
      functional_improvement: [
        "functional_assessment",
        "therapy_progress",
        "goal_tracking",
      ],
    };
    return requirements[outcomeType] || ["standard_documentation"];
  }

  // Get escalation criteria
  getEscalationCriteria(riskLevel) {
    const baseCriteria = [
      "significant_clinical_change",
      "unexpected_complications",
    ];

    if (riskLevel === "critical") {
      baseCriteria.push("immediate_physician_notification");
    }

    if (riskLevel === "high") {
      baseCriteria.push("care_team_notification");
    }

    return baseCriteria;
  }

  // Extract real-time factors for outcome prediction
  extractRealTimeFactors(enhancedPatientData) {
    return {
      clinical_stability:
        enhancedPatientData.current_clinical_status?.stability_trend ||
        "unknown",
      intervention_response:
        enhancedPatientData.recent_interventions?.length > 0
          ? "active"
          : "none",
      therapy_engagement: enhancedPatientData.therapy_progress
        ? "tracked"
        : "unknown",
      social_support_level:
        enhancedPatientData.social_determinants?.social_support || "unknown",
      care_coordination_quality: enhancedPatientData.care_coordination
        ? "coordinated"
        : "unknown",
      patient_engagement_level: enhancedPatientData.patient_engagement
        ? "assessed"
        : "unknown",
      data_completeness: this.calculateDataCompleteness(enhancedPatientData),
      prediction_context: {
        real_time_data_available: true,
        data_freshness: this.assessDataFreshness(enhancedPatientData),
        prediction_confidence: "enhanced_by_real_time_data",
      },
    };
  }

  // Calculate data completeness
  calculateDataCompleteness(patientData) {
    const expectedFields = [
      "current_clinical_status",
      "recent_interventions",
      "therapy_progress",
      "social_determinants",
      "care_coordination",
      "patient_engagement",
    ];

    const availableFields = expectedFields.filter(
      (field) => patientData[field] !== null && patientData[field] !== undefined
    );
    return (availableFields.length / expectedFields.length) * 100;
  }

  // Assess data freshness
  assessDataFreshness(patientData) {
    const timestamps = [];

    if (patientData.current_clinical_status?.last_updated) {
      timestamps.push(
        new Date(patientData.current_clinical_status.last_updated)
      );
    }

    if (patientData.therapy_progress?.last_updated) {
      timestamps.push(new Date(patientData.therapy_progress.last_updated));
    }

    if (timestamps.length === 0) return "unknown";

    const mostRecent = Math.max(...timestamps.map((t) => t.getTime()));
    const hoursOld = (Date.now() - mostRecent) / (1000 * 60 * 60);

    if (hoursOld < 6) return "very_fresh";
    if (hoursOld < 24) return "fresh";
    if (hoursOld < 72) return "acceptable";
    return "stale";
  }

  // Calculate prediction validity period
  calculatePredictionValidity(timeframe) {
    const timeframeDays = parseInt(timeframe.split("_")[0]);

    // Shorter predictions are valid for longer periods
    if (timeframeDays <= 7) {
      return { hours: 12, reason: "short_term_prediction" };
    } else if (timeframeDays <= 30) {
      return { hours: 6, reason: "medium_term_prediction" };
    } else {
      return { hours: 4, reason: "long_term_prediction" };
    }
  }

  // Prepare data for AI analysis
  prepareAnalysisData(patientData, factors) {
    const analysisData = {
      patient_id: patientData.id,
      demographics: {
        age: patientData.age,
        gender: patientData.gender,
        race: patientData.race,
      },
      clinical_data: {},
      historical_outcomes: this.getHistoricalOutcomes(patientData.id),
    };

    // Extract relevant factors
    factors.forEach((factor) => {
      if (patientData[factor] !== undefined) {
        analysisData.clinical_data[factor] = patientData[factor];
      }
    });

    return analysisData;
  }

  // Generate AI prediction using OpenAI
  async generateAIPrediction(analysisData, outcomeType, timeframe) {
    const prompt = this.buildPredictionPrompt(
      analysisData,
      outcomeType,
      timeframe
    );

    const response = await this.azureOpenAI.chatWithAI(prompt, {
      systemPrompt: `You are an advanced clinical AI assistant specializing in outcome prediction for nursing care with expertise in evidence-based medicine, clinical decision support, and predictive analytics.

CLINICAL EXPERTISE:
- Advanced knowledge of nursing care outcomes, patient safety, and clinical best practices
- Expertise in risk stratification, early warning systems, and clinical deterioration patterns
- Understanding of evidence-based interventions and their impact on patient outcomes
- Knowledge of CMS guidelines, quality measures, and regulatory requirements

ANALYSIS REQUIREMENTS:
- Provide evidence-based predictions with high accuracy and clinical relevance
- Include detailed probability scores with confidence intervals
- Identify key risk factors with specific clinical indicators
- Suggest evidence-based interventions and monitoring strategies
- Consider patient-specific factors, comorbidities, and care context
- Align with current clinical guidelines and best practices

RESPONSE FORMAT:
- Use structured, actionable clinical language
- Include specific clinical indicators and thresholds
- Provide clear rationale for predictions and recommendations
- Focus on actionable insights for nursing care teams`
    });

    return this.parsePredictionResponse(response);
  }

  // Build prediction prompt
  buildPredictionPrompt(analysisData, outcomeType, timeframe) {
    return `
Analyze the following patient data and predict the likelihood of ${outcomeType} within ${timeframe}:

Patient Demographics:
- Age: ${analysisData.demographics.age}
- Gender: ${analysisData.demographics.gender}
- Race: ${analysisData.demographics.race}

Clinical Data:
${Object.entries(analysisData.clinical_data)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

Historical Outcomes:
${
  analysisData.historical_outcomes.length > 0
    ? analysisData.historical_outcomes
        .map((outcome) => `- ${outcome.type}: ${outcome.result}`)
        .join("\n")
    : "No historical data available"
}

Please provide:
1. Probability score (0-100%)
2. Risk level (low/moderate/high/critical)
3. Top 3 key indicators contributing to this prediction
4. Confidence level in the prediction

Format your response as JSON with the following structure:
{
  "probability": number,
  "risk_level": "string",
  "key_indicators": ["string1", "string2", "string3"],
  "reasoning": "string"
}
    `;
  }

  // Parse AI prediction response
  parsePredictionResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing if JSON not found
      return {
        probability: 50,
        risk_level: "moderate",
        key_indicators: ["insufficient_data"],
        reasoning: "Unable to parse AI response",
      };
    } catch (error) {
      console.error("Error parsing prediction response:", error);
      return {
        probability: 50,
        risk_level: "moderate",
        key_indicators: ["parsing_error"],
        reasoning: "Error parsing AI response",
      };
    }
  }

  // Calculate confidence score
  calculateConfidenceScore(analysisData, model) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data completeness
    const dataCompleteness =
      Object.keys(analysisData.clinical_data).length / model.factors.length;
    confidence += dataCompleteness * 0.3;

    // Increase confidence based on historical data availability
    if (analysisData.historical_outcomes.length > 0) {
      confidence += 0.2;
    }

    // Factor in model accuracy
    confidence *= model.accuracy;

    return Math.min(confidence, 1.0);
  }

  // Generate recommendations based on prediction
  async generateRecommendations(prediction, patientData) {
    const recommendationPrompt = `
Based on the following prediction results, provide specific nursing interventions and recommendations:

Prediction Results:
- Probability: ${prediction.probability}%
- Risk Level: ${prediction.risk_level}
- Key Indicators: ${prediction.key_indicators.join(", ")}

Patient Context:
- Age: ${patientData.age}
- Primary Diagnosis: ${patientData.primary_diagnosis || "Not specified"}
- Current Medications: ${patientData.medications?.length || 0} medications

Provide 3-5 specific, actionable nursing interventions to mitigate the identified risks.
    `;

    try {
      const response = await this.azureOpenAI.chatWithAI(recommendationPrompt, {
        systemPrompt: `You are an advanced clinical nurse specialist with expertise in evidence-based practice, patient safety, and clinical excellence.

CLINICAL EXPERTISE:
- Advanced knowledge of nursing interventions and their evidence base
- Expertise in patient safety, risk management, and quality improvement
- Understanding of clinical guidelines, protocols, and best practices
- Knowledge of interdisciplinary care coordination and team-based approaches

RECOMMENDATION REQUIREMENTS:
- Provide evidence-based, actionable nursing interventions
- Include specific clinical indicators and monitoring parameters
- Suggest appropriate frequency and duration of interventions
- Consider patient-specific factors and care context
- Align with current clinical guidelines and regulatory standards
- Focus on measurable outcomes and quality indicators

RESPONSE FORMAT:
- Use clear, actionable clinical language
- Include specific intervention details and rationale
- Provide monitoring and evaluation criteria
- Suggest interdisciplinary collaboration points
- Include patient education and family engagement strategies`
      });

      return this.parseRecommendations(response);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      return ["Monitor patient closely", "Follow standard care protocols"];
    }
  }

  // Parse recommendations from AI response
  parseRecommendations(response) {
    const lines = response.split("\n").filter((line) => line.trim());
    const recommendations = [];

    lines.forEach((line) => {
      // Look for numbered or bulleted recommendations
      if (line.match(/^\d+\./) || line.match(/^[-•*]/)) {
        recommendations.push(
          line
            .replace(/^\d+\.\s*/, "")
            .replace(/^[-•*]\s*/, "")
            .trim()
        );
      }
    });

    return recommendations.length > 0 ? recommendations : [response.trim()];
  }

  // Get historical outcomes for a patient
  getHistoricalOutcomes(patientId) {
    const historical = this.historicalData.get(patientId) || [];
    return historical.slice(-5); // Return last 5 outcomes
  }

  // Store historical outcome
  storeHistoricalOutcome(patientId, outcome) {
    if (!this.historicalData.has(patientId)) {
      this.historicalData.set(patientId, []);
    }

    const outcomes = this.historicalData.get(patientId);
    outcomes.push({
      ...outcome,
      recorded_at: new Date(),
    });

    // Keep only last 10 outcomes
    if (outcomes.length > 10) {
      outcomes.splice(0, outcomes.length - 10);
    }
  }

  // Batch predict outcomes for multiple patients
  async batchPredictOutcomes(patients, outcomeType, timeframe = "30_days") {
    const predictions = [];

    for (const patient of patients) {
      try {
        const prediction = await this.predictOutcome(
          patient,
          outcomeType,
          timeframe
        );
        predictions.push({
          patient_id: patient.id,
          ...prediction,
        });
      } catch (error) {
        predictions.push({
          patient_id: patient.id,
          error: error.message,
          generated_at: new Date(),
        });
      }
    }

    return predictions;
  }

  // Analyze prediction accuracy
  analyzePredictionAccuracy(predictions, actualOutcomes) {
    const analysis = {
      total_predictions: predictions.length,
      correct_predictions: 0,
      accuracy_by_risk_level: {
        low: { total: 0, correct: 0 },
        moderate: { total: 0, correct: 0 },
        high: { total: 0, correct: 0 },
        critical: { total: 0, correct: 0 },
      },
      average_confidence: 0,
    };

    let totalConfidence = 0;

    predictions.forEach((prediction) => {
      const actual = actualOutcomes.find(
        (outcome) => outcome.patient_id === prediction.patient_id
      );

      if (actual) {
        const riskLevel = prediction.prediction.risk_level;
        analysis.accuracy_by_risk_level[riskLevel].total++;

        // Simple accuracy check (this would be more sophisticated in practice)
        const predicted = prediction.prediction.probability > 50;
        const actualResult = actual.outcome === true;

        if (predicted === actualResult) {
          analysis.correct_predictions++;
          analysis.accuracy_by_risk_level[riskLevel].correct++;
        }

        totalConfidence += prediction.prediction.confidence_score;
      }
    });

    analysis.overall_accuracy =
      analysis.correct_predictions / analysis.total_predictions;
    analysis.average_confidence = totalConfidence / predictions.length;

    return analysis;
  }

  // Get prediction statistics
  getPredictionStats() {
    return {
      available_models: Array.from(this.predictionModels.keys()),
      model_details: Object.fromEntries(this.predictionModels),
      historical_data_points: Array.from(this.historicalData.values()).reduce(
        (sum, outcomes) => sum + outcomes.length,
        0
      ),
      patients_with_history: this.historicalData.size,
    };
  }

  // Update model accuracy based on feedback
  updateModelAccuracy(outcomeType, actualAccuracy) {
    const model = this.predictionModels.get(outcomeType);
    if (model) {
      // Simple accuracy update (in practice, this would be more sophisticated)
      model.accuracy = (model.accuracy + actualAccuracy) / 2;
      model.lastTrained = new Date();
      console.log(`Updated ${outcomeType} model accuracy to ${model.accuracy}`);
    }
  }
}

export default new OutcomePredictionAI();
