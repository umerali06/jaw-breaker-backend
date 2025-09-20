import { v4 as uuidv4 } from 'uuid';

// JavaScript implementation of AI service provider abstraction

// Base AI Service class
export class BaseAIService {
  constructor() {
    this.name = 'base';
  }
  
  async processPrompt(prompt, context, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this._processPromptInternal(prompt, context, options);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        text: result.text,
        json: result.json,
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          tokensUsed: result.tokensUsed || 0,
          processingTime,
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.9
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        text: '',
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          tokensUsed: 0,
          processingTime,
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.9
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async extractEntities(text, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this._extractEntitiesInternal(text, options);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        entities: result.entities,
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          processingTime
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        entities: [],
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          processingTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async analyzeRisk(data, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this._analyzeRiskInternal(data, options);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        riskFactors: result.riskFactors,
        overallRisk: result.overallRisk,
        recommendations: result.recommendations,
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          processingTime
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        riskFactors: [],
        overallRisk: 0,
        recommendations: [],
        metadata: {
          provider: this.name,
          model: options.model || 'default',
          processingTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Methods to be implemented by specific providers
  async _processPromptInternal(prompt, context, options) {
    throw new Error('_processPromptInternal must be implemented by subclass');
  }
  
  async _extractEntitiesInternal(text, options) {
    throw new Error('_extractEntitiesInternal must be implemented by subclass');
  }
  
  async _analyzeRiskInternal(data, options) {
    throw new Error('_analyzeRiskInternal must be implemented by subclass');
  }
}

// AI Service Manager
export class AIServiceManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = 'openai';
    this.initializeProviders();
  }
  
  async initializeProviders() {
    try {
    // Initialize available providers based on environment
    if (process.env.OPENAI_API_KEY) {
        const { OpenAIProvider } = await import('./providers/llm/openai.js');
      this.registerProvider('openai', new OpenAIProvider());
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
        try {
          const { AnthropicProvider } = await import('./providers/llm/anthropic.js');
      this.registerProvider('anthropic', new AnthropicProvider());
        } catch (error) {
          console.log('Anthropic provider not available:', error.message);
        }
    }
    
    // Local rule-based provider is always available
      const { LocalRuleBasedProvider } = await import('./providers/risk/local.js');
    this.registerProvider('local', new LocalRuleBasedProvider());
    
    // Set default provider
    if (this.providers.has('openai')) {
      this.defaultProvider = 'openai';
    } else if (this.providers.has('anthropic')) {
      this.defaultProvider = 'anthropic';
    } else {
      this.defaultProvider = 'local';
      }
    } catch (error) {
      console.error('Error initializing AI providers:', error.message);
      // Ensure local provider is available as fallback
      try {
        const { LocalRuleBasedProvider } = await import('./providers/risk/local.js');
        this.registerProvider('local', new LocalRuleBasedProvider());
        this.defaultProvider = 'local';
      } catch (fallbackError) {
        console.error('Failed to initialize fallback provider:', fallbackError.message);
      }
    }
  }
  
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }
  
  getProvider(name) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    
    return provider;
  }
  
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }
  
  async processPrompt(prompt, context, options = {}) {
    const provider = this.getProvider(options.provider);
    return provider.processPrompt(prompt, context, options);
  }
  
  async extractEntities(text, options = {}) {
    const provider = this.getProvider(options.provider);
    return provider.extractEntities(text, options);
  }
  
  async analyzeRisk(data, options = {}) {
    const provider = this.getProvider(options.provider);
    return provider.analyzeRisk(data, options);
  }
  
  // Context builder for patient documents
  buildPatientContext(patientData, documentTexts) {
    let context = `Patient Information:\n`;
    
    if (patientData.demographics) {
      context += `- Name: ${patientData.demographics.name}\n`;
      context += `- Date of Birth: ${patientData.demographics.dob}\n`;
      context += `- Sex: ${patientData.demographics.sex}\n`;
    }
    
    if (patientData.currentMedications && patientData.currentMedications.length > 0) {
      context += `\nCurrent Medications:\n`;
      patientData.currentMedications.forEach((med) => {
        context += `- ${med.name} ${med.dose} ${med.route} ${med.frequency}\n`;
      });
    }
    
    if (patientData.allergies && patientData.allergies.length > 0) {
      context += `\nAllergies:\n`;
      patientData.allergies.forEach((allergy) => {
        context += `- ${allergy.substance}: ${allergy.reaction} (${allergy.severity})\n`;
      });
    }
    
    if (documentTexts.length > 0) {
      context += `\nRelevant Documents:\n`;
      documentTexts.forEach((text, index) => {
        context += `Document ${index + 1}:\n${text}\n\n`;
      });
    }
    
    return context;
  }
  
  // Validate that AI output is based on provided context
  validateOutputAgainstContext(output, context) {
    // Simple validation - check if output contains references to patient-specific information
    const patientInfo = context.match(/Name: ([^\n]+)|Date of Birth: ([^\n]+)|Sex: ([^\n]+)/g);
    
    if (patientInfo && patientInfo.length > 0) {
      // Check if output contains some patient-specific information
      return patientInfo.some(info => output.includes(info.split(': ')[1]));
    }
    
    // If no specific patient info, check if output is generic
    const genericPhrases = [
      'patient presents with',
      'based on the provided information',
      'according to the documents',
      'the patient has',
      'clinical findings include'
    ];
    
    return genericPhrases.some(phrase => output.toLowerCase().includes(phrase));
  }
}

// Export singleton instance
export const aiServiceManager = new AIServiceManager();
export default aiServiceManager;