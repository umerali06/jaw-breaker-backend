// Risk Stratification AI Service for nursing care
import azureOpenAIService from '../azureOpenAIService.js';

class RiskStratificationAI {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
    this.riskModels = new Map();
    this.riskThresholds = new Map();
    this.setupRiskModels();
  }

  // Setup risk stratification models
  setupRiskModels() {
    // Fall Risk Model
    this.riskModels.set("fall_risk", {
      name: "Fall Risk Assessment",
      factors: [
        "age",
        "mobility_score",
        "cognitive_status",
        "medication_count",
        "history_of_falls",
        "vision_impairment",
        "balance_issues",
      ],
      weights: {
        age: 0.15,
        mobility_score: 0.25,
        cognitive_status: 0.2,
        medication_count: 0.15,
        history_of_falls: 0.25,
      },
      thresholds: { low: 20, moderate: 40, high: 70, critical: 85 },
    });

    // Pressure Ulcer Risk Model
    this.riskModels.set("pressure_ulcer", {
      name: "Pressure Ulcer Risk (Braden Scale Enhanced)",
      factors: [
        "mobility",
        "activity",
        "sensory_perception",
        "moisture",
        "nutrition",
        "friction_shear",
        "age",
        "comorbidities",
      ],
      weights: {
        mobility: 0.2,
        activity: 0.15,
        sensory_perception: 0.15,
        moisture: 0.1,
        nutrition: 0.2,
        friction_shear: 0.2,
      },
      thresholds: { low: 18, moderate: 15, high: 12, critical: 9 },
    });

    // Infection Risk Model
    this.riskModels.set("infection_risk", {
      name: "Healthcare-Associated Infection Risk",
      factors: [
        "immune_status",
        "invasive_devices",
        "antibiotic_use",
        "length_of_stay",
        "comorbidities",
        "age",
        "nutritional_status",
      ],
      weights: {
        immune_status: 0.25,
        invasive_devices: 0.2,
        antibiotic_use: 0.15,
        length_of_stay: 0.15,
        comorbidities: 0.25,
      },
      thresholds: { low: 25, moderate: 50, high: 75, critical: 90 },
    });

    // Medication Error Risk Model
    this.riskModels.set("medication_error", {
      name: "Medication Error Risk Assessment",
      factors: [
        "medication_count",
        "high_risk_medications",
        "cognitive_status",
        "vision_hearing",
        "medication_adherence",
        "polypharmacy",
      ],
      weights: {
        medication_count: 0.2,
        high_risk_medications: 0.3,
        cognitive_status: 0.2,
        medication_adherence: 0.3,
      },
      thresholds: { low: 30, moderate: 50, high: 70, critical: 85 },
    });

    // Readmission Risk Model
    this.riskModels.set("readmission_risk", {
      name: "30-Day Readmission Risk",
      factors: [
        "primary_diagnosis",
        "comorbidity_count",
        "previous_admissions",
        "discharge_disposition",
        "social_support",
        "medication_complexity",
      ],
      weights: {
        primary_diagnosis: 0.25,
        comorbidity_count: 0.2,
        previous_admissions: 0.2,
        social_support: 0.2,
        medication_complexity: 0.15,
      },
      thresholds: { low: 20, moderate: 40, high: 65, critical: 80 },
    });

    console.log("Risk stratification models initialized");
  }

  // Perform comprehensive risk stratification with real-time data
  async performRiskStratification(patientData, riskTypes = null, options = {}) {
    try {
      // Enhance patient data with real-time information
      const enhancedPatientData = await this.enhanceWithRealTimeData(
        patientData,
        options
      );

      const typesToAssess = riskTypes || Array.from(this.riskModels.keys());
      const riskAssessments = {};

      // Perform parallel risk assessments for efficiency
      const assessmentPromises = typesToAssess.map(async (riskType) => {
        const assessment = await this.assessRisk(enhancedPatientData, riskType);
        return { riskType, assessment };
      });

      const assessmentResults = await Promise.all(assessmentPromises);
      assessmentResults.forEach(({ riskType, assessment }) => {
        riskAssessments[riskType] = assessment;
      });

      // Generate overall risk profile with real-time factors
      const overallProfile = this.generateOverallRiskProfile(
        riskAssessments,
        enhancedPatientData
      );

      // Generate AI-powered insights with real-time context
      const aiInsights = await this.generateAIInsights(
        enhancedPatientData,
        riskAssessments
      );

      // Generate real-time monitoring recommendations
      const monitoringRecommendations =
        await this.generateMonitoringRecommendations(
          riskAssessments,
          enhancedPatientData
        );

      // Calculate risk trends if historical data available
      const riskTrends = await this.calculateRiskTrends(
        patientData.id,
        riskAssessments
      );

      return {
        patient_id: patientData.id,
        assessment_date: new Date(),
        individual_risks: riskAssessments,
        overall_profile: overallProfile,
        ai_insights: aiInsights,
        recommendations: await this.generateRiskRecommendations(
          riskAssessments,
          enhancedPatientData
        ),
        monitoring_recommendations: monitoringRecommendations,
        risk_trends: riskTrends,
        real_time_factors: this.extractRealTimeRiskFactors(enhancedPatientData),
        next_assessment_due: this.calculateNextAssessmentDate(riskAssessments),
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours validity
      };
    } catch (error) {
      console.error("Risk stratification error:", error);
      throw error;
    }
  }

  // Enhance patient data with real-time risk-relevant information
  async enhanceWithRealTimeData(patientData, options = {}) {
    try {
      const enhanced = { ...patientData };

      // Add current vital signs for physiological risk assessment
      if (options.includeVitals !== false) {
        enhanced.current_vitals = await this.getCurrentVitals(patientData.id);
      }

      // Add recent mobility assessments
      if (options.includeMobility !== false) {
        enhanced.mobility_data = await this.getMobilityData(patientData.id);
      }

      // Add current medication effects on risk
      if (options.includeMedications !== false) {
        enhanced.medication_risk_factors = await this.getMedicationRiskFactors(
          patientData.id
        );
      }

      // Add environmental risk factors
      if (options.includeEnvironmental !== false) {
        enhanced.environmental_risks = await this.getEnvironmentalRiskFactors(
          patientData.id
        );
      }

      // Add recent incidents or near-misses
      if (options.includeIncidents !== false) {
        enhanced.recent_incidents = await this.getRecentIncidents(
          patientData.id
        );
      }

      // Add care team risk assessments
      if (options.includeCareTeam !== false) {
        enhanced.care_team_risk_input = await this.getCareTeamRiskInput(
          patientData.id
        );
      }

      return enhanced;
    } catch (error) {
      console.error("Error enhancing patient data for risk assessment:", error);
      return patientData;
    }
  }

  // Get current vital signs for risk assessment
  async getCurrentVitals(patientId) {
    try {
      // This would integrate with real-time monitoring systems
      return {
        blood_pressure: { systolic: null, diastolic: null },
        heart_rate: null,
        temperature: null,
        respiratory_rate: null,
        oxygen_saturation: null,
        orthostatic_changes: null,
        last_updated: new Date(),
        stability_trend: "stable", // stable, improving, declining
      };
    } catch (error) {
      console.error("Error getting current vitals for risk assessment:", error);
      return null;
    }
  }

  // Get mobility data for fall risk assessment
  async getMobilityData(patientId) {
    try {
      return {
        mobility_score: null,
        gait_stability: null,
        balance_assessment: null,
        assistive_devices: [],
        mobility_restrictions: [],
        recent_falls: [],
        last_assessed: new Date(),
      };
    } catch (error) {
      console.error("Error getting mobility data:", error);
      return null;
    }
  }

  // Get medication-related risk factors
  async getMedicationRiskFactors(patientId) {
    try {
      return {
        high_risk_medications: [],
        sedating_medications: [],
        orthostatic_medications: [],
        anticoagulants: [],
        medication_changes_24h: [],
        adherence_issues: [],
        last_updated: new Date(),
      };
    } catch (error) {
      console.error("Error getting medication risk factors:", error);
      return null;
    }
  }

  // Get environmental risk factors
  async getEnvironmentalRiskFactors(patientId) {
    try {
      return {
        room_hazards: [],
        lighting_adequate: true,
        floor_conditions: "dry",
        bed_height: "appropriate",
        call_light_accessible: true,
        bathroom_safety: "adequate",
        last_assessed: new Date(),
      };
    } catch (error) {
      console.error("Error getting environmental risk factors:", error);
      return null;
    }
  }

  // Get recent incidents or near-misses
  async getRecentIncidents(patientId) {
    try {
      return [];
    } catch (error) {
      console.error("Error getting recent incidents:", error);
      return [];
    }
  }

  // Get care team risk input
  async getCareTeamRiskInput(patientId) {
    try {
      return {
        nurse_concerns: [],
        physician_risk_notes: [],
        therapy_risk_assessment: null,
        family_concerns: [],
        last_updated: new Date(),
      };
    } catch (error) {
      console.error("Error getting care team risk input:", error);
      return null;
    }
  }

  // Generate monitoring recommendations based on risk levels
  async generateMonitoringRecommendations(riskAssessments, patientData) {
    try {
      const recommendations = {
        immediate_actions: [],
        ongoing_monitoring: [],
        reassessment_schedule: {},
        alert_criteria: {},
      };

      Object.entries(riskAssessments).forEach(([riskType, assessment]) => {
        const riskLevel = assessment.risk_level;

        switch (riskLevel) {
          case "critical":
            recommendations.immediate_actions.push({
              risk_type: riskType,
              action: this.getCriticalRiskActions(riskType),
              timeframe: "immediate",
            });
            recommendations.reassessment_schedule[riskType] = "q2h";
            break;

          case "high":
            recommendations.ongoing_monitoring.push({
              risk_type: riskType,
              monitoring: this.getHighRiskMonitoring(riskType),
              frequency: "q4h",
            });
            recommendations.reassessment_schedule[riskType] = "q8h";
            break;

          case "moderate":
            recommendations.ongoing_monitoring.push({
              risk_type: riskType,
              monitoring: this.getModerateRiskMonitoring(riskType),
              frequency: "q8h",
            });
            recommendations.reassessment_schedule[riskType] = "q24h";
            break;

          default:
            recommendations.reassessment_schedule[riskType] = "q48h";
        }

        // Set alert criteria
        recommendations.alert_criteria[riskType] = this.getAlertCriteria(
          riskType,
          riskLevel
        );
      });

      return recommendations;
    } catch (error) {
      console.error("Error generating monitoring recommendations:", error);
      return {
        immediate_actions: [],
        ongoing_monitoring: [],
        reassessment_schedule: {},
        alert_criteria: {},
      };
    }
  }

  // Get critical risk actions
  getCriticalRiskActions(riskType) {
    const actions = {
      fall_risk: [
        "Implement maximum fall precautions",
        "Consider 1:1 observation",
        "Bed alarm activation",
      ],
      pressure_ulcer: [
        "Immediate pressure relief",
        "Wound care consultation",
        "Nutrition assessment",
      ],
      infection_risk: [
        "Isolation precautions",
        "Infection control measures",
        "Physician notification",
      ],
      medication_error: [
        "Medication reconciliation",
        "Pharmacy consultation",
        "Double verification",
      ],
      readmission_risk: [
        "Discharge planning review",
        "Case management referral",
        "Family education",
      ],
    };

    return actions[riskType] || ["Standard critical risk protocols"];
  }

  // Get high risk monitoring requirements
  getHighRiskMonitoring(riskType) {
    const monitoring = {
      fall_risk: [
        "Frequent rounding",
        "Mobility assessment",
        "Environmental safety checks",
      ],
      pressure_ulcer: [
        "Skin integrity checks",
        "Repositioning schedule",
        "Nutrition monitoring",
      ],
      infection_risk: [
        "Vital signs monitoring",
        "Symptom assessment",
        "Lab value tracking",
      ],
      medication_error: [
        "Medication administration verification",
        "Side effect monitoring",
      ],
      readmission_risk: [
        "Symptom monitoring",
        "Compliance assessment",
        "Support system evaluation",
      ],
    };

    return monitoring[riskType] || ["Standard high risk monitoring"];
  }

  // Get moderate risk monitoring requirements
  getModerateRiskMonitoring(riskType) {
    const monitoring = {
      fall_risk: ["Regular safety rounds", "Mobility encouragement"],
      pressure_ulcer: ["Daily skin checks", "Position changes"],
      infection_risk: ["Routine vital signs", "Hygiene maintenance"],
      medication_error: ["Standard medication protocols"],
      readmission_risk: ["Education reinforcement", "Discharge preparation"],
    };

    return monitoring[riskType] || ["Standard moderate risk monitoring"];
  }

  // Get alert criteria for risk type and level
  getAlertCriteria(riskType, riskLevel) {
    const baseCriteria = {
      fall_risk: [
        "Unsteady gait observed",
        "Confusion or disorientation",
        "Orthostatic hypotension",
      ],
      pressure_ulcer: [
        "Skin breakdown noted",
        "Prolonged pressure",
        "Nutritional decline",
      ],
      infection_risk: ["Temperature elevation", "WBC changes", "New symptoms"],
      medication_error: [
        "Medication discrepancy",
        "Adverse reaction",
        "Missed doses",
      ],
      readmission_risk: [
        "Symptom recurrence",
        "Non-compliance",
        "Social issues",
      ],
    };

    let criteria = baseCriteria[riskType] || ["Condition changes"];

    if (riskLevel === "critical") {
      criteria = criteria.map((c) => `CRITICAL: ${c}`);
    }

    return criteria;
  }

  // Calculate risk trends over time
  async calculateRiskTrends(patientId, currentAssessments) {
    try {
      // This would query historical risk assessments
      const historicalAssessments = await this.getHistoricalRiskAssessments(
        patientId
      );

      if (historicalAssessments.length === 0) {
        return {
          trend_available: false,
          message: "Insufficient historical data for trend analysis",
        };
      }

      const trends = {};

      Object.keys(currentAssessments).forEach((riskType) => {
        const historical = historicalAssessments
          .filter((h) => h.individual_risks[riskType])
          .map((h) => ({
            date: h.assessment_date,
            score: h.individual_risks[riskType].ai_enhanced_score,
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (historical.length >= 2) {
          const currentScore = currentAssessments[riskType].ai_enhanced_score;
          const previousScore = historical[historical.length - 1].score;
          const change = currentScore - previousScore;

          trends[riskType] = {
            current_score: currentScore,
            previous_score: previousScore,
            change: change,
            trend:
              change > 5 ? "increasing" : change < -5 ? "decreasing" : "stable",
            data_points: historical.length,
          };
        }
      });

      return {
        trend_available: true,
        trends,
        analysis_date: new Date(),
      };
    } catch (error) {
      console.error("Error calculating risk trends:", error);
      return {
        trend_available: false,
        error: error.message,
      };
    }
  }

  // Get historical risk assessments
  async getHistoricalRiskAssessments(patientId) {
    try {
      // This would query the database for historical assessments
      return [];
    } catch (error) {
      console.error("Error getting historical risk assessments:", error);
      return [];
    }
  }

  // Extract real-time risk factors
  extractRealTimeRiskFactors(enhancedPatientData) {
    return {
      vital_signs_stability:
        enhancedPatientData.current_vitals?.stability_trend || "unknown",
      mobility_status:
        enhancedPatientData.mobility_data?.mobility_score || "unknown",
      medication_changes:
        enhancedPatientData.medication_risk_factors?.medication_changes_24h
          ?.length || 0,
      environmental_safety:
        enhancedPatientData.environmental_risks?.room_hazards?.length === 0,
      care_team_concerns:
        enhancedPatientData.care_team_risk_input?.nurse_concerns?.length || 0,
      recent_incidents: enhancedPatientData.recent_incidents?.length || 0,
      data_freshness: {
        vitals_age: enhancedPatientData.current_vitals?.last_updated
          ? Date.now() -
            new Date(enhancedPatientData.current_vitals.last_updated).getTime()
          : null,
        mobility_age: enhancedPatientData.mobility_data?.last_assessed
          ? Date.now() -
            new Date(enhancedPatientData.mobility_data.last_assessed).getTime()
          : null,
      },
    };
  }

  // Calculate next assessment date based on risk levels
  calculateNextAssessmentDate(riskAssessments) {
    const riskLevels = Object.values(riskAssessments).map((a) => a.risk_level);

    if (riskLevels.includes("critical")) {
      return new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    } else if (riskLevels.includes("high")) {
      return new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    } else if (riskLevels.includes("moderate")) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    } else {
      return new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    }
  }

  // Assess specific risk type
  async assessRisk(patientData, riskType) {
    const model = this.riskModels.get(riskType);
    if (!model) {
      throw new Error(`Unknown risk type: ${riskType}`);
    }

    // Calculate base risk score
    const baseScore = this.calculateBaseRiskScore(patientData, model);

    // Apply AI enhancement
    const aiEnhancedScore = await this.enhanceWithAI(
      patientData,
      riskType,
      baseScore
    );

    // Determine risk level
    const riskLevel = this.determineRiskLevel(
      aiEnhancedScore,
      model.thresholds
    );

    // Identify key risk factors
    const keyFactors = this.identifyKeyRiskFactors(patientData, model);

    return {
      risk_type: riskType,
      model_name: model.name,
      base_score: baseScore,
      ai_enhanced_score: aiEnhancedScore,
      risk_level: riskLevel,
      key_factors: keyFactors,
      factors_analyzed: model.factors,
      assessment_confidence: this.calculateConfidence(patientData, model),
      assessed_at: new Date(),
    };
  }

  // Calculate base risk score using model weights
  calculateBaseRiskScore(patientData, model) {
    let totalScore = 0;
    let totalWeight = 0;

    model.factors.forEach((factor) => {
      const value = this.extractFactorValue(patientData, factor);
      const weight = model.weights[factor] || 1 / model.factors.length;

      if (value !== null) {
        totalScore += value * weight * 100;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? totalScore / totalWeight : 50; // Default to moderate risk
  }

  // Extract factor value from patient data
  extractFactorValue(patientData, factor) {
    // Map patient data fields to risk factors
    const fieldMapping = {
      age: (data) => Math.min(data.age / 100, 1), // Normalize age
      mobility_score: (data) => data.mobility_score / 100,
      cognitive_status: (data) => data.cognitive_assessment?.score / 100,
      medication_count: (data) => Math.min(data.medications?.length / 20, 1),
      history_of_falls: (data) => (data.fall_history ? 1 : 0),
      comorbidities: (data) => Math.min(data.comorbidities?.length / 10, 1),
      immune_status: (data) => (data.immune_compromised ? 1 : 0.2),
      invasive_devices: (data) => data.devices?.length / 5,
      length_of_stay: (data) => Math.min(data.length_of_stay / 30, 1),
    };

    const mapper = fieldMapping[factor];
    if (mapper && patientData) {
      try {
        return mapper(patientData);
      } catch (error) {
        console.warn(`Error extracting factor ${factor}:`, error);
        return null;
      }
    }

    // Direct field access as fallback
    return patientData[factor] !== undefined ? patientData[factor] : null;
  }

  // Enhance risk score with AI analysis
  async enhanceWithAI(patientData, riskType, baseScore) {
    try {
      const prompt = this.buildAIEnhancementPrompt(
        patientData,
        riskType,
        baseScore
      );

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical risk assessment AI. Analyze patient data and provide risk score adjustments based on clinical expertise.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const aiAnalysis = this.parseAIEnhancement(
        response.choices[0].message.content
      );

      // Apply AI adjustment (limited to ±20 points)
      const adjustment = Math.max(-20, Math.min(20, aiAnalysis.adjustment));
      return Math.max(0, Math.min(100, baseScore + adjustment));
    } catch (error) {
      console.error("AI enhancement error:", error);
      return baseScore; // Return base score if AI fails
    }
  }

  // Build AI enhancement prompt
  buildAIEnhancementPrompt(patientData, riskType, baseScore) {
    return `
Analyze this patient's ${riskType} risk and suggest score adjustments:

Base Risk Score: ${baseScore}/100

Patient Information:
- Age: ${patientData.age}
- Primary Diagnosis: ${patientData.primary_diagnosis || "Not specified"}
- Comorbidities: ${patientData.comorbidities?.join(", ") || "None listed"}
- Current Medications: ${patientData.medications?.length || 0}
- Recent Vitals: ${JSON.stringify(patientData.vitals || {})}
- Social Factors: ${JSON.stringify(patientData.social_factors || {})}

Consider clinical nuances, drug interactions, and contextual factors that might increase or decrease the ${riskType} risk.

Provide your response in this format:
{
  "adjustment": number (-20 to +20),
  "reasoning": "explanation for adjustment",
  "confidence": number (0-1)
}
    `;
  }

  // Parse AI enhancement response
  parseAIEnhancement(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Error parsing AI enhancement:", error);
    }

    return { adjustment: 0, reasoning: "No AI adjustment", confidence: 0.5 };
  }

  // Determine risk level based on score and thresholds
  determineRiskLevel(score, thresholds) {
    if (score >= thresholds.critical) return "critical";
    if (score >= thresholds.high) return "high";
    if (score >= thresholds.moderate) return "moderate";
    return "low";
  }

  // Identify key risk factors
  identifyKeyRiskFactors(patientData, model) {
    const factors = [];

    model.factors.forEach((factor) => {
      const value = this.extractFactorValue(patientData, factor);
      const weight = model.weights[factor] || 0;

      if (value !== null && weight > 0.15) {
        // Significant factors only
        factors.push({
          factor,
          value,
          weight,
          impact: value * weight,
          description: this.getFactorDescription(factor, value),
        });
      }
    });

    // Sort by impact and return top factors
    return factors
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map((f) => ({
        factor: f.factor,
        description: f.description,
        impact_level:
          f.impact > 0.2 ? "high" : f.impact > 0.1 ? "moderate" : "low",
      }));
  }

  // Get factor description
  getFactorDescription(factor, value) {
    const descriptions = {
      age: `Age-related risk factor (${Math.round(value * 100)}%)`,
      mobility_score: `Mobility limitation (${Math.round(
        value * 100
      )}% impairment)`,
      cognitive_status: `Cognitive impairment (${Math.round(
        value * 100
      )}% affected)`,
      medication_count: `Polypharmacy risk (${Math.round(
        value * 20
      )} medications)`,
      history_of_falls:
        value > 0.5 ? "Previous fall history" : "No fall history",
      comorbidities: `Multiple conditions (${Math.round(
        value * 10
      )} comorbidities)`,
    };

    return descriptions[factor] || `${factor}: ${value}`;
  }

  // Calculate assessment confidence
  calculateConfidence(patientData, model) {
    let dataCompleteness = 0;
    let totalFactors = model.factors.length;

    model.factors.forEach((factor) => {
      if (this.extractFactorValue(patientData, factor) !== null) {
        dataCompleteness++;
      }
    });

    return dataCompleteness / totalFactors;
  }

  // Generate overall risk profile
  generateOverallRiskProfile(riskAssessments) {
    const riskLevels = Object.values(riskAssessments).map((r) => r.risk_level);
    const avgScore =
      Object.values(riskAssessments).reduce(
        (sum, r) => sum + r.ai_enhanced_score,
        0
      ) / Object.keys(riskAssessments).length;

    // Count risk levels
    const levelCounts = {
      critical: riskLevels.filter((l) => l === "critical").length,
      high: riskLevels.filter((l) => l === "high").length,
      moderate: riskLevels.filter((l) => l === "moderate").length,
      low: riskLevels.filter((l) => l === "low").length,
    };

    // Determine overall risk
    let overallRisk = "low";
    if (levelCounts.critical > 0) overallRisk = "critical";
    else if (levelCounts.high > 1) overallRisk = "high";
    else if (levelCounts.high > 0 || levelCounts.moderate > 2)
      overallRisk = "moderate";

    return {
      overall_risk_level: overallRisk,
      average_risk_score: Math.round(avgScore),
      risk_distribution: levelCounts,
      highest_risk_areas: Object.entries(riskAssessments)
        .filter(
          ([_, assessment]) =>
            assessment.risk_level === "critical" ||
            assessment.risk_level === "high"
        )
        .map(([type, assessment]) => ({
          risk_type: type,
          risk_level: assessment.risk_level,
          score: assessment.ai_enhanced_score,
        }))
        .sort((a, b) => b.score - a.score),
    };
  }

  // Generate AI insights
  async generateAIInsights(patientData, riskAssessments) {
    try {
      const prompt = `
Analyze this patient's comprehensive risk profile and provide clinical insights:

Patient: ${patientData.age} year old with ${
        patientData.primary_diagnosis || "unspecified diagnosis"
      }

Risk Assessment Results:
${Object.entries(riskAssessments)
  .map(
    ([type, assessment]) =>
      `- ${type}: ${assessment.risk_level} risk (${assessment.ai_enhanced_score}/100)`
  )
  .join("\n")}

Key Risk Factors:
${Object.values(riskAssessments)
  .flatMap((a) => a.key_factors)
  .slice(0, 5)
  .map((f) => `- ${f.description}`)
  .join("\n")}

Provide insights on:
1. Risk interaction patterns
2. Priority interventions
3. Monitoring recommendations
4. Potential complications to watch for

Keep response concise and clinically relevant.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical nurse specialist providing risk assessment insights.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      return this.parseAIInsights(response.choices[0].message.content);
    } catch (error) {
      console.error("AI insights generation error:", error);
      return {
        risk_interactions: ["Unable to generate AI insights"],
        priority_interventions: ["Follow standard protocols"],
        monitoring_recommendations: ["Regular assessment required"],
        potential_complications: ["Monitor for changes"],
      };
    }
  }

  // Parse AI insights
  parseAIInsights(response) {
    const insights = {
      risk_interactions: [],
      priority_interventions: [],
      monitoring_recommendations: [],
      potential_complications: [],
    };

    const sections = response.split(/\d+\./);

    sections.forEach((section, index) => {
      const lines = section.split("\n").filter((line) => line.trim());
      if (lines.length > 0) {
        switch (index) {
          case 1:
            insights.risk_interactions = lines.slice(0, 3);
            break;
          case 2:
            insights.priority_interventions = lines.slice(0, 3);
            break;
          case 3:
            insights.monitoring_recommendations = lines.slice(0, 3);
            break;
          case 4:
            insights.potential_complications = lines.slice(0, 3);
            break;
        }
      }
    });

    return insights;
  }

  // Generate risk-based recommendations
  async generateRiskRecommendations(riskAssessments) {
    const recommendations = [];

    Object.entries(riskAssessments).forEach(([riskType, assessment]) => {
      if (
        assessment.risk_level === "critical" ||
        assessment.risk_level === "high"
      ) {
        recommendations.push(
          ...this.getRiskSpecificRecommendations(riskType, assessment)
        );
      }
    });

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  // Get risk-specific recommendations
  getRiskSpecificRecommendations(riskType, assessment) {
    const recommendationMap = {
      fall_risk: [
        "Implement fall prevention protocol",
        "Ensure bed in lowest position with side rails up",
        "Provide non-slip footwear",
        "Consider bed alarm or chair alarm",
        "Increase frequency of rounding",
      ],
      pressure_ulcer: [
        "Implement pressure ulcer prevention protocol",
        "Turn patient every 2 hours",
        "Use pressure-relieving mattress",
        "Assess skin integrity daily",
        "Optimize nutrition and hydration",
      ],
      infection_risk: [
        "Implement infection prevention measures",
        "Monitor for signs of infection",
        "Ensure proper hand hygiene",
        "Consider isolation precautions if indicated",
        "Review antibiotic stewardship",
      ],
      medication_error: [
        "Implement medication safety protocols",
        "Double-check high-risk medications",
        "Provide medication education",
        "Consider medication reconciliation",
        "Monitor for adverse drug events",
      ],
      readmission_risk: [
        "Develop comprehensive discharge plan",
        "Ensure medication reconciliation",
        "Arrange appropriate follow-up care",
        "Provide patient education materials",
        "Consider case management referral",
      ],
    };

    const baseRecommendations = recommendationMap[riskType] || [
      "Monitor closely",
    ];

    return baseRecommendations.map((rec) => ({
      recommendation: rec,
      priority: assessment.risk_level === "critical" ? "urgent" : "high",
      risk_type: riskType,
      evidence_level: "standard_of_care",
    }));
  }

  // Get risk stratification statistics
  getRiskStats() {
    return {
      available_models: Array.from(this.riskModels.keys()),
      model_details: Object.fromEntries(
        Array.from(this.riskModels.entries()).map(([key, model]) => [
          key,
          {
            name: model.name,
            factors_count: model.factors.length,
            thresholds: model.thresholds,
          },
        ])
      ),
    };
  }

  // Update risk model thresholds based on outcomes
  updateRiskThresholds(riskType, outcomeData) {
    const model = this.riskModels.get(riskType);
    if (model && outcomeData.length > 0) {
      // Simple threshold adjustment (in practice, this would use more sophisticated methods)
      const avgScore =
        outcomeData.reduce((sum, data) => sum + data.score, 0) /
        outcomeData.length;
      const adjustment = avgScore > 50 ? 5 : -5;

      Object.keys(model.thresholds).forEach((level) => {
        model.thresholds[level] = Math.max(
          0,
          Math.min(100, model.thresholds[level] + adjustment)
        );
      });

      console.log(`Updated ${riskType} thresholds:`, model.thresholds);
    }
  }
}

export default new RiskStratificationAI();
