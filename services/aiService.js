import axios from 'axios';
import azureOpenAIService from './azureOpenAIService.js';

class AIService {
  constructor() {
    // Azure OpenAI Configuration (Primary)
    this.azureOpenAI = azureOpenAIService;
    
    // Fallback providers
    this.providers = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini'
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
        model: 'claude-3-sonnet-20240229'
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-pro'
      },
      local: {
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: 'llama2:13b'
      }
    };
    
    this.activeProvider = this.detectActiveProvider();
  }

  // Detect which AI provider is available
  detectActiveProvider() {
    // Always prioritize Azure OpenAI (gpt-5-chat)
    if (this.azureOpenAI && this.azureOpenAI.apiKey) return 'azure-openai';
    if (this.providers.openai.apiKey) return 'openai';
    if (this.providers.anthropic.apiKey) return 'anthropic';
    if (this.providers.google.apiKey) return 'google';
    if (process.env.USE_LOCAL_AI === 'true') return 'local';
    return null;
  }

  // Generate medical note using AI
  async generateMedicalNote(patientData, noteType, customPrompt, template) {
    try {
      console.log(`🤖 Generating ${noteType} note using ${this.activeProvider} AI provider`);
      
      if (!this.activeProvider) {
        throw new Error('No AI provider available. Please configure API keys or enable local AI.');
      }

      const prompt = this.buildMedicalPrompt(patientData, noteType, customPrompt, template);
      const aiResponse = await this.callAIProvider(prompt);
      
      return this.formatMedicalNote(aiResponse, patientData, noteType);
      
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error(`AI note generation failed: ${error.message}`);
    }
  }

  // Build comprehensive medical prompt
  buildMedicalPrompt(patientData, noteType, customPrompt, template) {
    const patientContext = this.extractPatientContext(patientData);
    const templateContext = template ? `\nTemplate: ${template.name}\nTemplate Description: ${template.description}` : '';
    
    return `You are an expert medical AI assistant. Generate a comprehensive, professional ${noteType} note based on the following information:

PATIENT INFORMATION:
${patientContext}

NOTE TYPE: ${noteType.toUpperCase()}
${templateContext}

CUSTOM PROMPT: ${customPrompt || 'Generate a standard clinical note'}

REQUIREMENTS:
1. Use proper medical terminology and SOAP format where appropriate
2. Include relevant clinical reasoning and differential diagnosis
3. Provide evidence-based treatment recommendations
4. Include appropriate follow-up plans
5. Maintain professional medical writing standards
6. Be comprehensive but concise
7. Focus on actionable clinical information

Generate a detailed, professional medical note that follows medical documentation standards:`;
  }

  // Extract relevant patient context for AI
  extractPatientContext(patientData) {
    let context = `Name: ${patientData.name || 'Not specified'}
Age: ${patientData.age || 'Not specified'}
Gender: ${patientData.gender || 'Not specified'}`;

    if (patientData.primaryDiagnosis) {
      context += `\nPrimary Diagnosis: ${patientData.primaryDiagnosis}`;
    }

    if (patientData.secondaryDiagnoses && patientData.secondaryDiagnoses.length > 0) {
      context += `\nSecondary Diagnoses: ${patientData.secondaryDiagnoses.join(', ')}`;
    }

    if (patientData.allergies && patientData.allergies.length > 0) {
      context += `\nAllergies: ${patientData.allergies.join(', ')}`;
    }

    if (patientData.medications && patientData.medications.length > 0) {
      const meds = patientData.medications.map(med => 
        `${med.name} ${med.dosage} ${med.frequency}`
      ).join('\n');
      context += `\nCurrent Medications:\n${meds}`;
    }

    if (patientData.notes) {
      context += `\nClinical Notes: ${patientData.notes}`;
    }

    return context;
  }

  // Call the appropriate AI provider
  async callAIProvider(prompt) {
    switch (this.activeProvider) {
      case 'azure-openai':
        return await this.callAzureOpenAI(prompt);
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'anthropic':
        return await this.callAnthropic(prompt);
      case 'google':
        return await this.callGoogle(prompt);
      case 'local':
        return await this.callLocalAI(prompt);
      default:
        throw new Error('No AI provider configured');
    }
  }

  // Azure OpenAI GPT-5 integration (Primary)
  async callAzureOpenAI(prompt) {
    try {
      const response = await this.azureOpenAI.chatWithAI(prompt, {});
      return response;
    } catch (error) {
      console.error('Azure OpenAI API error:', error.response?.data || error.message);
      throw new Error(`Azure OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // OpenAI GPT-4 integration (Fallback)
  async callOpenAI(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.openai.baseURL}/chat/completions`,
        {
          model: this.providers.openai.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert medical AI assistant specializing in clinical documentation and medical note generation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3,
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers.openai.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Anthropic Claude integration
  async callAnthropic(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.anthropic.baseURL}/messages`,
        {
          model: this.providers.anthropic.model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'x-api-key': this.providers.anthropic.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return response.data.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error.response?.data || error.message);
      throw new Error(`Anthropic API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Google Gemini integration
  async callGoogle(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.google.baseURL}/models/${this.providers.google.model}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.3,
            topP: 0.9
          }
        },
        {
          headers: {
            'x-goog-api-key': this.providers.google.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Google API error:', error.response?.data || error.message);
      throw new Error(`Google API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Local Ollama integration
  async callLocalAI(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.local.baseURL}/api/generate`,
        {
          model: this.providers.local.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 2000
          }
        }
      );

      return response.data.response;
    } catch (error) {
      console.error('Local AI error:', error.response?.data || error.message);
      throw new Error(`Local AI error: ${error.message}`);
    }
  }

  // Format the AI response into a proper medical note
  formatMedicalNote(aiResponse, patientData, noteType) {
    const timestamp = new Date().toLocaleString();
    const header = `AI Generated ${noteType} Note\n\nPatient: ${patientData.name || 'Unknown'}\nGenerated: ${timestamp}\nAI Provider: ${this.activeProvider.toUpperCase()}\n\n`;
    
    return header + aiResponse.trim();
  }

  // Get available AI providers
  getAvailableProviders() {
    const available = [];
    
    if (this.azureOpenAI && this.azureOpenAI.apiKey) available.push('Azure OpenAI GPT-5');
    if (this.providers.openai.apiKey) available.push('OpenAI GPT-4');
    if (this.providers.anthropic.apiKey) available.push('Anthropic Claude');
    if (this.providers.google.apiKey) available.push('Google Gemini');
    if (process.env.USE_LOCAL_AI === 'true') available.push('Local Ollama');
    
    return {
      active: this.activeProvider,
      available: available,
      configured: available.length > 0
    };
  }

  // Test AI provider connectivity
  async testProvider(providerName) {
    try {
      const testPrompt = 'Generate a simple test response: "Hello, this is a test."';
      let response;
      
      switch (providerName) {
        case 'azure-openai':
          response = await this.callAzureOpenAI(testPrompt);
          break;
        case 'openai':
          response = await this.callOpenAI(testPrompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(testPrompt);
          break;
        case 'google':
          response = await this.callGoogle(testPrompt);
          break;
        case 'local':
          response = await this.callLocalAI(testPrompt);
          break;
        default:
          throw new Error('Unknown provider');
      }
      
      return {
        success: true,
        provider: providerName,
        response: response,
        message: 'Provider test successful'
      };
    } catch (error) {
      return {
        success: false,
        provider: providerName,
        error: error.message,
        message: 'Provider test failed'
      };
    }
  }

  // Analyze patient document with AI
  async analyzeDocumentWithAI(documentContent) {
    try {
      console.log('🤖 Analyzing document with AI');
      
      if (!this.activeProvider) {
        console.log('⚠️ No AI provider available, using fallback analysis');
        return this.getFallbackAnalysis(documentContent);
      }

      const prompt = `You are a medical AI assistant specializing in clinical document analysis. Analyze the following medical document and extract key information:

DOCUMENT CONTENT:
${documentContent}

Please provide a structured analysis with the following components:
1. Key Findings: List the most important clinical findings, diagnoses, or observations
2. Medical Terms: Extract and list important medical terminology, conditions, and procedures
3. Risk Factors: Identify any risk factors, complications, or concerns mentioned
4. Recommendations: Extract any treatment recommendations, care instructions, or follow-up plans
5. Related Conditions: Identify related or secondary conditions mentioned
6. Medication Interactions: Note any medication interactions or contraindications
7. Care Instructions: Extract specific care instructions or patient education points
8. Confidence: Rate your confidence in this analysis (0.0 to 1.0)

Format your response as a JSON object with these exact keys:
{
  "keyFindings": ["finding1", "finding2", ...],
  "medicalTerms": ["term1", "term2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "relatedConditions": ["condition1", "condition2", ...],
  "medicationInteractions": ["interaction1", "interaction2", ...],
  "careInstructions": ["instruction1", "instruction2", ...],
  "confidence": 0.85
}`;

      const aiResponse = await this.callAIProvider(prompt);
      
      // Try to parse JSON response
      try {
        const analysis = JSON.parse(aiResponse);
        return analysis;
      } catch (parseError) {
        // If JSON parsing fails, return a structured response
        return {
          keyFindings: [aiResponse.substring(0, 200) + '...'],
          medicalTerms: [],
          riskFactors: [],
          recommendations: [],
          relatedConditions: [],
          medicationInteractions: [],
          careInstructions: [],
          confidence: 0.7
        };
      }
      
    } catch (error) {
      console.error('Document analysis error:', error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  // Generate knowledge recommendations based on analysis
  async generateKnowledgeRecommendations(keywords, medicalTerms, riskFactors) {
    try {
      console.log('🤖 Generating knowledge recommendations');
      
      if (!this.activeProvider) {
        throw new Error('No AI provider available');
      }

      const prompt = `You are a medical AI assistant specializing in nursing education and knowledge management. Based on the following clinical analysis, recommend relevant knowledge base articles for nursing professionals:

KEYWORDS: ${keywords.join(', ')}
MEDICAL TERMS: ${medicalTerms.join(', ')}
RISK FACTORS: ${riskFactors.join(', ')}

Please recommend 3-5 knowledge base articles that would be relevant for a nurse caring for this patient. For each recommendation, provide:
1. A relevant topic/category
2. A brief reason why this knowledge would be helpful
3. The relevance score (0.0 to 1.0)

Format your response as a JSON array:
[
  {
    "topic": "Diabetes Management",
    "reason": "Patient has diabetes-related conditions requiring specialized care knowledge",
    "relevance": 0.9
  },
  {
    "topic": "Fall Prevention",
    "reason": "Patient has mobility issues and fall risk factors",
    "relevance": 0.8
  }
]`;

      const aiResponse = await this.callAIProvider(prompt);
      
      try {
        const recommendations = JSON.parse(aiResponse);
        return recommendations;
      } catch (parseError) {
        // Return default recommendations if parsing fails
        return [
          {
            topic: "General Patient Care",
            reason: "Based on patient's clinical presentation",
            relevance: 0.7
          }
        ];
      }
      
    } catch (error) {
      console.error('Knowledge recommendation error:', error);
      return [];
    }
  }
}

const aiService = new AIService();

// Export specific functions for Knowledge & Training module
export const analyzeDocumentWithAI = (documentContent) => aiService.analyzeDocumentWithAI(documentContent);
export const generateKnowledgeRecommendations = (keywords, medicalTerms, riskFactors) => aiService.generateKnowledgeRecommendations(keywords, medicalTerms, riskFactors);

export default aiService;
