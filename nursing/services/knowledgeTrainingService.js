import KnowledgeBase from '../models/KnowledgeBase.js';
import TrainingModule from '../models/TrainingModule.js';
import PatientKnowledgeContext from '../models/PatientKnowledgeContext.js';
import azureOpenAIService from '../../services/azureOpenAIService.js';

class KnowledgeTrainingService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
  }

  // Knowledge Base Methods
  async createKnowledgeBase(knowledgeData) {
    try {
      const knowledge = new KnowledgeBase(knowledgeData);
      await knowledge.save();
      
      // Perform AI analysis
      await this.analyzeKnowledgeWithAI(knowledge._id);
      
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateKnowledgeBase(knowledgeId, updateData) {
    try {
      const knowledge = await KnowledgeBase.findById(knowledgeId);
      if (!knowledge) {
        return {
          success: false,
          error: 'Knowledge not found'
        };
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          knowledge[key] = updateData[key];
        }
      });

      // Update lastModified timestamp
      knowledge.lastModified = new Date();
      
      await knowledge.save();
      
      // Re-analyze with AI if content changed
      if (updateData.content && updateData.content !== knowledge.content) {
        await this.analyzeKnowledgeWithAI(knowledge._id);
      }
      
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getKnowledgeBase(knowledgeId) {
    try {
      const knowledge = await KnowledgeBase.findById(knowledgeId);
      if (!knowledge) {
        return {
          success: false,
          error: 'Knowledge not found'
        };
      }
      
      // Increment view count
      await knowledge.incrementView();
      
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error getting knowledge base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchKnowledge(query, filters = {}) {
    try {
      const knowledge = await KnowledgeBase.searchKnowledge(query, filters);
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getKnowledgeByCategory(category, limit = 20) {
    try {
      const knowledge = await KnowledgeBase.findByCategory(category)
        .limit(limit)
        .sort({ createdAt: -1 });
      
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error getting knowledge by category:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPopularKnowledge(limit = 10) {
    try {
      const knowledge = await KnowledgeBase.find({ status: 'approved', isPublic: true })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return {
        success: true,
        data: knowledge
      };
    } catch (error) {
      console.error('Error getting popular knowledge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeKnowledgeWithAI(knowledgeId) {
    try {
      const knowledge = await KnowledgeBase.findById(knowledgeId);
      if (!knowledge) {
        throw new Error('Knowledge not found');
      }

      // Perform AI analysis using Azure OpenAI
      const analysis = await this.performAIAnalysis(knowledge.content, 'knowledge');
      
      knowledge.aiAnalysis = {
        keywords: analysis.keywords || [],
        complexity: analysis.complexity || 'intermediate',
        estimatedReadTime: analysis.estimatedReadTime || 5,
        relatedTopics: analysis.relatedTopics || [],
        summary: analysis.summary || '',
        recommendations: analysis.recommendations || [],
        confidence: analysis.confidence || 0.8,
        lastAnalyzed: new Date()
      };
      
      await knowledge.save();
      
      return {
        success: true,
        data: knowledge.aiAnalysis
      };
    } catch (error) {
      console.error('Error analyzing knowledge with AI:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Training Module Methods
  async createTrainingModule(trainingData) {
    try {
      const training = new TrainingModule(trainingData);
      await training.save();
      
      // Perform AI analysis
      await this.analyzeTrainingWithAI(training._id);
      
      return {
        success: true,
        data: training
      };
    } catch (error) {
      console.error('Error creating training module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTrainingModule(trainingId) {
    try {
      const training = await TrainingModule.findById(trainingId);
      if (!training) {
        return {
          success: false,
          error: 'Training module not found'
        };
      }
      
      return {
        success: true,
        data: training
      };
    } catch (error) {
      console.error('Error getting training module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTrainingByCategory(category, limit = 20) {
    try {
      const training = await TrainingModule.findByCategory(category)
        .limit(limit)
        .sort({ createdAt: -1 });
      
      return {
        success: true,
        data: training
      };
    } catch (error) {
      console.error('Error getting training by category:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPopularTraining(limit = 10) {
    try {
      const training = await TrainingModule.find({ status: 'approved', isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return {
        success: true,
        data: training
      };
    } catch (error) {
      console.error('Error getting popular training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeTrainingWithAI(trainingId) {
    try {
      const training = await TrainingModule.findById(trainingId);
      if (!training) {
        throw new Error('Training module not found');
      }

      // Perform AI analysis using Azure OpenAI
      const content = `${training.description} ${training.objectives.join(' ')}`;
      const analysis = await this.performAIAnalysis(content, 'training');
      
      training.aiAnalysis = {
        keywords: analysis.keywords || [],
        complexity: analysis.complexity || 'intermediate',
        relatedTopics: analysis.relatedTopics || [],
        skillGaps: analysis.skillGaps || [],
        summary: analysis.summary || '',
        recommendations: analysis.recommendations || [],
        confidence: analysis.confidence || 0.8,
        lastAnalyzed: new Date()
      };
      
      await training.save();
      
      return {
        success: true,
        data: training.aiAnalysis
      };
    } catch (error) {
      console.error('Error analyzing training with AI:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Patient Knowledge Context Methods
  async getPatientKnowledgeContext(patientId, userId) {
    try {
      let context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      
      if (!context) {
        // Create new context if it doesn't exist
        context = new PatientKnowledgeContext({
          patientId,
          userId,
          carePlanIntegration: {
            activeConditions: [],
            medications: [],
            procedures: [],
            riskFactors: [],
            careGoals: []
          }
        });
        await context.save();
      }
      
      return {
        success: true,
        data: context
      };
    } catch (error) {
      console.error('Error getting patient knowledge context:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzePatientDocument(patientId, userId, documentData) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      // Perform AI analysis on the document using Azure OpenAI
      const aiAnalysis = await this.performAIAnalysis(documentData.content, 'patient_document');
      
      // Generate knowledge and training recommendations
      const knowledgeRecommendations = await this.generateKnowledgeRecommendations(
        aiAnalysis.keywords || [],
        aiAnalysis.medicalTerms || [],
        aiAnalysis.riskFactors || []
      );
      
      const trainingRecommendations = await this.generateTrainingRecommendations(
        aiAnalysis.keywords || [],
        aiAnalysis.medicalTerms || [],
        aiAnalysis.riskFactors || []
      );

      const documentAnalysis = {
        documentId: documentData.documentId,
        documentType: documentData.documentType,
        documentTitle: documentData.documentTitle,
        aiAnalysis: {
          keyFindings: aiAnalysis.keyFindings || [],
          medicalTerms: aiAnalysis.medicalTerms || [],
          riskFactors: aiAnalysis.riskFactors || [],
          recommendations: aiAnalysis.recommendations || [],
          relatedConditions: aiAnalysis.relatedConditions || [],
          medicationInteractions: aiAnalysis.medicationInteractions || [],
          careInstructions: aiAnalysis.careInstructions || [],
          confidence: aiAnalysis.confidence || 0.8
        },
        recommendedKnowledge: knowledgeRecommendations,
        recommendedTraining: trainingRecommendations
      };

      await context.addDocumentAnalysis(documentAnalysis);
      
      return {
        success: true,
        data: documentAnalysis
      };
    } catch (error) {
      console.error('Error analyzing patient document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addPatientKnowledge(patientId, userId, knowledgeData) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      await context.addPatientKnowledge(knowledgeData);
      await context.updateLearningAnalytics();
      
      return {
        success: true,
        data: context
      };
    } catch (error) {
      console.error('Error adding patient knowledge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async enrollInTraining(patientId, userId, trainingData) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      // Increment enrollment count for the training module
      const training = await TrainingModule.findById(trainingData.trainingId);
      if (training) {
        await training.incrementEnrollment();
      }

      await context.enrollInTraining(trainingData);
      
      return {
        success: true,
        data: context
      };
    } catch (error) {
      console.error('Error enrolling in training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateTrainingProgress(patientId, userId, trainingId, progressData) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      await context.updateTrainingProgress(trainingId, progressData);
      await context.updateLearningAnalytics();
      
      return {
        success: true,
        data: context
      };
    } catch (error) {
      console.error('Error updating training progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPatientLearningAnalytics(patientId, userId) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      await context.updateLearningAnalytics();
      
      return {
        success: true,
        data: {
          learningAnalytics: context.learningAnalytics,
          aiInsights: context.aiInsights,
          recentActivity: {
            knowledgeAccessed: context.patientKnowledge.slice(-5),
            trainingProgress: context.patientTraining.slice(-5),
            documentAnalysis: context.documentAnalysis.slice(-5)
          }
        }
      };
    } catch (error) {
      console.error('Error getting patient learning analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateCarePlanIntegration(patientId, userId, carePlanData) {
    try {
      const context = await PatientKnowledgeContext.findByPatient(patientId, userId);
      if (!context) {
        return {
          success: false,
          error: 'Patient context not found'
        };
      }

      context.carePlanIntegration = {
        ...context.carePlanIntegration,
        ...carePlanData,
        lastUpdated: new Date()
      };

      await context.save();
      
      return {
        success: true,
        data: context.carePlanIntegration
      };
    } catch (error) {
      console.error('Error updating care plan integration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create new training module
  async createTrainingModule(trainingData) {
    try {
      const trainingModule = new TrainingModule(trainingData);
      await trainingModule.save();
      
      return {
        success: true,
        data: trainingModule
      };
    } catch (error) {
      console.error('Error creating training module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create new knowledge article
  async createKnowledgeArticle(knowledgeData) {
    try {
      const knowledgeArticle = new KnowledgeBase(knowledgeData);
      await knowledgeArticle.save();
      
      return {
        success: true,
        data: knowledgeArticle
      };
    } catch (error) {
      console.error('Error creating knowledge article:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Core AI Analysis Methods
  async performAIAnalysis(content, analysisType) {
    try {
      console.log(`🤖 [KnowledgeTraining] Performing ${analysisType} analysis with Azure OpenAI`);
      
      const prompt = this.buildAnalysisPrompt(content, analysisType);
      const response = await this.azureOpenAI.callAzureOpenAI(prompt, 'gpt-5-chat');
      
      // Try to parse JSON response
      try {
        return JSON.parse(response);
      } catch (parseError) {
        // Fallback to text parsing
        return this.parseAIResponse(response, analysisType);
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return this.getFallbackAnalysis(analysisType);
    }
  }

  buildAnalysisPrompt(content, analysisType) {
    const basePrompt = `You are an expert medical AI assistant specializing in nursing education and clinical analysis. Analyze the following content and provide structured insights:`;
    
    const typeSpecificPrompts = {
      knowledge: `\n\nCONTENT TYPE: Nursing Knowledge Article
CONTENT: ${content}

Please provide a comprehensive analysis with:
1. Keywords: Extract key medical and nursing terms
2. Complexity: Rate as 'beginner', 'intermediate', or 'advanced'
3. EstimatedReadTime: Reading time in minutes
4. RelatedTopics: Related nursing topics
5. Summary: Brief summary of the content
6. Recommendations: Actionable recommendations for nurses
7. Confidence: Analysis confidence (0.0 to 1.0)

Format as JSON with these exact keys.`,
      
      training: `\n\nCONTENT TYPE: Nursing Training Module
CONTENT: ${content}

Please provide a comprehensive analysis with:
1. Keywords: Key learning objectives and skills
2. Complexity: Training difficulty level
3. RelatedTopics: Related training areas
4. SkillGaps: Skills this training addresses
5. Summary: Training overview
6. Recommendations: Learning recommendations
7. Confidence: Analysis confidence (0.0 to 1.0)

Format as JSON with these exact keys.`,
      
      patient_document: `\n\nCONTENT TYPE: Patient Medical Document
CONTENT: ${content}

Please provide a comprehensive analysis with:
1. KeyFindings: Important clinical findings
2. MedicalTerms: Medical terminology used
3. RiskFactors: Identified risk factors
4. Recommendations: Clinical recommendations
5. RelatedConditions: Related medical conditions
6. MedicationInteractions: Drug interactions
7. CareInstructions: Patient care instructions
8. Keywords: Key terms for knowledge matching
9. Confidence: Analysis confidence (0.0 to 1.0)

Format as JSON with these exact keys.`
    };

    return basePrompt + typeSpecificPrompts[analysisType] || typeSpecificPrompts.knowledge;
  }

  parseAIResponse(response, analysisType) {
    // Basic text parsing fallback
    const lines = response.split('\n').filter(line => line.trim());
    const keywords = lines.filter(line => line.toLowerCase().includes('keyword')).slice(0, 5);
    const summary = lines.find(line => line.toLowerCase().includes('summary')) || lines[0] || 'AI analysis completed';
    
    return {
      keywords: keywords.length > 0 ? keywords : ['nursing', 'healthcare', 'medical'],
      complexity: 'intermediate',
      estimatedReadTime: 5,
      relatedTopics: ['patient care', 'clinical practice'],
      summary: summary.substring(0, 200),
      recommendations: ['Review clinical guidelines', 'Consult with senior staff'],
      confidence: 0.7,
      keyFindings: [summary.substring(0, 100)],
      medicalTerms: ['clinical', 'patient', 'care'],
      riskFactors: ['standard precautions'],
      relatedConditions: ['general care'],
      medicationInteractions: [],
      careInstructions: ['Follow standard protocols']
    };
  }

  getFallbackAnalysis(analysisType) {
    return {
      keywords: ['nursing', 'healthcare', 'medical'],
      complexity: 'intermediate',
      estimatedReadTime: 5,
      relatedTopics: ['patient care', 'clinical practice'],
      summary: 'AI analysis temporarily unavailable',
      recommendations: ['Review clinical guidelines'],
      confidence: 0.5,
      keyFindings: ['Analysis in progress'],
      medicalTerms: ['clinical', 'patient'],
      riskFactors: ['standard precautions'],
      relatedConditions: ['general care'],
      medicationInteractions: [],
      careInstructions: ['Follow standard protocols']
    };
  }

  async generateKnowledgeRecommendations(keywords, medicalTerms, riskFactors) {
    try {
      const prompt = `Based on these clinical factors, recommend relevant nursing knowledge articles:
Keywords: ${keywords.join(', ')}
Medical Terms: ${medicalTerms.join(', ')}
Risk Factors: ${riskFactors.join(', ')}

Provide 3-5 knowledge recommendations with topics, reasons, and relevance scores (0.0-1.0).
Format as JSON array with: topic, reason, relevance`;

      const response = await this.azureOpenAI.callAzureOpenAI(prompt, 'gpt-5-chat');
      
      try {
        return JSON.parse(response);
      } catch (parseError) {
        return [
          {
            topic: "General Patient Care",
            reason: "Based on clinical presentation",
            relevance: 0.7
          }
        ];
      }
    } catch (error) {
      console.error('Error generating knowledge recommendations:', error);
      return [];
    }
  }

  async generateTrainingRecommendations(keywords, medicalTerms, riskFactors) {
    try {
      const prompt = `Based on these clinical factors, recommend relevant nursing training modules:
Keywords: ${keywords.join(', ')}
Medical Terms: ${medicalTerms.join(', ')}
Risk Factors: ${riskFactors.join(', ')}

Provide 3-5 training recommendations with topics, reasons, and relevance scores (0.0-1.0).
Format as JSON array with: topic, reason, relevance`;

      const response = await this.azureOpenAI.callAzureOpenAI(prompt, 'gpt-5-chat');
      
      try {
        return JSON.parse(response);
      } catch (parseError) {
        return [
          {
            topic: "Clinical Skills Training",
            reason: "Based on patient needs",
            relevance: 0.7
          }
        ];
      }
    } catch (error) {
      console.error('Error generating training recommendations:', error);
      return [];
    }
  }
}

// Helper function to generate training recommendations (legacy)
async function generateTrainingRecommendations(keywords, medicalTerms, riskFactors) {
  try {
    // This would typically call an AI service to generate recommendations
    // For now, we'll return mock data based on the input
    const recommendations = [];
    
    if (medicalTerms.includes('diabetes') || keywords.includes('glucose')) {
      recommendations.push({
        trainingId: null, // Would be populated with actual training ID
        relevance: 0.9,
        reason: 'Patient has diabetes-related conditions'
      });
    }
    
    if (riskFactors.includes('fall risk') || keywords.includes('mobility')) {
      recommendations.push({
        trainingId: null,
        relevance: 0.8,
        reason: 'Patient has mobility and fall risk factors'
      });
    }
    
    return recommendations;
  } catch (error) {
    console.error('Error generating training recommendations:', error);
    return [];
  }
}

export default new KnowledgeTrainingService();
