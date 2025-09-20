import mongoose from 'mongoose';

const PatientCommunicationSchema = new mongoose.Schema({
  // Core identifiers
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Communication details
  communicationType: {
    type: String,
    enum: ['chat', 'education', 'instruction', 'reminder', 'followup', 'emergency', 'family_update'],
    required: true,
    index: true
  },
  
  // Message content
  message: {
    type: String,
    required: true,
    maxlength: 10000
  },
  
  // AI-generated content
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiModel: {
    type: String,
    enum: ['azure-openai', 'openai', 'gemini'],
    default: 'azure-openai'
  },
  
  // Context awareness
  context: {
    // Patient context
    patientContext: {
      currentConditions: [String],
      medications: [String],
      allergies: [String],
      recentVitals: mongoose.Schema.Types.Mixed,
      carePlan: String,
      riskFactors: [String]
    },
    
    // Document context
    documentContext: {
      referencedDocuments: [{
        documentId: mongoose.Schema.Types.ObjectId,
        documentName: String,
        relevanceScore: Number,
        extractedInsights: [String]
      }],
      clinicalInsights: [String],
      soapNotes: [String],
      oasisScores: mongoose.Schema.Types.Mixed
    },
    
    // Communication context
    communicationContext: {
      previousMessages: [String],
      communicationGoals: [String],
      urgencyLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      targetAudience: {
        type: String,
        enum: ['patient', 'family', 'caregiver', 'healthcare_team'],
        default: 'patient'
      }
    }
  },
  
  // Response and feedback
  response: {
    type: String,
    maxlength: 10000
  },
  responseReceived: {
    type: Boolean,
    default: false
  },
  responseTimestamp: Date,
  
  // Feedback and effectiveness
  feedback: {
    helpful: Boolean,
    clarity: {
      type: Number,
      min: 1,
      max: 5
    },
    accuracy: {
      type: Number,
      min: 1,
      max: 5
    },
    patientSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String
  },
  
  // Communication outcomes
  outcomes: {
    actionTaken: String,
    followUpRequired: Boolean,
    followUpDate: Date,
    escalationRequired: Boolean,
    escalationReason: String,
    complianceAchieved: Boolean,
    patientUnderstanding: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'unknown']
    }
  },
  
  // Templates and suggestions
  templateUsed: {
    templateId: String,
    templateName: String,
    customizationLevel: {
      type: String,
      enum: ['none', 'minimal', 'moderate', 'extensive'],
      default: 'none'
    }
  },
  
  // AI suggestions for future communications
  aiSuggestions: [{
    suggestionType: {
      type: String,
      enum: ['followup', 'education', 'reminder', 'assessment', 'intervention']
    },
    suggestedMessage: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    suggestedTiming: Date,
    reasoning: String
  }],
  
  // Metadata
  metadata: {
    deviceType: String,
    location: String,
    sessionId: String,
    ipAddress: String,
    userAgent: String
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 } // For automatic cleanup of old communications
  }
}, {
  timestamps: true,
  collection: 'patient_communications'
});

// Indexes for efficient querying
PatientCommunicationSchema.index({ patientId: 1, createdAt: -1 });
PatientCommunicationSchema.index({ userId: 1, createdAt: -1 });
PatientCommunicationSchema.index({ communicationType: 1, createdAt: -1 });
PatientCommunicationSchema.index({ 'context.communicationContext.urgencyLevel': 1 });
PatientCommunicationSchema.index({ aiGenerated: 1, createdAt: -1 });
PatientCommunicationSchema.index({ 'outcomes.followUpRequired': 1, 'outcomes.followUpDate': 1 });

// Virtual for communication summary
PatientCommunicationSchema.virtual('summary').get(function() {
  return this.message.length > 100 
    ? this.message.substring(0, 100) + '...' 
    : this.message;
});

// Method to get communication context
PatientCommunicationSchema.methods.getContextSummary = function() {
  return {
    patientConditions: this.context.patientContext.currentConditions,
    urgencyLevel: this.context.communicationContext.urgencyLevel,
    targetAudience: this.context.communicationContext.targetAudience,
    referencedDocuments: this.context.documentContext.referencedDocuments.length,
    aiGenerated: this.aiGenerated
  };
};

