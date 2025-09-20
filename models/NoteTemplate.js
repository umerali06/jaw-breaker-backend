import mongoose from "mongoose";

const noteTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "soap",
        "progress",
        "discharge",
        "consultation",
        "procedure",
        "medication",
        "cardiology",
        "endocrinology",
        "neurology",
        "emergency",
        "custom",
      ],
      index: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    specialty: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: String,
      default: "1.0",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    metadata: {
      evidenceLevel: String,
      lastReviewed: Date,
      reviewFrequency: String,
      tags: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
noteTemplateSchema.index({ type: 1, isActive: 1 });
noteTemplateSchema.index({ category: 1, isActive: 1 });
noteTemplateSchema.index({ specialty: 1, isActive: 1 });
noteTemplateSchema.index({ name: 1, isActive: 1 });

// Instance method to get safe template data
noteTemplateSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    description: this.description,
    type: this.type,
    prompt: this.prompt,
    category: this.category,
    specialty: this.specialty,
    version: this.version,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static method to get templates by type
noteTemplateSchema.statics.getTemplatesByType = function (type) {
  return this.find({ type: type, isActive: true }).sort({ name: 1 });
};

// Static method to get templates by category
noteTemplateSchema.statics.getTemplatesByCategory = function (category) {
  return this.find({ category: category, isActive: true }).sort({ name: 1 });
};

// Static method to search templates
noteTemplateSchema.statics.searchTemplates = function (query) {
  const searchRegex = new RegExp(query, "i");
  return this.find({
    isActive: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { specialty: searchRegex },
    ],
  }).sort({ name: 1 });
};

const NoteTemplate = mongoose.model("NoteTemplate", noteTemplateSchema);
export default NoteTemplate;










