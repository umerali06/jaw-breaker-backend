// Clinical Validation Service for AI-Generated Clinical Content
// Ensures accuracy, compliance, and quality of AI-generated clinical recommendations

import azureOpenAIService from '../azureOpenAIService.js';

class ClinicalValidationService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
    this.validationRules = {
      soapNotes: this.getSOAPValidationRules(),
      oasisScores: this.getOASISValidationRules(),
      clinicalRecommendations: this.getClinicalRecommendationRules(),
      vitalSignsAnalysis: this.getVitalSignsValidationRules()
    };
  }

  /**
   * Validate SOAP note quality and compliance
   * @param {string} soapNote - Generated SOAP note
   * @param {Object} patientContext - Patient information
   * @returns {Object} Validation results
   */
  async validateSOAPNote(soapNote, patientContext = {}) {
    try {
      const validationPrompt = this.buildSOAPValidationPrompt(soapNote, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(validationPrompt, {
        systemPrompt: `You are an advanced clinical validation specialist with expertise in nursing documentation, regulatory compliance, and quality assurance.

CLINICAL EXPERTISE:
- Advanced knowledge of SOAP note standards and best practices
- Expertise in regulatory compliance (CMS, Joint Commission, state regulations)
- Understanding of evidence-based practice and clinical guidelines
- Knowledge of quality measures and documentation requirements

VALIDATION REQUIREMENTS:
- Assess clinical accuracy and completeness
- Verify regulatory compliance and documentation standards
- Check for evidence-based practice alignment
- Identify potential safety concerns or gaps
- Ensure professional language and terminology
- Validate clinical reasoning and assessment logic

RESPONSE FORMAT:
- Provide structured validation results
- Include specific recommendations for improvement
- Identify compliance issues and safety concerns
- Suggest evidence-based alternatives
- Focus on actionable improvements`
      });

      return this.parseValidationResponse(response, 'soap');
    } catch (error) {
      console.error('Error validating SOAP note:', error);
      return {
        isValid: false,
        errors: ['Validation service unavailable'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  /**
   * Validate OASIS scores for accuracy and compliance
   * @param {Object} oasisScores - Generated OASIS scores
   * @param {Object} patientContext - Patient information
   * @returns {Object} Validation results
   */
  async validateOASISScores(oasisScores, patientContext = {}) {
    try {
      const validationPrompt = this.buildOASISValidationPrompt(oasisScores, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(validationPrompt, {
        systemPrompt: `You are an advanced OASIS validation specialist with expertise in CMS home health regulations, quality measures, and clinical assessment.

CLINICAL EXPERTISE:
- Advanced knowledge of OASIS assessment and scoring criteria
- Expertise in CMS guidelines and regulatory requirements
- Understanding of home health care delivery and patient outcomes
- Knowledge of quality measures and outcome standards

VALIDATION REQUIREMENTS:
- Verify OASIS score accuracy and rationale
- Check compliance with CMS guidelines
- Assess clinical reasoning and documentation support
- Identify potential scoring errors or inconsistencies
- Ensure evidence-based assessment criteria
- Validate regulatory compliance

RESPONSE FORMAT:
- Provide structured validation results
- Include specific scoring recommendations
- Identify compliance issues and corrections needed
- Suggest evidence-based assessment criteria
- Focus on regulatory compliance and accuracy`
      });

      return this.parseValidationResponse(response, 'oasis');
    } catch (error) {
      console.error('Error validating OASIS scores:', error);
      return {
        isValid: false,
        errors: ['Validation service unavailable'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  /**
   * Validate clinical recommendations for safety and evidence base
   * @param {Array} recommendations - Generated clinical recommendations
   * @param {Object} patientContext - Patient information
   * @returns {Object} Validation results
   */
  async validateClinicalRecommendations(recommendations, patientContext = {}) {
    try {
      const validationPrompt = this.buildClinicalRecommendationValidationPrompt(recommendations, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(validationPrompt, {
        systemPrompt: `You are an advanced clinical validation specialist with expertise in evidence-based practice, patient safety, and clinical guidelines.

CLINICAL EXPERTISE:
- Advanced knowledge of evidence-based practice and clinical guidelines
- Expertise in patient safety and risk management
- Understanding of interdisciplinary care coordination
- Knowledge of regulatory compliance and quality standards

VALIDATION REQUIREMENTS:
- Verify evidence base and clinical rationale
- Check for patient safety concerns
- Assess appropriateness for patient context
- Identify potential contraindications or interactions
- Ensure regulatory compliance and best practices
- Validate clinical reasoning and decision support

RESPONSE FORMAT:
- Provide structured validation results
- Include specific safety and evidence assessments
- Identify potential risks or contraindications
- Suggest evidence-based alternatives
- Focus on patient safety and quality outcomes`
      });

      return this.parseValidationResponse(response, 'recommendations');
    } catch (error) {
      console.error('Error validating clinical recommendations:', error);
      return {
        isValid: false,
        errors: ['Validation service unavailable'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  /**
   * Validate vital signs analysis for accuracy and clinical relevance
   * @param {Object} vitalSignsAnalysis - Generated vital signs analysis
   * @param {Object} patientContext - Patient information
   * @returns {Object} Validation results
   */
  async validateVitalSignsAnalysis(vitalSignsAnalysis, patientContext = {}) {
    try {
      const validationPrompt = this.buildVitalSignsValidationPrompt(vitalSignsAnalysis, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(validationPrompt, {
        systemPrompt: `You are an advanced vital signs validation specialist with expertise in cardiovascular monitoring, respiratory assessment, and clinical decision support.

CLINICAL EXPERTISE:
- Advanced knowledge of vital signs interpretation and normal ranges
- Expertise in cardiovascular and respiratory assessment
- Understanding of sepsis screening and early warning systems
- Knowledge of evidence-based monitoring protocols

VALIDATION REQUIREMENTS:
- Verify vital signs interpretation accuracy
- Check for appropriate normal range references
- Assess clinical reasoning and assessment logic
- Identify potential safety concerns or missed alerts
- Ensure evidence-based monitoring protocols
- Validate clinical decision support recommendations

RESPONSE FORMAT:
- Provide structured validation results
- Include specific accuracy and safety assessments
- Identify potential missed alerts or concerns
- Suggest evidence-based monitoring protocols
- Focus on patient safety and clinical accuracy`
      });

      return this.parseValidationResponse(response, 'vitalSigns');
    } catch (error) {
      console.error('Error validating vital signs analysis:', error);
      return {
        isValid: false,
        errors: ['Validation service unavailable'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  // Validation prompt builders
  buildSOAPValidationPrompt(soapNote, patientContext) {
    return `Please validate the following SOAP note for clinical accuracy, regulatory compliance, and quality standards:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

SOAP NOTE TO VALIDATE:
${soapNote}

VALIDATION CRITERIA:
1. Clinical accuracy and completeness
2. Regulatory compliance (CMS, Joint Commission)
3. Evidence-based practice alignment
4. Professional language and terminology
5. Clinical reasoning and assessment logic
6. Safety concerns or gaps

Please provide structured validation results with specific recommendations.`;
  }

  buildOASISValidationPrompt(oasisScores, patientContext) {
    return `Please validate the following OASIS scores for accuracy, compliance, and clinical rationale:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

OASIS SCORES TO VALIDATE:
${JSON.stringify(oasisScores, null, 2)}

VALIDATION CRITERIA:
1. OASIS score accuracy and rationale
2. CMS guideline compliance
3. Clinical reasoning and documentation support
4. Scoring consistency and logic
5. Evidence-based assessment criteria
6. Regulatory compliance

Please provide structured validation results with specific recommendations.`;
  }

  buildClinicalRecommendationValidationPrompt(recommendations, patientContext) {
    return `Please validate the following clinical recommendations for safety, evidence base, and appropriateness:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

RECOMMENDATIONS TO VALIDATE:
${JSON.stringify(recommendations, null, 2)}

VALIDATION CRITERIA:
1. Evidence base and clinical rationale
2. Patient safety and risk assessment
3. Appropriateness for patient context
4. Potential contraindications or interactions
5. Regulatory compliance and best practices
6. Clinical reasoning and decision support

Please provide structured validation results with specific recommendations.`;
  }

  buildVitalSignsValidationPrompt(vitalSignsAnalysis, patientContext) {
    return `Please validate the following vital signs analysis for accuracy, clinical relevance, and safety:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

VITAL SIGNS ANALYSIS TO VALIDATE:
${JSON.stringify(vitalSignsAnalysis, null, 2)}

VALIDATION CRITERIA:
1. Vital signs interpretation accuracy
2. Appropriate normal range references
3. Clinical reasoning and assessment logic
4. Safety concerns or missed alerts
5. Evidence-based monitoring protocols
6. Clinical decision support recommendations

Please provide structured validation results with specific recommendations.`;
  }

  // Response parsing
  parseValidationResponse(response, type) {
    try {
      // Parse the AI response to extract validation results
      const lines = response.split('\n').filter(line => line.trim());
      
      const validation = {
        isValid: true,
        score: 0,
        errors: [],
        warnings: [],
        recommendations: [],
        compliance: {
          cms: true,
          jointCommission: true,
          evidenceBased: true
        }
      };

      // Parse validation results (simplified - would need more sophisticated parsing)
      lines.forEach(line => {
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('invalid')) {
          validation.errors.push(line.trim());
          validation.isValid = false;
        } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('caution')) {
          validation.warnings.push(line.trim());
        } else if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest')) {
          validation.recommendations.push(line.trim());
        }
      });

      // Calculate validation score
      validation.score = this.calculateValidationScore(validation);

      return validation;
    } catch (error) {
      console.error('Error parsing validation response:', error);
      return {
        isValid: false,
        errors: ['Validation parsing failed'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  calculateValidationScore(validation) {
    let score = 100;
    
    // Deduct points for errors
    score -= validation.errors.length * 20;
    
    // Deduct points for warnings
    score -= validation.warnings.length * 10;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  // Validation rules
  getSOAPValidationRules() {
    return {
      requiredSections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
      clinicalTerminology: true,
      evidenceBased: true,
      regulatoryCompliance: true
    };
  }

  getOASISValidationRules() {
    return {
      cmsCompliance: true,
      evidenceBased: true,
      clinicalRationale: true,
      regulatoryStandards: true
    };
  }

  getClinicalRecommendationRules() {
    return {
      evidenceBased: true,
      patientSafety: true,
      clinicalRationale: true,
      regulatoryCompliance: true
    };
  }

  getVitalSignsValidationRules() {
    return {
      accuracy: true,
      safetyAlerts: true,
      evidenceBased: true,
      clinicalRelevance: true
    };
  }
}

export default new ClinicalValidationService();
