import mongoose from 'mongoose';

const riskSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['falls', 'infection', 'medication', 'pressure_ulcer', 'dehydration', 'delirium']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  likelihood: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'very_high']
  },
  impact: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  factors: [{
    type: String,
    maxlength: 200
  }],
  mitigation: {
    type: String,
    required: true,
    maxlength: 1000
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'monitoring', 'resolved', 'escalated'],
    default: 'active'
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  aiAnalysis: {
    recommendations: [String],
    riskFactors: [String],
    interventions: [String],
    monitoring: [String],
    complications: [String],
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    summary: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    lastAnalyzed: Date,
    aiModel: String
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
riskSchema.index({ patientId: 1 });
riskSchema.index({ category: 1, severity: 1, status: 1 });
riskSchema.index({ createdAt: -1 });
riskSchema.index({ riskScore: -1 });
riskSchema.index({ patientId: 1, category: 1 });

// Pre-validate middleware to calculate risk score
riskSchema.pre('validate', function(next) {
  const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
  const likelihoodScores = { low: 1, medium: 2, high: 3, very_high: 4 };
  const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };
  
  this.riskScore = (severityScores[this.severity] + 
                   likelihoodScores[this.likelihood] + 
                   impactScores[this.impact]) / 3;
  
  next();
});

export default mongoose.model('Risk', riskSchema);
