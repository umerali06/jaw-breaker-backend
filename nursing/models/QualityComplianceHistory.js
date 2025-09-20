import mongoose from 'mongoose';

const qualityComplianceHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: String,
    required: false,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  checkType: {
    type: String,
    required: true,
    enum: [
      'medication_safety',
      'infection_control',
      'patient_safety',
      'documentation_quality',
      'care_plan_compliance',
      'vital_signs_monitoring',
      'fall_prevention',
      'pressure_ulcer_prevention',
      'medication_reconciliation',
      'discharge_planning',
      'pain_management',
      'nutrition_assessment',
      'mobility_assessment',
      'cognitive_assessment',
      'family_education',
      'emergency_procedures',
      'equipment_safety',
      'environmental_safety',
      'communication_quality',
      'timeliness_of_care'
    ],
    index: true
  },
  checkCategory: {
    type: String,
    required: true,
    enum: [
      'safety',
      'quality',
      'compliance',
      'documentation',
      'clinical',
      'administrative'
    ],
    index: true
  },
  checkTitle: {
    type: String,
    required: true,
    trim: true
  },
  checkDescription: {
    type: String,
    required: true,
    trim: true
  },
  patientContext: {
    name: String,
    age: Number,
    gender: String,
    condition: String,
    allergies: [String],
    medications: [String],
    riskFactors: [String],
    carePlan: String
  },
  complianceStatus: {
    type: String,
    required: true,
    enum: ['compliant', 'non_compliant', 'partially_compliant', 'not_applicable', 'requires_review'],
    default: 'requires_review'
  },
  complianceScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  findings: [{
    category: {
      type: String,
      enum: ['strength', 'concern', 'recommendation', 'violation', 'observation'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    evidence: [String],
    recommendations: [String],
    followUpRequired: {
      type: Boolean,
      default: false
    },
    followUpDate: Date,
    assignedTo: String
  }],
  riskAssessment: {
    overallRisk: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    riskFactors: [String],
    mitigationStrategies: [String],
    monitoringRequired: {
      type: Boolean,
      default: false
    }
  },
  recommendations: [{
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      required: true
    },
    category: {
      type: String,
      enum: ['immediate_action', 'process_improvement', 'training', 'policy_update', 'equipment', 'staffing'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    implementationDate: Date,
    responsibleParty: String,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    }
  }],
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'reviewed', 'approved', 'rejected', 'escalated', 'archived', 'restored'],
      required: true
    },
    performedBy: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    changes: mongoose.Schema.Types.Mixed
  }],
  regulatoryStandards: [{
    standard: {
      type: String,
      required: true,
      trim: true
    },
    version: String,
    section: String,
    complianceStatus: {
      type: String,
      enum: ['compliant', 'non_compliant', 'partially_compliant', 'not_applicable'],
      required: true
    },
    notes: String
  }],
  qualityMetrics: {
    responseTime: Number, // in minutes
    accuracyScore: Number, // 0-100
    completenessScore: Number, // 0-100
    timelinessScore: Number, // 0-100
    patientSatisfactionScore: Number, // 0-100
    staffComplianceScore: Number // 0-100
  },
  followUpActions: [{
    action: {
      type: String,
      required: true,
      trim: true
    },
    assignedTo: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending'
    },
    completionNotes: String,
    completedDate: Date
  }],
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
qualityComplianceHistorySchema.index({ userId: 1, createdAt: -1 });
qualityComplianceHistorySchema.index({ userId: 1, patientId: 1, createdAt: -1 });
qualityComplianceHistorySchema.index({ checkType: 1, complianceStatus: 1 });
qualityComplianceHistorySchema.index({ checkCategory: 1, createdAt: -1 });
qualityComplianceHistorySchema.index({ complianceScore: 1 });
qualityComplianceHistorySchema.index({ 'riskAssessment.overallRisk': 1 });
qualityComplianceHistorySchema.index({ sessionId: 1 });

// Virtual for formatted compliance status
qualityComplianceHistorySchema.virtual('formattedComplianceStatus').get(function() {
  const statusMap = {
    'compliant': 'Compliant',
    'non_compliant': 'Non-Compliant',
    'partially_compliant': 'Partially Compliant',
    'not_applicable': 'Not Applicable',
    'requires_review': 'Requires Review'
  };
  return statusMap[this.complianceStatus] || this.complianceStatus;
});

// Virtual for risk level color
qualityComplianceHistorySchema.virtual('riskLevelColor').get(function() {
  const colorMap = {
    'low': '#10B981', // green
    'medium': '#F59E0B', // yellow
    'high': '#EF4444', // red
    'critical': '#DC2626' // dark red
  };
  return colorMap[this.riskAssessment?.overallRisk] || '#6B7280'; // gray
});

