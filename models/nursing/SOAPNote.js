import mongoose from "mongoose";

const soapNoteSchema = new mongoose.Schema(
  {
    // Basic Information
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visitDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    template: {
      type: String,
      enum: ["general", "pediatric", "geriatric", "emergency", "specialty"],
      default: "general",
    },

    // SOAP Structure
    subjective: {
      chiefComplaint: {
        type: String,
        required: true,
      },
      historyOfPresentIllness: String,
      reviewOfSystems: {
        constitutional: String,
        cardiovascular: String,
        respiratory: String,
        gastrointestinal: String,
        genitourinary: String,
        musculoskeletal: String,
        neurological: String,
        psychiatric: String,
        endocrine: String,
        hematologic: String,
        allergic: String,
      },
      pastMedicalHistory: String,
      medications: [
        {
          name: String,
          dosage: String,
          frequency: String,
          route: String,
        },
      ],
      allergies: [
        {
          allergen: String,
          reaction: String,
          severity: {
            type: String,
            enum: ["mild", "moderate", "severe"],
          },
        },
      ],
      socialHistory: String,
      familyHistory: String,
    },

    objective: {
      vitalSigns: {
        temperature: Number,
        bloodPressure: {
          systolic: Number,
          diastolic: Number,
        },
        heartRate: Number,
        respiratoryRate: Number,
        oxygenSaturation: Number,
        weight: Number,
        height: Number,
        bmi: Number,
        painScale: Number,
      },
      physicalExam: {
        general: String,
        head: String,
        eyes: String,
        ears: String,
        nose: String,
        throat: String,
        neck: String,
        cardiovascular: String,
        respiratory: String,
        abdomen: String,
        extremities: String,
        neurological: String,
        skin: String,
        psychiatric: String,
      },
      diagnosticResults: [
        {
          testType: String,
          result: String,
          date: Date,
          interpretation: String,
        },
      ],
    },

    assessment: {
      primaryDiagnosis: {
        type: String,
        required: true,
      },
      secondaryDiagnoses: [String],
      differentialDiagnoses: [String],
      clinicalImpression: String,
      riskFactors: [String],
      prognosis: String,
    },

    plan: {
      treatments: [
        {
          intervention: String,
          instructions: String,
          duration: String,
          frequency: String,
        },
      ],
      medications: [
        {
          name: String,
          dosage: String,
          frequency: String,
          duration: String,
          instructions: String,
        },
      ],
      followUp: String,
      referrals: [
        {
          specialty: String,
          provider: String,
          reason: String,
          urgency: {
            type: String,
            enum: ["routine", "urgent", "stat"],
            default: "routine",
          },
        },
      ],
      patientEducation: String,
      lifestyle: String,
    },

    // AI Enhancements
    aiEnhancements: {
      qualityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      completenessScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      clinicalInsights: [String],
      suggestedImprovements: [String],
      riskAlerts: [
        {
          type: String,
          severity: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
          },
          message: String,
          recommendation: String,
        },
      ],
      codingSuggestions: [
        {
          code: String,
          description: String,
          confidence: Number,
        },
      ],
    },

    // Status and Workflow
    status: {
      type: String,
      enum: [
        "draft",
        "in_progress",
        "completed",
        "reviewed",
        "signed",
        "locked",
      ],
      default: "draft",
    },

    // Digital Signature
    signature: {
      signed: {
        type: Boolean,
        default: false,
      },
      signedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      signedAt: Date,
      signatureHash: String,
      witnessedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      ipAddress: String,
    },

    // Version Control
    version: {
      type: Number,
      default: 1,
    },
    history: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        action: String,
        changes: mongoose.Schema.Types.Mixed,
        notes: String,
      },
    ],
    approvals: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      },
    ],

    // Metadata
    metadata: {
      wordCount: {
        type: Number,
        default: 0,
      },
      timeSpent: {
        type: Number, // in seconds
        default: 0,
      },
      location: String,
      deviceInfo: String,
      ipAddress: String,
      autoSaved: {
        type: Boolean,
        default: false,
      },
      lastAutoSave: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
soapNoteSchema.index({ patientId: 1, visitDate: -1 });
soapNoteSchema.index({ userId: 1, status: 1 });
soapNoteSchema.index({ visitDate: -1, status: 1 });
soapNoteSchema.index({ template: 1, createdAt: -1 });
soapNoteSchema.index({ "aiEnhancements.qualityScore": -1 });
soapNoteSchema.index({ "signature.signed": 1, "signature.signedAt": -1 });

// Virtual for note completeness
soapNoteSchema.virtual("completeness").get(function () {
  let totalFields = 0;
  let completedFields = 0;

  // Count subjective fields
  const subjectiveFields = ["chiefComplaint", "historyOfPresentIllness"];
  subjectiveFields.forEach((field) => {
    totalFields++;
    if (this.subjective[field] && this.subjective[field].trim()) {
      completedFields++;
    }
  });

  // Count objective fields
  const objectiveFields = ["vitalSigns", "physicalExam"];
  objectiveFields.forEach((field) => {
    totalFields++;
    if (
      this.objective[field] &&
      Object.keys(this.objective[field]).length > 0
    ) {
      completedFields++;
    }
  });

  // Count assessment fields
  totalFields++;
  if (
    this.assessment.primaryDiagnosis &&
    this.assessment.primaryDiagnosis.trim()
  ) {
    completedFields++;
  }

  // Count plan fields
  totalFields++;
  if (this.plan.treatments && this.plan.treatments.length > 0) {
    completedFields++;
  }

  return totalFields > 0
    ? Math.round((completedFields / totalFields) * 100)
    : 0;
});

// Virtual for estimated reading time
soapNoteSchema.virtual("estimatedReadingTime").get(function () {
  const wordsPerMinute = 200;
  return Math.ceil(this.metadata.wordCount / wordsPerMinute);
});

// Pre-save middleware to calculate word count
soapNoteSchema.pre("save", function (next) {
  let wordCount = 0;

  // Count words in subjective section
  Object.values(this.subjective).forEach((value) => {
    if (typeof value === "string") {
      wordCount += value.split(/\s+/).filter((word) => word.length > 0).length;
    }
  });

  // Count words in objective section
  Object.values(this.objective).forEach((value) => {
    if (typeof value === "string") {
      wordCount += value.split(/\s+/).filter((word) => word.length > 0).length;
    }
  });

  // Count words in assessment section
  Object.values(this.assessment).forEach((value) => {
    if (typeof value === "string") {
      wordCount += value.split(/\s+/).filter((word) => word.length > 0).length;
    }
  });

  this.metadata.wordCount = wordCount;
  next();
});

// Instance method to generate summary
soapNoteSchema.methods.generateSummary = function () {
  return {
    patient: this.patientId,
    date: this.visitDate,
    chiefComplaint: this.subjective.chiefComplaint,
    primaryDiagnosis: this.assessment.primaryDiagnosis,
    keyTreatments: this.plan.treatments.slice(0, 3).map((t) => t.intervention),
    status: this.status,
    completeness: this.completeness,
  };
};

// Instance method to validate required fields
soapNoteSchema.methods.validateRequiredFields = function () {
  const errors = [];

  if (
    !this.subjective.chiefComplaint ||
    !this.subjective.chiefComplaint.trim()
  ) {
    errors.push("Chief complaint is required");
  }

  if (
    !this.assessment.primaryDiagnosis ||
    !this.assessment.primaryDiagnosis.trim()
  ) {
    errors.push("Primary diagnosis is required");
  }

  if (!this.plan.treatments || this.plan.treatments.length === 0) {
    errors.push("At least one treatment plan is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Static method to get notes statistics
soapNoteSchema.statics.getNotesStats = function (userId, dateRange = {}) {
  const matchStage = { userId };

  if (dateRange.start || dateRange.end) {
    matchStage.visitDate = {};
    if (dateRange.start) matchStage.visitDate.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.visitDate.$lte = new Date(dateRange.end);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalNotes: { $sum: 1 },
        completedNotes: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        signedNotes: {
          $sum: { $cond: ["$signature.signed", 1, 0] },
        },
        averageQualityScore: { $avg: "$aiEnhancements.qualityScore" },
        averageWordCount: { $avg: "$metadata.wordCount" },
        averageTimeSpent: { $avg: "$metadata.timeSpent" },
        templates: { $push: "$template" },
      },
    },
    {
      $project: {
        _id: 0,
        totalNotes: 1,
        completedNotes: 1,
        signedNotes: 1,
        completionRate: {
          $multiply: [{ $divide: ["$completedNotes", "$totalNotes"] }, 100],
        },
        signatureRate: {
          $multiply: [{ $divide: ["$signedNotes", "$totalNotes"] }, 100],
        },
        averageQualityScore: { $round: ["$averageQualityScore", 2] },
        averageWordCount: { $round: ["$averageWordCount", 0] },
        averageTimeSpent: { $round: ["$averageTimeSpent", 0] },
        templates: 1,
      },
    },
  ]);
};

// Static method to search notes
soapNoteSchema.statics.searchNotes = function (userId, query, options = {}) {
  const searchRegex = new RegExp(query, "i");
  const matchStage = {
    userId,
    $or: [
      { "subjective.chiefComplaint": searchRegex },
      { "subjective.historyOfPresentIllness": searchRegex },
      { "assessment.primaryDiagnosis": searchRegex },
      { "assessment.clinicalImpression": searchRegex },
    ],
  };

  if (options.status) {
    matchStage.status = options.status;
  }

  if (options.template) {
    matchStage.template = options.template;
  }

  return this.find(matchStage)
    .populate("patientId", "name medicalRecordNumber")
    .sort({ visitDate: -1 })
    .limit(options.limit || 20);
};

const SOAPNote = mongoose.model("SOAPNote", soapNoteSchema);

export default SOAPNote;
