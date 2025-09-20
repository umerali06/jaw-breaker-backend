import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  // Basic information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
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
  
  // Task details
  category: {
    type: String,
    required: true,
    enum: [
      'medication',
      'assessment',
      'documentation',
      'communication',
      'procedure',
      'follow_up',
      'education',
      'safety',
      'other'
    ],
    default: 'other'
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    required: true,
    enum: ['todo', 'in_progress', 'review', 'completed', 'cancelled'],
    default: 'todo'
  },
  
  // Scheduling
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  estimatedDuration: {
    type: Number,
    min: 1,
    max: 480, // 8 hours max
    default: 30
  },
  actualDuration: {
    type: Number,
    min: 0
  },
  
  // Assignment
  assignedTo: {
    type: String,
    trim: true,
    maxlength: 100
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Progress tracking
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Recurring tasks
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'daily'
  },
  recurringInterval: {
    type: Number,
    min: 1,
    max: 365,
    default: 1
  },
  parentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  
  // Dependencies
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  
  // Tags and metadata
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // AI analysis
  aiAnalysis: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    suggestions: [{
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
    analyzedAt: {
      type: Date
    },
    aiModel: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro']
    }
  },
  
  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['reminder', 'overdue', 'due_soon', 'completed', 'cancelled'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    scheduledFor: {
      type: Date,
      required: true
    },
    sentAt: {
      type: Date
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  
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
taskSchema.index({ patientId: 1, status: 1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ category: 1, priority: 1 });
taskSchema.index({ createdAt: -1 });

// Pre-save middleware
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Calculate actual duration if task is completed
  if (this.isModified('status') && this.status === 'completed' && this.createdAt && this.completedAt) {
    this.actualDuration = Math.round((this.completedAt - this.createdAt) / (1000 * 60)); // in minutes
  }
  
  next();
});

// Instance methods
taskSchema.methods.updateProgress = function(progress) {
  this.progress = Math.max(0, Math.min(100, progress));
  this.updatedAt = new Date();
  return this.save();
};

taskSchema.methods.complete = function(completedBy) {
  this.status = 'completed';
  this.progress = 100;
  this.completedAt = new Date();
  this.completedBy = completedBy;
  return this.save();
};

taskSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = this.notes ? `${this.notes}\n\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  return this.save();
};

taskSchema.methods.addNotification = function(notification) {
  this.notifications.push(notification);
  return this.save();
};

taskSchema.methods.markNotificationAsRead = function(notificationId) {
  const notification = this.notifications.id(notificationId);
  if (notification) {
    notification.isRead = true;
    return this.save();
  }
  throw new Error('Notification not found');
};

// Static methods
taskSchema.statics.findByPatient = function(patientId, options = {}) {
  const query = { patientId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  if (options.assignedTo) {
    query.assignedTo = options.assignedTo;
  }
  
  return this.find(query)
    .populate('patientId userId assignedBy completedBy')
    .sort(options.sort || { dueDate: 1 });
};

taskSchema.statics.findOverdue = function(patientId = null) {
  const query = {
    status: { $in: ['todo', 'in_progress', 'review'] },
    dueDate: { $lt: new Date() }
  };
  
  if (patientId) {
    query.patientId = patientId;
  }
  
  return this.find(query)
    .populate('patientId userId')
    .sort({ dueDate: 1 });
};

taskSchema.statics.findDueSoon = function(hours = 24, patientId = null) {
  const now = new Date();
  const dueSoon = new Date(now.getTime() + hours * 60 * 60 * 1000);
  
  const query = {
    status: { $in: ['todo', 'in_progress', 'review'] },
    dueDate: { $gte: now, $lte: dueSoon }
  };
  
  if (patientId) {
    query.patientId = patientId;
  }
  
  return this.find(query)
    .populate('patientId userId')
    .sort({ dueDate: 1 });
};

taskSchema.statics.getTaskStats = function(patientId = null, dateRange = null) {
  const matchStage = {};
  
  if (patientId) {
    matchStage.patientId = new mongoose.Types.ObjectId(patientId);
  }
  
  if (dateRange) {
    const { start, end } = dateRange;
    matchStage.createdAt = {
      $gte: new Date(start),
      $lte: new Date(end)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['todo', 'in_progress', 'review']] },
                  { $lt: ['$dueDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        avgProgress: { $avg: '$progress' },
        avgDuration: { $avg: '$actualDuration' }
      }
    }
  ]);
};

const Task = mongoose.model('Task', taskSchema);

export default Task;


