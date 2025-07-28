import mongoose from "mongoose";

const clinicalAnalysisSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },
    patientId: {
      type: String,
      required: true,
    },
    analysisType: {
      type: String,
      enum: ["document", "visit", "comprehensive"],
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    clinicalInsights: [
      {
        type: {
          type: String,
          enum: ["risk", "improvement", "alert", "recommendation"],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        priority: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          required: true,
        },
        category: {
          type: String,
          required: true,
        },
        evidence: {
          type: String,
          required: true,
        },
      },
    ],
    extractedEntities: {
      medications: [
        {
          type: String,
        },
      ],
      conditions: [
        {
          type: String,
        },
      ],
      procedures: [
        {
          type: String,
        },
      ],
      vitals: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      allergies: [
        {
          type: String,
        },
      ],
      functionalStatus: [
        {
          type: String,
        },
      ],
      cognitiveStatus: [
        {
          type: String,
        },
      ],
      socialFactors: [
        {
          type: String,
        },
      ],
    },
    soapNote: {
      subjective: {
        type: String,
        required: true,
      },
      objective: {
        type: String,
        required: true,
      },
      assessment: {
        type: String,
        required: true,
      },
      plan: {
        type: String,
        required: true,
      },
    },
    oasisScores: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
    careGoals: [
      {
        goal: {
          type: String,
          required: true,
        },
        timeframe: {
          type: String,
          required: true,
        },
        interventions: [
          {
            type: String,
          },
        ],
        outcomes: [
          {
            type: String,
          },
        ],
      },
    ],
    interventions: [
      {
        intervention: {
          type: String,
          required: true,
        },
        frequency: {
          type: String,
          required: true,
        },
        rationale: {
          type: String,
          required: true,
        },
        expectedOutcome: {
          type: String,
          required: true,
        },
      },
    ],
    riskFactors: [
      {
        risk: {
          type: String,
          required: true,
        },
        severity: {
          type: String,
          enum: ["low", "moderate", "high", "severe"],
          required: true,
        },
        interventions: [
          {
            type: String,
          },
        ],
        monitoring: {
          type: String,
          required: true,
        },
      },
    ],
    providerCommunication: [
      {
        priority: {
          type: String,
          enum: ["low", "medium", "high", "urgent"],
          required: true,
        },
        topic: {
          type: String,
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        action: {
          type: String,
          required: true,
        },
      },
    ],
    skilledNeedJustification: {
      primary: {
        type: String,
        required: true,
      },
      secondary: [
        {
          type: String,
        },
      ],
      frequency: {
        type: String,
        required: true,
      },
      duration: {
        type: String,
        required: true,
      },
      goals: [
        {
          type: String,
        },
      ],
      outcomes: [
        {
          type: String,
        },
      ],
    },
    qualityIndicators: {
      fallRisk: {
        type: String,
        enum: ["low", "moderate", "high"],
      },
      readmissionRisk: {
        type: String,
        enum: ["low", "moderate", "high"],
      },
      medicationCompliance: {
        type: String,
        enum: ["excellent", "good", "fair", "poor"],
      },
      functionalImprovement: {
        type: String,
        enum: ["significant", "moderate", "minimal", "none"],
      },
      patientSafety: {
        type: String,
        enum: ["excellent", "good", "fair", "poor"],
      },
    },
    processingTime: {
      type: Number,
      required: true,
    },
    aiProvider: {
      type: String,
      enum: ["openai", "gemini"],
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
clinicalAnalysisSchema.index({ fileId: 1 });
clinicalAnalysisSchema.index({ patientId: 1, createdAt: -1 });
clinicalAnalysisSchema.index({ analysisType: 1 });
clinicalAnalysisSchema.index({ createdBy: 1, createdAt: -1 });
clinicalAnalysisSchema.index({ "qualityIndicators.fallRisk": 1 });
clinicalAnalysisSchema.index({ "qualityIndicators.readmissionRisk": 1 });

// Virtual for analysis age
clinicalAnalysisSchema.virtual("analysisAge").get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Instance method to get summary data
clinicalAnalysisSchema.methods.getSummary = function () {
  return {
    id: this._id,
    patientId: this.patientId,
    analysisType: this.analysisType,
    summary: this.summary,
    confidence: this.confidence,
    aiProvider: this.aiProvider,
    createdAt: this.createdAt,
    processingTime: this.processingTime,
    insightsCount: this.clinicalInsights.length,
    riskFactorsCount: this.riskFactors.length,
    careGoalsCount: this.careGoals.length,
  };
};

// Static method to get latest analysis for patient
clinicalAnalysisSchema.statics.getLatestForPatient = function (patientId) {
  return this.findOne({ patientId })
    .sort({ createdAt: -1 })
    .populate("fileId", "filename originalname createdAt");
};

// Static method to get analysis by type
clinicalAnalysisSchema.statics.getByType = function (patientId, analysisType) {
  return this.find({ patientId, analysisType })
    .sort({ createdAt: -1 })
    .populate("fileId", "filename originalname createdAt");
};

const ClinicalAnalysis = mongoose.model(
  "ClinicalAnalysis",
  clinicalAnalysisSchema
);
export default ClinicalAnalysis;