// Virtual for compliance score color
qualityComplianceHistorySchema.virtual('complianceScoreColor').get(function() {
  if (this.complianceScore >= 90) return '#10B981'; // green
  if (this.complianceScore >= 70) return '#F59E0B'; // yellow
  if (this.complianceScore >= 50) return '#EF4444'; // red
  return '#DC2626'; // dark red
});

// Static method to get user's quality compliance history
qualityComplianceHistorySchema.statics.getUserQualityCompliance = function(userId, options = {}) {
  const {
    patientId = null,
    checkType = null,
    checkCategory = null,
    complianceStatus = null,
    startDate = null,
    endDate = null,
    limit = 20,
    skip = 0,
    includeArchived = false
  } = options;

  const matchQuery = {
    userId,
    isDeleted: false
  };

  if (!includeArchived) {
    matchQuery.isArchived = false;
  }

  if (patientId) {
    matchQuery.patientId = patientId;
  }

  if (checkType) {
    matchQuery.checkType = checkType;
  }

  if (checkCategory) {
    matchQuery.checkCategory = checkCategory;
  }

  if (complianceStatus) {
    matchQuery.complianceStatus = complianceStatus;
  }

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  return this.find(matchQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get quality compliance statistics
qualityComplianceHistorySchema.statics.getUserQualityStats = function(userId, patientId = null, options = {}) {
  const includeArchived = !!options.includeArchived;

  const matchQuery = {
    userId,
    isDeleted: false
  };

  if (!includeArchived) {
    matchQuery.isArchived = false;
  }

  // Only add patientId filter if a specific patient is requested
  // If patientId is null/empty, we want stats for ALL patients
  // Handle undefined, null, empty string, and "null" string cases
  if (patientId && 
      patientId !== 'null' && 
      String(patientId).trim() !== '' && 
      String(patientId).trim() !== 'null') {
    matchQuery.patientId = String(patientId).trim();
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: 1 },
        averageComplianceScore: { $avg: '$complianceScore' },
        compliantChecks: {
          $sum: { $cond: [{ $eq: ['$complianceStatus', 'compliant'] }, 1, 0] }
        },
        nonCompliantChecks: {
          $sum: { $cond: [{ $eq: ['$complianceStatus', 'non_compliant'] }, 1, 0] }
        },
        partiallyCompliantChecks: {
          $sum: { $cond: [{ $eq: ['$complianceStatus', 'partially_compliant'] }, 1, 0] }
        },
        highRiskChecks: {
          $sum: { $cond: [{ $eq: ['$riskAssessment.overallRisk', 'high'] }, 1, 0] }
        },
        criticalRiskChecks: {
          $sum: { $cond: [{ $eq: ['$riskAssessment.overallRisk', 'critical'] }, 1, 0] }
        },
        pendingFollowUps: {
          $sum: { $size: { $filter: { input: '$followUpActions', cond: { $eq: ['$$this.status', 'pending'] } } } }
        },
        overdueFollowUps: {
          $sum: { $size: { $filter: { input: '$followUpActions', cond: { $eq: ['$$this.status', 'overdue'] } } } }
        },
        lastCheckDate: { $max: '$createdAt' }
      }
    }
  ]);
};

// Static method to get compliance trends
qualityComplianceHistorySchema.statics.getComplianceTrends = function(userId, patientId = null, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const matchQuery = {
    userId,
    isDeleted: false,
    isArchived: false,
    createdAt: { $gte: startDate }
  };

  // Only add patientId filter if a specific patient is requested
  // If patientId is null/empty, we want trends for ALL patients
  // Handle undefined, null, empty string, and "null" string cases
  if (patientId && 
      patientId !== 'null' && 
      String(patientId).trim() !== '' && 
      String(patientId).trim() !== 'null') {
    matchQuery.patientId = String(patientId).trim();
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        dailyChecks: { $sum: 1 },
        averageScore: { $avg: '$complianceScore' },
        compliantCount: {
          $sum: { $cond: [{ $eq: ['$complianceStatus', 'compliant'] }, 1, 0] }
        },
        highRiskCount: {
          $sum: { $cond: [{ $eq: ['$riskAssessment.overallRisk', 'high'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

// Instance method to archive quality compliance record
qualityComplianceHistorySchema.methods.archive = function() {
  this.isArchived = true;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to soft delete quality compliance record
qualityComplianceHistorySchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to restore soft deleted record
qualityComplianceHistorySchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to add audit trail entry
qualityComplianceHistorySchema.methods.addAuditEntry = function(action, performedBy, notes = '', changes = {}) {
  this.auditTrail.push({
    action,
    performedBy,
    timestamp: new Date(),
    notes,
    changes
  });
  this.updatedAt = new Date();
  return this.save();
};

// Ensure virtual fields are serialized
qualityComplianceHistorySchema.set('toJSON', { virtuals: true });
qualityComplianceHistorySchema.set('toObject', { virtuals: true });

const QualityComplianceHistory = mongoose.model('QualityComplianceHistory', qualityComplianceHistorySchema);

export default QualityComplianceHistory;
