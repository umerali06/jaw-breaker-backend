import { BaseAIService } from '../../provider.js';

export class OpenAIProvider extends BaseAIService {
  constructor() {
    super();
    this.name = 'openai';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
  }
  
  async _processPromptInternal(prompt, context, options = {}) {
    const systemPrompt = `You are a medical AI assistant. You must ONLY provide information based on the patient context and documents provided. 
    
    IMPORTANT RULES:
    1. NEVER generate fake, sample, or placeholder medical information
    2. ONLY use information from the provided patient context and documents
    3. If you cannot find relevant information in the provided context, respond with "insufficient_data"
    4. Always cite specific information from the provided documents
    5. Be precise and clinical in your responses
    6. If asked for differential diagnosis, only suggest conditions that have supporting evidence in the documents
    
    Patient Context:
    ${context}
    
    Doctor's Question/Prompt:
    ${prompt}`;
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        max_tokens: options.maxTokens || 2000,
        stream: false
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Check if the response indicates insufficient data
    if (content.toLowerCase().includes('insufficient_data') || 
        content.toLowerCase().includes('no supporting patient documents')) {
      throw new Error('insufficient_data');
    }
    
    // Try to parse JSON if the response looks like structured data
    let jsonOutput;
    try {
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonOutput = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors, continue with text output
    }
    
    return {
      text: content,
      json: jsonOutput,
      tokensUsed: data.usage?.total_tokens || 0
    };
  }
  
  async _extractEntitiesInternal(text, options = {}) {
    const prompt = `Extract medical entities from the following text. Return only entities that are explicitly mentioned in the text. Do not generate or infer entities.
    
    Text to analyze:
    ${text}
    
    Extract the following entity types if present:
    - Symptoms
    - Diagnoses
    - Medications
    - Lab values
    - Procedures
    - Body parts
    - Vital signs
    
    Format your response as a JSON array with each entity having: text, type, confidence (0.0-1.0), start (character position), end (character position).
    
    If no relevant entities are found, return an empty array.`;
    
    const response = await this._processPromptInternal(prompt, '', options);
    
    try {
      const entities = JSON.parse(response.text);
      if (Array.isArray(entities)) {
        return { entities };
      }
    } catch (e) {
      // If JSON parsing fails, try to extract entities using regex patterns
      return this._fallbackEntityExtraction(text);
    }
    
    return { entities: [] };
  }
  
  async _analyzeRiskInternal(data, options = {}) {
    const prompt = `Analyze the following patient data for risk factors. Only identify risks that have clear evidence in the data provided. Do not generate hypothetical or generic risks.
    
    Patient Data:
    ${JSON.stringify(data, null, 2)}
    
    Analyze for:
    1. Medication-related risks (interactions, contraindications)
    2. Clinical risks based on lab values, vital signs, or documented conditions
    3. Demographic or lifestyle risks if documented
    
    Return your analysis as a JSON object with:
    - riskFactors: array of { factor, score (0-10), confidence (0.0-1.0), evidence }
    - overallRisk: overall risk score (0-10)
    - recommendations: specific, actionable recommendations based on identified risks
    
    If no clear risk factors are identified in the data, return minimal risk scores and generic safety recommendations.`;
    
    const response = await this._processPromptInternal(prompt, '', options);
    
    try {
      const analysis = JSON.parse(response.text);
      return {
        riskFactors: analysis.riskFactors || [],
        overallRisk: analysis.overallRisk || 0,
        recommendations: analysis.recommendations || []
      };
    } catch (e) {
      // Fallback to basic risk assessment
      return this._fallbackRiskAssessment(data);
    }
  }
  
  _fallbackEntityExtraction(text) {
    const entities = [];
    
    // Simple regex-based extraction for common medical terms
    const patterns = [
      { type: 'symptom', regex: /\b(fever|pain|headache|nausea|vomiting|diarrhea|cough|shortness of breath|fatigue|weakness)\b/gi },
      { type: 'medication', regex: /\b(aspirin|ibuprofen|acetaminophen|amoxicillin|metformin|lisinopril|atorvastatin)\b/gi },
      { type: 'diagnosis', regex: /\b(diabetes|hypertension|asthma|pneumonia|heart disease|stroke|cancer)\b/gi },
      { type: 'lab_value', regex: /\b(glucose|cholesterol|blood pressure|heart rate|temperature|hemoglobin|creatinine)\b/gi }
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: pattern.type,
          confidence: 0.6, // Lower confidence for regex-based extraction
          start: match.index,
          end: match.index + match[0].length
        });
      }
    });
    
    return { entities };
  }
  
  _fallbackRiskAssessment(data) {
    const riskFactors = [];
    let overallRisk = 0;
    
    // Basic medication interaction check
    if (data.medications && data.medications.length > 1) {
      riskFactors.push({
        factor: 'Multiple medications',
        score: 3,
        confidence: 0.7,
        evidence: ['Patient is taking multiple medications']
      });
      overallRisk += 3;
    }
    
    // Basic allergy check
    if (data.allergies && data.allergies.length > 0) {
      riskFactors.push({
        factor: 'Known allergies',
        score: 2,
        confidence: 0.8,
        evidence: ['Patient has documented allergies']
      });
      overallRisk += 2;
    }
    
    const recommendations = [
      'Review medication list for potential interactions',
      'Monitor for adverse reactions',
      'Ensure allergy information is prominently displayed'
    ];
    
    return {
      riskFactors,
      overallRisk: Math.min(overallRisk, 10),
      recommendations
    };
  }
}