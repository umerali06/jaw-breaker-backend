import mongoose from "mongoose";

const nursingAssessmentSchema = new mongoose.Schema(
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

    // Assessment Type and Template
    assessmentType: {
      type: String,
      enum: [
        "head-to-toe",
        "focused",
        "pain",
        "mental-status",
        "fall-risk",
        "wound",
        "cardiac",
        "respiratory",
        "neurological",
        "mobility",
        "nutrition",
      ],
      required: true,
    },
    template: String,

    // Assessment Data Structure (Dynamic based on type)
    assessmentData: {
      // General Assessment Fields
      general: {
        appearance: String,
        consciousness: String,
        orientation: String,
        distress: String,
        mood: String,
        behavior: String,
      },

      // Vital Signs
      vitals: {
        temperature: String,
        bloodPressure: String,
        heartRate: String,
        respiratoryRate: String,
        oxygenSaturation: String,
        pain: String,
        weight: String,
        height: String,
        bmi: Number,
      },

      // System-Specific Assessments
      neurological: {
        consciousness: String,
        orientation: String,
        speech: String,
        memory: String,
        motorFunction: String,
        sensoryFunction: String,
        reflexes: String,
        pupils: String,
        cranialNerves: String,
      },

      cardiovascular: {
        heartSounds: String,
        rhythm: String,
        peripheralPulses: String,
        edema: String,
        capillaryRefill: String,
        skinColor: String,
        jugularVeinDistention: String,
        chestPain: String,
      },

      respiratory: {
        breathSounds: String,
        respiratoryEffort: String,
        cough: String,
        sputum: String,
        oxygenSupport: String,
        chestExpansion: String,
        dyspnea: String,
      },

      gastrointestinal: {
        bowelSounds: String,
        abdomen: String,
        lastBowelMovement: String,
        nausea: String,
        appetite: String,
        swallowing: String,
        nutrition: String,
      },

      genitourinary: {
        urination: String,
        bladderDistention: String,
        incontinence: String,
        catheter: String,
        urineCharacteristics: String,
      },

      musculoskeletal: {
        mobility: String,
        strength: String,
        range: String,
        gait: String,
        assistiveDevices: String,
        jointFunction: String,
        balance: String,
      },

      integumentary: {
        skinCondition: String,
        wounds: String,
        pressure: String,
        temperature: String,
        moisture: String,
        turgor: String,
        lesions: String,
      },

      // Specialized Assessment Data
      painAssessment: {
        location: String,
        quality: String,
        intensity: {
          type: Number,
          min: 0,
          max: 10,
        },
        duration: String,
        frequency: String,
        aggravatingFactors: [String],
        alleviatingFactors: [String],
        associatedSymptoms: [String],
        functionalImpact: String,
        previousTreatments: String,
        scale: {
          type: String,
          enum: ["numeric", "faces", "behavioral", "flacc"],
        },
      },

      mentalStatusExam: {
        orientation: {
          person: Boolean,
          place: Boolean,
          time: Boolean,
          situation: Boolean,
        },
        memory: {
          immediate: String,
          recent: String,
          remote: String,
        },
        attention: String,
        language: String,
        mood: String,
        affect: String,
        thoughtProcess: String,
        perceptions: String,
        insight: String,
        judgment: String,
        mmseScore: {
          type: Number,
          min: 0,
          max: 30,
        },
      },

      fallRiskAssessment: {
        morseScale: {
          historyOfFalls: {
            type: Number,
            enum: [0, 25], // No = 0, Yes = 25
          },
          secondaryDiagnosis: {
            type: Number,
            enum: [0, 15], // No = 0, Yes = 15
          },
          ambulatoryAid: {
            type: Number,
            enum: [0, 15, 30], // None/bed rest = 0, Crutches/cane = 15, Furniture = 30
          },
          ivTherapy: {
            type: Number,
            enum: [0, 20], // No = 0, Yes = 20
          },
          gait: {
            type: Number,
            enum: [0, 10, 20], // Normal = 0, Weak = 10, Impaired = 20
          },
          mentalStatus: {
            type: Number,
            enum: [0, 15], // Oriented = 0, Forgets limitations = 15
          },
          totalScore: Number,
        },
        hendrichScale: {
          confusionDisorientation: Boolean,
          symptomatic: Boolean,
          sensoryDeficit: Boolean,
          notSafetyAware: Boolean,
          impaired: Boolean,
          totalScore: Number,
        },
        riskLevel: {
          type: String,
          enum: ["low", "medium", "high"],
        },
        interventions: [String],
      },
    },

    // Assessment Findings and Clinical Observations
    findings: [
      {
        system: String,
        finding: String,
        significance: {
          type: String,
          enum: ["normal", "abnormal", "critical"],
        },
        followUp: String,
        priority: {
          type: Number,
          min: 1,
          max: 5,
        },
      },
    ],

    // AI Analysis and Clinical Decision Support
    aiAnalysis: {
      completenessScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      abnormalFindings: [String],
      riskAssessment: {
        fallRisk: {
          score: Number,
          level: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          factors: [String],
        },
        pressureUlcerRisk: {
          score: Number,
          level: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          factors: [String],
        },
        infectionRisk: {
          score: Number,
          level: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          factors: [String],
        },
        deteriorationRisk: {
          score: Number,
          level: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          factors: [String],
        },
      },
      recommendations: [String],
      alerts: [
        {
          severity: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
          },
          message: String,
          action: String,
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      clinicalInsights: [String],
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },

    // Assessment Status and Workflow
    status: {
      type: String,
      enum: ["draft", "in_progress", "completed", "reviewed", "signed"],
      default: "draft",
    },

    // Version Control and History
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

    // Metadata
    metadata: {
      startTime: Date,
      completedAt: Date,
      duration: Number, // in seconds
      location: String,
      deviceInfo: String,
      assessmentTool: String, // Which standardized tool was used
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
nursingAssessmentSchema.index({ patientId: 1, createdAt: -1 });
nursingAssessmentSchema.index({ userId: 1, assessmentType: 1 });
nursingAssessmentSchema.index({ status: 1, createdAt: -1 });
nursingAssessmentSchema.index({
  "aiAnalysis.riskAssessment.fallRisk.level": 1,
});
nursingAssessmentSchema.index({ assessmentType: 1, createdAt: -1 });

// Virtual for assessment completion percentage
nursingAssessmentSchema.virtual("completionPercentage").get(function () {
  let totalFields = 0;
  let completedFields = 0;

  // Count based on assessment type
  const requiredFields = this.getRequiredFieldsByType();

  requiredFields.forEach((fieldPath) => {
    totalFields++;
    const value = this.getNestedValue(fieldPath);
    if (value !== null && value !== undefined && value !== "") {
      completedFields++;
    }
  });

  return totalFields > 0
    ? Math.round((completedFields / totalFields) * 100)
    : 0;
});

// Instance method to get required fields by assessment type
nursingAssessmentSchema.methods.getRequiredFieldsByType = function () {
  const baseFields = [
    "assessmentData.general.appearance",
    "assessmentData.vitals.temperature",
  ];

  switch (this.assessmentType) {
    case "head-to-toe":
      return [
        ...baseFields,
        "assessmentData.neurological.consciousness",
        "assessmentData.cardiovascular.heartSounds",
        "assessmentData.respiratory.breathSounds",
        "assessmentData.gastrointestinal.bowelSounds",
        "assessmentData.musculoskeletal.mobility",
        "assessmentData.integumentary.skinCondition",
      ];
    case "pain":
      return [
        ...baseFields,
        "assessmentData.painAssessment.location",
        "assessmentData.painAssessment.intensity",
        "assessmentData.painAssessment.quality",
      ];
    case "fall-risk":
      return [
        ...baseFields,
        "assessmentData.fallRiskAssessment.morseScale.historyOfFalls",
        "assessmentData.fallRiskAssessment.morseScale.gait",
        "assessmentData.fallRiskAssessment.morseScale.mentalStatus",
      ];
    default:
      return baseFields;
  }
};

// Instance method to get nested value from object path
nursingAssessmentSchema.methods.getNestedValue = function (path) {
  return path.split(".").reduce((obj, key) => obj && obj[key], this);
};

// Instance method to calculate fall risk score (Morse Scale)
nursingAssessmentSchema.methods.calculateMorseScore = function () {
  if (this.assessmentType !== "fall-risk") return null;

  const morse = this.assessmentData.fallRiskAssessment.morseScale;
  const totalScore =
    (morse.historyOfFalls || 0) +
    (morse.secondaryDiagnosis || 0) +
    (morse.ambulatoryAid || 0) +
    (morse.ivTherapy || 0) +
    (morse.gait || 0) +
    (morse.mentalStatus || 0);

  morse.totalScore = totalScore;

  // Determine risk level
  let riskLevel;
  if (totalScore >= 45) {
    riskLevel = "high";
  } else if (totalScore >= 25) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  this.assessmentData.fallRiskAssessment.riskLevel = riskLevel;

  return { totalScore, riskLevel };
};

// Instance method to generate AI insights
nursingAssessmentSchema.methods.generateAIInsights = async function () {
  const insights = [];
  const recommendations = [];
  const alerts = [];

  // Analyze vital signs
  if (this.assessmentData.vitals.temperature) {
    const temp = parseFloat(this.assessmentData.vitals.temperature);
    if (temp > 100.4) {
      alerts.push({
        severity: "high",
        message: "Elevated temperature detected",
        action: "Monitor closely and consider fever management",
      });
    }
  }

  // Analyze pain assessment
  if (
    this.assessmentData.painAssessment &&
    this.assessmentData.painAssessment.intensity > 7
  ) {
    alerts.push({
      severity: "high",
      message: "Severe pain reported",
      action: "Implement pain management interventions immediately",
    });
  }

  // Analyze fall risk
  if (this.assessmentType === "fall-risk") {
    const morseScore = this.calculateMorseScore();
    if (morseScore && morseScore.riskLevel === "high") {
      alerts.push({
        severity: "high",
        message: "High fall risk identified",
        action: "Implement fall prevention measures immediately",
      });
    }
  }

  // Update AI analysis
  this.aiAnalysis.recommendations = recommendations;
  this.aiAnalysis.alerts = alerts;
  this.aiAnalysis.clinicalInsights = insights;
  this.aiAnalysis.completenessScore = this.completionPercentage;

  return { insights, recommendations, alerts };
};

// Static method to get assessment statistics
nursingAssessmentSchema.statics.getAssessmentStats = function (
  userId,
  assessmentType = null,
  dateRange = {}
) {
  const matchStage = { userId };

  if (assessmentType) {
    matchStage.assessmentType = assessmentType;
  }

  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$assessmentType",
        count: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        averageCompletionTime: { $avg: "$metadata.duration" },
        highRiskCount: {
          $sum: {
            $cond: [
              { $eq: ["$aiAnalysis.riskAssessment.fallRisk.level", "high"] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        assessmentType: "$_id",
        totalAssessments: "$count",
        completedAssessments: "$completedCount",
        completionRate: {
          $multiply: [{ $divide: ["$completedCount", "$count"] }, 100],
        },
        averageCompletionTime: { $round: ["$averageCompletionTime", 0] },
        highRiskCount: 1,
      },
    },
  ]);
};

const NursingAssessment = mongoose.model(
  "NursingAssessment",
  nursingAssessmentSchema
);

export default NursingAssessment;