// Method to calculate communication effectiveness
PatientCommunicationSchema.methods.getEffectivenessScore = function() {
  if (!this.feedback) return null;
  
  const scores = [
    this.feedback.clarity,
    this.feedback.accuracy,
    this.feedback.patientSatisfaction
  ].filter(score => score !== undefined);
  
  if (scores.length === 0) return null;
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

// Static method to get communication analytics
PatientCommunicationSchema.statics.getCommunicationAnalytics = async function(userId, patientId = null, dateRange = {}) {
  const matchQuery = { userId };
  if (patientId) matchQuery.patientId = patientId;
  
  if (dateRange.start || dateRange.end) {
    matchQuery.createdAt = {};
    if (dateRange.start) matchQuery.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchQuery.createdAt.$lte = new Date(dateRange.end);
  }
  
  const analytics = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalCommunications: { $sum: 1 },
        aiGeneratedCount: {
          $sum: { $cond: ['$aiGenerated', 1, 0] }
        },
        avgResponseTime: {
          $avg: {
            $cond: [
              { $and: ['$responseTimestamp', '$createdAt'] },
              { $subtract: ['$responseTimestamp', '$createdAt'] },
              null
            ]
          }
        },
        communicationTypes: {
          $push: '$communicationType'
        },
        urgencyLevels: {
          $push: '$context.communicationContext.urgencyLevel'
        },
        avgEffectiveness: {
          $avg: {
            $cond: [
              { $and: ['$feedback.clarity', '$feedback.accuracy', '$feedback.patientSatisfaction'] },
              {
                $divide: [
                  { $add: ['$feedback.clarity', '$feedback.accuracy', '$feedback.patientSatisfaction'] },
                  3
                ]
              },
              null
            ]
          }
        },
        responseReceivedCount: {
          $sum: { $cond: ['$responseReceived', 1, 0] }
        }
      }
    }
  ]);
  
  const result = analytics[0] || {
    totalCommunications: 0,
    aiGeneratedCount: 0,
    avgResponseTime: null,
    communicationTypes: [],
    urgencyLevels: [],
    avgEffectiveness: null,
    responseReceivedCount: 0
  };

  // Calculate response rate percentage
  result.responseRate = result.totalCommunications > 0 
    ? Math.round((result.responseReceivedCount / result.totalCommunications) * 100)
    : 0;

  return result;
};

// Static method to get recent communications
PatientCommunicationSchema.statics.getRecentCommunications = async function(userId, patientId = null, limit = 50) {
  const query = { userId };
  if (patientId) query.patientId = patientId;
  
  return await this.find(query)
    .populate('patientId', 'demographics.name demographics.dob demographics.sex')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to search communications
PatientCommunicationSchema.statics.searchCommunications = async function(userId, searchQuery, filters = {}) {
  const matchQuery = { userId };
  
  if (searchQuery) {
    matchQuery.$or = [
      { message: { $regex: searchQuery, $options: 'i' } },
      { response: { $regex: searchQuery, $options: 'i' } },
      { 'context.patientContext.currentConditions': { $regex: searchQuery, $options: 'i' } }
    ];
  }
  
  if (filters.patientId) matchQuery.patientId = filters.patientId;
  if (filters.communicationType) matchQuery.communicationType = filters.communicationType;
  if (filters.aiGenerated !== undefined) matchQuery.aiGenerated = filters.aiGenerated;
  if (filters.dateRange) {
    matchQuery.createdAt = {};
    if (filters.dateRange.start) matchQuery.createdAt.$gte = new Date(filters.dateRange.start);
    if (filters.dateRange.end) matchQuery.createdAt.$lte = new Date(filters.dateRange.end);
  }
  
  return await this.find(matchQuery)
    .populate('patientId', 'demographics.name demographics.dob demographics.sex')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100)
    .lean();
};

export default mongoose.model('PatientCommunication', PatientCommunicationSchema);
