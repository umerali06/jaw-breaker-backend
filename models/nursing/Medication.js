import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema(
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

    // Medication Information
    medication: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      genericName: {
        type: String,
        trim: true,
      },
      brandNames: [String],
      ndc: String, // National Drug Code
      rxcui: String, // RxNorm Concept Unique Identifier
      dosageForm: {
        type: String,
        enum: [
          "tablet",
          "capsule",
          "liquid",
          "injection",
          "patch",
          "inhaler",
          "cream",
          "ointment",
          "drops",
          "other",
        ],
      },
      strength: String,
      route: {
        type: String,
        enum: [
          "oral",
          "iv",
          "im",
          "sc",
          "topical",
          "inhalation",
          "rectal",
          "vaginal",
          "sublingual",
          "buccal",
          "other",
        ],
        required: true,
      },
      therapeuticClass: String,
      pharmacologicClass: String,
      controlledSubstance: {
        isControlled: {
          type: Boolean,
          default: false,
        },
        schedule: {
          type: String,
          enum: ["I", "II", "III", "IV", "V"],
        },
      },
    },

    // Prescription Information
    prescription: {
      prescriber: {
        name: {
          type: String,
          required: true,
        },
        npi: String, // National Provider Identifier
        dea: String, // DEA Number
        specialty: String,
        phone: String,
        address: String,
      },
      indication: {
        type: String,
        required: true,
      },
      dosage: {
        type: String,
        required: true,
      },
      frequency: {
        type: String,
        required: true,
      },
      quantity: Number,
      refills: {
        type: Number,
        default: 0,
      },
      daysSupply: Number,
      prescribedDate: {
        type: Date,
        required: true,
      },
      startDate: {
        type: Date,
        required: true,
      },
      endDate: Date,
      instructions: String,
      prn: {
        type: Boolean,
        default: false,
      },
      prnInstructions: String,
    },

    // Administration and Adherence
    administration: {
      status: {
        type: String,
        enum: ["active", "discontinued", "held", "completed", "suspended"],
        default: "active",
      },
      discontinuedDate: Date,
      discontinuedReason: String,
      adherence: {
        overall: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        pattern: [
          {
            date: Date,
            taken: Boolean,
            time: Date,
            dose: String,
            notes: String,
            reportedBy: String,
          },
        ],
        missedDoses: {
          type: Number,
          default: 0,
        },
        onTimeRate: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        lastTaken: Date,
        nextDue: Date,
      },
      sideEffects: [
        {
          effect: String,
          severity: {
            type: String,
            enum: ["mild", "moderate", "severe", "life-threatening"],
          },
          onset: Date,
          resolved: {
            type: Boolean,
            default: false,
          },
          resolvedDate: Date,
          action: String,
        },
      ],
      allergicReactions: [
        {
          reaction: String,
          severity: {
            type: String,
            enum: ["mild", "moderate", "severe", "anaphylaxis"],
          },
          onset: Date,
          treatment: String,
          resolved: Boolean,
        },
      ],
    },

    // AI Analysis and Clinical Decision Support
    aiAnalysis: {
      riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      interactions: [
        {
          interactingMedication: String,
          interactionType: {
            type: String,
            enum: ["drug-drug", "drug-food", "drug-disease", "drug-lab"],
          },
          severity: {
            type: String,
            enum: ["minor", "moderate", "major", "contraindicated"],
          },
          mechanism: String,
          clinicalEffect: String,
          management: String,
          evidence: {
            type: String,
            enum: ["theoretical", "case-report", "study", "established"],
          },
          confidence: {
            type: Number,
            min: 0,
            max: 100,
          },
        },
      ],
      contraindications: [
        {
          condition: String,
          severity: String,
          rationale: String,
          alternative: String,
        },
      ],
      monitoring: [
        {
          parameter: String,
          frequency: String,
          target: String,
          rationale: String,
          lastChecked: Date,
          nextDue: Date,
          results: [
            {
              date: Date,
              value: String,
              interpretation: String,
              action: String,
            },
          ],
        },
      ],
      recommendations: [
        {
          type: {
            type: String,
            enum: [
              "dosing",
              "timing",
              "monitoring",
              "alternative",
              "discontinue",
              "caution",
            ],
          },
          recommendation: String,
          rationale: String,
          priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
          },
          confidence: {
            type: Number,
            min: 0,
            max: 100,
          },
          source: String,
          implemented: {
            type: Boolean,
            default: false,
          },
          implementedDate: Date,
        },
      ],
      adherencePrediction: {
        probability: {
          type: Number,
          min: 0,
          max: 100,
        },
        factors: [String],
        interventions: [String],
        confidence: Number,
      },
    },

    // Clinical Monitoring
    monitoring: {
      vitalSigns: [
        {
          date: Date,
          bloodPressure: String,
          heartRate: Number,
          temperature: Number,
          weight: Number,
          notes: String,
        },
      ],
      labResults: [
        {
          date: Date,
          test: String,
          result: String,
          reference: String,
          interpretation: String,
          action: String,
        },
      ],
      symptoms: [
        {
          date: Date,
          symptom: String,
          severity: {
            type: String,
            enum: ["mild", "moderate", "severe"],
          },
          frequency: String,
          notes: String,
        },
      ],
      effectiveness: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        notes: String,
        lastAssessed: Date,
        improvements: [String],
        concerns: [String],
      },
    },

    // Pharmacy and Insurance
    pharmacy: {
      name: String,
      phone: String,
      address: String,
      npi: String,
      lastFilled: Date,
      nextRefill: Date,
      refillsRemaining: Number,
    },
    insurance: {
      covered: Boolean,
      copay: Number,
      priorAuth: Boolean,
      priorAuthStatus: String,
      formulary: Boolean,
      tier: String,
    },

    // Cost and Financial
    cost: {
      retail: Number,
      insurance: Number,
      copay: Number,
      deductible: Number,
      outOfPocket: Number,
      currency: {
        type: String,
        default: "USD",
      },
    },

    // Version Control and History
    version: {
      type: Number,
      default: 1,
    },
    history: [
      {
        version: Number,
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
      source: {
        type: String,
        enum: ["manual", "ehr", "pharmacy", "import"],
        default: "manual",
      },
      verified: {
        type: Boolean,
        default: false,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      verifiedDate: Date,
      lastReviewed: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
medicationSchema.index({ patientId: 1, "administration.status": 1 });
medicationSchema.index({ userId: 1, createdAt: -1 });
medicationSchema.index({
  "medication.name": "text",
  "medication.genericName": "text",
});
medicationSchema.index({ "prescription.startDate": -1 });
medicationSchema.index({ "aiAnalysis.riskScore": -1 });
medicationSchema.index({ "administration.adherence.nextDue": 1 });

// Virtual for days remaining
medicationSchema.virtual("daysRemaining").get(function () {
  if (!this.prescription.endDate) return null;
  const today = new Date();
  const endDate = new Date(this.prescription.endDate);
  const diffTime = endDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for adherence status
medicationSchema.virtual("adherenceStatus").get(function () {
  const adherence = this.administration.adherence.overall;
  if (adherence >= 90) return "excellent";
  if (adherence >= 80) return "good";
  if (adherence >= 70) return "fair";
  return "poor";
});

// Virtual for interaction risk level
medicationSchema.virtual("interactionRiskLevel").get(function () {
  const interactions = this.aiAnalysis.interactions;
  if (interactions.some((i) => i.severity === "contraindicated"))
    return "critical";
  if (interactions.some((i) => i.severity === "major")) return "high";
  if (interactions.some((i) => i.severity === "moderate")) return "medium";
  return "low";
});

// Instance method to calculate adherence
medicationSchema.methods.calculateAdherence = function (days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentPattern = this.administration.adherence.pattern.filter(
    (entry) => entry.date >= cutoffDate
  );

  if (recentPattern.length === 0) return 0;

  const takenCount = recentPattern.filter((entry) => entry.taken).length;
  const adherenceRate = (takenCount / recentPattern.length) * 100;

  // Update the overall adherence
  this.administration.adherence.overall = Math.round(adherenceRate);

  return adherenceRate;
};

// Instance method to check for interactions
medicationSchema.methods.checkInteractions = async function (
  otherMedications = []
) {
  // This would integrate with external drug interaction APIs
  // For now, return mock data structure
  const interactions = [];

  for (const otherMed of otherMedications) {
    // Mock interaction check logic
    if (
      this.medication.name.toLowerCase().includes("warfarin") &&
      otherMed.medication.name.toLowerCase().includes("aspirin")
    ) {
      interactions.push({
        interactingMedication: otherMed.medication.name,
        interactionType: "drug-drug",
        severity: "major",
        mechanism: "Increased bleeding risk",
        clinicalEffect: "Enhanced anticoagulant effect",
        management: "Monitor INR closely, consider dose adjustment",
        evidence: "established",
        confidence: 95,
      });
    }
  }

  this.aiAnalysis.interactions = interactions;
  return interactions;
};

// Instance method to generate medication summary
medicationSchema.methods.generateSummary = function () {
  return {
    name: this.medication.name,
    dosage: this.prescription.dosage,
    frequency: this.prescription.frequency,
    indication: this.prescription.indication,
    status: this.administration.status,
    adherence: this.administration.adherence.overall,
    riskScore: this.aiAnalysis.riskScore,
    interactionCount: this.aiAnalysis.interactions.length,
    sideEffectCount: this.administration.sideEffects.length,
    daysRemaining: this.daysRemaining,
  };
};

// Static method to get medication statistics
medicationSchema.statics.getMedicationStats = function (
  userId,
  patientId = null
) {
  const matchStage = { userId };
  if (patientId) matchStage.patientId = patientId;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMedications: { $sum: 1 },
        activeMedications: {
          $sum: {
            $cond: [{ $eq: ["$administration.status", "active"] }, 1, 0],
          },
        },
        averageAdherence: { $avg: "$administration.adherence.overall" },
        averageRiskScore: { $avg: "$aiAnalysis.riskScore" },
        totalInteractions: { $sum: { $size: "$aiAnalysis.interactions" } },
        totalSideEffects: { $sum: { $size: "$administration.sideEffects" } },
        medicationClasses: { $push: "$medication.therapeuticClass" },
      },
    },
    {
      $project: {
        _id: 0,
        totalMedications: 1,
        activeMedications: 1,
        averageAdherence: { $round: ["$averageAdherence", 2] },
        averageRiskScore: { $round: ["$averageRiskScore", 2] },
        totalInteractions: 1,
        totalSideEffects: 1,
        medicationClasses: 1,
      },
    },
  ]);
};

// Static method to find medications due for refill
medicationSchema.statics.findDueForRefill = function (userId, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  return this.find({
    userId,
    "administration.status": "active",
    "pharmacy.nextRefill": { $lte: cutoffDate },
  })
    .populate("patientId", "name")
    .sort({ "pharmacy.nextRefill": 1 });
};

// Static method to find high-risk medications
medicationSchema.statics.findHighRisk = function (userId, riskThreshold = 70) {
  return this.find({
    userId,
    "administration.status": "active",
    "aiAnalysis.riskScore": { $gte: riskThreshold },
  })
    .populate("patientId", "name")
    .sort({ "aiAnalysis.riskScore": -1 });
};

const Medication = mongoose.model("Medication", medicationSchema);

export default Medication;
