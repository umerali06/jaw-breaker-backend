import mongoose from 'mongoose';

const voiceTranscriptionHistorySchema = new mongoose.Schema({
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
  audioFileName: {
    type: String,
    required: false
  },
  audioSize: {
    type: Number,
    required: false
  },
  audioDuration: {
    type: Number,
    required: false // Duration in seconds
  },
  transcriptionText: {
    type: String,
    required: true
  },
  structuredDocumentation: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  processingTime: {
    type: Number,
    required: false // Processing time in milliseconds
  },
  confidence: {
    type: Number,
    required: false // AI confidence score (0-1)
  },
  language: {
    type: String,
    default: 'en',
    required: false
  },
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
voiceTranscriptionHistorySchema.index({ userId: 1, createdAt: -1 });
voiceTranscriptionHistorySchema.index({ userId: 1, patientId: 1, createdAt: -1 });
voiceTranscriptionHistorySchema.index({ sessionId: 1 });
voiceTranscriptionHistorySchema.index({ isDeleted: 1, isArchived: 1 });

// Virtual for formatted date
voiceTranscriptionHistorySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for duration in human readable format
voiceTranscriptionHistorySchema.virtual('formattedDuration').get(function() {
  if (!this.audioDuration) return 'Unknown';
  
  const minutes = Math.floor(this.audioDuration / 60);
  const seconds = Math.floor(this.audioDuration % 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
});

// Virtual for file size in human readable format
voiceTranscriptionHistorySchema.virtual('formattedSize').get(function() {
  if (!this.audioSize) return 'Unknown';
  
  const bytes = this.audioSize;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Static method to get user's transcription history
voiceTranscriptionHistorySchema.statics.getUserTranscriptions = function(userId, options = {}) {
  const {
    patientId = null,
    limit = 50,
    skip = 0,
    startDate = null,
    endDate = null,
    isArchived = false
  } = options;

  const query = {
    userId,
    isDeleted: false,
    isArchived
  };

  if (patientId) {
    query.patientId = patientId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .select('-__v');
};

// Static method to get transcription by session ID
voiceTranscriptionHistorySchema.statics.getBySessionId = function(sessionId) {
  return this.findOne({
    sessionId,
    isDeleted: false
  });
};

// Static method to archive transcription
voiceTranscriptionHistorySchema.methods.archive = function() {
  this.isArchived = true;
  this.updatedAt = new Date();
  return this.save();
};

// Static method to soft delete transcription
voiceTranscriptionHistorySchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// Static method to restore transcription
voiceTranscriptionHistorySchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.updatedAt = new Date();
  return this.save();
};

// Static method to get transcription statistics
voiceTranscriptionHistorySchema.statics.getUserStats = function(userId, patientId = null, opts = {}) {
  const includeArchived = !!opts.includeArchived;

  const matchQuery = {
    userId,
    isDeleted: false
  };

  // Align with list default - exclude archived by default
  if (!includeArchived) {
    matchQuery.isArchived = false;
  }

  // Add patient filter if provided (normalize empty strings)
  // Handle undefined, null, empty string, and "null" string cases
  if (patientId && 
      patientId !== 'null' && 
      String(patientId).trim() !== '' && 
      String(patientId).trim() !== 'null') {
    matchQuery.patientId = String(patientId).trim();
  }

  return this.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: null,
        totalTranscriptions: { $sum: 1 },
        totalDuration: { $sum: { $ifNull: ['$audioDuration', 0] } },
        totalSize: { $sum: { $ifNull: ['$audioSize', 0] } },
        averageConfidence: { $avg: { $ifNull: ['$confidence', 0] } },
        averageProcessingTime: { $avg: { $ifNull: ['$processingTime', 0] } },
        lastTranscription: { $max: '$createdAt' }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
voiceTranscriptionHistorySchema.set('toJSON', { virtuals: true });
voiceTranscriptionHistorySchema.set('toObject', { virtuals: true });

const VoiceTranscriptionHistory = mongoose.model('VoiceTranscriptionHistory', voiceTranscriptionHistorySchema);

export default VoiceTranscriptionHistory;
