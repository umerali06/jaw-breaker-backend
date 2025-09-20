import mongoose from "mongoose";

const ProgressTrackingSchema = new mongoose.Schema(
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

    // Progress Period
    trackingPeriod: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: Date,
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "daily",
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },

    // SMART Goals
    goals: [
      {
        id: String,
        title: {
          type: String,
          required: true,
        },
        description: String,
        category: {
          type: String,
          enum: [
            "functional",
            "clinical",
            "behavioral",
            "educational",
            "discharge",
          ],
        },
        // SMART Criteria
        specific: String,
        measurable: {
          metric: String,
          target: Number,
          unit: String,
          baseline: Number,
        },
        achievable: {
          isRealistic: Boolean,
          barriers: [String],
          resources: [String],
        },
        relevant: {
          priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
          },
          rationale: String,
          alignsWithCarePlan: Boolean,
        },
        timeBound: {
          targetDate: Date,
          milestones: [
            {
              date: Date,
              description: String,
              achieved: Boolean,
              achievedDate: Date,
            },
          ],
        },
        // Progress Tracking
        status: {
          type: String,
          enum: [
            "not-started",
            "in-progress",
            "achieved",
            "modified",
            "discontinued",
          ],
          default: "not-started",
        },
        progress: {
          percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
          },
          currentValue: Number,
          lastUpdated: Date,
          trend: {
            type: String,
            enum: ["improving", "stable", "declining"],
          },
        },
        interventions: [
          {
            intervention: String,
            frequency: String,
            duration: String,
            responsible: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            effectiveness: {
              type: String,
              enum: [
                "very-effective",
                "effective",
                "somewhat-effective",
                "not-effective",
              ],
            },
          },
        ],
        outcomes: [
          {
            date: Date,
            measurement: Number,
            notes: String,
            assessedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
          },
        ],
      },
    ],

    // Functional Status Tracking
    functionalStatus: {
      adl: {
        // Activities of Daily Living
        bathing: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
        dressing: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
        toileting: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
        transferring: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
        continence: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
        feeding: {
          score: Number,
          assistance: {
            type: String,
            enum: [
              "independent",
              "supervision",
              "minimal-assist",
              "moderate-assist",
              "maximal-assist",
              "dependent",
            ],
          },
          notes: String,
          lastAssessed: Date,
        },
      },
      iadl: {
        // Instrumental Activities of Daily Living
        housekeeping: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
        laundry: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
        shopping: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
        transportation: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
        medicationManagement: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
        finances: {
          score: Number,
          capability: String,
          notes: String,
          lastAssessed: Date,
        },
      },
      mobility: {
        ambulation: {
          distance: Number, // in feet/meters
          assistiveDevice: String,
          assistance: String,
          endurance: String,
          lastAssessed: Date,
        },
        balance: {
          score: Number,
          riskLevel: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          notes: String,
          lastAssessed: Date,
        },
        fallRisk: {
          score: Number,
          riskLevel: {
            type: String,
            enum: ["low", "medium", "high"],
          },
          interventions: [String],
          lastAssessed: Date,
        },
      },
    },

    // Clinical Indicators
    clinicalIndicators: {
      vitalSigns: [
        {
          date: Date,
          temperature: Number,
          bloodPressure: {
            systolic: Number,
            diastolic: Number,
          },
          heartRate: Number,
          respiratoryRate: Number,
          oxygenSaturation: Number,
          weight: Number,
          painScore: Number,
          recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      labValues: [
        {
          date: Date,
          test: String,
          value: Number,
          unit: String,
          normalRange: String,
          status: {
            type: String,
            enum: ["normal", "abnormal-low", "abnormal-high", "critical"],
          },
          trend: {
            type: String,
            enum: ["improving", "stable", "worsening"],
          },
        },
      ],
      symptoms: [
        {
          date: Date,
          symptom: String,
          severity: {
            type: Number,
            min: 1,
            max: 10,
          },
          frequency: String,
          duration: String,
          triggers: [String],
          interventions: [String],
          response: String,
        },
      ],
    },

    // AI Analysis and Predictions
    aiAnalysis: {
      progressPrediction: {
        overallTrajectory: {
          type: String,
          enum: ["excellent", "good", "fair", "poor"],
        },
        predictedOutcomes: [
          {
            outcome: String,
            probability: {
              type: Number,
              min: 0,
              max: 1,
            },
            timeframe: String,
            confidence: {
              type: Number,
              min: 0,
              max: 1,
            },
          },
        ],
        riskFactors: [String],
        protectiveFactors: [String],
        recommendations: [String],
      },
      trendAnalysis: {
        functionalTrend: {
          type: String,
          enum: ["improving", "stable", "declining"],
        },
        clinicalTrend: {
          type: String,
          enum: ["improving", "stable", "declining"],
        },
        goalAchievementRate: Number,
        interventionEffectiveness: [
          {
            intervention: String,
            effectiveness: Number,
            evidence: String,
          },
        ],
      },
      alerts: [
        {
          type: {
            type: String,
            enum: ["decline", "plateau", "risk", "goal-behind-schedule"],
          },
          severity: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
          },
          message: String,
          recommendations: [String],
          timestamp: Date,
          acknowledged: Boolean,
          acknowledgedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },

    // Discharge Planning
    dischargePlanning: {
      targetDischargeDate: Date,
      dischargeDestination: {
        type: String,
        enum: [
          "home",
          "home-with-services",
          "assisted-living",
          "skilled-nursing",
          "hospital",
          "other",
        ],
      },
      readinessAssessment: {
        medical: {
          stable: Boolean,
          notes: String,
        },
        functional: {
          adequate: Boolean,
          notes: String,
        },
        cognitive: {
          adequate: Boolean,
          notes: String,
        },
        social: {
          support: Boolean,
          notes: String,
        },
        environmental: {
          safe: Boolean,
          notes: String,
        },
      },
      barriers: [String],
      interventions: [String],
      services: [
        {
          service: String,
          provider: String,
          frequency: String,
          duration: String,
          status: {
            type: String,
            enum: ["ordered", "approved", "scheduled", "active"],
          },
        },
      ],
    },

    // Status and Metadata
    status: {
      type: String,
      enum: ["active", "completed", "discontinued", "on-hold"],
      default: "active",
    },

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
      totalDays: Number,
      completionRate: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProgressTrackingSchema.index({ patientId: 1, status: 1 });
ProgressTrackingSchema.index({ userId: 1, "trackingPeriod.startDate": -1 });
ProgressTrackingSchema.index({
  "goals.status": 1,
  "goals.timeBound.targetDate": 1,
});
ProgressTrackingSchema.index({
  "aiAnalysis.alerts.severity": 1,
  "aiAnalysis.alerts.acknowledged": 1,
});

// Pre-save middleware
ProgressTrackingSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();

  // Calculate total days
  if (this.trackingPeriod.startDate) {
    const endDate = this.trackingPeriod.endDate || new Date();
    this.metadata.totalDays = Math.ceil(
      (endDate - this.trackingPeriod.startDate) / (1000 * 60 * 60 * 24)
    );
  }

  // Calculate completion rate
  if (this.goals.length > 0) {
    const completedGoals = this.goals.filter(
      (goal) => goal.status === "achieved"
    ).length;
    this.metadata.completionRate = (completedGoals / this.goals.length) * 100;
  }

  next();
});

// Methods
ProgressTrackingSchema.methods.calculateOverallProgress = function () {
  if (this.goals.length === 0) return 0;

  const totalProgress = this.goals.reduce(
    (sum, goal) => sum + goal.progress.percentage,
    0
  );
  return totalProgress / this.goals.length;
};

ProgressTrackingSchema.methods.identifyAtRiskGoals = function () {
  const now = new Date();
  return this.goals.filter((goal) => {
    if (goal.status === "achieved" || goal.status === "discontinued")
      return false;

    const targetDate = new Date(goal.timeBound.targetDate);
    const daysRemaining = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
    const progressNeeded = 100 - goal.progress.percentage;

    // Risk if less than 30 days remaining and less than 70% complete
    return daysRemaining < 30 && goal.progress.percentage < 70;
  });
};

ProgressTrackingSchema.methods.generateProgressReport = function () {
  const overallProgress = this.calculateOverallProgress();
  const atRiskGoals = this.identifyAtRiskGoals();

  return {
    overallProgress,
    totalGoals: this.goals.length,
    achievedGoals: this.goals.filter((g) => g.status === "achieved").length,
    inProgressGoals: this.goals.filter((g) => g.status === "in-progress")
      .length,
    atRiskGoals: atRiskGoals.length,
    functionalImprovement: this.calculateFunctionalImprovement(),
    recommendations: this.generateRecommendations(),
  };
};

ProgressTrackingSchema.methods.calculateFunctionalImprovement = function () {
  // Calculate improvement in ADL scores
  const adlScores = Object.values(this.functionalStatus.adl)
    .map((item) => item.score)
    .filter(Boolean);
  const avgAdlScore =
    adlScores.length > 0
      ? adlScores.reduce((a, b) => a + b) / adlScores.length
      : 0;

  return {
    adlAverage: avgAdlScore,
    mobilityScore: this.functionalStatus.mobility.balance.score || 0,
    fallRisk: this.functionalStatus.mobility.fallRisk.riskLevel || "unknown",
  };
};

ProgressTrackingSchema.methods.generateRecommendations = function () {
  const recommendations = [];

  // Check for declining trends
  if (this.aiAnalysis.trendAnalysis.functionalTrend === "declining") {
    recommendations.push(
      "Consider increasing therapy intensity due to functional decline"
    );
  }

  // Check goal achievement rate
  if (this.aiAnalysis.trendAnalysis.goalAchievementRate < 50) {
    recommendations.push(
      "Review and modify goals to ensure they are achievable"
    );
  }

  // Check for high fall risk
  if (this.functionalStatus.mobility.fallRisk.riskLevel === "high") {
    recommendations.push(
      "Implement comprehensive fall prevention interventions"
    );
  }

  return recommendations;
};

// Static methods
ProgressTrackingSchema.statics.getByPatient = function (
  patientId,
  options = {}
) {
  return this.find({ patientId })
    .sort({ "trackingPeriod.startDate": -1 })
    .limit(options.limit || 10)
    .populate("userId", "profile.firstName profile.lastName")
    .exec();
};

ProgressTrackingSchema.statics.getActiveTracking = function (userId) {
  return this.find({
    userId,
    status: "active",
    "trackingPeriod.isActive": true,
  })
    .populate("patientId", "demographics.firstName demographics.lastName")
    .exec();
};

ProgressTrackingSchema.statics.getGoalAnalytics = function (
  userId,
  timeframe = 90
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);

  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        "trackingPeriod.startDate": { $gte: startDate },
      },
    },
    {
      $unwind: "$goals",
    },
    {
      $group: {
        _id: "$goals.status",
        count: { $sum: 1 },
        avgProgress: { $avg: "$goals.progress.percentage" },
      },
    },
  ];

  return this.aggregate(pipeline);
};

export default mongoose.model("ProgressTracking", ProgressTrackingSchema);
