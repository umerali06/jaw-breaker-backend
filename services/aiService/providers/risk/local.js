import { BaseAIService } from '../../provider.js';

export class LocalRuleBasedProvider extends BaseAIService {
  constructor() {
    super();
    this.name = 'local';
  }
  
  async _processPromptInternal(prompt, context, options = {}) {
    // Local rule-based processing for basic medical queries
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('differential diagnosis') || lowerPrompt.includes('diagnosis')) {
      return this._generateDifferentialDiagnosis(context);
    }
    
    if (lowerPrompt.includes('treatment plan') || lowerPrompt.includes('treatment')) {
      return this._generateTreatmentPlan(context);
    }
    
    if (lowerPrompt.includes('medication') || lowerPrompt.includes('drug')) {
      return this._analyzeMedications(context);
    }
    
    if (lowerPrompt.includes('risk') || lowerPrompt.includes('assessment')) {
      return this._assessRisk(context);
    }
    
    // Default response
    return {
      text: 'This local rule-based system can provide basic medical analysis. For more comprehensive AI assistance, please use an external AI provider.',
      tokensUsed: 0
    };
  }
  
  async _extractEntitiesInternal(text, options = {}) {
    const entities = [];
    
    // Medical entity patterns
    const patterns = [
      // Symptoms
      { type: 'symptom', regex: /\b(fever|pain|headache|nausea|vomiting|diarrhea|cough|shortness of breath|fatigue|weakness|dizziness|chest pain|abdominal pain|back pain)\b/gi },
      
      // Vital signs
      { type: 'vital_sign', regex: /\b(blood pressure|heart rate|temperature|respiratory rate|oxygen saturation|pulse|bp|hr|temp|rr|o2|spo2)\b/gi },
      
      // Lab values
      { type: 'lab_value', regex: /\b(glucose|cholesterol|hemoglobin|creatinine|bun|sodium|potassium|chloride|bicarbonate|wbc|rbc|platelets|hct|hgb)\b/gi },
      
      // Medications
      { type: 'medication', regex: /\b(aspirin|ibuprofen|acetaminophen|amoxicillin|metformin|lisinopril|atorvastatin|omeprazole|albuterol|insulin|warfarin|digoxin|furosemide)\b/gi },
      
      // Diagnoses
      { type: 'diagnosis', regex: /\b(diabetes|hypertension|asthma|pneumonia|heart disease|stroke|cancer|copd|kidney disease|liver disease|arthritis|depression|anxiety)\b/gi },
      
      // Procedures
      { type: 'procedure', regex: /\b(surgery|catheterization|biopsy|colonoscopy|endoscopy|x-ray|ct scan|mri|ultrasound|ekg|ecg|stress test)\b/gi },
      
      // Body parts
      { type: 'body_part', regex: /\b(heart|lung|kidney|liver|brain|stomach|intestine|colon|esophagus|trachea|artery|vein|bone|joint|muscle)\b/gi }
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: pattern.type,
          confidence: 0.8, // High confidence for rule-based extraction
          start: match.index,
          end: match.index + match[0].length
        });
      }
    });
    
    return { entities };
  }
  
  async _analyzeRiskInternal(data, options = {}) {
    const riskFactors = [];
    let overallRisk = 0;
    
    // Analyze medications
    if (data.currentMedications && data.currentMedications.length > 0) {
      const medCount = data.currentMedications.length;
      if (medCount > 5) {
        riskFactors.push({
          factor: 'Polypharmacy (5+ medications)',
          score: 4,
          confidence: 0.9,
          evidence: [`Patient is taking ${medCount} medications`]
        });
        overallRisk += 4;
      }
      
      // Check for specific high-risk medications
      const highRiskMeds = data.currentMedications.filter((med) => 
        ['warfarin', 'insulin', 'digoxin', 'lithium'].includes(med.name.toLowerCase())
      );
      
      if (highRiskMeds.length > 0) {
        riskFactors.push({
          factor: 'High-risk medications',
          score: 3,
          confidence: 0.9,
          evidence: highRiskMeds.map((med) => med.name)
        });
        overallRisk += 3;
      }
    }
    
    // Analyze allergies
    if (data.allergies && data.allergies.length > 0) {
      const severeAllergies = data.allergies.filter((allergy) => 
        allergy.severity === 'severe' || allergy.severity === 'life_threatening'
      );
      
      if (severeAllergies.length > 0) {
        riskFactors.push({
          factor: 'Severe allergies',
          score: 3,
          confidence: 0.9,
          evidence: severeAllergies.map((allergy) => `${allergy.substance}: ${allergy.reaction}`)
        });
        overallRisk += 3;
      }
    }
    
    // Analyze demographics
    if (data.demographics) {
      const age = this._calculateAge(data.demographics.dob);
      if (age > 65) {
        riskFactors.push({
          factor: 'Advanced age',
          score: 2,
          confidence: 0.8,
          evidence: [`Patient age: ${age} years`]
        });
        overallRisk += 2;
      }
    }
    
    // Generate recommendations based on identified risks
    const recommendations = [];
    
    if (riskFactors.some(rf => rf.factor.includes('Polypharmacy'))) {
      recommendations.push('Review medication list for potential interactions and consider deprescribing if appropriate');
    }
    
    if (riskFactors.some(rf => rf.factor.includes('High-risk medications'))) {
      recommendations.push('Monitor therapeutic levels and adverse effects closely');
    }
    
    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {
      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');
    }
    
    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {
      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');
    }
    
    // Default safety recommendations
    if (recommendations.length === 0) {
      recommendations.push('Continue current monitoring and care plan');
      recommendations.push('Review medications for potential interactions');
      recommendations.push('Monitor for any new symptoms or adverse reactions');
    }
    
    return {
      riskFactors,
      overallRisk: Math.min(overallRisk, 10),
      recommendations
    };
  }
  
  _generateDifferentialDiagnosis(context) {
    const diagnoses = [];
    
    // Basic rule-based diagnosis based on context keywords
    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {
      diagnoses.push('Upper respiratory tract infection');
      diagnoses.push('Pneumonia');
      diagnoses.push('Bronchitis');
    }
    
    if (context.toLowerCase().includes('chest pain')) {
      diagnoses.push('Angina');
      diagnoses.push('Myocardial infarction');
      diagnoses.push('Gastroesophageal reflux disease');
      diagnoses.push('Costochondritis');
    }
    
    if (context.toLowerCase().includes('shortness of breath')) {
      diagnoses.push('Asthma');
      diagnoses.push('Chronic obstructive pulmonary disease');
      diagnoses.push('Heart failure');
      diagnoses.push('Pulmonary embolism');
    }
    
    if (context.toLowerCase().includes('abdominal pain')) {
      diagnoses.push('Gastritis');
      diagnoses.push('Peptic ulcer disease');
      diagnoses.push('Appendicitis');
      diagnoses.push('Cholecystitis');
    }
    
    if (diagnoses.length === 0) {
      diagnoses.push('Insufficient clinical information for differential diagnosis');
    }
    
    return {
      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,
      json: { diagnoses, confidence: 'low', method: 'rule_based' },
      tokensUsed: 0
    };
  }
  
  _generateTreatmentPlan(context) {
    const treatments = [];
    
    // Basic treatment recommendations based on context
    if (context.toLowerCase().includes('fever')) {
      treatments.push('Acetaminophen or ibuprofen for fever control');
      treatments.push('Adequate hydration');
    }
    
    if (context.toLowerCase().includes('pain')) {
      treatments.push('Appropriate pain management based on severity');
      treatments.push('Consider non-pharmacological interventions');
    }
    
    if (context.toLowerCase().includes('infection')) {
      treatments.push('Antibiotics if bacterial infection suspected');
      treatments.push('Supportive care and monitoring');
    }
    
    if (treatments.length === 0) {
      treatments.push('General supportive care and monitoring');
      treatments.push('Address underlying cause if identified');
    }
    
    return {
      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,
      json: { treatments, confidence: 'low', method: 'rule_based' },
      tokensUsed: 0
    };
  }
  
  _analyzeMedications(context) {
    const analysis = [];
    
    // Basic medication analysis
    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {
      analysis.push('Review for potential drug interactions');
      analysis.push('Consider medication reconciliation');
      analysis.push('Assess for unnecessary medications');
    }
    
    if (context.toLowerCase().includes('allergy')) {
      analysis.push('Verify allergy information is current');
      analysis.push('Ensure allergy alerts are active');
      analysis.push('Review for cross-sensitivity');
    }
    
    if (analysis.length === 0) {
      analysis.push('Review current medication list');
      analysis.push('Assess for drug interactions');
      analysis.push('Monitor for adverse effects');
    }
    
    return {
      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,
      json: { analysis, confidence: 'low', method: 'rule_based' },
      tokensUsed: 0
    };
  }
  
  _assessRisk(context) {
    const risks = [];
    
    // Basic risk assessment
    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {
      risks.push('Increased risk of adverse drug reactions');
      risks.push('Higher risk of falls and complications');
    }
    
    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {
      risks.push('Complex care management required');
      risks.push('Higher risk of treatment interactions');
    }
    
    if (risks.length === 0) {
      risks.push('Standard risk assessment recommended');
      risks.push('Monitor for new risk factors');
    }
    
    return {
      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,
      json: { risks, confidence: 'low', method: 'rule_based' },
      tokensUsed: 0
    };
  }
  
  _calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}

      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}


      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}




      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}



      recommendations.push('Monitor therapeutic levels and adverse effects closely');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Severe allergies'))) {

      recommendations.push('Ensure allergy information is prominently displayed and reviewed before any new medications');

    }

    

    if (riskFactors.some(rf => rf.factor.includes('Advanced age'))) {

      recommendations.push('Consider age-appropriate dosing adjustments and increased monitoring');

    }

    

    // Default safety recommendations

    if (recommendations.length === 0) {

      recommendations.push('Continue current monitoring and care plan');

      recommendations.push('Review medications for potential interactions');

      recommendations.push('Monitor for any new symptoms or adverse reactions');

    }

    

    return {

      riskFactors,

      overallRisk: Math.min(overallRisk, 10),

      recommendations

    };

  }

  

  private _generateDifferentialDiagnosis(context: string): { text: string; json?: any; tokensUsed?: number } {

    const diagnoses: string[] = [];

    

    // Basic rule-based diagnosis based on context keywords

    if (context.toLowerCase().includes('fever') && context.toLowerCase().includes('cough')) {

      diagnoses.push('Upper respiratory tract infection');

      diagnoses.push('Pneumonia');

      diagnoses.push('Bronchitis');

    }

    

    if (context.toLowerCase().includes('chest pain')) {

      diagnoses.push('Angina');

      diagnoses.push('Myocardial infarction');

      diagnoses.push('Gastroesophageal reflux disease');

      diagnoses.push('Costochondritis');

    }

    

    if (context.toLowerCase().includes('shortness of breath')) {

      diagnoses.push('Asthma');

      diagnoses.push('Chronic obstructive pulmonary disease');

      diagnoses.push('Heart failure');

      diagnoses.push('Pulmonary embolism');

    }

    

    if (context.toLowerCase().includes('abdominal pain')) {

      diagnoses.push('Gastritis');

      diagnoses.push('Peptic ulcer disease');

      diagnoses.push('Appendicitis');

      diagnoses.push('Cholecystitis');

    }

    

    if (diagnoses.length === 0) {

      diagnoses.push('Insufficient clinical information for differential diagnosis');

    }

    

    return {

      text: `Based on the provided context, consider the following differential diagnoses:\n\n${diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nNote: This is a basic rule-based analysis. For comprehensive evaluation, consider additional clinical information and testing.`,

      json: { diagnoses, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _generateTreatmentPlan(context: string): { text: string; json?: any; tokensUsed?: number } {

    const treatments: string[] = [];

    

    // Basic treatment recommendations based on context

    if (context.toLowerCase().includes('fever')) {

      treatments.push('Acetaminophen or ibuprofen for fever control');

      treatments.push('Adequate hydration');

    }

    

    if (context.toLowerCase().includes('pain')) {

      treatments.push('Appropriate pain management based on severity');

      treatments.push('Consider non-pharmacological interventions');

    }

    

    if (context.toLowerCase().includes('infection')) {

      treatments.push('Antibiotics if bacterial infection suspected');

      treatments.push('Supportive care and monitoring');

    }

    

    if (treatments.length === 0) {

      treatments.push('General supportive care and monitoring');

      treatments.push('Address underlying cause if identified');

    }

    

    return {

      text: `Treatment Plan:\n\n${treatments.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNote: This is a basic treatment framework. Individualize based on patient-specific factors and clinical judgment.`,

      json: { treatments, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _analyzeMedications(context: string): { text: string; json?: any; tokensUsed?: number } {

    const analysis: string[] = [];

    

    // Basic medication analysis

    if (context.toLowerCase().includes('multiple medications') || context.toLowerCase().includes('polypharmacy')) {

      analysis.push('Review for potential drug interactions');

      analysis.push('Consider medication reconciliation');

      analysis.push('Assess for unnecessary medications');

    }

    

    if (context.toLowerCase().includes('allergy')) {

      analysis.push('Verify allergy information is current');

      analysis.push('Ensure allergy alerts are active');

      analysis.push('Review for cross-sensitivity');

    }

    

    if (analysis.length === 0) {

      analysis.push('Review current medication list');

      analysis.push('Assess for drug interactions');

      analysis.push('Monitor for adverse effects');

    }

    

    return {

      text: `Medication Analysis:\n\n${analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nNote: This is a basic medication review. Consider comprehensive medication management review.`,

      json: { analysis, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _assessRisk(context: string): { text: string; json?: any; tokensUsed?: number } {

    const risks: string[] = [];

    

    // Basic risk assessment

    if (context.toLowerCase().includes('elderly') || context.toLowerCase().includes('age 65')) {

      risks.push('Increased risk of adverse drug reactions');

      risks.push('Higher risk of falls and complications');

    }

    

    if (context.toLowerCase().includes('multiple conditions') || context.toLowerCase().includes('comorbidities')) {

      risks.push('Complex care management required');

      risks.push('Higher risk of treatment interactions');

    }

    

    if (risks.length === 0) {

      risks.push('Standard risk assessment recommended');

      risks.push('Monitor for new risk factors');

    }

    

    return {

      text: `Risk Assessment:\n\n${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nNote: This is a basic risk assessment. Consider comprehensive evaluation based on individual factors.`,

      json: { risks, confidence: 'low', method: 'rule_based' },

      tokensUsed: 0

    };

  }

  

  private _calculateAge(dob: Date | string): number {

    const birthDate = new Date(dob);

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

      age--;

    }

    

    return age;

  }

}

