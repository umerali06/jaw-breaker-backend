import nursingAIService from './aiService.js';

class RiskAssessmentService {
  constructor() {
    this.riskScoringAlgorithms = {
      fallRisk: this.calculateFallRisk,
      sepsisRisk: this.calculateSepsisRisk,
      readmissionRisk: this.calculateReadmissionRisk,
      medicationRisk: this.calculateMedicationRisk,
      pressureUlcerRisk: this.calculatePressureUlcerRisk
    };
  }

  /**
   * Calculate comprehensive risk assessment for a patient
   */
  async calculateComprehensiveRiskAssessment(patientData, vitalSigns, medications) {
    try {
      const riskScores = {};
      const riskFactors = {};
      const recommendations = {};

      // Calculate individual risk scores
      riskScores.fallRisk = this.calculateFallRisk(patientData, vitalSigns);
      riskScores.sepsisRisk = this.calculateSepsisRisk(patientData, vitalSigns);
      riskScores.readmissionRisk = this.calculateReadmissionRisk(patientData, medications);
      riskScores.medicationRisk = this.calculateMedicationRisk(patientData, medications);
      riskScores.pressureUlcerRisk = this.calculatePressureUlcerRisk(patientData, vitalSigns);

      // Identify risk factors
      riskFactors.fallRisk = this.identifyFallRiskFactors(patientData, vitalSigns);
      riskFactors.sepsisRisk = this.identifySepsisRiskFactors(patientData, vitalSigns);
      riskFactors.medicationRisk = this.identifyMedicationRiskFactors(patientData, medications);

      // Generate AI-powered recommendations
      const aiRecommendations = await this.generateAIRiskRecommendations(
        patientData, 
        riskScores, 
        riskFactors
      );

      return {
        success: true,
        riskScores,
        riskFactors,
        recommendations: {
          ...aiRecommendations,
          immediateActions: this.getImmediateActions(riskScores),
          monitoringPlan: this.getMonitoringPlan(riskScores),
          preventionStrategies: this.getPreventionStrategies(riskScores, riskFactors)
        },
        overallRiskLevel: this.calculateOverallRiskLevel(riskScores),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error in comprehensive risk assessment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate Fall Risk using Morse Fall Scale
   */
  calculateFallRisk(patientData, vitalSigns) {
    let score = 0;
    const factors = [];

    // History of falling (25 points)
    if (patientData.riskFactors?.includes('Fall risk') || 
        patientData.conditions?.some(c => c.includes('Fall') || c.includes('Dementia'))) {
      score += 25;
      factors.push('History of falls or cognitive impairment');
    }

    // Secondary diagnosis (15 points)
    if (patientData.conditions && patientData.conditions.length > 2) {
      score += 15;
      factors.push('Multiple comorbidities');
    }

    // Ambulatory aid (0-30 points)
    if (patientData.clinicalContext?.functionalStatus?.includes('walker') || 
        patientData.clinicalContext?.functionalStatus?.includes('wheelchair')) {
      score += 30;
      factors.push('Requires ambulatory aid');
    } else if (patientData.clinicalContext?.functionalStatus?.includes('assistance')) {
      score += 15;
      factors.push('Requires assistance with mobility');
    }

    // IV/Heparin lock (20 points)
    if (patientData.medications?.some(m => m.includes('IV') || m.includes('Heparin'))) {
      score += 20;
      factors.push('IV access or anticoagulation');
    }

    // Gait (0-20 points)
    if (patientData.clinicalContext?.functionalStatus?.includes('limited')) {
      score += 20;
      factors.push('Impaired gait');
    } else if (patientData.clinicalContext?.functionalStatus?.includes('assistance')) {
      score += 10;
      factors.push('Gait requires assistance');
    }

    // Mental status (0-15 points)
    if (patientData.conditions?.some(c => c.includes('Dementia') || c.includes('Cognitive'))) {
      score += 15;
      factors.push('Cognitive impairment');
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (score >= 45) riskLevel = 'High';
    else if (score >= 25) riskLevel = 'Moderate';

    return {
      score,
      riskLevel,
      factors,
      interpretation: this.getFallRiskInterpretation(score, riskLevel)
    };
  }

  /**
   * Calculate Sepsis Risk using qSOFA and SIRS criteria
   */
  calculateSepsisRisk(patientData, vitalSigns) {
    let qSOFAScore = 0;
    let sirsScore = 0;
    const factors = [];

    // qSOFA criteria
    if (vitalSigns?.respiratoryRate > 22) {
      qSOFAScore += 1;
      factors.push('Respiratory rate > 22');
    }
    if (vitalSigns?.systolicBP < 100) {
      qSOFAScore += 1;
      factors.push('Systolic BP < 100 mmHg');
    }
    if (patientData.conditions?.some(c => c.includes('Cognitive') || c.includes('Dementia'))) {
      qSOFAScore += 1;
      factors.push('Altered mental status');
    }

    // SIRS criteria
    if (vitalSigns?.temperature > 100.4 || vitalSigns?.temperature < 96.8) {
      sirsScore += 1;
      factors.push('Temperature abnormality');
    }
    if (vitalSigns?.heartRate > 90) {
      sirsScore += 1;
      factors.push('Heart rate > 90');
    }
    if (vitalSigns?.respiratoryRate > 20) {
      sirsScore += 1;
      factors.push('Respiratory rate > 20');
    }
    if (patientData.recentLabs?.some(lab => lab.includes('WBC') && (lab.includes('>12') || lab.includes('<4')))) {
      sirsScore += 1;
      factors.push('WBC abnormality');
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (qSOFAScore >= 2) riskLevel = 'High';
    else if (sirsScore >= 2 || qSOFAScore >= 1) riskLevel = 'Moderate';

    return {
      qSOFAScore,
      sirsScore,
      riskLevel,
      factors,
      interpretation: this.getSepsisRiskInterpretation(qSOFAScore, sirsScore, riskLevel)
    };
  }

  /**
   * Calculate Readmission Risk
   */
  calculateReadmissionRisk(patientData, medications) {
    let score = 0;
    const factors = [];

    // Age factor
    if (patientData.age >= 75) {
      score += 3;
      factors.push('Age ≥ 75 years');
    } else if (patientData.age >= 65) {
      score += 2;
      factors.push('Age ≥ 65 years');
    }

    // Number of medications
    if (medications && medications.length >= 10) {
      score += 3;
      factors.push('Polypharmacy (≥10 medications)');
    } else if (medications && medications.length >= 5) {
      score += 2;
      factors.push('Multiple medications (≥5)');
    }

    // Chronic conditions
    if (patientData.conditions?.length >= 5) {
      score += 3;
      factors.push('Multiple chronic conditions');
    } else if (patientData.conditions?.length >= 3) {
      score += 2;
      factors.push('Multiple comorbidities');
    }

    // High-risk conditions
    const highRiskConditions = ['Heart Failure', 'COPD', 'Diabetes', 'Dementia', 'Kidney Disease'];
    const hasHighRiskConditions = patientData.conditions?.some(condition => 
      highRiskConditions.some(hrc => condition.includes(hrc))
    );
    if (hasHighRiskConditions) {
      score += 2;
      factors.push('High-risk chronic conditions');
    }

    // Social factors
    if (patientData.clinicalContext?.socialHistory?.includes('alone') || 
        patientData.clinicalContext?.socialHistory?.includes('isolation')) {
      score += 2;
      factors.push('Social isolation');
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (score >= 8) riskLevel = 'High';
    else if (score >= 5) riskLevel = 'Moderate';

    return {
      score,
      riskLevel,
      factors,
      interpretation: this.getReadmissionRiskInterpretation(score, riskLevel)
    };
  }

  /**
   * Calculate Medication Risk
   */
  calculateMedicationRisk(patientData, medications) {
    let score = 0;
    const factors = [];

    // Number of medications
    if (medications && medications.length >= 10) {
      score += 4;
      factors.push('Polypharmacy (≥10 medications)');
    } else if (medications && medications.length >= 5) {
      score += 2;
      factors.push('Multiple medications (≥5)');
    }

    // High-risk medications
    const highRiskMeds = ['Warfarin', 'Digoxin', 'Insulin', 'Opioids', 'Benzodiazepines'];
    const hasHighRiskMeds = medications?.some(med => 
      highRiskMeds.some(hrm => med.includes(hrm))
    );
    if (hasHighRiskMeds) {
      score += 3;
      factors.push('High-risk medications present');
    }

    // Age-related risk
    if (patientData.age >= 75) {
      score += 2;
      factors.push('Advanced age (≥75)');
    }

    // Renal/hepatic impairment
    if (patientData.conditions?.some(c => c.includes('Kidney') || c.includes('Liver'))) {
      score += 2;
      factors.push('Renal or hepatic impairment');
    }

    // Cognitive impairment
    if (patientData.conditions?.some(c => c.includes('Dementia') || c.includes('Cognitive'))) {
      score += 2;
      factors.push('Cognitive impairment');
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (score >= 8) riskLevel = 'High';
    else if (score >= 5) riskLevel = 'Moderate';

    return {
      score,
      riskLevel,
      factors,
      interpretation: this.getMedicationRiskInterpretation(score, riskLevel)
    };
  }

  /**
   * Calculate Pressure Ulcer Risk using Braden Scale
   */
  calculatePressureUlcerRisk(patientData, vitalSigns) {
    let score = 23; // Maximum possible score
    const factors = [];

    // Sensory perception (1-4 points)
    if (patientData.conditions?.some(c => c.includes('Dementia') || c.includes('Cognitive'))) {
      score -= 2;
      factors.push('Impaired sensory perception');
    }

    // Moisture (1-4 points)
    if (patientData.conditions?.some(c => c.includes('Incontinence'))) {
      score -= 2;
      factors.push('Moisture exposure');
    }

    // Activity (1-4 points)
    if (patientData.clinicalContext?.functionalStatus?.includes('wheelchair') || 
        patientData.clinicalContext?.functionalStatus?.includes('bedbound')) {
      score -= 3;
      factors.push('Limited mobility');
    } else if (patientData.clinicalContext?.functionalStatus?.includes('assistance')) {
      score -= 1;
      factors.push('Reduced activity');
    }

    // Mobility (1-4 points)
    if (patientData.clinicalContext?.functionalStatus?.includes('wheelchair')) {
      score -= 2;
      factors.push('Impaired mobility');
    }

    // Nutrition (1-4 points)
    if (patientData.conditions?.some(c => c.includes('Dementia') || c.includes('Cognitive'))) {
      score -= 1;
      factors.push('Potential nutrition issues');
    }

    // Friction and shear (1-3 points)
    if (patientData.clinicalContext?.functionalStatus?.includes('assistance')) {
      score -= 1;
      factors.push('Friction and shear risk');
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (score <= 9) riskLevel = 'High';
    else if (score <= 12) riskLevel = 'Moderate';

    return {
      score,
      riskLevel,
      factors,
      interpretation: this.getPressureUlcerRiskInterpretation(score, riskLevel)
    };
  }

  /**
   * Generate AI-powered risk recommendations
   */
  async generateAIRiskRecommendations(patientData, riskScores, riskFactors) {
    try {
      const systemPrompt = `You are a clinical risk assessment AI specializing in evidence-based risk mitigation strategies for nursing care.

Provide specific, actionable recommendations for risk reduction based on the patient's risk scores and factors. Focus on:
- Evidence-based interventions
- Patient-specific considerations
- Interdisciplinary team coordination
- Quality improvement opportunities
- Patient and family education

Format your response with clear sections and specific recommendations.`;

      const userPrompt = `Patient: ${patientData.name}, Age: ${patientData.age}, Gender: ${patientData.gender}
Conditions: ${patientData.conditions?.join(', ') || 'None specified'}
Medications: ${patientData.medications?.join(', ') || 'None specified'}

Risk Scores:
- Fall Risk: ${riskScores.fallRisk.riskLevel} (Score: ${riskScores.fallRisk.score})
- Sepsis Risk: ${riskScores.sepsisRisk.riskLevel} (qSOFA: ${riskScores.sepsisRisk.qSOFAScore}, SIRS: ${riskScores.sepsisRisk.sirsScore})
- Readmission Risk: ${riskScores.readmissionRisk.riskLevel} (Score: ${riskScores.readmissionRisk.score})
- Medication Risk: ${riskScores.medicationRisk.riskLevel} (Score: ${riskScores.medicationRisk.score})
- Pressure Ulcer Risk: ${riskScores.pressureUlcerRisk.riskLevel} (Score: ${riskScores.pressureUlcerRisk.score})

Risk Factors Identified:
${Object.entries(riskFactors).map(([type, factors]) => 
  `${type}: ${factors.join(', ')}`
).join('\n')}

Provide comprehensive risk mitigation recommendations.`;

      const result = await nursingAIService.callOpenAI(systemPrompt, userPrompt);
      
      return {
        aiRecommendations: result,
        evidenceBase: 'Evidence-based guidelines and clinical best practices',
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating AI risk recommendations:', error);
      return {
        aiRecommendations: 'Unable to generate AI recommendations at this time.',
        evidenceBase: 'Standard clinical guidelines',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Helper methods for risk interpretations
  getFallRiskInterpretation(score, riskLevel) {
    const interpretations = {
      'Low': 'Patient has low fall risk. Continue standard fall prevention measures.',
      'Moderate': 'Patient has moderate fall risk. Implement enhanced fall prevention protocols.',
      'High': 'Patient has high fall risk. Implement comprehensive fall prevention strategies immediately.'
    };
    return interpretations[riskLevel] || interpretations['Low'];
  }

  getSepsisRiskInterpretation(qSOFA, sirs, riskLevel) {
    if (riskLevel === 'High') {
      return 'High sepsis risk detected. Immediate evaluation and treatment required.';
    } else if (riskLevel === 'Moderate') {
      return 'Moderate sepsis risk. Close monitoring and early intervention recommended.';
    } else {
      return 'Low sepsis risk. Continue standard monitoring.';
    }
  }

  getReadmissionRiskInterpretation(score, riskLevel) {
    const interpretations = {
      'Low': 'Low readmission risk. Standard discharge planning appropriate.',
      'Moderate': 'Moderate readmission risk. Enhanced discharge planning recommended.',
      'High': 'High readmission risk. Comprehensive discharge planning and follow-up required.'
    };
    return interpretations[riskLevel] || interpretations['Low'];
  }

  getMedicationRiskInterpretation(score, riskLevel) {
    const interpretations = {
      'Low': 'Low medication risk. Standard medication management appropriate.',
      'Moderate': 'Moderate medication risk. Enhanced medication monitoring recommended.',
      'High': 'High medication risk. Comprehensive medication review and monitoring required.'
    };
    return interpretations[riskLevel] || interpretations['Low'];
  }

  getPressureUlcerRiskInterpretation(score, riskLevel) {
    const interpretations = {
      'Low': 'Low pressure ulcer risk. Standard skin care appropriate.',
      'Moderate': 'Moderate pressure ulcer risk. Enhanced skin care and positioning required.',
      'High': 'High pressure ulcer risk. Comprehensive pressure ulcer prevention protocol required.'
    };
    return interpretations[riskLevel] || interpretations['Low'];
  }

  // Risk factor identification methods
  identifyFallRiskFactors(patientData, vitalSigns) {
    const factors = [];
    if (patientData.age >= 65) factors.push('Age ≥ 65');
    if (patientData.conditions?.some(c => c.includes('Dementia'))) factors.push('Cognitive impairment');
    if (patientData.medications?.some(m => m.includes('Benzodiazepine') || m.includes('Opioid'))) factors.push('Sedating medications');
    if (vitalSigns?.bloodPressure?.includes('/') && parseInt(vitalSigns.bloodPressure.split('/')[0]) < 100) factors.push('Hypotension');
    return factors;
  }

  identifySepsisRiskFactors(patientData, vitalSigns) {
    const factors = [];
    if (vitalSigns?.temperature > 100.4 || vitalSigns?.temperature < 96.8) factors.push('Temperature abnormality');
    if (vitalSigns?.heartRate > 90) factors.push('Tachycardia');
    if (vitalSigns?.respiratoryRate > 20) factors.push('Tachypnea');
    if (vitalSigns?.systolicBP < 100) factors.push('Hypotension');
    if (patientData.conditions?.some(c => c.includes('Infection') || c.includes('Pneumonia'))) factors.push('Active infection');
    return factors;
  }

  identifyMedicationRiskFactors(patientData, medications) {
    const factors = [];
    if (medications && medications.length >= 5) factors.push('Polypharmacy');
    if (patientData.age >= 75) factors.push('Advanced age');
    if (patientData.conditions?.some(c => c.includes('Kidney') || c.includes('Liver'))) factors.push('Organ impairment');
    if (patientData.conditions?.some(c => c.includes('Dementia'))) factors.push('Cognitive impairment');
    return factors;
  }

  // Action and monitoring plans
  getImmediateActions(riskScores) {
    const actions = [];
    if (riskScores.fallRisk.riskLevel === 'High') actions.push('Implement fall prevention protocol immediately');
    if (riskScores.sepsisRisk.riskLevel === 'High') actions.push('Initiate sepsis evaluation and treatment');
    if (riskScores.medicationRisk.riskLevel === 'High') actions.push('Conduct comprehensive medication review');
    if (riskScores.pressureUlcerRisk.riskLevel === 'High') actions.push('Implement pressure ulcer prevention protocol');
    return actions;
  }

  getMonitoringPlan(riskScores) {
    const plan = {};
    if (riskScores.fallRisk.riskLevel !== 'Low') plan.fallRisk = 'Monitor every 4 hours';
    if (riskScores.sepsisRisk.riskLevel !== 'Low') plan.sepsisRisk = 'Monitor vital signs every 2 hours';
    if (riskScores.medicationRisk.riskLevel !== 'Low') plan.medicationRisk = 'Daily medication review';
    if (riskScores.pressureUlcerRisk.riskLevel !== 'Low') plan.pressureUlcerRisk = 'Skin assessment every 8 hours';
    return plan;
  }

  getPreventionStrategies(riskScores, riskFactors) {
    const strategies = [];
    if (riskScores.fallRisk.riskLevel !== 'Low') strategies.push('Fall prevention education and environmental modifications');
    if (riskScores.sepsisRisk.riskLevel !== 'Low') strategies.push('Infection prevention protocols and early warning systems');
    if (riskScores.medicationRisk.riskLevel !== 'Low') strategies.push('Medication reconciliation and monitoring protocols');
    if (riskScores.pressureUlcerRisk.riskLevel !== 'Low') strategies.push('Pressure ulcer prevention and skin care protocols');
    return strategies;
  }

  calculateOverallRiskLevel(riskScores) {
    const highRiskCount = Object.values(riskScores).filter(score => score.riskLevel === 'High').length;
    const moderateRiskCount = Object.values(riskScores).filter(score => score.riskLevel === 'Moderate').length;
    
    if (highRiskCount >= 2) return 'High';
    if (highRiskCount >= 1 || moderateRiskCount >= 3) return 'Moderate';
    return 'Low';
  }
}

export default new RiskAssessmentService();
