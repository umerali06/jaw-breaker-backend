import mongoose from "mongoose";

const CarePlanSchema = new mongoose.Schema(
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
    // Care Plan Details
    planName: {
      type: String,
      required: true,
    },
    planType: {
      type: String,
      enum: ["admission", "ongoing", "discharge", "emergency", "specialty"],
      default: "ongoing",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    // Care Plan Content
    assessmentSummary: {
      primaryDiagnosis: String,
      secondaryDiagnoses: [String],
      riskFactors: [String],
      strengths: [String],
      barriers: [String],
      psychosocialFactors: String,
      culturalConsiderations: String,
      learningNeeds: String,
    },
    // Goals and Outcomes - Fixed schema definition
    goals: [
      new mongoose.Schema(
        {
          id: String, // Frontend uses 'id' not 'goalId'
          description: String,
          targetDate: String, // Frontend sends as string
          priority: {
            type: String, // Frontend sends as string ("low", "medium", "high")
            enum: ["low", "medium", "high"],
            default: "medium",
          },
          measurableOutcomes: [String], // Array of strings to match frontend
          progress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
          },
          status: {
            type: String,
            enum: [
              "not_started", // Frontend uses underscore
              "in_progress",
              "completed",
              "on_hold",
            ],
            default: "not_started",
          },
        },
        { _id: false }
      ),
    ],
    // Interventions - Fixed schema definition
    interventions: [
      new mongoose.Schema(
        {
          id: String, // Frontend uses 'id' not 'interventionId'
          type: String, // Frontend sends intervention type as string
          description: String,
          frequency: String,
          duration: String,
          status: {
            type: String,
            enum: ["planned", "active", "completed", "discontinued", "on_hold"],
            default: "planned",
          },
        },
        { _id: false }
      ),
    ],
    // Evaluation and Outcomes
    evaluation: {
      overallProgress: {
        type: String,
        enum: ["excellent", "good", "fair", "poor", "declining"],
        default: "fair",
      },
      goalsAchieved: {
        type: Number,
        default: 0,
      },
      goalsPartiallyAchieved: {
        type: Number,
        default: 0,
      },
      goalsNotAchieved: {
        type: Number,
        default: 0,
      },
      effectiveInterventions: [String],
      ineffectiveInterventions: [String],
      unexpectedOutcomes: [String],
      complications: [String],
      patientSatisfaction: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        feedback: String,
        date: Date,
      },
      familySatisfaction: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        feedback: String,
        date: Date,
      },
    },
    // Care Team
    careTeam: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: [
            "primary-nurse",
            "case-manager",
            "physician",
            "therapist",
            "social-worker",
            "dietitian",
            "pharmacist",
            "other",
          ],
          required: true,
        },
        specialty: String,
        responsibilities: [String],
        contactInfo: {
          phone: String,
          email: String,
          pager: String,
        },
        availability: {
          schedule: String,
          onCall: Boolean,
          backup: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
        joinDate: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "inactive", "on-leave"],
          default: "active",
        },
      },
    ],
    // Communication and Collaboration
    communication: {
      preferredMethod: {
        type: String,
        enum: ["verbal", "written", "electronic", "mixed"],
        default: "mixed",
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "bi-weekly", "monthly", "as-needed"],
        default: "weekly",
      },
      meetings: [
        {
          date: Date,
          type: {
            type: String,
            enum: [
              "care-conference",
              "family-meeting",
              "team-huddle",
              "discharge-planning",
            ],
          },
          attendees: [
            {
              userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
              },
              role: String,
              attended: Boolean,
            },
          ],
          agenda: [String],
          decisions: [String],
          actionItems: [
            {
              task: String,
              assignedTo: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
              },
              dueDate: Date,
              status: {
                type: String,
                enum: ["pending", "in-progress", "completed"],
                default: "pending",
              },
            },
          ],
          nextMeeting: Date,
        },
      ],
      notes: [
        {
          date: Date,
          author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          type: {
            type: String,
            enum: ["progress-note", "communication", "concern", "update"],
          },
          content: String,
          priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
          },
          recipients: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
          ],
          acknowledged: [
            {
              userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
              },
              acknowledgedAt: Date,
            },
          ],
        },
      ],
    },
    // AI Analysis and Recommendations
    aiAnalysis: {
      riskAssessment: {
        overallRisk: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
        },
        riskFactors: [
          {
            factor: String,
            severity: String,
            likelihood: Number,
            impact: String,
            mitigation: String,
          },
        ],
        recommendations: [String],
        lastAssessed: Date,
      },
      outcomesPrediction: {
        predictedOutcomes: [
          {
            outcome: String,
            probability: Number,
            timeframe: String,
            confidence: Number,
          },
        ],
        factorsInfluencing: [String],
        recommendations: [String],
        lastPredicted: Date,
      },
      interventionOptimization: {
        suggestedInterventions: [
          {
            intervention: String,
            rationale: String,
            evidenceLevel: String,
            expectedBenefit: String,
            priority: Number,
          },
        ],
        interventionsToModify: [
          {
            interventionId: String,
            suggestion: String,
            rationale: String,
          },
        ],
        interventionsToDiscontinue: [
          {
            interventionId: String,
            reason: String,
            alternative: String,
          },
        ],
        lastOptimized: Date,
      },
      qualityMetrics: {
        planCompleteness: {
          type: Number,
          min: 0,
          max: 100,
        },
        evidenceBasedScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        patientCenteredScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        collaborationScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        overallQualityScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        lastCalculated: Date,
      },
    },
    // Regulatory and Compliance
    compliance: {
      regulatoryRequirements: [
        {
          requirement: String,
          status: {
            type: String,
            enum: ["met", "partially-met", "not-met", "not-applicable"],
          },
          evidence: String,
          lastReviewed: Date,
        },
      ],
      qualityIndicators: [
        {
          indicator: String,
          target: String,
          actual: String,
          status: {
            type: String,
            enum: ["met", "not-met", "improving", "declining"],
          },
          lastMeasured: Date,
        },
      ],
      accreditationStandards: [
        {
          standard: String,
          organization: String, // Joint Commission, CMS, etc.
          compliance: Boolean,
          notes: String,
          lastAudited: Date,
        },
      ],
    },
    // Status and Workflow
    status: {
      type: String,
      enum: [
        "draft",
        "active",
        "on-hold",
        "completed",
        "discontinued",
        "archived",
      ],
      default: "draft",
    },
    // Approval and Sign-off
    approvals: [
      {
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: String,
        approvedAt: Date,
        comments: String,
        signature: String,
      },
    ],
    // Version Control
    version: {
      type: Number,
      default: 1,
    },
    revisions: [
      {
        version: Number,
        revisedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        revisedAt: Date,
        reason: String,
        changes: mongoose.Schema.Types.Mixed,
        approved: Boolean,
      },
    ],
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
      nextReviewDue: Date,
      reviewFrequency: {
        type: String,
        enum: ["weekly", "bi-weekly", "monthly", "quarterly"],
        default: "weekly",
      },
      tags: [String],
      category: String,
      complexity: {
        type: String,
        enum: ["simple", "moderate", "complex", "highly-complex"],
        default: "moderate",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CarePlanSchema.index({ patientId: 1, status: 1 });
CarePlanSchema.index({ userId: 1, createdAt: -1 });
CarePlanSchema.index({ status: 1, "metadata.nextReviewDue": 1 });
CarePlanSchema.index({ "goals.status": 1, "goals.targetDate": 1 });
CarePlanSchema.index({
  "interventions.status": 1,
  "interventions.assignedTo.userId": 1,
});
CarePlanSchema.index({ "aiAnalysis.riskAssessment.overallRisk": 1 });

// Pre-save middleware
CarePlanSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();

  // Calculate next review date
  if (!this.metadata.nextReviewDue) {
    const reviewDays = {
      weekly: 7,
      "bi-weekly": 14,
      monthly: 30,
      quarterly: 90,
    };
    const days = reviewDays[this.metadata.reviewFrequency] || 7;
    this.metadata.nextReviewDue = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    );
  }

  // Update evaluation metrics
  const totalGoals = this.goals.length;
  if (totalGoals > 0) {
    this.evaluation.goalsAchieved = this.goals.filter(
      (g) => g.status === "achieved"
    ).length;
    this.evaluation.goalsPartiallyAchieved = this.goals.filter(
      (g) => g.status === "partially-achieved"
    ).length;
    this.evaluation.goalsNotAchieved = this.goals.filter(
      (g) => g.status === "not-achieved"
    ).length;
  }

  next();
});

