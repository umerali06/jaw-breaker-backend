import mongoose from "mongoose";

const oasisAssessmentSchema = new mongoose.Schema(
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

    // Assessment Type and Episode Information
    assessmentType: {
      type: String,
      enum: ["SOC", "ROC", "FU", "TRF", "DC"], // Start of Care, Resumption, Follow-up, Transfer, Discharge
      required: true,
    },
    episodeId: {
      type: String,
      required: true,
    },

    // OASIS-E Data Structure (M-Items)
    oasisData: {
      // Administrative Items
      M0010: String, // Agency Medicare Provider Number
      M0014: String, // Branch State
      M0016: String, // Branch ID Number
      M0018: String, // National Provider Identifier
      M0020: String, // Patient ID Number
      M0030: Date, // Start of Care Date
      M0032: Date, // Resumption of Care Date

      // Patient Demographics and History
      M0040: String, // Patient Name
      M0050: String, // Patient State of Residence
      M0060: String, // Patient ZIP Code
      M0063: String, // Medicare Number
      M0064: String, // Social Security Number
      M0065: String, // Medicaid Number
      M0066: Date, // Birth Date
      M0069: String, // Gender
      M0070: [String], // Race/Ethnicity
      M0072: String, // Primary Language

      // Clinical Record Items
      M0080: String, // Discipline of Person Completing Assessment
      M0090: Date, // Date Assessment Completed
      M0100: Date, // This Assessment is Currently Being Completed for the Following Reason
      M0102: String, // Date of Physician Ordered Start of Care
      M0104: String, // Date of Referral

      // Patient History and Diagnoses
      M0110: [String], // Episode Timing
      M0140: [String], // Race/Ethnicity
      M1000: String, // From which of the following Inpatient Facilities was the patient discharged
      M1005: String, // Inpatient Discharge Date
      M1010: String, // List each Inpatient Diagnosis and ICD-10-CM code
      M1011: String, // List each Inpatient Procedure and ICD-10-PCS code
      M1016: String, // Diagnoses Requiring Medical or Treatment Regimen Change
      M1018: String, // Conditions Prior to Medical or Treatment Regimen Change
      M1020: String, // Primary Diagnosis
      M1021: String, // Other Diagnoses
      M1023: String, // Other Diagnoses
      M1025: String, // Other Diagnoses
      M1027: String, // Other Diagnoses
      M1029: String, // Other Diagnoses
      M1031: String, // Other Diagnoses

      // Living Arrangements
      M1100: String, // Patient Living Situation
      M1110: String, // Availability of Assistance

      // Sensory Status
      M1200: String, // Vision
      M1210: String, // Ability to Hear
      M1220: String, // Understanding of Verbal Content
      M1230: String, // Speech and Oral Expression

      // Integumentary Status
      M1300: String, // Pressure Ulcer Assessment
      M1302: String, // Does this patient have a Risk for Developing Pressure Ulcers
      M1306: String, // Does this patient have at least one Unhealed Pressure Ulcer
      M1307: String, // The Oldest Stage 2 Pressure Ulcer that is present at discharge
      M1308: String, // Current Number of Unhealed Pressure Ulcers at Each Stage
      M1309: String, // The Largest Pressure Ulcer Stage
      M1310: String, // Pressure Ulcer Length
      M1312: String, // Pressure Ulcer Width
      M1314: String, // Pressure Ulcer Depth
      M1320: String, // Status of Most Problematic Pressure Ulcer
      M1322: String, // Current Number of Stage 1 Pressure Ulcers
      M1324: String, // Stage of Most Problematic Unhealed Pressure Ulcer
      M1330: String, // Does this patient have a Stasis Ulcer
      M1332: String, // Current Number of Stasis Ulcers
      M1334: String, // Status of Most Problematic Stasis Ulcer
      M1340: String, // Does this patient have a Surgical Wound
      M1342: String, // Status of Most Problematic Surgical Wound

      // Respiratory Status
      M1400: String, // When is the patient dyspneic or noticeably Short of Breath
      M1410: String, // Respiratory Treatments utilized at home

      // Cardiac Status
      M1500: String, // Symptoms in Heart Failure Patients

      // Elimination Status
      M1600: String, // Has this patient been treated for a Urinary Tract Infection
      M1610: String, // Urinary Incontinence or Urinary Catheter Presence
      M1615: String, // When does Urinary Incontinence occur
      M1620: String, // Bowel Incontinence Frequency
      M1630: String, // Ostomy for Bowel Elimination

      // Neuro/Emotional/Behavioral Status
      M1700: String, // Cognitive Functioning
      M1710: String, // When Confused
      M1720: String, // When Anxious
      M1730: String, // Depression Screening
      M1740: String, // Cognitive, behavioral, and psychiatric symptoms
      M1745: String, // Frequency of Disruptive Behavior Symptoms

      // Activities of Daily Living (ADL)/Instrumental Activities of Daily Living (IADL)
      M1800: String, // Grooming
      M1810: String, // Current Ability to Dress Upper Body
      M1820: String, // Current Ability to Dress Lower Body
      M1830: String, // Bathing
      M1840: String, // Toilet Transferring
      M1845: String, // Toileting Hygiene
      M1850: String, // Transferring
      M1860: String, // Ambulation/Locomotion
      M1870: String, // Feeding or Eating
      M1880: String, // Current Ability to Plan and Prepare Light Meals
      M1890: String, // Ability to Use Telephone

      // Medications
      M2000: String, // Drug Regimen Review
      M2002: String, // Medication Follow-up
      M2004: String, // Medication Intervention
      M2010: String, // Patient/Caregiver High Risk Drug Education
      M2020: String, // Management of Oral Medications
      M2030: String, // Management of Injectable Medications

      // Care Management
      M2100: String, // Types and Sources of Assistance
      M2110: String, // How Often does the patient receive ADL or IADL assistance

      // Therapy Need and Plan of Care
      M2200: String, // Therapy Need
      M2250: String, // Plan of Care Synopsis
      M2300: String, // Emergent Care
      M2310: String, // Reason for Emergent Care
      M2400: String, // Intervention Synopsis
      M2410: String, // Intervention Synopsis
      M2420: String, // Discharge Disposition
    },

    // Calculated Scores and Risk Assessments
    scoring: {
      totalScore: {
        type: Number,
        default: 0,
      },
      domainScores: {
        functional: Number,
        cognitive: Number,
        behavioral: Number,
        physiological: Number,
      },
      riskCategories: {
        hospitalization: {
          type: String,
          enum: ["Low", "Medium", "High"],
        },
        emergencyDept: {
          type: String,
          enum: ["Low", "Medium", "High"],
        },
        improvement: {
          type: String,
          enum: ["Low", "Medium", "High"],
        },
      },
      qualityMeasures: {
        improvementInAmbulation: Boolean,
        improvementInBathing: Boolean,
        improvementInTransferring: Boolean,
        improvementInManagingOralMedications: Boolean,
        improvementInPain: Boolean,
        improvementInDyspnea: Boolean,
        acuteCarehospitalization: Boolean,
        dischargeToCommunity: Boolean,
      },
    },

    // AI Analysis and Insights
    aiAnalysis: {
      completenessScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      accuracyScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      recommendations: [String],
      flaggedItems: [String],
      qualityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      riskPredictions: {
        readmissionRisk: {
          probability: Number,
          confidence: Number,
          factors: [String],
        },
        deteriorationRisk: {
          probability: Number,
          confidence: Number,
          factors: [String],
        },
        fallRisk: {
          probability: Number,
          confidence: Number,
          factors: [String],
        },
      },
      insights: [String],
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
      enum: [
        "draft",
        "in_progress",
        "completed",
        "reviewed",
        "submitted",
        "locked",
      ],
      default: "draft",
    },

    // CMS Submission Data
    submissionData: {
      submittedAt: Date,
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      confirmationNumber: String,
      errors: [String],
      warnings: [String],
      cmsResponse: mongoose.Schema.Types.Mixed,
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
      ipAddress: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
oasisAssessmentSchema.index({ patientId: 1, createdAt: -1 });
oasisAssessmentSchema.index({ userId: 1, status: 1 });
oasisAssessmentSchema.index({ episodeId: 1 });
oasisAssessmentSchema.index({ assessmentType: 1, createdAt: -1 });
oasisAssessmentSchema.index({ "scoring.totalScore": -1 });
oasisAssessmentSchema.index({ "aiAnalysis.qualityScore": -1 });

// Virtual for assessment completion percentage
oasisAssessmentSchema.virtual("completionPercentage").get(function () {
  const totalFields = Object.keys(this.oasisData).length;
  const completedFields = Object.values(this.oasisData).filter(
    (value) => value !== null && value !== undefined && value !== ""
  ).length;
  return totalFields > 0
    ? Math.round((completedFields / totalFields) * 100)
    : 0;
});

// Instance method to calculate OASIS scores
oasisAssessmentSchema.methods.calculateScores = function () {
  // Implement OASIS scoring algorithm
  const data = this.oasisData;
  let totalScore = 0;

  // Functional domain scoring
  const functionalItems = [
    "M1800",
    "M1810",
    "M1820",
    "M1830",
    "M1840",
    "M1850",
    "M1860",
    "M1870",
  ];
  let functionalScore = 0;
  functionalItems.forEach((item) => {
    if (data[item]) {
      functionalScore += parseInt(data[item]) || 0;
    }
  });

  // Cognitive domain scoring
  const cognitiveItems = ["M1700", "M1710", "M1720"];
  let cognitiveScore = 0;
  cognitiveItems.forEach((item) => {
    if (data[item]) {
      cognitiveScore += parseInt(data[item]) || 0;
    }
  });

  // Update scores
  this.scoring.domainScores.functional = functionalScore;
  this.scoring.domainScores.cognitive = cognitiveScore;
  this.scoring.totalScore = functionalScore + cognitiveScore;

  // Risk categorization based on scores
  if (this.scoring.totalScore >= 20) {
    this.scoring.riskCategories.hospitalization = "High";
  } else if (this.scoring.totalScore >= 10) {
    this.scoring.riskCategories.hospitalization = "Medium";
  } else {
    this.scoring.riskCategories.hospitalization = "Low";
  }

  return this.scoring;
};

// Instance method to validate assessment completeness
oasisAssessmentSchema.methods.validateCompleteness = function () {
  const requiredFields = [
    "M0010",
    "M0020",
    "M0030",
    "M0040",
    "M0066",
    "M0069",
    "M1020",
    "M1100",
    "M1200",
    "M1700",
    "M1800",
    "M1810",
  ];

  const missingFields = requiredFields.filter(
    (field) => !this.oasisData[field] || this.oasisData[field] === ""
  );

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPercentage: this.completionPercentage,
  };
};

// Static method to get assessments by patient
oasisAssessmentSchema.statics.getByPatient = function (patientId, options = {}) {
  const query = { patientId };
  
  return this.find(query)
    .populate("userId", "firstName lastName email")
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

// Static method to get assessment statistics
oasisAssessmentSchema.statics.getAssessmentStats = function (
  userId,
  dateRange = {}
) {
  const matchStage = { userId };

  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAssessments: { $sum: 1 },
        completedAssessments: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        averageScore: { $avg: "$scoring.totalScore" },
        averageCompletionTime: { $avg: "$metadata.duration" },
        assessmentTypes: { $push: "$assessmentType" },
      },
    },
    {
      $project: {
        _id: 0,
        totalAssessments: 1,
        completedAssessments: 1,
        completionRate: {
          $multiply: [
            { $divide: ["$completedAssessments", "$totalAssessments"] },
            100,
          ],
        },
        averageScore: { $round: ["$averageScore", 2] },
        averageCompletionTime: { $round: ["$averageCompletionTime", 0] },
        assessmentTypes: 1,
      },
    },
  ]);
};

const OASISAssessment = mongoose.model(
  "OASISAssessment",
  oasisAssessmentSchema
);

export default OASISAssessment;
