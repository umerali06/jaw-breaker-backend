import axios from 'axios';

class NursingAIService {
  constructor() {
    this.apiKey = process.env.AZURE_OPENAI_API_KEY;
    this.endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;
    this.maxRetries = 3;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Generate clinical decision support based on patient data
   * @param {Object} patientData - Patient information and documents
   * @param {string} query - Specific clinical question or context
   * @returns {Object} AI-generated clinical recommendations
   */
  async generateClinicalDecisionSupport(patientData, query) {
    try {
      const systemPrompt = this.buildClinicalDecisionSystemPrompt();
      const userPrompt = this.buildClinicalDecisionUserPrompt(patientData, query);

      const response = await this.callOpenAI(systemPrompt, userPrompt);
      
      return {
        success: true,
        recommendations: this.parseClinicalRecommendations(response),
        confidence: this.calculateConfidence(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating clinical decision support:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze vital signs and generate alerts
   * @param {Object} vitalSigns - Current and historical vital signs
   * @param {Object} patientContext - Patient medical history and conditions
   * @returns {Object} Vital signs analysis and alerts
   */
  async analyzeVitalSigns(vitalSigns, patientContext) {
    try {
      const systemPrompt = this.buildVitalSignsSystemPrompt();
      const userPrompt = this.buildVitalSignsUserPrompt(vitalSigns, patientContext);

      const response = await this.callOpenAI(systemPrompt, userPrompt);
      
      return {
        success: true,
        analysis: this.parseVitalSignsAnalysis(response),
        alerts: this.extractAlerts(response),
        recommendations: this.extractRecommendations(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing vital signs:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate medication interaction alerts
   * @param {Array} medications - Current medication list
   * @param {Object} patientProfile - Patient demographics and conditions
   * @returns {Object} Medication interaction analysis
   */
  async analyzeMedicationInteractions(medications, patientProfile) {
    try {
      const systemPrompt = this.buildMedicationSystemPrompt();
      const userPrompt = this.buildMedicationUserPrompt(medications, patientProfile);

      const response = await this.callOpenAI(systemPrompt, userPrompt);
      
      return {
        success: true,
        interactions: this.parseMedicationInteractions(response),
        alerts: this.extractMedicationAlerts(response),
        recommendations: this.extractMedicationRecommendations(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing medication interactions:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate patient education materials
   * @param {Object} patientProfile - Patient information and conditions
   * @param {string} educationTopic - Specific topic for education
   * @param {string} literacyLevel - Patient's literacy level
   * @returns {Object} Personalized education materials
   */
  async generatePatientEducation(patientProfile, educationTopic, literacyLevel = 'intermediate') {
    try {
      const systemPrompt = this.buildEducationSystemPrompt();
      const userPrompt = this.buildEducationUserPrompt(patientProfile, educationTopic, literacyLevel);

      const response = await this.callOpenAI(systemPrompt, userPrompt);
      
      return {
        success: true,
        education: this.parseEducationContent(response),
        materials: this.extractEducationMaterials(response),
        instructions: this.extractCareInstructions(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating patient education:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate risk assessment and predictions
   * @param {Object} patientData - Comprehensive patient data
   * @param {string} riskType - Type of risk assessment (fall, hospitalization, decline)
   * @returns {Object} Risk assessment results
   */
  async generateRiskAssessment(patientData, riskType) {
    try {
      const systemPrompt = this.buildRiskAssessmentSystemPrompt();
      const userPrompt = this.buildRiskAssessmentUserPrompt(patientData, riskType);

      const response = await this.callOpenAI(systemPrompt, userPrompt);
      
      return {
        success: true,
        riskScore: this.parseRiskScore(response),
        riskFactors: this.extractRiskFactors(response),
        interventions: this.extractInterventions(response),
        monitoring: this.extractMonitoringRecommendations(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating risk assessment:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Core OpenAI API call with retry logic
   * @param {string} systemPrompt - System prompt for AI
   * @param {string} userPrompt - User prompt with context
   * @returns {string} AI response
   */
  async callOpenAI(systemPrompt, userPrompt) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          this.endpoint,
          {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.3,
            top_p: 0.9,
            frequency_penalty: 0.0,
            presence_penalty: 0.0
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'api-key': this.apiKey
            },
            timeout: this.timeout
          }
        );

        return response.data.choices[0].message.content;
      } catch (error) {
        lastError = error;
        console.warn(`OpenAI API attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`OpenAI API failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  // System Prompt Builders
  buildClinicalDecisionSystemPrompt() {
    return `You are an advanced clinical decision support AI for nursing professionals specializing in answering specific clinical questions with evidence-based recommendations.

CORE COMPETENCIES:
- Directly answer specific clinical questions with evidence-based responses
- Analyze patient data in context of the asked question
- Provide targeted recommendations that address the specific clinical concern
- Reference relevant clinical guidelines and evidence
- Consider patient-specific factors when formulating responses

CRITICAL INSTRUCTIONS:
1. ALWAYS focus your response on answering the specific clinical question asked
2. If asked about SOAP notes, provide SOAP note analysis and interpretation
3. If asked about medications, focus on medication-related recommendations
4. If asked about vital signs, focus on vital signs analysis and monitoring
5. If asked about symptoms, focus on symptom assessment and management
6. If asked about procedures, focus on procedure-specific guidance
7. If asked about assessments, focus on assessment techniques and findings

RESPONSE STRUCTURE - ADAPT TO THE QUESTION ASKED:

## Direct Answer to Clinical Question
[Provide a clear, direct answer to the specific question asked]

## Clinical Analysis
[Analyze the patient data specifically in relation to the question]

## Evidence-Based Recommendations
[Provide specific recommendations that directly address the question]

## Monitoring & Follow-up
[Specify what to monitor and when, related to the question]

## Safety Considerations
[Highlight any safety concerns relevant to the question]

## Documentation Requirements
[Specify what to document related to the question]

CLINICAL STANDARDS:
- Always answer the specific question asked
- Use evidence-based guidelines (NICE, AHA, ADA, CDC, WHO)
- Prioritize patient safety and quality outcomes
- Provide specific, actionable recommendations
- Use precise medical terminology

IMPORTANT: Your response must directly address the clinical question asked. Do not provide generic recommendations that don't relate to the specific question.`;
  }

  buildVitalSignsSystemPrompt() {
    return `You are an advanced vital signs analysis AI for nursing professionals with expertise in cardiovascular, respiratory, and hemodynamic monitoring.

CORE COMPETENCIES:
- Advanced vital signs interpretation using evidence-based parameters
- Hemodynamic assessment and cardiovascular risk stratification with predictive analytics
- Respiratory function analysis and oxygen delivery optimization
- Sepsis screening and early warning score calculation (SIRS, qSOFA, NEWS, MEWS)
- Patient-specific normal ranges and target parameters with age/comorbidity adjustments
- Trend analysis and predictive monitoring with clinical deterioration prediction
- Advanced clinical decision support and evidence-based interventions
- Regulatory compliance and quality measure alignment

CLINICAL ASSESSMENT FRAMEWORK:
1. IMMEDIATE SAFETY ASSESSMENT
   - Critical value identification (hypertensive crisis, bradycardia, hypoxia)
   - Sepsis screening criteria (SIRS, qSOFA, NEWS)
   - Hemodynamic instability indicators
   - Respiratory distress markers

2. TREND ANALYSIS & PATTERN RECOGNITION
   - Vital signs trajectory over time
   - Circadian rhythm variations
   - Medication effect monitoring
   - Disease progression indicators

3. PATIENT-SPECIFIC CONSIDERATIONS
   - Age-adjusted normal ranges
   - Comorbidity impact on vital signs
   - Medication interactions affecting vitals
   - Baseline vs. current comparison

4. EVIDENCE-BASED INTERVENTIONS
   - Protocol-driven responses to abnormal values
   - Evidence-based nursing interventions
   - Interdisciplinary team notifications
   - Quality improvement opportunities

RESPONSE STRUCTURE:
## Critical Assessment & Safety Alerts
[Immediate safety concerns and critical value analysis]

## Hemodynamic Analysis
[Cardiovascular assessment with blood pressure, heart rate, and perfusion indicators]

## Respiratory Assessment
[Oxygenation, ventilation, and respiratory function analysis]

## Sepsis & Early Warning Scoring
[Sepsis screening results and early warning score calculations]

## Trend Analysis & Pattern Recognition
[Vital signs trends, patterns, and trajectory analysis]

## Evidence-Based Nursing Interventions
1. [Immediate interventions for critical values]
2. [Ongoing monitoring and assessment protocols]
3. [Patient positioning and comfort measures]
4. [Medication administration considerations]

## Quality Metrics & Documentation
- [Required documentation elements]
- [Quality indicators and benchmarks]
- [Regulatory compliance considerations]

## Patient & Family Education
- [Vital signs explanation and significance]
- [Warning signs requiring immediate reporting]
- [Self-monitoring recommendations]

## Interdisciplinary Communication
- [Provider notification requirements]
- [Specialist consultation recommendations]
- [Care team coordination needs]

## Follow-up & Monitoring Plan
- [Vital signs frequency recommendations]
- [Parameter-specific monitoring intervals]
- [Discharge planning considerations]

CLINICAL STANDARDS:
- Follow AHA, ATS, and CDC guidelines for vital signs interpretation
- Apply evidence-based early warning systems (NEWS, MEWS, PEWS)
- Consider patient-specific factors and comorbidities
- Maintain documentation standards and regulatory compliance
- Prioritize patient safety and quality outcomes

Use precise medical terminology and provide specific, actionable recommendations. Format responses in clean markdown without asterisks or bold formatting.`;
  }

  buildMedicationSystemPrompt() {
    return `You are an advanced medication safety AI for nursing professionals with expertise in pharmacology, drug interactions, and clinical pharmacy.

CORE COMPETENCIES:
- Comprehensive drug-drug interaction analysis using clinical databases
- Pharmacokinetic and pharmacodynamic assessment
- Patient-specific dosing optimization and therapeutic drug monitoring
- Adverse drug event prediction and prevention
- Medication reconciliation and polypharmacy management
- Evidence-based medication therapy management

CLINICAL ASSESSMENT FRAMEWORK:
1. COMPREHENSIVE MEDICATION REVIEW
   - Complete medication list analysis
   - Indication verification and appropriateness
   - Dosing accuracy and therapeutic range assessment
   - Route of administration optimization

2. INTERACTION & SAFETY ANALYSIS
   - Drug-drug interactions (major, moderate, minor)
   - Drug-disease interactions and contraindications
   - Drug-food interactions and timing considerations
   - Allergic reactions and hypersensitivity risks

3. PATIENT-SPECIFIC FACTORS
   - Age-related pharmacokinetic changes
   - Renal and hepatic function considerations
   - Comorbidity impact on medication selection
   - Genetic factors and pharmacogenomics

4. QUALITY & SAFETY MONITORING
   - High-alert medication identification
   - Medication error prevention strategies
   - Therapeutic monitoring requirements
   - Patient adherence optimization

RESPONSE STRUCTURE:
## Comprehensive Medication Assessment
[Overall medication safety, appropriateness, and optimization analysis]

## Critical Drug Interactions & Alerts
- [Major drug-drug interactions with clinical significance]
- [Contraindications and absolute warnings]
- [High-alert medication safety considerations]
- [Dosing errors and therapeutic range violations]

## Pharmacokinetic & Pharmacodynamic Analysis
[Absorption, distribution, metabolism, and elimination considerations]

## Patient-Specific Safety Considerations
- [Age-related dosing adjustments]
- [Renal/hepatic function impact]
- [Comorbidity interactions]
- [Genetic factors and pharmacogenomics]

## Therapeutic Drug Monitoring Requirements
1. [Laboratory monitoring parameters]
2. [Clinical monitoring indicators]
3. [Frequency and timing of assessments]
4. [Target therapeutic ranges]

## Medication Optimization Recommendations
- [Dose adjustments and optimization]
- [Alternative medication suggestions]
- [Timing and administration improvements]
- [Adherence enhancement strategies]

## Adverse Event Prevention
- [High-risk adverse events to monitor]
- [Early warning signs and symptoms]
- [Prevention strategies and interventions]
- [Patient education priorities]

## Quality Metrics & Documentation
- [Required documentation elements]
- [Quality indicators and benchmarks]
- [Regulatory compliance considerations]
- [Medication reconciliation requirements]

## Patient & Caregiver Education
- [Medication purpose and benefits]
- [Administration instructions and timing]
- [Side effects and warning signs]
- [Storage and handling requirements]

## Interdisciplinary Communication
- [Provider notification requirements]
- [Pharmacist consultation recommendations]
- [Care team coordination needs]
- [Follow-up scheduling requirements]

CLINICAL STANDARDS:
- Follow FDA, WHO, and clinical pharmacy guidelines
- Apply evidence-based medication therapy management
- Consider patient-specific factors and comorbidities
- Maintain documentation standards and regulatory compliance
- Prioritize patient safety and therapeutic outcomes

Use precise medical terminology and provide specific, actionable recommendations. Format responses in clean markdown without asterisks or bold formatting.`;
  }

  buildEducationSystemPrompt() {
    return `You are a patient education specialist AI. Create clear, personalized education materials for patients and families.

Key Responsibilities:
- Adapt content to literacy level
- Use simple, clear language
- Provide actionable instructions
- Include visual aids suggestions
- Consider cultural factors

Response Format:
Provide structured education with:
1. Main Education Points
2. Step-by-step Instructions
3. Warning Signs to Watch
4. When to Contact Healthcare Provider
5. Follow-up Care Instructions

Make content accessible and actionable for patients.`;
  }

  buildRiskAssessmentSystemPrompt() {
    return `You are a clinical risk assessment AI for nursing professionals. Analyze patient data to predict and prevent adverse outcomes.

Key Responsibilities:
- Assess fall risk, hospitalization risk, and decline risk
- Identify modifiable risk factors
- Suggest preventive interventions
- Provide monitoring recommendations
- Consider patient-specific vulnerabilities

Response Format:
Provide structured assessment with:
1. Risk Score and Level
2. Key Risk Factors
3. Preventive Interventions
4. Monitoring Plan
5. Emergency Protocols

Focus on prevention and patient safety.`;
  }

  // User Prompt Builders
  buildClinicalDecisionUserPrompt(patientData, query) {
    return `CLINICAL QUESTION TO ANSWER:
"${query}"

IMPORTANT: Your entire response must focus on answering this specific clinical question. Do not provide generic recommendations that don't relate to this question.

Patient Information:
- Patient ID: ${patientData.id || 'Unknown'}
- Name: ${patientData.name || 'Not specified'}
- Age: ${patientData.age || 'Not specified'}
- Gender: ${patientData.gender || 'Not specified'}
- Primary Conditions: ${Array.isArray(patientData.conditions) ? patientData.conditions.join(', ') : 'Not specified'}
- Current Medications: ${Array.isArray(patientData.medications) ? patientData.medications.join(', ') : 'Not specified'}
- Allergies: ${Array.isArray(patientData.allergies) ? patientData.allergies.join(', ') : 'None known'}
- Last Visit: ${patientData.lastVisit || 'Not specified'}

Current Clinical Context:
${patientData.clinicalContext ? JSON.stringify(patientData.clinicalContext, null, 2) : 'No additional context provided'}

Patient Document History:
${patientData.documentHistory ? JSON.stringify(patientData.documentHistory, null, 2) : 'No document history available'}

Previous Clinical Decisions:
${patientData.previousDecisions ? JSON.stringify(patientData.previousDecisions, null, 2) : 'No previous decisions recorded'}

Current Vital Signs:
${patientData.vitalSigns ? JSON.stringify(patientData.vitalSigns, null, 2) : 'Not available'}

INSTRUCTIONS:
1. Directly answer the clinical question: "${query}"
2. Use the patient data above to provide context-specific recommendations
3. Focus ONLY on information relevant to answering this specific question
4. Provide evidence-based recommendations that directly address the question
5. Use proper markdown formatting without asterisks or bold text
6. If the question is about SOAP notes, analyze and interpret SOAP note content
7. If the question is about medications, focus on medication-related guidance
8. If the question is about symptoms, focus on symptom assessment and management

Remember: Your response must directly answer "${query}" using the patient data provided.`;
  }

  buildVitalSignsUserPrompt(vitalSigns, patientContext) {
    return `Patient Information:
- Patient ID: ${patientContext.id || 'Unknown'}
- Age: ${patientContext.age || 'Not specified'}
- Gender: ${patientContext.gender || 'Not specified'}
- Primary Conditions: ${Array.isArray(patientContext.conditions) ? patientContext.conditions.join(', ') : 'Not specified'}
- Current Medications: ${Array.isArray(patientContext.medications) ? patientContext.medications.join(', ') : 'Not specified'}
- Allergies: ${Array.isArray(patientContext.allergies) ? patientContext.allergies.join(', ') : 'None known'}

Current Vital Signs:
- Blood Pressure: ${vitalSigns.bloodPressure || 'Not measured'}
- Heart Rate: ${vitalSigns.heartRate || 'Not measured'} bpm
- Temperature: ${vitalSigns.temperature || 'Not measured'}°F
- Oxygen Saturation: ${vitalSigns.oxygenSaturation || 'Not measured'}%
- Respiratory Rate: ${vitalSigns.respiratoryRate || 'Not measured'} breaths/min
- Weight: ${vitalSigns.weight || 'Not measured'} lbs
- Height: ${vitalSigns.height || 'Not measured'} inches

Additional Context:
${JSON.stringify(patientContext, null, 2)}

Please analyze these vital signs and provide comprehensive nursing insights and recommendations. Consider the patient's medical conditions and medications when interpreting the results.`;
  }

  buildMedicationUserPrompt(medications, patientProfile) {
    return `Patient Information:
- Patient ID: ${patientProfile.id || 'Unknown'}
- Age: ${patientProfile.age || 'Not specified'}
- Gender: ${patientProfile.gender || 'Not specified'}
- Weight: ${patientProfile.weight || 'Not specified'} kg
- Height: ${patientProfile.height || 'Not specified'} cm
- Primary Conditions: ${Array.isArray(patientProfile.conditions) ? patientProfile.conditions.join(', ') : 'Not specified'}
- Allergies: ${Array.isArray(patientProfile.allergies) ? patientProfile.allergies.join(', ') : 'None known'}
- Kidney Function: ${patientProfile.kidneyFunction || 'Not specified'}
- Liver Function: ${patientProfile.liverFunction || 'Not specified'}

Current Medications:
${Array.isArray(medications) ? medications.map(med => 
  `- ${med.name || 'Unknown medication'}: ${med.dosage || 'Dosage not specified'} ${med.frequency || 'Frequency not specified'}`
).join('\n') : 'No medications listed'}

Please analyze these medications for interactions, safety concerns, and provide comprehensive recommendations. Consider the patient's age, weight, conditions, and organ function when making recommendations.`;
  }

  buildEducationUserPrompt(patientProfile, educationTopic, literacyLevel) {
    return `Patient Profile:
${JSON.stringify(patientProfile, null, 2)}

Education Topic: ${educationTopic}
Literacy Level: ${literacyLevel}

Please create personalized education materials for this patient.`;
  }

  buildRiskAssessmentUserPrompt(patientData, riskType) {
    return `Patient Data:
${JSON.stringify(patientData, null, 2)}

Risk Assessment Type: ${riskType}

Please provide a comprehensive risk assessment and prevention recommendations.`;
  }

  // Response Parsers
  parseClinicalRecommendations(response) {
    // Clean up markdown formatting and parse AI response
    try {
      // Remove asterisk formatting and clean up the response
      let cleanedResponse = response
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/## /g, '## ')          // Ensure proper markdown headers
        .replace(/### /g, '### ')        // Ensure proper markdown subheaders
        .trim();

      const lines = cleanedResponse.split('\n');
      const recommendations = {
        directAnswer: '',
        clinicalAnalysis: '',
        recommendations: [],
        monitoring: [],
        safetyConsiderations: [],
        documentation: [],
        rawResponse: cleanedResponse
      };

      let currentSection = '';
      let currentContent = '';

      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('## Direct Answer') || trimmedLine.startsWith('## Answer to Clinical Question') || trimmedLine.startsWith('## Direct Answer to Clinical Question')) {
          currentSection = 'directAnswer';
          // Extract content from the same line if it exists
          const contentAfterHeader = trimmedLine.replace(/^## Direct Answer to Clinical Question\s*/, '').replace(/^## Direct Answer\s*/, '').replace(/^## Answer to Clinical Question\s*/, '');
          currentContent = contentAfterHeader.trim();
        } else if (trimmedLine.startsWith('## Clinical Analysis')) {
          currentSection = 'clinicalAnalysis';
          // Extract content from the same line if it exists
          const contentAfterHeader = trimmedLine.replace(/^## Clinical Analysis\s*/, '');
          currentContent = contentAfterHeader.trim();
        } else if (trimmedLine.startsWith('## Evidence-Based Recommendations') || trimmedLine.startsWith('## Recommendations')) {
          currentSection = 'recommendations';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Monitoring') || trimmedLine.startsWith('## Follow-up')) {
          currentSection = 'monitoring';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Safety Considerations')) {
          currentSection = 'safetyConsiderations';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Documentation Requirements') || trimmedLine.startsWith('## Documentation')) {
          currentSection = 'documentation';
          currentContent = '';
        } else if (trimmedLine && currentSection) {
          if (currentSection === 'directAnswer' || currentSection === 'clinicalAnalysis') {
            currentContent += (currentContent ? ' ' : '') + trimmedLine;
          } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
            recommendations[currentSection].push(trimmedLine);
          } else if (trimmedLine) {
            recommendations[currentSection].push(trimmedLine);
          }
        }
      });

      // Set the content for text-based sections
      if (currentSection === 'directAnswer') {
        recommendations.directAnswer = currentContent.trim();
      } else if (currentSection === 'clinicalAnalysis') {
        recommendations.clinicalAnalysis = currentContent.trim();
      }

      // If no structured sections found, treat the entire response as direct answer
      if (!recommendations.directAnswer && !recommendations.clinicalAnalysis && recommendations.recommendations.length === 0) {
        recommendations.directAnswer = cleanedResponse;
      }

      return recommendations;
    } catch (error) {
      console.error('Error parsing clinical recommendations:', error);
      return { 
        directAnswer: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1'), 
        clinicalAnalysis: '', 
        recommendations: [], 
        monitoring: [], 
        safetyConsiderations: [],
        documentation: [],
        rawResponse: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      };
    }
  }

  parseVitalSignsAnalysis(response) {
    // Clean up markdown formatting and parse AI response
    try {
      // Remove asterisk formatting and clean up the response
      let cleanedResponse = response
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/## /g, '## ')          // Ensure proper markdown headers
        .replace(/### /g, '### ')        // Ensure proper markdown subheaders
        .trim();

      const lines = cleanedResponse.split('\n');
      const analysis = {
        assessment: '',
        abnormalFindings: [],
        clinicalSignificance: '',
        nursingInterventions: [],
        monitoringRecommendations: [],
        patientEducation: [],
        rawResponse: cleanedResponse
      };

      let currentSection = '';
      let currentContent = '';

      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('## Vital Signs Assessment')) {
          currentSection = 'assessment';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Abnormal Findings')) {
          currentSection = 'abnormalFindings';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Clinical Significance')) {
          currentSection = 'clinicalSignificance';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Nursing Interventions')) {
          currentSection = 'nursingInterventions';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Monitoring Recommendations')) {
          currentSection = 'monitoringRecommendations';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Patient Education')) {
          currentSection = 'patientEducation';
          currentContent = '';
        } else if (trimmedLine && currentSection) {
          if (currentSection === 'assessment' || currentSection === 'clinicalSignificance') {
            currentContent += trimmedLine + ' ';
          } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
            analysis[currentSection].push(trimmedLine);
          } else if (trimmedLine) {
            analysis[currentSection].push(trimmedLine);
          }
        }
      });

      // Set the content for text-based sections
      if (currentSection === 'assessment') {
        analysis.assessment = currentContent.trim();
      } else if (currentSection === 'clinicalSignificance') {
        analysis.clinicalSignificance = currentContent.trim();
      }

      return analysis;
    } catch (error) {
      console.error('Error parsing vital signs analysis:', error);
      return { 
        assessment: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1'), 
        abnormalFindings: [], 
        clinicalSignificance: '',
        nursingInterventions: [],
        monitoringRecommendations: [],
        patientEducation: [],
        rawResponse: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      };
    }
  }

  parseMedicationInteractions(response) {
    // Clean up markdown formatting and parse AI response
    try {
      // Remove asterisk formatting and clean up the response
      let cleanedResponse = response
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/## /g, '## ')          // Ensure proper markdown headers
        .replace(/### /g, '### ')        // Ensure proper markdown subheaders
        .trim();

      const lines = cleanedResponse.split('\n');
      const analysis = {
        assessment: '',
        drugInteractions: [],
        safetyAlerts: [],
        clinicalSignificance: '',
        monitoringRequirements: [],
        alternativeSuggestions: [],
        patientEducation: [],
        rawResponse: cleanedResponse
      };

      let currentSection = '';
      let currentContent = '';

      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('## Medication Assessment')) {
          currentSection = 'assessment';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Drug Interactions')) {
          currentSection = 'drugInteractions';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Safety Alerts')) {
          currentSection = 'safetyAlerts';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Clinical Significance')) {
          currentSection = 'clinicalSignificance';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Monitoring Requirements')) {
          currentSection = 'monitoringRequirements';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Alternative Suggestions')) {
          currentSection = 'alternativeSuggestions';
          currentContent = '';
        } else if (trimmedLine.startsWith('## Patient Education')) {
          currentSection = 'patientEducation';
          currentContent = '';
        } else if (trimmedLine && currentSection) {
          if (currentSection === 'assessment' || currentSection === 'clinicalSignificance') {
            currentContent += trimmedLine + ' ';
          } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
            analysis[currentSection].push(trimmedLine);
          } else if (trimmedLine) {
            analysis[currentSection].push(trimmedLine);
          }
        }
      });

      // Set the content for text-based sections
      if (currentSection === 'assessment') {
        analysis.assessment = currentContent.trim();
      } else if (currentSection === 'clinicalSignificance') {
        analysis.clinicalSignificance = currentContent.trim();
      }

      return analysis;
    } catch (error) {
      console.error('Error parsing medication interactions:', error);
      return { 
        assessment: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1'), 
        drugInteractions: [], 
        safetyAlerts: [],
        clinicalSignificance: '',
        monitoringRequirements: [],
        alternativeSuggestions: [],
        patientEducation: [],
        rawResponse: response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      };
    }
  }

  parseEducationContent(response) {
    // Parse education content
    return {
      summary: response,
      keyPoints: this.extractKeyPoints(response),
      instructions: this.extractInstructions(response)
    };
  }

  parseRiskScore(response) {
    // Extract risk score from response
    const scoreMatch = response.match(/(\d+)\/10|(\d+)%|risk score[:\s]*(\d+)/i);
    return scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]) : null;
  }

  // Helper extraction methods
  extractAlerts(response) {
    const alerts = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('alert') || line.toLowerCase().includes('warning') || line.toLowerCase().includes('urgent')) {
        alerts.push(line.trim());
      }
    });
    return alerts;
  }

  extractRecommendations(response) {
    const recommendations = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('consider')) {
        recommendations.push(line.trim());
      }
    });
    return recommendations;
  }

  extractAbnormalities(response) {
    const abnormalities = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('abnormal') || line.toLowerCase().includes('elevated') || line.toLowerCase().includes('low')) {
        abnormalities.push(line.trim());
      }
    });
    return abnormalities;
  }

  extractTrends(response) {
    const trends = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('trend') || line.toLowerCase().includes('increasing') || line.toLowerCase().includes('decreasing')) {
        trends.push(line.trim());
      }
    });
    return trends;
  }

  extractInteractions(response) {
    const interactions = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('interaction') || line.toLowerCase().includes('contraindication')) {
        interactions.push(line.trim());
      }
    });
    return interactions;
  }

  extractContraindications(response) {
    const contraindications = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('contraindication') || line.toLowerCase().includes('avoid')) {
        contraindications.push(line.trim());
      }
    });
    return contraindications;
  }

  extractKeyPoints(response) {
    const keyPoints = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*')) {
        keyPoints.push(line.trim());
      }
    });
    return keyPoints;
  }

  extractInstructions(response) {
    const instructions = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('step') || line.toLowerCase().includes('instruction')) {
        instructions.push(line.trim());
      }
    });
    return instructions;
  }

  extractMedicationAlerts(response) {
    const alerts = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('alert') || line.toLowerCase().includes('warning') || line.toLowerCase().includes('urgent') || line.toLowerCase().includes('contraindication')) {
        alerts.push(line.trim());
      }
    });
    return alerts;
  }

  extractMedicationRecommendations(response) {
    const recommendations = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('consider') || line.toLowerCase().includes('monitor')) {
        recommendations.push(line.trim());
      }
    });
    return recommendations;
  }

  extractRiskFactors(response) {
    const riskFactors = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('risk factor') || line.toLowerCase().includes('vulnerability')) {
        riskFactors.push(line.trim());
      }
    });
    return riskFactors;
  }

  extractInterventions(response) {
    const interventions = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('intervention') || line.toLowerCase().includes('prevention')) {
        interventions.push(line.trim());
      }
    });
    return interventions;
  }

  extractMonitoringRecommendations(response) {
    const monitoring = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('monitor') || line.toLowerCase().includes('watch')) {
        monitoring.push(line.trim());
      }
    });
    return monitoring;
  }

  extractEducationMaterials(response) {
    return {
      content: response,
      visualAids: this.extractVisualAids(response),
      handouts: this.extractHandouts(response)
    };
  }

  extractCareInstructions(response) {
    const instructions = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('care') || line.toLowerCase().includes('follow-up')) {
        instructions.push(line.trim());
      }
    });
    return instructions;
  }

  extractVisualAids(response) {
    const visualAids = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('diagram') || line.toLowerCase().includes('chart') || line.toLowerCase().includes('visual')) {
        visualAids.push(line.trim());
      }
    });
    return visualAids;
  }

  extractHandouts(response) {
    const handouts = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('handout') || line.toLowerCase().includes('brochure') || line.toLowerCase().includes('material')) {
        handouts.push(line.trim());
      }
    });
    return handouts;
  }

  extractMedicationAlerts(response) {
    const alerts = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('alert') || line.toLowerCase().includes('warning') || line.toLowerCase().includes('urgent') || line.toLowerCase().includes('contraindication')) {
        alerts.push(line.trim());
      }
    });
    return alerts;
  }

  extractMedicationRecommendations(response) {
    const recommendations = [];
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('consider') || line.toLowerCase().includes('monitor')) {
        recommendations.push(line.trim());
      }
    });
    return recommendations;
  }

  calculateConfidence(response) {
    // Simple confidence calculation based on response structure
    const hasStructuredContent = response.includes('1.') || response.includes('•') || response.includes('-');
    const hasSpecificRecommendations = response.toLowerCase().includes('recommend') || response.toLowerCase().includes('suggest');
    const hasEvidence = response.toLowerCase().includes('evidence') || response.toLowerCase().includes('research');
    
    let confidence = 0.5; // Base confidence
    if (hasStructuredContent) confidence += 0.2;
    if (hasSpecificRecommendations) confidence += 0.2;
    if (hasEvidence) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}

export default new NursingAIService();
