import mongoose from 'mongoose';

const patientKnowledgeContextSchema = new mongoose.Schema({
  // Patient reference
  patientId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Document analysis
  documentAnalysis: [{
    documentId: String,
    documentType: {
      type: String,
      enum: ['medical_record', 'lab_result', 'imaging', 'prescription', 'note', 'assessment']
    },
    documentTitle: String,
    analyzedAt: {
      type: Date,
      default: Date.now
    },
    
    // AI analysis results
    aiAnalysis: {
      keyFindings: [String],
      medicalTerms: [String],
      riskFactors: [String],
      recommendations: [String],
      relatedConditions: [String],
      medicationInteractions: [String],
      careInstructions: [String],
      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    },
    
    // Knowledge recommendations
    recommendedKnowledge: [{
      knowledgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeBase'
      },
      relevance: {
        type: Number,
        min: 0,
        max: 1
      },
      reason: String
    }],
    
    // Training recommendations
    recommendedTraining: [{
      trainingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingModule'
      },
      relevance: {
        type: Number,
        min: 0,
        max: 1
      },
      reason: String
    }]
  }],
  
  // Patient-specific knowledge base
  patientKnowledge: [{
    knowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeBase'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: String,
    relevance: {
      type: Number,
      min: 0,
      max: 1
    },
    notes: String,
    isBookmarked: {
      type: Boolean,
      default: false
    }
  }],
  
  // Patient-specific training
  patientTraining: [{
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingModule'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    enrolledBy: String,
    status: {
      type: String,
      enum: ['enrolled', 'in_progress', 'completed', 'cancelled'],
      default: 'enrolled'
    },
    progress: {
      completedModules: [Number],
      currentModule: Number,
      overallProgress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },
    assessments: [{
      moduleOrder: Number,
      score: Number,
      completedAt: Date,
      attempts: [{
        score: Number,
        completedAt: Date,
        answers: mongoose.Schema.Types.Mixed
      }]
    }],
    completionDate: Date,
    certificate: {
      issued: Boolean,
      issuedAt: Date,
      certificateId: String
    }
  }],
  
  // Care plan integration
  carePlanIntegration: {
    activeConditions: [String],
    medications: [String],
    procedures: [String],
    riskFactors: [String],
    careGoals: [String],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Learning analytics
  learningAnalytics: {
    totalKnowledgeAccessed: {
      type: Number,
      default: 0
    },
    totalTrainingCompleted: {
      type: Number,
      default: 0
    },
    averageKnowledgeRating: {
      type: Number,
      default: 0
    },
    averageTrainingScore: {
      type: Number,
      default: 0
    },
    learningStrengths: [String],
    learningGaps: [String],
    recommendedFocus: [String]
  },
  
  // AI insights
  aiInsights: {
    patientComplexity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    careChallenges: [String],
    learningNeeds: [String],
    knowledgeGaps: [String],
    trainingPriorities: [String],
    lastAnalyzed: {
      type: Date,
      default: Date.now
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
patientKnowledgeContextSchema.index({ patientId: 1, userId: 1 });
patientKnowledgeContextSchema.index({ 'documentAnalysis.analyzedAt': -1 });
patientKnowledgeContextSchema.index({ 'patientKnowledge.addedAt': -1 });
patientKnowledgeContextSchema.index({ 'patientTraining.enrolledAt': -1 });

// Pre-save middleware
patientKnowledgeContextSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
patientKnowledgeContextSchema.statics.findByPatient = function(patientId, userId) {
  return this.findOne({ patientId, userId });
};

patientKnowledgeContextSchema.statics.getPatientKnowledge = function(patientId, userId) {
  return this.findOne({ patientId, userId })
    .populate('patientKnowledge.knowledgeId')
    .populate('patientTraining.trainingId');
};

// Instance methods
patientKnowledgeContextSchema.methods.addDocumentAnalysis = function(documentData) {
  this.documentAnalysis.push(documentData);
  return this.save();
};

patientKnowledgeContextSchema.methods.addPatientKnowledge = function(knowledgeData) {
  this.patientKnowledge.push(knowledgeData);
  return this.save();
};

patientKnowledgeContextSchema.methods.enrollInTraining = function(trainingData) {
  this.patientTraining.push(trainingData);
  return this.save();
};

patientKnowledgeContextSchema.methods.updateTrainingProgress = function(trainingId, progressData) {
  const training = this.patientTraining.id(trainingId);
  if (training) {
    Object.assign(training, progressData);
    return this.save();
  }
  return Promise.reject(new Error('Training not found'));
};

patientKnowledgeContextSchema.methods.updateLearningAnalytics = function() {
  this.learningAnalytics.totalKnowledgeAccessed = this.patientKnowledge.length;
  this.learningAnalytics.totalTrainingCompleted = this.patientTraining.filter(t => t.status === 'completed').length;
  
  // Calculate average ratings and scores
  const knowledgeRatings = this.patientKnowledge.map(k => k.relevance).filter(r => r > 0);
  const trainingScores = this.patientTraining
    .filter(t => t.assessments.length > 0)
    .map(t => t.assessments[t.assessments.length - 1].score);
  
  this.learningAnalytics.averageKnowledgeRating = knowledgeRatings.length > 0 
    ? knowledgeRatings.reduce((a, b) => a + b, 0) / knowledgeRatings.length 
    : 0;
    
  this.learningAnalytics.averageTrainingScore = trainingScores.length > 0
    ? trainingScores.reduce((a, b) => a + b, 0) / trainingScores.length
    : 0;
    
  return this.save();
};

export default mongoose.model('PatientKnowledgeContext', patientKnowledgeContextSchema);

