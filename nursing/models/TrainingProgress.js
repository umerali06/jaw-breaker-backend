import mongoose from 'mongoose';

const trainingProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trainingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingModule',
    required: true
  },
  patientId: {
    type: String,
    required: false // Optional - for patient-specific training
  },
  status: {
    type: String,
    enum: ['enrolled', 'in_progress', 'completed', 'abandoned'],
    default: 'enrolled'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  currentModuleIndex: {
    type: Number,
    default: 0
  },
  completedModules: [{
    type: Number
  }],
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  quizAnswers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
trainingProgressSchema.index({ userId: 1, trainingId: 1 }, { unique: true });
trainingProgressSchema.index({ userId: 1, status: 1 });
trainingProgressSchema.index({ trainingId: 1, status: 1 });

// Virtual for completion percentage
trainingProgressSchema.virtual('completionPercentage').get(function() {
  return this.progress;
});

// Method to update progress
trainingProgressSchema.methods.updateProgress = function(moduleIndex, totalModules) {
  this.currentModuleIndex = moduleIndex;
  this.progress = Math.round((moduleIndex / totalModules) * 100);
  this.lastAccessedAt = new Date();
  
  if (moduleIndex === totalModules) {
    this.status = 'completed';
    this.completedAt = new Date();
  } else {
    this.status = 'in_progress';
    if (!this.startedAt) {
      this.startedAt = new Date();
    }
  }
  
  return this.save();
};

// Method to complete training
trainingProgressSchema.methods.completeTraining = function(score, timeSpent, answers) {
  this.status = 'completed';
  this.progress = 100;
  this.score = score;
  this.timeSpent = timeSpent;
  this.answers = answers;
  this.completedAt = new Date();
  this.lastAccessedAt = new Date();
  
  return this.save();
};

export default mongoose.model('TrainingProgress', trainingProgressSchema);
