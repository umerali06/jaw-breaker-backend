import mongoose from 'mongoose';

const clinicalAlertSchema = new mongoose.Schema({
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
  
  // Alert details
  type: {
    type: String,
    required: true,
    enum: ['vital_signs', 'medication', 'lab_result', 'risk_assessment', 'clinical_decision', 'general'],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Status tracking
  acknowledged: {
    type: Boolean,
    default: false,
    index: true
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acknowledgmentNotes: {
    type: String,
    maxlength: 1000,
    default: null
  },
  
  // Source information
  source: {
    type: String,
    enum: ['ai_analysis', 'manual_entry', 'system_generated', 'risk_assessment'],
    default: 'system_generated'
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Metadata
  metadata: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    category: {
      type: String,
      default: 'clinical'
    },
    tags: [String],
    relatedAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    default: null,
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
clinicalAlertSchema.index({ patientId: 1, acknowledged: 1, createdAt: -1 });
clinicalAlertSchema.index({ userId: 1, acknowledged: 1, createdAt: -1 });
clinicalAlertSchema.index({ type: 1, severity: 1, acknowledged: 1 });
clinicalAlertSchema.index({ createdAt: -1 });
clinicalAlertSchema.index({ expiresAt: 1 });

// Virtual for formatted timestamp
clinicalAlertSchema.virtual('timestamp').get(function() {
  return this.createdAt;
});

// Method to acknowledge alert
clinicalAlertSchema.methods.acknowledge = function(userId, notes = '') {
  this.acknowledged = true;
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = userId;
  this.acknowledgmentNotes = notes;
  return this.save();
};

// Static method to get active alerts for a patient
clinicalAlertSchema.statics.getActiveAlerts = function(patientId, userId) {
  return this.find({
    patientId,
    userId,
    acknowledged: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

// Static method to create alert
clinicalAlertSchema.statics.createAlert = function(alertData) {
  return this.create(alertData);
};

export default mongoose.model('ClinicalAlert', clinicalAlertSchema);

