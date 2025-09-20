import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema({
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
      'medication',
      'procedure',
      'diagnosis',
      'treatment',
      'safety',
      'protocol',
      'guideline',
      'best_practice',
      'emergency',
      'documentation'
    ]
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Content
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    maxlength: 500
  },
  
  // Media and attachments
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // References and sources
  references: [{
    title: String,
    url: String,
    author: String,
    publicationDate: Date,
    source: String
  }],
  
  // Version control
  version: {
    type: Number,
    default: 1
  },
  previousVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBase'
  },
  
  // Status and visibility
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'archived'],
    default: 'draft'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isTemplate: {
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
  reviewers: [{
    userId: String,
    reviewedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    comments: String
  }],
  
  // Usage statistics
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // AI analysis
  aiAnalysis: {
    keywords: [String],
    complexity: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    estimatedReadTime: Number, // in minutes
    relatedTopics: [String],
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

// Indexes for better performance
knowledgeBaseSchema.index({ title: 'text', description: 'text', content: 'text' });
knowledgeBaseSchema.index({ category: 1, subcategory: 1 });
knowledgeBaseSchema.index({ createdBy: 1 });
knowledgeBaseSchema.index({ status: 1, isPublic: 1 });
knowledgeBaseSchema.index({ tags: 1 });
knowledgeBaseSchema.index({ createdAt: -1 });

// Pre-save middleware
knowledgeBaseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
knowledgeBaseSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'approved', isPublic: true });
};

knowledgeBaseSchema.statics.searchKnowledge = function(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'approved',
    isPublic: true,
    ...filters
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

knowledgeBaseSchema.statics.getPopularKnowledge = function(limit = 10) {
  return this.find({ status: 'approved', isPublic: true })
    .sort({ viewCount: -1, rating: -1 })
    .limit(limit);
};

knowledgeBaseSchema.statics.getRecentKnowledge = function(limit = 10) {
  return this.find({ status: 'approved', isPublic: true })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Instance methods
knowledgeBaseSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

knowledgeBaseSchema.methods.addRating = function(rating) {
  const totalRating = this.rating.average * this.rating.count + rating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

knowledgeBaseSchema.methods.createNewVersion = function(newData) {
  const newVersion = new this.constructor({
    ...newData,
    version: this.version + 1,
    previousVersion: this._id,
    createdBy: newData.createdBy || this.createdBy
  });
  return newVersion.save();
};

export default mongoose.model('KnowledgeBase', knowledgeBaseSchema);

