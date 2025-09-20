import mongoose from 'mongoose';

const trainingModuleSchema = new mongoose.Schema({
  // Basic information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'clinical_skills',
      'safety_protocols',
      'medication_management',
      'patient_care',
      'documentation',
      'emergency_procedures',
      'infection_control',
      'communication',
      'leadership',
      'technology'
    ]
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Training content
  objectives: [{
    type: String,
    required: true,
    maxlength: 200
  }],
  prerequisites: [{
    type: String,
    maxlength: 200
  }],
  estimatedDuration: {
    type: Number, // in minutes
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  
  // Content structure
  modules: [{
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    description: String,
    content: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    estimatedTime: Number, // in minutes
    resources: [{
      type: {
        type: String,
        enum: ['video', 'document', 'link', 'quiz', 'simulation']
      },
      title: String,
      url: String,
      description: String
    }],
    assessments: [{
      type: {
        type: String,
        enum: ['quiz', 'practical', 'simulation', 'case_study']
      },
      title: String,
      questions: [{
        question: String,
        type: {
          type: String,
          enum: ['multiple_choice', 'true_false', 'short_answer', 'essay']
        },
        options: [String],
        correctAnswer: mongoose.Schema.Types.Mixed,
        explanation: String,
        points: {
          type: Number,
          default: 1
        }
      }],
      passingScore: {
        type: Number,
        default: 70
      }
    }]
  }],
  
  // Completion requirements
  completionCriteria: {
    minScore: {
      type: Number,
      default: 70
    },
    requiredModules: [Number], // module order numbers
    practicalAssessment: {
      type: Boolean,
      default: false
    },
    certification: {
      type: Boolean,
      default: false
    }
  },
  
  // Status and visibility
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'archived'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isMandatory: {
    type: Boolean,
    default: false
  },
  
  // Ownership and permissions
  createdBy: {
    type: String,
    required: true
  },
  lastModifiedBy: {
    type: String,
    required: true
  },
  instructors: [{
    userId: String,
    name: String,
    role: String
  }],
  
  // Target audience
  targetRoles: [{
    type: String,
    enum: ['nurse', 'nurse_practitioner', 'nurse_manager', 'nurse_educator', 'all']
  }],
  experienceLevel: {
    type: String,
    enum: ['new_graduate', 'experienced', 'expert', 'all'],
    default: 'all'
  },
  
  // Usage statistics
  enrollmentCount: {
    type: Number,
    default: 0
  },
  completionCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Quizzes and assessments
  quizzes: [{
    question: {
      type: String,
      required: true
    },
    options: [String],
    correctAnswer: Number,
    explanation: String,
    moduleTitle: String,
    moduleOrder: Number
  }],
  
  // Practical applications
  practicalApplications: [{
    title: String,
    description: String,
    scenario: String,
    tasks: [String],
    evaluationCriteria: [String],
    moduleTitle: String,
    moduleOrder: Number
  }],

  // AI analysis
  aiAnalysis: {
    keywords: [String],
    complexity: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    relatedTopics: [String],
    skillGaps: [String],
    lastAnalyzed: Date
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: Date,
  archivedAt: Date
});

// Indexes
trainingModuleSchema.index({ title: 'text', description: 'text' });
trainingModuleSchema.index({ category: 1, subcategory: 1 });
trainingModuleSchema.index({ createdBy: 1 });
trainingModuleSchema.index({ status: 1, isActive: 1 });
trainingModuleSchema.index({ targetRoles: 1 });
trainingModuleSchema.index({ createdAt: -1 });

// Pre-save middleware
trainingModuleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
trainingModuleSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'approved', isActive: true });
};

trainingModuleSchema.statics.findByRole = function(role) {
  return this.find({ 
    $or: [
      { targetRoles: role },
      { targetRoles: 'all' }
    ],
    status: 'approved',
    isActive: true
  });
};

trainingModuleSchema.statics.getPopularModules = function(limit = 10) {
  return this.find({ status: 'approved', isActive: true })
    .sort({ enrollmentCount: -1, averageRating: -1 })
    .limit(limit);
};

// Instance methods
trainingModuleSchema.methods.incrementEnrollment = function() {
  this.enrollmentCount += 1;
  return this.save();
};

trainingModuleSchema.methods.updateCompletionStats = function(score) {
  this.completionCount += 1;
  const totalScore = this.averageScore * (this.completionCount - 1) + score;
  this.averageScore = totalScore / this.completionCount;
  return this.save();
};

export default mongoose.model('TrainingModule', trainingModuleSchema);