// Methods
CarePlanSchema.methods.calculateQualityScore = function () {
  let completenessScore = 0;
  let evidenceScore = 0;
  let patientCenteredScore = 0;
  let collaborationScore = 0;

  // Completeness (25%)
  const requiredFields = [
    this.assessmentSummary.primaryDiagnosis,
    this.goals.length > 0,
    this.interventions.length > 0,
    this.careTeam.length > 0,
  ];
  completenessScore =
    (requiredFields.filter(Boolean).length / requiredFields.length) * 25;

  // Evidence-based (25%)
  const evidenceBasedInterventions = this.interventions.filter(
    (i) => i.rationale && i.rationale.length > 10
  ).length;
  evidenceScore = Math.min(
    (evidenceBasedInterventions / this.interventions.length) * 25,
    25
  );

  // Patient-centered (25%)
  const patientFactors = [
    this.assessmentSummary.culturalConsiderations,
    this.assessmentSummary.learningNeeds,
    this.evaluation.patientSatisfaction.rating > 0,
  ];
  patientCenteredScore =
    (patientFactors.filter(Boolean).length / patientFactors.length) * 25;

  // Collaboration (25%)
  const collaborationFactors = [
    this.careTeam.length > 1,
    this.communication.meetings.length > 0,
    this.communication.notes.length > 0,
  ];
  collaborationScore =
    (collaborationFactors.filter(Boolean).length /
      collaborationFactors.length) *
    25;

  const overallScore =
    completenessScore +
    evidenceScore +
    patientCenteredScore +
    collaborationScore;

  this.aiAnalysis.qualityMetrics.planCompleteness = completenessScore * 4; // Convert to 0-100
  this.aiAnalysis.qualityMetrics.evidenceBasedScore = evidenceScore * 4;
  this.aiAnalysis.qualityMetrics.patientCenteredScore =
    patientCenteredScore * 4;
  this.aiAnalysis.qualityMetrics.collaborationScore = collaborationScore * 4;
  this.aiAnalysis.qualityMetrics.overallQualityScore = overallScore;
  this.aiAnalysis.qualityMetrics.lastCalculated = new Date();

  return overallScore;
};

