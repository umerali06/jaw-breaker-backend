// Clinical Quality Assurance Service
// Ensures high-quality, accurate, and compliant AI-generated clinical content

import azureOpenAIService from '../azureOpenAIService.js';
import ClinicalValidationService from './ClinicalValidationService.js';

class ClinicalQualityAssuranceService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
    this.validationService = ClinicalValidationService;
    this.qualityMetrics = {
      accuracy: 0,
      compliance: 0,
      evidenceBase: 0,
      safety: 0,
      completeness: 0
    };
  }

  /**
   * Comprehensive quality assurance for AI-generated clinical content
   * @param {Object} content - AI-generated clinical content
   * @param {string} contentType - Type of content (soap, oasis, recommendations, etc.)
   * @param {Object} patientContext - Patient information
   * @returns {Object} Quality assurance results
   */
  async performQualityAssurance(content, contentType, patientContext = {}) {
    try {
      console.log(`Performing quality assurance for ${contentType} content`);
      
      const qualityChecks = await Promise.all([
        this.checkClinicalAccuracy(content, contentType, patientContext),
        this.checkRegulatoryCompliance(content, contentType, patientContext),
        this.checkEvidenceBase(content, contentType, patientContext),
        this.checkPatientSafety(content, contentType, patientContext),
        this.checkCompleteness(content, contentType, patientContext)
      ]);

      const qualityScore = this.calculateOverallQualityScore(qualityChecks);
      const recommendations = this.generateQualityRecommendations(qualityChecks);
      
      return {
        success: true,
        qualityScore,
        qualityChecks,
        recommendations,
        timestamp: new Date().toISOString(),
        contentType
      };
    } catch (error) {
      console.error('Error performing quality assurance:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check clinical accuracy of AI-generated content
   */
  async checkClinicalAccuracy(content, contentType, patientContext) {
    try {
      const prompt = this.buildClinicalAccuracyPrompt(content, contentType, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(prompt, {
        systemPrompt: `You are an advanced clinical accuracy specialist with expertise in evidence-based medicine, clinical guidelines, and quality assurance.

CLINICAL EXPERTISE:
- Advanced knowledge of clinical accuracy and evidence-based practice
- Expertise in clinical guidelines and best practices
- Understanding of medical terminology and clinical reasoning
- Knowledge of quality standards and accuracy requirements

ACCURACY REQUIREMENTS:
- Verify clinical accuracy and correctness
- Check medical terminology and language
- Assess clinical reasoning and logic
- Identify potential inaccuracies or errors
- Ensure evidence-based practice alignment
- Validate clinical decision support

RESPONSE FORMAT:
- Provide structured accuracy assessment
- Include specific accuracy scores and rationale
- Identify potential inaccuracies or errors
- Suggest corrections and improvements
- Focus on clinical accuracy and correctness`
      });

      return this.parseQualityCheckResponse(response, 'accuracy');
    } catch (error) {
      console.error('Error checking clinical accuracy:', error);
      return { score: 0, issues: ['Accuracy check failed'], recommendations: [] };
    }
  }

  /**
   * Check regulatory compliance of AI-generated content
   */
  async checkRegulatoryCompliance(content, contentType, patientContext) {
    try {
      const prompt = this.buildCompliancePrompt(content, contentType, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(prompt, {
        systemPrompt: `You are an advanced regulatory compliance specialist with expertise in healthcare regulations, CMS guidelines, and quality standards.

REGULATORY EXPERTISE:
- Advanced knowledge of CMS guidelines and regulations
- Expertise in Joint Commission standards and requirements
- Understanding of state and federal healthcare regulations
- Knowledge of quality measures and compliance requirements

COMPLIANCE REQUIREMENTS:
- Verify regulatory compliance and standards
- Check CMS guideline alignment
- Assess Joint Commission compliance
- Identify potential compliance issues
- Ensure quality measure alignment
- Validate documentation standards

RESPONSE FORMAT:
- Provide structured compliance assessment
- Include specific compliance scores and rationale
- Identify potential compliance issues
- Suggest corrections and improvements
- Focus on regulatory compliance and standards`
      });

      return this.parseQualityCheckResponse(response, 'compliance');
    } catch (error) {
      console.error('Error checking regulatory compliance:', error);
      return { score: 0, issues: ['Compliance check failed'], recommendations: [] };
    }
  }

  /**
   * Check evidence base of AI-generated content
   */
  async checkEvidenceBase(content, contentType, patientContext) {
    try {
      const prompt = this.buildEvidenceBasePrompt(content, contentType, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(prompt, {
        systemPrompt: `You are an advanced evidence-based practice specialist with expertise in clinical research, guidelines, and quality improvement.

EVIDENCE EXPERTISE:
- Advanced knowledge of evidence-based practice and clinical research
- Expertise in clinical guidelines and best practices
- Understanding of research methodology and evidence levels
- Knowledge of quality improvement and outcome measures

EVIDENCE REQUIREMENTS:
- Verify evidence base and clinical rationale
- Check guideline alignment and best practices
- Assess research support and evidence levels
- Identify potential evidence gaps
- Ensure evidence-based practice alignment
- Validate clinical decision support

RESPONSE FORMAT:
- Provide structured evidence assessment
- Include specific evidence scores and rationale
- Identify potential evidence gaps
- Suggest evidence-based improvements
- Focus on evidence-based practice and research`
      });

      return this.parseQualityCheckResponse(response, 'evidenceBase');
    } catch (error) {
      console.error('Error checking evidence base:', error);
      return { score: 0, issues: ['Evidence check failed'], recommendations: [] };
    }
  }

  /**
   * Check patient safety of AI-generated content
   */
  async checkPatientSafety(content, contentType, patientContext) {
    try {
      const prompt = this.buildPatientSafetyPrompt(content, contentType, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(prompt, {
        systemPrompt: `You are an advanced patient safety specialist with expertise in risk management, safety protocols, and quality improvement.

SAFETY EXPERTISE:
- Advanced knowledge of patient safety and risk management
- Expertise in safety protocols and best practices
- Understanding of adverse events and prevention
- Knowledge of quality improvement and safety measures

SAFETY REQUIREMENTS:
- Verify patient safety and risk assessment
- Check safety protocols and best practices
- Assess potential safety concerns
- Identify potential risks or hazards
- Ensure safety measure alignment
- Validate safety recommendations

RESPONSE FORMAT:
- Provide structured safety assessment
- Include specific safety scores and rationale
- Identify potential safety concerns
- Suggest safety improvements
- Focus on patient safety and risk management`
      });

      return this.parseQualityCheckResponse(response, 'safety');
    } catch (error) {
      console.error('Error checking patient safety:', error);
      return { score: 0, issues: ['Safety check failed'], recommendations: [] };
    }
  }

  /**
   * Check completeness of AI-generated content
   */
  async checkCompleteness(content, contentType, patientContext) {
    try {
      const prompt = this.buildCompletenessPrompt(content, contentType, patientContext);
      
      const response = await this.azureOpenAI.chatWithAI(prompt, {
        systemPrompt: `You are an advanced clinical completeness specialist with expertise in documentation standards, quality measures, and comprehensive care.

COMPLETENESS EXPERTISE:
- Advanced knowledge of clinical documentation and completeness
- Expertise in quality measures and standards
- Understanding of comprehensive care requirements
- Knowledge of documentation standards and requirements

COMPLETENESS REQUIREMENTS:
- Verify content completeness and thoroughness
- Check documentation standards and requirements
- Assess comprehensive care coverage
- Identify potential gaps or omissions
- Ensure quality measure alignment
- Validate comprehensive documentation

RESPONSE FORMAT:
- Provide structured completeness assessment
- Include specific completeness scores and rationale
- Identify potential gaps or omissions
- Suggest completeness improvements
- Focus on comprehensive documentation and care`
      });

      return this.parseQualityCheckResponse(response, 'completeness');
    } catch (error) {
      console.error('Error checking completeness:', error);
      return { score: 0, issues: ['Completeness check failed'], recommendations: [] };
    }
  }

  // Prompt builders
  buildClinicalAccuracyPrompt(content, contentType, patientContext) {
    return `Please assess the clinical accuracy of the following ${contentType} content:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

CONTENT TO ASSESS:
${JSON.stringify(content, null, 2)}

ACCURACY CRITERIA:
1. Clinical accuracy and correctness
2. Medical terminology and language
3. Clinical reasoning and logic
4. Evidence-based practice alignment
5. Clinical decision support accuracy
6. Professional standards

Please provide structured accuracy assessment with specific scores and recommendations.`;
  }

  buildCompliancePrompt(content, contentType, patientContext) {
    return `Please assess the regulatory compliance of the following ${contentType} content:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

CONTENT TO ASSESS:
${JSON.stringify(content, null, 2)}

COMPLIANCE CRITERIA:
1. CMS guideline compliance
2. Joint Commission standards
3. State and federal regulations
4. Quality measure alignment
5. Documentation standards
6. Regulatory requirements

Please provide structured compliance assessment with specific scores and recommendations.`;
  }

  buildEvidenceBasePrompt(content, contentType, patientContext) {
    return `Please assess the evidence base of the following ${contentType} content:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

CONTENT TO ASSESS:
${JSON.stringify(content, null, 2)}

EVIDENCE CRITERIA:
1. Evidence-based practice alignment
2. Clinical guideline support
3. Research evidence base
4. Best practice adherence
5. Clinical rationale
6. Evidence quality

Please provide structured evidence assessment with specific scores and recommendations.`;
  }

  buildPatientSafetyPrompt(content, contentType, patientContext) {
    return `Please assess the patient safety of the following ${contentType} content:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

CONTENT TO ASSESS:
${JSON.stringify(content, null, 2)}

SAFETY CRITERIA:
1. Patient safety assessment
2. Risk management protocols
3. Safety recommendations
4. Potential safety concerns
5. Adverse event prevention
6. Safety best practices

Please provide structured safety assessment with specific scores and recommendations.`;
  }

  buildCompletenessPrompt(content, contentType, patientContext) {
    return `Please assess the completeness of the following ${contentType} content:

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

CONTENT TO ASSESS:
${JSON.stringify(content, null, 2)}

COMPLETENESS CRITERIA:
1. Content completeness and thoroughness
2. Documentation standards
3. Comprehensive care coverage
4. Quality measure alignment
5. Required elements coverage
6. Comprehensive documentation

Please provide structured completeness assessment with specific scores and recommendations.`;
  }

  // Response parsing
  parseQualityCheckResponse(response, checkType) {
    try {
      const lines = response.split('\n').filter(line => line.trim());
      
      let score = 0;
      const issues = [];
      const recommendations = [];

      // Parse response for score, issues, and recommendations
      lines.forEach(line => {
        if (line.toLowerCase().includes('score') && line.includes(':')) {
          const scoreMatch = line.match(/(\d+)/);
          if (scoreMatch) {
            score = parseInt(scoreMatch[1]);
          }
        } else if (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem')) {
          issues.push(line.trim());
        } else if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest')) {
          recommendations.push(line.trim());
        }
      });

      return {
        score: Math.max(0, Math.min(100, score)),
        issues,
        recommendations,
        checkType
      };
    } catch (error) {
      console.error('Error parsing quality check response:', error);
      return {
        score: 0,
        issues: ['Parsing failed'],
        recommendations: ['Manual review recommended'],
        checkType
      };
    }
  }

  // Quality score calculation
  calculateOverallQualityScore(qualityChecks) {
    const totalScore = qualityChecks.reduce((sum, check) => sum + check.score, 0);
    return Math.round(totalScore / qualityChecks.length);
  }

  // Generate quality recommendations
  generateQualityRecommendations(qualityChecks) {
    const recommendations = [];
    
    qualityChecks.forEach(check => {
      if (check.score < 80) {
        recommendations.push({
          type: check.checkType,
          priority: check.score < 60 ? 'high' : 'medium',
          recommendations: check.recommendations
        });
      }
    });

    return recommendations;
  }
}

export default new ClinicalQualityAssuranceService();
