// Clinical Decision Support AI Service for evidence-based nursing care
import OpenAI from "openai";

class ClinicalDecisionSupportAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.clinicalGuidelines = new Map();
    this.evidenceBase = new Map();
    this.decisionTrees = new Map();
    this.setupClinicalKnowledge();
  }

  // Setup clinical knowledge base
  setupClinicalKnowledge() {
    // Clinical guidelines
    this.clinicalGuidelines.set("wound_care", {
      title: "Wound Care Management Guidelines",
      source: "WOCN Society",
      version: "2023",
      recommendations: [
        "Assess wound characteristics daily",
        "Maintain moist wound environment",
        "Manage wound bioburden",
        "Protect periwound skin",
        "Optimize patient factors",
      ],
    });

    this.clinicalGuidelines.set("pain_management", {
      title: "Pain Assessment and Management",
      source: "American Pain Society",
      version: "2023",
      recommendations: [
        "Use validated pain assessment tools",
        "Implement multimodal pain management",
        "Monitor for adverse effects",
        "Educate patient and family",
        "Document pain interventions",
      ],
    });

    this.clinicalGuidelines.set("infection_prevention", {
      title: "Healthcare-Associated Infection Prevention",
      source: "CDC Guidelines",
      version: "2023",
      recommendations: [
        "Hand hygiene compliance",
        "Standard and transmission-based precautions",
        "Environmental cleaning protocols",
        "Device-associated infection prevention",
        "Antimicrobial stewardship",
      ],
    });

    // Evidence-based interventions
    this.evidenceBase.set("fall_prevention", {
      interventions: [
        {
          intervention: "Multifactorial fall risk assessment",
          evidence_level: "A",
          effectiveness: 0.85,
          source: "Cochrane Review 2023",
        },
        {
          intervention: "Exercise programs",
          evidence_level: "A",
          effectiveness: 0.78,
          source: "Systematic Review 2023",
        },
        {
          intervention: "Medication review",
          evidence_level: "B",
          effectiveness: 0.65,
          source: "RCT Meta-analysis 2023",
        },
      ],
    });

    console.log("Clinical knowledge base initialized");
  }

  // Generate clinical decision support with real-time data integration
  async generateDecisionSupport(patientData, clinicalScenario, options = {}) {
    try {
      // Enhance patient data with real-time information
      const enhancedPatientData = await this.enhanceWithRealTimeData(
        patientData,
        options
      );

      // Analyze clinical context with enhanced data
      const clinicalContext = await this.analyzeClinicalContext(
        enhancedPatientData,
        clinicalScenario
      );

      // Generate evidence-based recommendations
      const recommendations = await this.generateRecommendations(
        clinicalContext,
        enhancedPatientData
      );

      // Assess intervention priorities with real-time urgency
      const priorities = this.assessInterventionPriorities(
        recommendations,
        enhancedPatientData
      );

      // Generate alerts and warnings with real-time monitoring
      const alerts = await this.generateClinicalAlerts(
        enhancedPatientData,
        clinicalContext
      );

      // Create decision pathway with real-time adaptations
      const decisionPathway = await this.createDecisionPathway(
        clinicalContext,
        recommendations,
        enhancedPatientData
      );

      // Generate real-time monitoring plan
      const monitoringPlan = await this.generateMonitoringPlan(
        enhancedPatientData,
        recommendations,
        alerts
      );

      return {
        patient_id: patientData.id,
        scenario: clinicalScenario,
        clinical_context: clinicalContext,
        recommendations: recommendations,
        intervention_priorities: priorities,
        clinical_alerts: alerts,
        decision_pathway: decisionPathway,
        monitoring_plan: monitoringPlan,
        evidence_summary: this.generateEvidenceSummary(recommendations),
        real_time_factors: this.extractRealTimeFactors(enhancedPatientData),
        generated_at: new Date(),
        confidence_score: this.calculateConfidenceScore(
          clinicalContext,
          recommendations
        ),
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes validity
      };
    } catch (error) {
      console.error("Clinical decision support error:", error);
      throw error;
    }
  }

  // Enhance patient data with real-time information
  async enhanceWithRealTimeData(patientData, options = {}) {
    try {
      const enhanced = { ...patientData };

      // Add real-time vital signs if available
      if (options.includeVitals && patientData.id) {
        enhanced.current_vitals = await this.getCurrentVitals(patientData.id);
      }

      // Add recent assessments
      if (options.includeAssessments && patientData.id) {
        enhanced.recent_assessments = await this.getRecentAssessments(
          patientData.id
        );
      }

      // Add current medications with administration status
      if (options.includeMedications && patientData.id) {
        enhanced.current_medications = await this.getCurrentMedications(
          patientData.id
        );
      }

      // Add real-time risk scores
      if (options.includeRiskScores && patientData.id) {
        enhanced.current_risk_scores = await this.getCurrentRiskScores(
          patientData.id
        );
      }

      // Add care team context
      if (options.includeCareTeam && patientData.id) {
        enhanced.care_team_context = await this.getCareTeamContext(
          patientData.id
        );
      }

      // Add environmental factors
      enhanced.environmental_factors = {
        timestamp: new Date(),
        location: patientData.location || "unknown",
        isolation_status: patientData.isolation_status || "none",
        mobility_restrictions: patientData.mobility_restrictions || [],
      };

      return enhanced;
    } catch (error) {
      console.error("Error enhancing patient data:", error);
      return patientData; // Return original data if enhancement fails
    }
  }

  // Get current vital signs from real-time monitoring
  async getCurrentVitals(patientId) {
    try {
      // This would integrate with real-time monitoring systems
      // For now, return mock structure that would be populated by real systems
      return {
        temperature: null,
        blood_pressure: { systolic: null, diastolic: null },
        heart_rate: null,
        respiratory_rate: null,
        oxygen_saturation: null,
        pain_score: null,
        last_updated: new Date(),
        source: "real_time_monitor",
      };
    } catch (error) {
      console.error("Error getting current vitals:", error);
      return null;
    }
  }

  // Get recent nursing assessments
  async getRecentAssessments(patientId) {
    try {
      // This would query the nursing assessments database
      return [];
    } catch (error) {
      console.error("Error getting recent assessments:", error);
      return [];
    }
  }

  // Get current medications with administration status
  async getCurrentMedications(patientId) {
    try {
      // This would query the medication administration records
      return [];
    } catch (error) {
      console.error("Error getting current medications:", error);
      return [];
    }
  }

  // Get current risk scores from risk stratification
  async getCurrentRiskScores(patientId) {
    try {
      // This would integrate with the risk stratification service
      return {
        fall_risk: null,
        pressure_ulcer_risk: null,
        infection_risk: null,
        last_calculated: new Date(),
      };
    } catch (error) {
      console.error("Error getting current risk scores:", error);
      return null;
    }
  }

  // Get care team context
  async getCareTeamContext(patientId) {
    try {
      return {
        primary_nurse: null,
        attending_physician: null,
        specialists: [],
        care_plan_updated: null,
        team_communication_notes: [],
      };
    } catch (error) {
      console.error("Error getting care team context:", error);
      return null;
    }
  }

  // Generate real-time monitoring plan
  async generateMonitoringPlan(patientData, recommendations, alerts) {
    try {
      const monitoringPlan = {
        vital_signs_monitoring: {
          frequency: this.determineVitalSignsFrequency(alerts, patientData),
          parameters: this.determineMonitoringParameters(patientData, alerts),
          alert_thresholds: this.generateAlertThresholds(patientData),
        },
        assessment_schedule: {
          nursing_assessments: this.generateAssessmentSchedule(recommendations),
          specialty_assessments: this.generateSpecialtyAssessments(
            patientData,
            alerts
          ),
        },
        intervention_monitoring: {
          medication_monitoring: this.generateMedicationMonitoring(patientData),
          therapy_monitoring: this.generateTherapyMonitoring(recommendations),
          safety_monitoring: this.generateSafetyMonitoring(alerts),
        },
        escalation_criteria: this.generateEscalationCriteria(
          alerts,
          patientData
        ),
        documentation_requirements:
          this.generateDocumentationRequirements(recommendations),
      };

      return monitoringPlan;
    } catch (error) {
      console.error("Error generating monitoring plan:", error);
      return {
        vital_signs_monitoring: {
          frequency: "q4h",
          parameters: ["basic_vitals"],
        },
        assessment_schedule: { nursing_assessments: ["daily"] },
        intervention_monitoring: { medication_monitoring: ["standard"] },
        escalation_criteria: ["significant_change_in_condition"],
        documentation_requirements: ["standard_nursing_documentation"],
      };
    }
  }

  // Determine vital signs monitoring frequency based on risk
  determineVitalSignsFrequency(alerts, patientData) {
    const criticalAlerts = alerts.filter(
      (alert) => alert.severity === "critical"
    );
    const highAlerts = alerts.filter((alert) => alert.severity === "high");

    if (criticalAlerts.length > 0) return "q15min";
    if (highAlerts.length > 0) return "q1h";
    if (patientData.current_risk_scores?.overall_risk === "high") return "q2h";
    return "q4h";
  }

  // Determine monitoring parameters
  determineMonitoringParameters(patientData, alerts) {
    const baseParameters = [
      "temperature",
      "blood_pressure",
      "heart_rate",
      "respiratory_rate",
    ];
    const additionalParameters = [];

    alerts.forEach((alert) => {
      if (alert.type === "vital_sign_alert") {
        additionalParameters.push("continuous_monitoring");
      }
      if (alert.message.includes("oxygen")) {
        additionalParameters.push("oxygen_saturation");
      }
      if (alert.message.includes("pain")) {
        additionalParameters.push("pain_assessment");
      }
    });

    return [...baseParameters, ...additionalParameters];
  }

  // Generate alert thresholds based on patient condition
  generateAlertThresholds(patientData) {
    const age = patientData.age || 65;
    const baseThresholds = {
      temperature: { min: 36.0, max: 38.0 },
      heart_rate: { min: 60, max: 100 },
      systolic_bp: { min: 90, max: 140 },
      diastolic_bp: { min: 60, max: 90 },
      respiratory_rate: { min: 12, max: 20 },
      oxygen_saturation: { min: 95, max: 100 },
    };

    // Adjust thresholds based on age and conditions
    if (age > 75) {
      baseThresholds.heart_rate.max = 110;
      baseThresholds.systolic_bp.max = 150;
    }

    return baseThresholds;
  }

  // Extract real-time factors for decision making
  extractRealTimeFactors(enhancedPatientData) {
    return {
      data_freshness: {
        vitals_age: enhancedPatientData.current_vitals?.last_updated
          ? Date.now() -
            new Date(enhancedPatientData.current_vitals.last_updated).getTime()
          : null,
        assessments_age:
          enhancedPatientData.recent_assessments?.length > 0
            ? Date.now() -
              new Date(
                enhancedPatientData.recent_assessments[0].created_at
              ).getTime()
            : null,
      },
      real_time_availability: {
        vitals_monitoring: !!enhancedPatientData.current_vitals,
        medication_tracking: !!enhancedPatientData.current_medications,
        risk_scoring: !!enhancedPatientData.current_risk_scores,
      },
      environmental_context: enhancedPatientData.environmental_factors,
      care_coordination: {
        team_available: !!enhancedPatientData.care_team_context,
        communication_active:
          enhancedPatientData.care_team_context?.team_communication_notes
            ?.length > 0,
      },
    };
  }

  // Generate assessment schedule based on recommendations
  generateAssessmentSchedule(recommendations) {
    const schedule = [];

    recommendations.forEach((rec) => {
      if (rec.recommendation.toLowerCase().includes("assess")) {
        if (rec.priority === "high") {
          schedule.push("q2h_focused_assessment");
        } else {
          schedule.push("q8h_assessment");
        }
      }
    });

    if (schedule.length === 0) {
      schedule.push("q12h_routine_assessment");
    }

    return [...new Set(schedule)]; // Remove duplicates
  }

  // Generate specialty assessments based on patient condition
  generateSpecialtyAssessments(patientData, alerts) {
    const specialtyAssessments = [];

    alerts.forEach((alert) => {
      if (alert.type === "drug_interaction") {
        specialtyAssessments.push("pharmacist_consultation");
      }
      if (alert.message.includes("wound")) {
        specialtyAssessments.push("wound_care_assessment");
      }
      if (alert.message.includes("nutrition")) {
        specialtyAssessments.push("nutritionist_evaluation");
      }
    });

    return specialtyAssessments;
  }

  // Generate medication monitoring requirements
  generateMedicationMonitoring(patientData) {
    const monitoring = ["medication_administration_verification"];

    if (patientData.current_medications?.some((med) => med.high_risk)) {
      monitoring.push("high_risk_medication_monitoring");
    }

    if (patientData.allergies?.length > 0) {
      monitoring.push("allergy_verification");
    }

    return monitoring;
  }

  // Generate therapy monitoring requirements
  generateTherapyMonitoring(recommendations) {
    const therapyMonitoring = [];

    recommendations.forEach((rec) => {
      if (rec.recommendation.toLowerCase().includes("therapy")) {
        therapyMonitoring.push("therapy_compliance_monitoring");
      }
      if (rec.recommendation.toLowerCase().includes("exercise")) {
        therapyMonitoring.push("mobility_progress_tracking");
      }
    });

    return therapyMonitoring;
  }

  // Generate safety monitoring requirements
  generateSafetyMonitoring(alerts) {
    const safetyMonitoring = ["fall_risk_precautions"];

    alerts.forEach((alert) => {
      if (alert.severity === "critical") {
        safetyMonitoring.push("continuous_observation");
      }
      if (alert.type === "allergy_conflict") {
        safetyMonitoring.push("allergy_alert_monitoring");
      }
    });

    return [...new Set(safetyMonitoring)];
  }

  // Generate escalation criteria
  generateEscalationCriteria(alerts, patientData) {
    const criteria = ["significant_change_in_condition"];

    alerts.forEach((alert) => {
      if (alert.severity === "critical") {
        criteria.push("immediate_physician_notification");
      }
      if (alert.type === "vital_sign_alert") {
        criteria.push("vital_sign_threshold_breach");
      }
    });

    return [...new Set(criteria)];
  }

  // Generate documentation requirements
  generateDocumentationRequirements(recommendations) {
    const requirements = ["standard_nursing_documentation"];

    recommendations.forEach((rec) => {
      if (rec.priority === "high") {
        requirements.push("detailed_intervention_documentation");
      }
      if (rec.evidence_level === "A") {
        requirements.push("evidence_based_rationale_documentation");
      }
    });

    return [...new Set(requirements)];
  }

  // Analyze clinical context
  async analyzeClinicalContext(patientData, scenario) {
    const prompt = `
Analyze this clinical scenario and provide structured context:

Patient Information:
- Age: ${patientData.age}
- Gender: ${patientData.gender}
- Primary Diagnosis: ${patientData.primary_diagnosis}
- Comorbidities: ${patientData.comorbidities?.join(", ") || "None"}
- Current Medications: ${
      patientData.medications?.map((m) => m.name).join(", ") || "None"
    }
- Allergies: ${patientData.allergies?.join(", ") || "None"}
- Recent Vitals: ${JSON.stringify(patientData.vitals || {})}

Clinical Scenario: ${scenario}

Provide analysis in this format:
{
  "primary_concerns": ["concern1", "concern2"],
  "risk_factors": ["risk1", "risk2"],
  "contraindications": ["contra1", "contra2"],
  "clinical_priorities": ["priority1", "priority2"],
  "relevant_guidelines": ["guideline1", "guideline2"]
}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical decision support AI specializing in nursing care. Provide evidence-based analysis of clinical scenarios.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      return this.parseClinicalContext(response.choices[0].message.content);
    } catch (error) {
      console.error("Clinical context analysis error:", error);
      return {
        primary_concerns: ["Assessment needed"],
        risk_factors: ["Unknown"],
        contraindications: ["Review required"],
        clinical_priorities: ["Standard care"],
        relevant_guidelines: ["General protocols"],
      };
    }
  }

  // Parse clinical context from AI response
  parseClinicalContext(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Error parsing clinical context:", error);
    }

    return {
      primary_concerns: ["Analysis incomplete"],
      risk_factors: ["Assessment needed"],
      contraindications: ["Review required"],
      clinical_priorities: ["Standard protocols"],
      relevant_guidelines: ["General guidelines"],
    };
  }

  // Generate evidence-based recommendations
  async generateRecommendations(clinicalContext) {
    const recommendations = [];

    // Get guideline-based recommendations
    for (const guidelineName of clinicalContext.relevant_guidelines) {
      const guideline = this.clinicalGuidelines.get(guidelineName);
      if (guideline) {
        guideline.recommendations.forEach((rec) => {
          recommendations.push({
            recommendation: rec,
            source: guideline.source,
            evidence_level: "Guideline",
            category: "standard_care",
            priority: "medium",
          });
        });
      }
    }

    // Get AI-generated specific recommendations
    const aiRecommendations = await this.generateAIRecommendations(
      clinicalContext
    );
    recommendations.push(...aiRecommendations);

    // Get evidence-based interventions
    const evidenceRecommendations =
      this.getEvidenceBasedRecommendations(clinicalContext);
    recommendations.push(...evidenceRecommendations);

    return this.prioritizeRecommendations(recommendations);
  }

  // Generate AI-specific recommendations
  async generateAIRecommendations(clinicalContext) {
    const prompt = `
Based on this clinical context, provide specific nursing interventions:

Primary Concerns: ${clinicalContext.primary_concerns.join(", ")}
Risk Factors: ${clinicalContext.risk_factors.join(", ")}
Clinical Priorities: ${clinicalContext.clinical_priorities.join(", ")}

Provide 5-7 specific, actionable nursing interventions with rationale.
Format as a JSON array of objects with: intervention, rationale, priority, category
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical nurse specialist. Provide evidence-based nursing interventions.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return this.parseAIRecommendations(response.choices[0].message.content);
    } catch (error) {
      console.error("AI recommendations error:", error);
      return [];
    }
  }

  // Parse AI recommendations
  parseAIRecommendations(response) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((rec) => ({
          ...rec,
          source: "AI Analysis",
          evidence_level: "AI-Generated",
        }));
      }
    } catch (error) {
      console.error("Error parsing AI recommendations:", error);
    }

    return [];
  }

  // Get evidence-based recommendations
  getEvidenceBasedRecommendations(clinicalContext) {
    const recommendations = [];

    // Match context to evidence base
    clinicalContext.primary_concerns.forEach((concern) => {
      const evidence = this.evidenceBase.get(concern);
      if (evidence) {
        evidence.interventions.forEach((intervention) => {
          recommendations.push({
            recommendation: intervention.intervention,
            source: intervention.source,
            evidence_level: intervention.evidence_level,
            effectiveness: intervention.effectiveness,
            category: "evidence_based",
            priority: intervention.evidence_level === "A" ? "high" : "medium",
          });
        });
      }
    });

    return recommendations;
  }

  // Prioritize recommendations
  prioritizeRecommendations(recommendations) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const evidenceOrder = { A: 3, B: 2, C: 1, Guideline: 2, "AI-Generated": 1 };

    return recommendations
      .sort((a, b) => {
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        const aEvidence = evidenceOrder[a.evidence_level] || 1;
        const bEvidence = evidenceOrder[b.evidence_level] || 1;

        return bPriority + bEvidence - (aPriority + aEvidence);
      })
      .slice(0, 10); // Top 10 recommendations
  }

  // Assess intervention priorities
  assessInterventionPriorities(recommendations, patientData) {
    const priorities = {
      immediate: [],
      urgent: [],
      routine: [],
      monitoring: [],
    };

    recommendations.forEach((rec) => {
      // Assess urgency based on patient condition and recommendation type
      const urgency = this.assessUrgency(rec, patientData);
      priorities[urgency].push({
        recommendation: rec.recommendation,
        rationale: rec.rationale || "Evidence-based intervention",
        timeframe: this.getTimeframe(urgency),
        resources_needed: this.getResourcesNeeded(rec),
      });
    });

    return priorities;
  }

  // Assess urgency of intervention
  assessUrgency(recommendation, patientData) {
    const immediateKeywords = [
      "emergency",
      "critical",
      "urgent",
      "stat",
      "immediate",
    ];
    const urgentKeywords = ["monitor", "assess", "evaluate", "check"];

    const recText = recommendation.recommendation.toLowerCase();

    if (immediateKeywords.some((keyword) => recText.includes(keyword))) {
      return "immediate";
    }

    if (
      recommendation.priority === "high" ||
      urgentKeywords.some((keyword) => recText.includes(keyword))
    ) {
      return "urgent";
    }

    if (recText.includes("monitor") || recText.includes("observe")) {
      return "monitoring";
    }

    return "routine";
  }

  // Get timeframe for intervention
  getTimeframe(urgency) {
    const timeframes = {
      immediate: "Within 15 minutes",
      urgent: "Within 1 hour",
      routine: "Within 4 hours",
      monitoring: "Ongoing",
    };
    return timeframes[urgency];
  }

  // Get resources needed for intervention
  getResourcesNeeded(recommendation) {
    const resourceKeywords = {
      medication: ["Pharmacy", "Physician order"],
      assessment: ["Assessment tools", "Documentation"],
      monitoring: ["Monitoring equipment", "Frequent observation"],
      education: ["Educational materials", "Time for teaching"],
      consultation: ["Specialist referral", "Interdisciplinary team"],
    };

    const recText = recommendation.recommendation.toLowerCase();
    const resources = [];

    Object.entries(resourceKeywords).forEach(
      ([category, categoryResources]) => {
        if (recText.includes(category)) {
          resources.push(...categoryResources);
        }
      }
    );

    return resources.length > 0 ? resources : ["Standard nursing resources"];
  }

  // Generate clinical alerts
  async generateClinicalAlerts(patientData, clinicalContext) {
    const alerts = [];

    // Check for drug interactions
    if (patientData.medications && patientData.medications.length > 1) {
      const drugAlerts = await this.checkDrugInteractions(
        patientData.medications
      );
      alerts.push(...drugAlerts);
    }

    // Check for allergy conflicts
    if (patientData.allergies && patientData.medications) {
      const allergyAlerts = this.checkAllergyConflicts(
        patientData.allergies,
        patientData.medications
      );
      alerts.push(...allergyAlerts);
    }

    // Check vital sign alerts
    if (patientData.vitals) {
      const vitalAlerts = this.checkVitalSignAlerts(
        patientData.vitals,
        patientData.age
      );
      alerts.push(...vitalAlerts);
    }

    // Check for contraindications
    const contraindicationAlerts = this.checkContraindications(
      clinicalContext.contraindications
    );
    alerts.push(...contraindicationAlerts);

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Check drug interactions
  async checkDrugInteractions(medications) {
    // This would integrate with a drug interaction database in production
    const interactions = [];

    // Simplified interaction checking
    const highRiskCombinations = [
      ["warfarin", "aspirin"],
      ["digoxin", "furosemide"],
      ["metformin", "contrast"],
    ];

    const medicationNames = medications.map((m) => m.name?.toLowerCase() || "");

    highRiskCombinations.forEach(([drug1, drug2]) => {
      if (medicationNames.includes(drug1) && medicationNames.includes(drug2)) {
        interactions.push({
          type: "drug_interaction",
          severity: "high",
          message: `Potential interaction between ${drug1} and ${drug2}`,
          recommendation: "Review with pharmacist",
          drugs_involved: [drug1, drug2],
        });
      }
    });

    return interactions;
  }

  // Check allergy conflicts
  checkAllergyConflicts(allergies, medications) {
    const conflicts = [];

    allergies.forEach((allergy) => {
      medications.forEach((medication) => {
        if (medication.name?.toLowerCase().includes(allergy.toLowerCase())) {
          conflicts.push({
            type: "allergy_conflict",
            severity: "critical",
            message: `Patient allergic to ${allergy}, prescribed ${medication.name}`,
            recommendation: "Do not administer - contact physician",
            allergy: allergy,
            medication: medication.name,
          });
        }
      });
    });

    return conflicts;
  }

  // Check vital sign alerts
  checkVitalSignAlerts(vitals, patientAge) {
    const alerts = [];

    // Temperature alerts
    if (vitals.temperature) {
      if (vitals.temperature > 38.3) {
        alerts.push({
          type: "vital_sign_alert",
          severity: "high",
          message: `Fever: Temperature ${vitals.temperature}°C`,
          recommendation: "Monitor closely, consider antipyretics",
        });
      }
    }

    // Blood pressure alerts
    if (vitals.systolic_bp && vitals.diastolic_bp) {
      if (vitals.systolic_bp > 180 || vitals.diastolic_bp > 110) {
        alerts.push({
          type: "vital_sign_alert",
          severity: "critical",
          message: `Hypertensive crisis: BP ${vitals.systolic_bp}/${vitals.diastolic_bp}`,
          recommendation: "Immediate physician notification required",
        });
      }
    }

    // Heart rate alerts
    if (vitals.heart_rate) {
      if (vitals.heart_rate > 120 || vitals.heart_rate < 50) {
        alerts.push({
          type: "vital_sign_alert",
          severity: "high",
          message: `Abnormal heart rate: ${vitals.heart_rate} bpm`,
          recommendation: "Assess patient, consider ECG",
        });
      }
    }

    return alerts;
  }

  // Check contraindications
  checkContraindications(contraindications) {
    return contraindications.map((contraindication) => ({
      type: "contraindication",
      severity: "medium",
      message: `Contraindication identified: ${contraindication}`,
      recommendation: "Review before proceeding with intervention",
    }));
  }

  // Create decision pathway
  async createDecisionPathway(clinicalContext, recommendations) {
    const pathway = {
      assessment_phase: {
        steps: [
          "Complete initial assessment",
          "Review patient history",
          "Identify risk factors",
          "Assess current condition",
        ],
        decision_points: clinicalContext.primary_concerns,
      },
      intervention_phase: {
        steps: recommendations.slice(0, 5).map((rec) => rec.recommendation),
        monitoring_points: [
          "Monitor patient response",
          "Assess intervention effectiveness",
          "Document outcomes",
        ],
      },
      evaluation_phase: {
        steps: [
          "Evaluate goal achievement",
          "Assess need for plan modification",
          "Plan ongoing care",
          "Communicate with team",
        ],
      },
    };

    return pathway;
  }

  // Generate evidence summary
  generateEvidenceSummary(recommendations) {
    const evidenceLevels = {};
    const sources = new Set();

    recommendations.forEach((rec) => {
      evidenceLevels[rec.evidence_level] =
        (evidenceLevels[rec.evidence_level] || 0) + 1;
      if (rec.source) sources.add(rec.source);
    });

    return {
      total_recommendations: recommendations.length,
      evidence_distribution: evidenceLevels,
      unique_sources: Array.from(sources),
      strength_of_evidence: this.assessEvidenceStrength(evidenceLevels),
    };
  }

  // Assess evidence strength
  assessEvidenceStrength(evidenceLevels) {
    const levelA = evidenceLevels["A"] || 0;
    const levelB = evidenceLevels["B"] || 0;
    const guidelines = evidenceLevels["Guideline"] || 0;
    const total = Object.values(evidenceLevels).reduce(
      (sum, count) => sum + count,
      0
    );

    const strongEvidence = (levelA + guidelines) / total;

    if (strongEvidence > 0.7) return "strong";
    if (strongEvidence > 0.4) return "moderate";
    return "limited";
  }

  // Calculate confidence score
  calculateConfidenceScore(clinicalContext, recommendations) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on evidence quality
    const evidenceQuality =
      recommendations.filter(
        (r) => r.evidence_level === "A" || r.evidence_level === "Guideline"
      ).length / recommendations.length;

    confidence += evidenceQuality * 0.3;

    // Increase confidence based on context completeness
    const contextCompleteness =
      Object.values(clinicalContext).filter((value) =>
        Array.isArray(value) ? value.length > 0 : value
      ).length / Object.keys(clinicalContext).length;

    confidence += contextCompleteness * 0.2;

    return Math.min(confidence, 1.0);
  }

  // Get decision support statistics
  getDecisionSupportStats() {
    return {
      clinical_guidelines: this.clinicalGuidelines.size,
      evidence_base_entries: this.evidenceBase.size,
      decision_trees: this.decisionTrees.size,
      available_guidelines: Array.from(this.clinicalGuidelines.keys()),
      evidence_categories: Array.from(this.evidenceBase.keys()),
    };
  }

  // Update clinical guidelines
  updateClinicalGuideline(guidelineName, guidelineData) {
    this.clinicalGuidelines.set(guidelineName, {
      ...guidelineData,
      updated_at: new Date(),
    });
    console.log(`Updated clinical guideline: ${guidelineName}`);
  }

  // Add evidence-based intervention
  addEvidenceBasedIntervention(category, intervention) {
    if (!this.evidenceBase.has(category)) {
      this.evidenceBase.set(category, { interventions: [] });
    }

    this.evidenceBase.get(category).interventions.push({
      ...intervention,
      added_at: new Date(),
    });

    console.log(`Added evidence-based intervention to ${category}`);
  }
}

export default new ClinicalDecisionSupportAI();
