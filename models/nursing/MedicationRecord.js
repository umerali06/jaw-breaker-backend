import mongoose from "mongoose";

const MedicationRecordSchema = new mongoose.Schema(
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
      },
      genericName: String,
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
          "topical",
          "inhaler",
          "patch",
          "suppository",
          "other",
        ],
      },
      strength: String,
      route: {
        type: String,
        enum: [
          "oral",
          "IV",
          "IM",
          "SQ",
          "topical",
          "inhalation",
          "rectal",
          "sublingual",
          "buccal",
          "nasal",
          "ophthalmic",
          "otic",
        ],
      },
      therapeuticClass: String,
      pharmacologicClass: String,
      controlledSubstance: {
        isControlled: Boolean,
        schedule: String, // I, II, III, IV, V
      },
    },

    // Prescription Information
    prescription: {
      prescriber: {
        name: String,
        npi: String,
        dea: String,
        specialty: String,
        contactInfo: String,
      },
      indication: String,
      dosage: String,
      frequency: String,
      quantity: Number,
      refills: Number,
      daysSupply: Number,
      prescribedDate: Date,
      startDate: Date,
      endDate: Date,
      instructions: String,
      pharmacyInstructions: String,
    },

    // Administration Records
    administration: {
      status: {
        type: String,
        enum: ["active", "discontinued", "held", "completed", "expired"],
        default: "active",
      },
      administrationTimes: [String], // e.g., ['08:00', '14:00', '20:00']
      adherence: {
        overall: {
          type: Number,
          min: 0,
          max: 100,
        },
        pattern: [
          {
            date: Date,
            scheduledTime: String,
            actualTime: Date,
            taken: Boolean,
            dose: String,
            administeredBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            notes: String,
            reason: String, // if not taken
          },
        ],
        missedDoses: Number,
        onTimeRate: Number,
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
          resolved: Boolean,
          resolvedDate: Date,
          action: String, // 'continued', 'dose-reduced', 'discontinued'
          reportedBy: String,
        },
      ],
      effectiveness: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        notes: String,
        assessmentDate: Date,
      },
    },

    // AI Analysis and Safety
    aiAnalysis: {
      riskScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      interactions: [
        {
          interactingMedication: String,
          severity: {
            type: String,
            enum: ["minor", "moderate", "major", "contraindicated"],
          },
          mechanism: String,
          clinicalEffect: String,
          management: String,
          evidence: String,
          source: String,
        },
      ],
      contraindications: [
        {
          condition: String,
          severity: String,
          reason: String,
          recommendation: String,
        },
      ],
      allergies: [
        {
          allergen: String,
          reaction: String,
          severity: String,
          crossReactivity: [String],
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
        },
      ],
      recommendations: [
        {
          type: {
            type: String,
            enum: ["dosing", "monitoring", "safety", "efficacy", "adherence"],
          },
          recommendation: String,
          rationale: String,
          priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
          },
          evidence: String,
        },
      ],
      alerts: [
        {
          type: String,
          severity: String,
          message: String,
          action: String,
          timestamp: Date,
          acknowledged: Boolean,
          acknowledgedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },

    // Clinical Decision Support
    clinicalSupport: {
      dosageCalculations: {
        weightBased: Boolean,
        bsaBased: Boolean, // Body Surface Area
        renalAdjustment: Boolean,
        hepaticAdjustment: Boolean,
        calculations: [
          {
            type: String,
            formula: String,
            result: String,
            units: String,
          },
        ],
      },
      guidelines: [
        {
          source: String,
          guideline: String,
          recommendation: String,
          evidenceLevel: String,
        },
      ],
      protocols: [
        {
          name: String,
          indication: String,
          steps: [String],
          monitoring: [String],
        },
      ],
    },

    // Reconciliation and History
    reconciliation: {
      homemedications: [
        {
          medication: String,
          dosage: String,
          frequency: String,
          lastTaken: Date,
          source: String, // 'patient', 'family', 'pharmacy', 'provider'
        },
      ],
      changes: [
        {
          date: Date,
          type: {
            type: String,
            enum: [
              "added",
              "discontinued",
              "dose-changed",
              "frequency-changed",
              "route-changed",
            ],
          },
          reason: String,
          changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          previousValue: String,
          newValue: String,
        },
      ],
      discrepancies: [
        {
          type: String,
          description: String,
          resolved: Boolean,
          resolution: String,
          resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },

    // Status and Workflow
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued", "on-hold", "completed"],
      default: "active",
    },

    // Metadata
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      lastReviewed: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      source: {
        type: String,
        enum: ["admission", "transfer", "new-order", "reconciliation"],
        default: "new-order",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
MedicationRecordSchema.index({ patientId: 1, status: 1 });
MedicationRecordSchema.index({ userId: 1, createdAt: -1 });
MedicationRecordSchema.index({
  "medication.name": "text",
  "medication.genericName": "text",
});
MedicationRecordSchema.index({ "administration.adherence.nextDue": 1 });
MedicationRecordSchema.index({ "aiAnalysis.riskScore": -1 });
MedicationRecordSchema.index({
  "aiAnalysis.alerts.severity": 1,
  "aiAnalysis.alerts.acknowledged": 1,
});

// Pre-save middleware
MedicationRecordSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();

  // Calculate adherence rate
  if (this.administration.adherence.pattern.length > 0) {
    const takenDoses = this.administration.adherence.pattern.filter(
      (p) => p.taken
    ).length;
    const totalDoses = this.administration.adherence.pattern.length;
    this.administration.adherence.overall = Math.round(
      (takenDoses / totalDoses) * 100
    );

    // Calculate on-time rate (within 30 minutes of scheduled time)
    const onTimeDoses = this.administration.adherence.pattern.filter((p) => {
      if (!p.taken || !p.actualTime || !p.scheduledTime) return false;
      const scheduled = new Date(`1970-01-01T${p.scheduledTime}:00`);
      const actual = new Date(p.actualTime);
      const scheduledTime = scheduled.getHours() * 60 + scheduled.getMinutes();
      const actualTime = actual.getHours() * 60 + actual.getMinutes();
      return Math.abs(actualTime - scheduledTime) <= 30;
    }).length;

    this.administration.adherence.onTimeRate =
      Math.round((onTimeDoses / takenDoses) * 100) || 0;
  }

  next();
});

// Methods
MedicationRecordSchema.methods.checkInteractions = async function (
  otherMedications
) {
  // This would integrate with a drug interaction database
  const interactions = [];

  for (const otherMed of otherMedications) {
    // Simulate interaction checking
    if (
      this.medication.name.toLowerCase().includes("warfarin") &&
      otherMed.medication.name.toLowerCase().includes("aspirin")
    ) {
      interactions.push({
        interactingMedication: otherMed.medication.name,
        severity: "major",
        mechanism: "Additive anticoagulant effects",
        clinicalEffect: "Increased bleeding risk",
        management: "Monitor INR closely, consider dose adjustment",
        evidence: "Well-documented",
        source: "Clinical studies",
      });
    }
  }

  this.aiAnalysis.interactions = interactions;
  return interactions;
};

MedicationRecordSchema.methods.calculateRiskScore = function () {
  let riskScore = 0;

  // High-risk medications
  const highRiskMeds = ["warfarin", "heparin", "insulin", "digoxin", "lithium"];
  if (
    highRiskMeds.some((med) => this.medication.name.toLowerCase().includes(med))
  ) {
    riskScore += 30;
  }

  // Controlled substances
  if (this.medication.controlledSubstance.isControlled) {
    riskScore += 20;
  }

  // Multiple interactions
  riskScore += this.aiAnalysis.interactions.length * 10;

  // Poor adherence
  if (this.administration.adherence.overall < 80) {
    riskScore += 25;
  }

  // Side effects
  const severeSideEffects = this.administration.sideEffects.filter(
    (se) => se.severity === "severe" || se.severity === "life-threatening"
  );
  riskScore += severeSideEffects.length * 15;

  this.aiAnalysis.riskScore = Math.min(riskScore, 100);
  return this.aiAnalysis.riskScore;
};

MedicationRecordSchema.methods.addAdministration = function (
  administrationData
) {
  this.administration.adherence.pattern.push({
    date: administrationData.date || new Date(),
    scheduledTime: administrationData.scheduledTime,
    actualTime: administrationData.actualTime,
    taken: administrationData.taken,
    dose: administrationData.dose,
    administeredBy: administrationData.administeredBy,
    notes: administrationData.notes,
    reason: administrationData.reason,
  });

  if (administrationData.taken) {
    this.administration.adherence.lastTaken =
      administrationData.actualTime || new Date();
  } else {
    this.administration.adherence.missedDoses += 1;
  }

  return this.save();
};

// Static methods
MedicationRecordSchema.statics.getByPatient = function (
  patientId,
  options = {}
) {
  return this.find({
    patientId,
    status: options.status || { $in: ["active", "on-hold"] },
  })
    .sort({ createdAt: -1 })
    .populate("userId", "profile.firstName profile.lastName")
    .exec();
};

MedicationRecordSchema.statics.getDueAdministrations = function (
  userId,
  timeWindow = 60
) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + timeWindow * 60000);

  return this.find({
    userId,
    status: "active",
    "administration.adherence.nextDue": {
      $gte: now,
      $lte: windowEnd,
    },
  })
    .populate("patientId", "demographics.firstName demographics.lastName")
    .exec();
};

MedicationRecordSchema.statics.getHighRiskMedications = function (userId) {
  return this.find({
    userId,
    status: "active",
    "aiAnalysis.riskScore": { $gte: 70 },
  })
    .sort({ "aiAnalysis.riskScore": -1 })
    .populate("patientId", "demographics.firstName demographics.lastName")
    .exec();
};

MedicationRecordSchema.statics.getAdherenceReport = function (
  patientId,
  dateRange = {}
) {
  const pipeline = [
    {
      $match: {
        patientId: mongoose.Types.ObjectId(patientId),
        ...(dateRange.start && { createdAt: { $gte: dateRange.start } }),
        ...(dateRange.end && { createdAt: { $lte: dateRange.end } }),
      },
    },
    {
      $group: {
        _id: null,
        totalMedications: { $sum: 1 },
        avgAdherence: { $avg: "$administration.adherence.overall" },
        avgOnTimeRate: { $avg: "$administration.adherence.onTimeRate" },
        totalMissedDoses: { $sum: "$administration.adherence.missedDoses" },
        activeMedications: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
      },
    },
  ];

  return this.aggregate(pipeline);
};

export default mongoose.model("MedicationRecord", MedicationRecordSchema);
