import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    content: {
      type: String,
      required: true,
      trim: true,
    },
    template: {
      type: String,
      required: false,
      trim: true,
    },
    templateId: {
      type: String,
      required: false,
      trim: true,
    },
    customPrompt: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "completed", "archived"],
      default: "completed",
      index: true,
    },
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    metadata: {
      diagnosis: String,
      medications: [String],
      procedures: [String],
      followUpDate: Date,
      priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
noteSchema.index({ patientId: 1, createdAt: -1 });
noteSchema.index({ doctorId: 1, createdAt: -1 });
noteSchema.index({ type: 1, status: 1 });
noteSchema.index({ createdAt: -1 });
noteSchema.index({ "metadata.priority": 1 });

// Virtual for note summary
noteSchema.virtual("summary").get(function () {
  if (!this.content) return "";
  return this.content.length > 200
    ? this.content.substring(0, 200) + "..."
    : this.content;
});

// Instance method to get safe note data
noteSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    patientId: this.patientId,
    doctorId: this.doctorId,
    type: this.type,
    content: this.content,
    template: this.template,
    templateId: this.templateId,
    customPrompt: this.customPrompt,
    status: this.status,
    aiGenerated: this.aiGenerated,
    metadata: this.metadata,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static method to search notes
noteSchema.statics.searchNotes = function (query, doctorId, patientId = null) {
  const searchRegex = new RegExp(query, "i");
  const searchCriteria = {
    doctorId: doctorId,
    isActive: true,
    $or: [
      { content: searchRegex },
      { template: searchRegex },
      { "metadata.diagnosis": searchRegex },
    ],
  };

  if (patientId) {
    searchCriteria.patientId = patientId;
  }

  return this.find(searchCriteria).sort({ createdAt: -1 });
};

// Static method to get notes by patient
noteSchema.statics.getNotesByPatient = function (patientId, doctorId) {
  return this.find({
    patientId: patientId,
    doctorId: doctorId,
    isActive: true,
  }).sort({ createdAt: -1 });
};

// Static method to get notes by type
noteSchema.statics.getNotesByType = function (type, doctorId) {
  return this.find({
    type: type,
    doctorId: doctorId,
    isActive: true,
  }).sort({ createdAt: -1 });
};

const Note = mongoose.model("Note", noteSchema);
export default Note;










