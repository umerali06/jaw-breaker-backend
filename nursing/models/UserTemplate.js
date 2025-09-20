import mongoose from 'mongoose';

const userTemplateSchema = new mongoose.Schema({
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
  templateName: {
    type: String,
    required: true,
    trim: true
  },
  condition: {
    type: String,
    required: true,
    trim: true
  },
  templateType: {
    type: String,
    required: true,
    enum: ['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']
  },
  templateData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  sourceTemplate: {
    type: String,
    required: false, // ID of the original template if this is a copy
    default: null
  },
  isCustom: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
userTemplateSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
userTemplateSchema.index({ condition: 1, templateType: 1, isDeleted: 1 });
userTemplateSchema.index({ userId: 1, condition: 1, templateType: 1 });
userTemplateSchema.index({ isPublic: 1, isDeleted: 1 });

// Virtual for formatted creation date
userTemplateSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toISOString();
});

// Virtual for formatted last used date
userTemplateSchema.virtual('formattedLastUsed').get(function() {
  return this.lastUsed ? this.lastUsed.toISOString() : null;
});

// Method to increment usage count
userTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Method to soft delete
userTemplateSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Static method to get user templates
userTemplateSchema.statics.getUserTemplates = function(userId, condition = null, templateType = null) {
  const query = { 
    userId, 
    isDeleted: false 
  };
  
  if (condition) {
    query.condition = condition;
  }
  
  if (templateType) {
    query.templateType = templateType;
  }
  
  console.log('🔍 UserTemplate.getUserTemplates query:', query);
  
  return this.find(query)
    .sort({ lastUsed: -1, createdAt: -1 })
    .limit(100);
};

// Static method to get public templates
userTemplateSchema.statics.getPublicTemplates = function(condition = null, templateType = null) {
  const query = { 
    isPublic: true,
    isDeleted: false 
  };
  
  if (condition) {
    query.condition = condition;
  }
  
  if (templateType) {
    query.templateType = templateType;
  }
  
  return this.find(query)
    .sort({ usageCount: -1, createdAt: -1 })
    .limit(50);
};

// Static method to get template by ID
userTemplateSchema.statics.getTemplateById = function(templateId, userId = null) {
  const query = { 
    _id: templateId,
    isDeleted: false 
  };
  
  // If userId is provided, ensure user owns the template or it's public
  if (userId) {
    query.$or = [
      { userId: userId },
      { isPublic: true }
    ];
  }
  
  return this.findOne(query);
};

// Static method to search templates
userTemplateSchema.statics.searchTemplates = function(userId, searchTerm, condition = null, templateType = null) {
  const query = { 
    $or: [
      { userId: userId, isDeleted: false },
      { isPublic: true, isDeleted: false }
    ]
  };
  
  if (searchTerm) {
    query.$and = [
      {
        $or: [
          { templateName: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } }
        ]
      }
    ];
  }
  
  if (condition) {
    query.condition = condition;
  }
  
  if (templateType) {
    query.templateType = templateType;
  }
  
  return this.find(query)
    .sort({ usageCount: -1, createdAt: -1 })
    .limit(50);
};

// Static method to get template statistics
userTemplateSchema.statics.getTemplateStats = function(userId) {
  return this.aggregate([
    { $match: { userId, isDeleted: false } },
    {
      $group: {
        _id: null,
        totalTemplates: { $sum: 1 },
        totalUsage: { $sum: '$usageCount' },
        conditions: { $addToSet: '$condition' },
        templateTypes: { $addToSet: '$templateType' }
      }
    }
  ]);
};

const UserTemplate = mongoose.model('UserTemplate', userTemplateSchema);

export default UserTemplate;
