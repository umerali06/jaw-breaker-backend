import mongoose from "mongoose";

const OutcomeMeasureSchema = new mongoose.Schema(
  {
    // Basic Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },

    // Core fields for OutcomeMeasuresService
    indicatorType: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["clinical", "functional", "satisfaction"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    qualityScores: {
      target: Number,
      benchmark: Number,
      weighted: Number,
    },
    benchmarkComparison: {
      vsTarget: {
        difference: Number,
        percentage: Number,
        status: {
          type: String,
          enum: ["above", "below", "at"],
        },
      },
      vsBenchmark: {
        difference: Number,
        percentage: Number,
        status: {
          type: String,
          enum: ["above", "below", "at"],
        },
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },

    // Reporting Period
    reportingPeriod: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "annually"],
        default: "monthly",
      },
      period: String, // e.g., "Q1 2024", "January 2024"
    },

    // Quality Indicators
    qualityIndicators: [
      {
        indicator: {
          type: String,
          enum: [
            "readmission-rate",
            "infection-rate",
            "fall-rate",
            "pressure-ulcer-rate",
            "medication-error-rate",
            "patient-satisfaction",
            "length-of-stay",
            "mortality-rate",
            "pain-management",
            "functional-improvement",
            "discharge-to-community",
            "emergency-department-visits",
          ],
          required: true,
        },
        name: String,
        description: String,
        current: {
          type: Number,
          required: true,
        },
        target: Number,
        benchmark: Number, // Industry benchmark
        trend: {
          type: String,
          enum: ["improving", "stable", "declining", "unknown"],
        },
        numerator: Number,
        denominator: Number,
        percentage: Number,
        riskAdjusted: Boolean,
        dataSource: String,
        calculationMethod: String,
        lastUpdated: Date,
      },
    ],

    // Patient Outcomes
    patientOutcomes: [
      {
        category: {
          type: String,
          enum: [
            "functional",
            "clinical",
            "experience",
            "safety",
            "efficiency",
          ],
        },
        measures: [
          {
            measure: String,
            score: Number,
            change: Number, // Change from previous period
            significance: {
              type: String,
              enum: ["significant", "not-significant", "trending"],
            },
            target: Number,
            benchmark: Number,
            percentile: Number,
          },
        ],
        overallScore: Number,
        trend: {
          type: String,
          enum: ["improving", "stable", "declining"],
        },
      },
    ],

    // Clinical Outcomes
    clinicalOutcomes: {
      readmissionRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
      infectionRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
      fallRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
      pressureUlcerRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
      medicationErrorRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
      mortalityRate: {
        current: Number,
        target: Number,
        benchmark: Number,
        trend: String,
      },
    },

    // Functional Outcomes
    functionalOutcomes: {
      mobilityImprovement: {
        percentage: Number,
        target: Number,
        benchmark: Number,
      },
      adlImprovement: {
        percentage: Number,
        target: Number,
        benchmark: Number,
      },
      cognitiveImprovement: {
        percentage: Number,
        target: Number,
        benchmark: Number,
      },
      painReduction: {
        percentage: Number,
        target: Number,
        benchmark: Number,
      },
    },

    // Patient Experience
    patientExperience: {
      satisfactionScore: {
        current: Number,
        target: Number,
        benchmark: Number,
        responses: Number,
      },
      communicationScore: {
        current: Number,
        target: Number,
        benchmark: Number,
      },
      careCoordinationScore: {
        current: Number,
        target: Number,
        benchmark: Number,
      },
      overallRating: {
        current: Number,
        target: Number,
        benchmark: Number,
      },
    },

    // AI Analytics
    aiAnalytics: {
      predictiveModels: [
        {
          model: String,
          prediction: Number,
          confidence: {
            type: Number,
            min: 0,
            max: 1,
          },
          factors: [String],
          recommendations: [String],
        },
      ],
      riskAssessment: {
        overallRisk: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
        },
        riskFactors: [String],
        mitigationStrategies: [String],
      },
      trendAnalysis: {
        shortTerm: String, // 30 days
        mediumTerm: String, // 90 days
        longTerm: String, // 1 year
        seasonalPatterns: [String],
        anomalies: [String],
      },
      benchmarkComparison: {
        percentile: Number,
        ranking: String,
        improvementAreas: [String],
        strengths: [String],
      },
    },

    // Compliance and Regulatory
    compliance: {
      cmsCompliance: {
        score: Number,
        requirements: [
          {
            requirement: String,
            status: {
              type: String,
              enum: ["compliant", "non-compliant", "partial"],
            },
            lastAssessed: Date,
            nextDue: Date,
          },
        ],
      },
      qualityMeasures: [
        {
          measure: String,
          score: Number,
          percentile: Number,
          target: Number,
          status: {
            type: String,
            enum: ["met", "not-met", "improving"],
          },
        },
      ],
      accreditation: {
        status: String,
        lastReview: Date,
        nextReview: Date,
        findings: [String],
        correctionPlan: [String],
      },
    },

    // Status and Metadata
    status: {
      type: String,
      enum: ["draft", "active", "completed", "archived"],
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
      lastCalculated: Date,
      calculationDuration: Number, // milliseconds
      dataQuality: {
        completeness: Number,
        accuracy: Number,
        timeliness: Number,
      },
      version: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
OutcomeMeasureSchema.index({ userId: 1, "reportingPeriod.startDate": -1 });
OutcomeMeasureSchema.index({
  organizationId: 1,
  "reportingPeriod.frequency": 1,
});
OutcomeMeasureSchema.index({ patientId: 1, createdAt: -1 });
OutcomeMeasureSchema.index({ "qualityIndicators.indicator": 1 });
OutcomeMeasureSchema.index({ status: 1, "metadata.lastCalculated": -1 });

// Pre-save middleware
OutcomeMeasureSchema.pre("save", function (next) {
  this.metadata.updatedAt = new Date();

  // Calculate percentages for quality indicators
  this.qualityIndicators.forEach((indicator) => {
    if (indicator.numerator && indicator.denominator) {
      indicator.percentage =
        (indicator.numerator / indicator.denominator) * 100;
    }
  });

  next();
});

// Methods
OutcomeMeasureSchema.methods.calculateOverallScore = function () {
  let totalScore = 0;
  let count = 0;

  // Calculate from quality indicators
  this.qualityIndicators.forEach((indicator) => {
    if (indicator.current && indicator.target) {
      const score = (indicator.current / indicator.target) * 100;
      totalScore += Math.min(score, 100);
      count++;
    }
  });

  return count > 0 ? totalScore / count : 0;
};

OutcomeMeasureSchema.methods.generateTrendAnalysis = function () {
  // This would integrate with historical data
  const trends = {
    improving: 0,
    stable: 0,
    declining: 0,
  };

  this.qualityIndicators.forEach((indicator) => {
    if (indicator.trend) {
      trends[indicator.trend]++;
    }
  });

  const total = trends.improving + trends.stable + trends.declining;
  if (total === 0) return "unknown";

  const improvingPercentage = (trends.improving / total) * 100;
  const decliningPercentage = (trends.declining / total) * 100;

  if (improvingPercentage > 60) return "improving";
  if (decliningPercentage > 40) return "declining";
  return "stable";
};

OutcomeMeasureSchema.methods.identifyRiskAreas = function () {
  const riskAreas = [];

  this.qualityIndicators.forEach((indicator) => {
    if (indicator.current && indicator.target) {
      const performance = (indicator.current / indicator.target) * 100;
      if (performance < 80) {
        riskAreas.push({
          indicator: indicator.indicator,
          performance: performance,
          gap: indicator.target - indicator.current,
        });
      }
    }
  });

  return riskAreas.sort((a, b) => a.performance - b.performance);
};

// Static methods
OutcomeMeasureSchema.statics.getByUser = function (userId, options = {}) {
  return this.find({ userId })
    .sort({ "reportingPeriod.startDate": -1 })
    .limit(options.limit || 12)
    .exec();
};

OutcomeMeasureSchema.statics.getBenchmarkComparison = function (
  organizationId,
  indicator
) {
  const pipeline = [
    {
      $match: {
        organizationId: mongoose.Types.ObjectId(organizationId),
        "qualityIndicators.indicator": indicator,
      },
    },
    {
      $unwind: "$qualityIndicators",
    },
    {
      $match: {
        "qualityIndicators.indicator": indicator,
      },
    },
    {
      $group: {
        _id: null,
        avgCurrent: { $avg: "$qualityIndicators.current" },
        avgTarget: { $avg: "$qualityIndicators.target" },
        avgBenchmark: { $avg: "$qualityIndicators.benchmark" },
        count: { $sum: 1 },
      },
    },
  ];

  return this.aggregate(pipeline);
};

OutcomeMeasureSchema.statics.getTrendAnalysis = function (
  userId,
  timeframe = 12
) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - timeframe);

  return this.find({
    userId: mongoose.Types.ObjectId(userId),
    "reportingPeriod.startDate": { $gte: startDate },
  })
    .sort({ "reportingPeriod.startDate": 1 })
    .exec();
};

export default mongoose.model("OutcomeMeasure", OutcomeMeasureSchema);
