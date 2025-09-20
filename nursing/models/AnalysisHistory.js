import mongoose from 'mongoose';

const analysisHistorySchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  analysisType: {
    type: String,
    required: true,
    enum: ['vitalSigns', 'medications', 'clinicalDecisions', 'voiceTranscription', 'customTemplate', 'templateUpdate']
  },
  analysisData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  inputData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
analysisHistorySchema.index({ patientId: 1, analysisType: 1, timestamp: -1 });
analysisHistorySchema.index({ userId: 1, timestamp: -1 });
analysisHistorySchema.index({ isDeleted: 1 });

// Virtual for formatted timestamp
analysisHistorySchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Method to soft delete
analysisHistorySchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Static method to get patient history
analysisHistorySchema.statics.getPatientHistory = function(patientId, analysisType = null, userId = null) {
  const query = { 
    patientId, 
    isDeleted: false 
  };
  
  if (analysisType) {
    query.analysisType = analysisType;
  }
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(50);
};

// Static method to get user's analysis history
analysisHistorySchema.statics.getUserHistory = function(userId, limit = 100) {
  return this.find({ 
    userId, 
    isDeleted: false 
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to clear patient history
analysisHistorySchema.statics.clearPatientHistory = function(patientId, userId = null) {
  const query = { 
    patientId, 
    isDeleted: false 
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.updateMany(query, { isDeleted: true });
};

const AnalysisHistory = mongoose.model('AnalysisHistory', analysisHistorySchema);

export default AnalysisHistory;
