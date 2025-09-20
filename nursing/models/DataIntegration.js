import mongoose from 'mongoose';

const dataIntegrationSchema = new mongoose.Schema({
  // Basic information
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
  
  // File information
  files: [{
    originalName: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['vital_signs', 'lab_results', 'imaging', 'medications', 'assessments', 'reports', 'other'],
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    description: {
      type: String,
      maxlength: 1000
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'analyzed', 'error'],
      default: 'uploaded'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Analysis results
  analysisResults: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    analysisType: {
      type: String,
      enum: ['comprehensive', 'quick', 'detailed', 'real_time'],
      required: true
    },
    aiModel: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    summary: {
      type: String,
      maxlength: 10000
    },
    insights: [{
      type: String,
      maxlength: 2000
    }],
    recommendations: [{
      type: String,
      maxlength: 2000
    }],
    alerts: [{
      type: String,
      maxlength: 2000
    }],
    extractedData: {
      type: mongoose.Schema.Types.Mixed
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  }],
  
  // AI Insights
  aiInsights: {
    overallAssessment: {
      type: String,
      maxlength: 2000
    },
    trends: [{
      type: String,
      maxlength: 500
    }],
    alerts: [{
      type: String,
      maxlength: 500
    }],
    predictions: [{
      type: String,
      maxlength: 500
    }],
    riskFactors: [{
      type: String,
      maxlength: 500
    }],
    recommendations: [{
      type: String,
      maxlength: 500
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Integration settings
  settings: {
    autoAnalysis: {
      type: Boolean,
      default: true
    },
    realTimeProcessing: {
      type: Boolean,
      default: true
    },
    dataRetention: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    },
    exportFormat: {
      type: String,
      enum: ['json', 'csv', 'pdf', 'excel', 'xml'],
      default: 'json'
    },
    aiModel: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro'],
      default: 'gpt-4'
    },
    dataEncryption: {
      type: Boolean,
      default: false
    },
    auditLogging: {
      type: Boolean,
      default: false
    },
    accessLevel: {
      type: String,
      enum: ['public', 'restricted', 'private'],
      default: 'restricted'
    },
    processingPriority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    batchSize: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    backgroundProcessing: {
      type: Boolean,
      default: false
    },
    notifications: {
      analysisComplete: {
        type: Boolean,
        default: false
      },
      errors: {
        type: Boolean,
        default: true
      },
      exportComplete: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Statistics
  statistics: {
    totalFiles: {
      type: Number,
      default: 0
    },
    totalAnalysis: {
      type: Number,
      default: 0
    },
    successfulAnalysis: {
      type: Number,
      default: 0
    },
    failedAnalysis: {
      type: Number,
      default: 0
    },
    averageConfidence: {
      type: Number,
      default: 0
    },
    lastAnalysisAt: {
      type: Date
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
}, {
  timestamps: true
});

// Indexes for better performance
dataIntegrationSchema.index({ patientId: 1, userId: 1 });
dataIntegrationSchema.index({ 'files.uploadedAt': -1 });
dataIntegrationSchema.index({ 'analysisResults.processedAt': -1 });
dataIntegrationSchema.index({ createdAt: -1 });

// Pre-save middleware to update statistics
dataIntegrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update statistics
  this.statistics.totalFiles = this.files.length;
  this.statistics.totalAnalysis = this.analysisResults.length;
  this.statistics.successfulAnalysis = this.analysisResults.filter(r => r.status === 'completed').length;
  this.statistics.failedAnalysis = this.analysisResults.filter(r => r.status === 'failed').length;
  
  if (this.analysisResults.length > 0) {
    const completedAnalysis = this.analysisResults.filter(r => r.status === 'completed');
    if (completedAnalysis.length > 0) {
      this.statistics.averageConfidence = completedAnalysis.reduce((sum, r) => sum + r.confidence, 0) / completedAnalysis.length;
    }
    
    const lastAnalysis = this.analysisResults
      .filter(r => r.completedAt)
      .sort((a, b) => b.completedAt - a.completedAt)[0];
    
    if (lastAnalysis) {
      this.statistics.lastAnalysisAt = lastAnalysis.completedAt;
    }
  }
  
  next();
});

// Instance methods
dataIntegrationSchema.methods.addFile = function(fileData) {
  this.files.push({
    ...fileData,
    uploadedAt: new Date()
  });
  return this.save();
};

dataIntegrationSchema.methods.addAnalysisResult = function(analysisData) {
  this.analysisResults.push({
    ...analysisData,
    processedAt: new Date()
  });
  return this.save();
};

dataIntegrationSchema.methods.updateFileStatus = function(fileId, status) {
  const file = this.files.id(fileId);
  if (file) {
    file.status = status;
    return this.save();
  }
  throw new Error('File not found');
};

dataIntegrationSchema.methods.updateAnalysisStatus = function(analysisId, status, result = null) {
  const analysis = this.analysisResults.id(analysisId);
  if (analysis) {
    analysis.status = status;
    if (result) {
      Object.assign(analysis, result);
    }
    if (status === 'completed') {
      analysis.completedAt = new Date();
    }
    return this.save();
  }
  throw new Error('Analysis not found');
};

// Static methods
dataIntegrationSchema.statics.findByPatient = function(patientId) {
  return this.findOne({ patientId }).populate('patientId userId');
};

dataIntegrationSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).populate('patientId userId');
};

dataIntegrationSchema.statics.getRecentAnalysis = function(patientId, limit = 10) {
  return this.findOne({ patientId })
    .select('analysisResults')
    .sort({ 'analysisResults.processedAt': -1 })
    .limit(limit);
};

const DataIntegration = mongoose.model('DataIntegration', dataIntegrationSchema);

export default DataIntegration;


