import mongoose from 'mongoose';

const clinicalDataSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'clinical_recommendations',
      'differential_diagnosis',
      'medication_safety_check',
      'predictive_analytics',
      'voice_transcription',
      'ai_notes',
      'icd_coding',
      'document_analysis',
      'diagnostic_support',
      'treatment_recommendations'
    ],
    index: true
  },
  category: {
    type: String,
    required: false,
    enum: ['diagnosis', 'treatment', 'medication', 'analytics', 'documentation', 'coding']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  aiRecommendations: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  relatedData: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedDataModel',
    required: false
  },
  relatedDataModel: {
    type: String,
    required: false,
    enum: ['AINote', 'Transcription', 'ICDCode', 'Medication', 'LabResult']
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'in-progress', 'completed', 'failed', 'cancelled'],
    index: true
  },
  priority: {
    type: String,
    required: true,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent', 'critical'],
    index: true
  },
  complexityScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  responseTime: {
    type: Number, // in milliseconds
    required: false
  },
  outcome: {
    type: String,
    enum: ['successful', 'partial', 'failed', 'pending'],
    default: 'pending'
  },
  description: {
    type: String,
    required: false
  },
  recommendedAction: {
    type: String,
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [{
    type: String,
    required: false
  }],
  version: {
    type: String,
    default: '1.0'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
clinicalDataSchema.index({ patientId: 1, doctorId: 1, type: 1, createdAt: -1 });
clinicalDataSchema.index({ doctorId: 1, status: 1, priority: 1 });
clinicalDataSchema.index({ createdAt: -1 });
clinicalDataSchema.index({ updatedAt: -1 });

// Virtual for time since creation
clinicalDataSchema.virtual('timeSinceCreation').get(function() {
  return Date.now() - this.createdAt;
});

// Virtual for time since update
clinicalDataSchema.virtual('timeSinceUpdate').get(function() {
  return Date.now() - this.updatedAt;
});

// Pre-save middleware
clinicalDataSchema.pre('save', function(next) {
  // Auto-calculate complexity score based on data type and content
  if (this.isModified('type') || this.isModified('data')) {
    this.complexityScore = this.calculateComplexityScore();
  }
  
  // Auto-set category based on type
  if (this.isModified('type')) {
    this.category = this.getCategoryFromType();
  }
  
  next();
});

// Instance methods
clinicalDataSchema.methods.calculateComplexityScore = function() {
  let score = 5; // Base score
  
  // Adjust based on type
  switch (this.type) {
    case 'predictive_analytics':
      score += 2;
      break;
    case 'differential_diagnosis':
      score += 1;
      break;
    case 'medication_safety_check':
      score += 1;
      break;
    case 'voice_transcription':
      score -= 1;
      break;
  }
  
  // Adjust based on data complexity
  if (this.data && typeof this.data === 'object') {
    const dataKeys = Object.keys(this.data);
    if (dataKeys.length > 5) score += 1;
    if (dataKeys.length > 10) score += 1;
  }
  
  return Math.min(Math.max(score, 1), 10);
};

clinicalDataSchema.methods.getCategoryFromType = function() {
  const typeToCategory = {
    'clinical_recommendations': 'treatment',
    'differential_diagnosis': 'diagnosis',
    'medication_safety_check': 'medication',
    'predictive_analytics': 'analytics',
    'voice_transcription': 'documentation',
    'ai_notes': 'documentation',
    'icd_coding': 'coding',
    'document_analysis': 'diagnosis',
    'diagnostic_support': 'diagnosis',
    'treatment_recommendations': 'treatment'
  };
  
  return typeToCategory[this.type] || 'general';
};

clinicalDataSchema.methods.markAsCompleted = function(outcome = 'successful') {
  this.status = 'completed';
  this.outcome = outcome;
  this.responseTime = Date.now() - this.createdAt;
  return this.save();
};

clinicalDataSchema.methods.updatePriority = function(newPriority) {
  if (['low', 'normal', 'high', 'urgent', 'critical'].includes(newPriority)) {
    this.priority = newPriority;
    return this.save();
  }
  throw new Error('Invalid priority level');
};

// Static methods
clinicalDataSchema.statics.findByPatientAndType = function(patientId, type, limit = 10) {
  return this.find({ patientId, type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('relatedData');
};

clinicalDataSchema.statics.findCriticalAlerts = function(doctorId, limit = 50) {
  return this.find({
    doctorId,
    priority: { $in: ['urgent', 'critical'] },
    status: { $in: ['pending', 'in-progress'] }
  })
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit)
  .populate('patientId', 'name age gender contact');
};

clinicalDataSchema.statics.getAnalytics = function(doctorId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        doctorId: mongoose.Types.ObjectId(doctorId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgComplexity: { $avg: '$complexityScore' },
        avgResponseTime: { $avg: '$responseTime' },
        successRate: {
          $avg: { $cond: [{ $eq: ['$outcome', 'successful'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Validation
clinicalDataSchema.path('data').validate(function(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return true;
}, 'Data must be a valid object');

clinicalDataSchema.path('aiRecommendations').validate(function(value) {
  if (value && typeof value !== 'object') {
    return false;
  }
  return true;
}, 'AI recommendations must be a valid object');

export default mongoose.model('ClinicalData', clinicalDataSchema);