CarePlanSchema.methods.updateGoalProgress = function (goalId, progressData) {
  const goal = this.goals.find((g) => g.goalId === goalId);
  if (goal) {
    goal.progress.percentage =
      progressData.percentage || goal.progress.percentage;
    goal.progress.notes = progressData.notes || goal.progress.notes;
    goal.progress.lastUpdated = new Date();

    // Auto-update status based on progress
    if (goal.progress.percentage >= 100) {
      goal.status = "achieved";
    } else if (goal.progress.percentage >= 50) {
      goal.status = "in-progress";
    } else if (goal.progress.percentage > 0) {
      goal.status = "in-progress";
    }

    return this.save();
  }
  return Promise.reject(new Error("Goal not found"));
};

CarePlanSchema.methods.addCommunicationNote = function (noteData) {
  this.communication.notes.push({
    date: new Date(),
    author: noteData.author,
    type: noteData.type || "progress-note",
    content: noteData.content,
    priority: noteData.priority || "medium",
    recipients: noteData.recipients || [],
    acknowledged: [],
  });
  return this.save();
};

CarePlanSchema.methods.scheduleCareMeeting = function (meetingData) {
  this.communication.meetings.push({
    date: meetingData.date,
    type: meetingData.type,
    attendees: meetingData.attendees || [],
    agenda: meetingData.agenda || [],
    decisions: [],
    actionItems: [],
    nextMeeting: meetingData.nextMeeting,
  });
  return this.save();
};

// Static methods
CarePlanSchema.statics.getByPatient = function (patientId, options = {}) {
  return this.find({
    patientId,
    status: options.status || { $ne: "archived" },
  })
    .sort({ createdAt: -1 })
    .populate("userId", "profile.firstName profile.lastName")
    .populate(
      "careTeam.userId",
      "profile.firstName profile.lastName profile.credentials"
    )
    .exec();
};

CarePlanSchema.statics.getDueForReview = function (userId) {
  return this.find({
    userId,
    status: "active",
    "metadata.nextReviewDue": { $lte: new Date() },
  })
    .populate("patientId", "demographics.firstName demographics.lastName")
    .sort({ "metadata.nextReviewDue": 1 })
    .exec();
};

CarePlanSchema.statics.getQualityMetrics = function (userId, dateRange = {}) {
  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        status: { $in: ["active", "completed"] },
        ...(dateRange.start && { createdAt: { $gte: dateRange.start } }),
        ...(dateRange.end && { createdAt: { $lte: dateRange.end } }),
      },
    },
    {
      $group: {
        _id: null,
        totalPlans: { $sum: 1 },
        avgQualityScore: {
          $avg: "$aiAnalysis.qualityMetrics.overallQualityScore",
        },
        avgGoalsAchieved: { $avg: "$evaluation.goalsAchieved" },
        avgPatientSatisfaction: {
          $avg: "$evaluation.patientSatisfaction.rating",
        },
        completedPlans: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
      },
    },
  ];
  return this.aggregate(pipeline);
};

export default mongoose.model("CarePlan", CarePlanSchema);
