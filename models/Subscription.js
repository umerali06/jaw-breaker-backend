import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    planId: {
      type: String,
      required: true,
      enum: [
        "nursing-professional",
        "physical-therapy-professional",
        "general-professional",
        // Legacy plans for backward compatibility
        "nursing-monthly",
        "nursing-annual",
        "pt-monthly",
        "pt-annual",
        // Medical provider plans
        "medical-monthly",
        "medical-annual",
      ],
    },
    planName: {
      type: String,
      required: true,
    },
    planType: {
      type: String,
      required: true,
      enum: ["nursing", "physical-therapy", "medical-provider", "general", "legacy"],
      default: function () {
        if (this.planId.includes("nursing")) return "nursing";
        if (
          this.planId.includes("physical-therapy") ||
          this.planId.includes("pt")
        )
          return "physical-therapy";
        if (this.planId.includes("medical")) return "medical-provider";
        if (this.planId.includes("general")) return "general";
        return "legacy";
      },
    },
    planTier: {
      type: String,
      enum: ["basic", "professional", "enterprise"],
      default: "professional",
    },
    status: {
      type: String,
      required: true,
      enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
      ],
      default: "trialing",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    interval: {
      type: String,
      required: true,
      enum: ["month", "year"],
    },
    intervalCount: {
      type: Number,
      default: 1,
    },

    // Features and limits for this subscription
    features: [
      {
        type: String,
      },
    ],
    limits: {
      fileUploads: { type: Number, default: -1 }, // -1 means unlimited
      storageGB: { type: Number, default: -1 },
      analysisRequests: { type: Number, default: 1000 },
      teamMembers: { type: Number, default: 5 },
      apiCalls: { type: Number, default: 10000 },
    },

    // Usage tracking
    usage: {
      currentPeriod: {
        fileUploads: { type: Number, default: 0 },
        storageUsed: { type: Number, default: 0 },
        analysisRequests: { type: Number, default: 0 },
        apiCalls: { type: Number, default: 0 },
      },
      lifetime: {
        totalFileUploads: { type: Number, default: 0 },
        totalAnalysisRequests: { type: Number, default: 0 },
        totalApiCalls: { type: Number, default: 0 },
      },
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialEnd: {
      type: Date,
    },
    canceledAt: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancellationReason: {
      type: String,
    },

    // Billing information
    stripePriceId: {
      type: String,
      required: true,
    },
    nextBillingDate: {
      type: Date,
    },
    lastBillingDate: {
      type: Date,
    },

    // Discounts and promotions
    discounts: [
      {
        couponId: String,
        percentOff: Number,
        amountOff: Number,
        duration: String,
        durationInMonths: Number,
      },
    ],

    // Risk and fraud information
    riskScore: {
      type: Number,
      default: 0,
    },
    fraudFlags: [
      {
        type: String,
      },
    ],

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

// Virtual for checking if subscription is active
subscriptionSchema.virtual("isActive").get(function () {
  return this.status === "active" || this.status === "trialing";
});

// Virtual for checking if trial is active
subscriptionSchema.virtual("isTrialing").get(function () {
  return (
    this.status === "trialing" && this.trialEnd && new Date() < this.trialEnd
  );
});

// Virtual for days remaining in trial
subscriptionSchema.virtual("trialDaysRemaining").get(function () {
  if (!this.isTrialing) return 0;
  const now = new Date();
  const trialEnd = new Date(this.trialEnd);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Method to check if user has access to a feature
subscriptionSchema.methods.hasFeatureAccess = function (feature) {
  if (!this.isActive) return false;
  return this.features.includes(feature);
};

// Method to check usage limits
subscriptionSchema.methods.checkUsageLimit = function (limitType) {
  const limit = this.limits[limitType];
  const currentUsage = this.usage.currentPeriod[limitType] || 0;

  if (limit === -1) return { allowed: true, unlimited: true };

  return {
    allowed: currentUsage < limit,
    unlimited: false,
    current: currentUsage,
    limit: limit,
    remaining: Math.max(0, limit - currentUsage),
  };
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = async function (
  limitType,
  amount = 1
) {
  const usagePath = `usage.currentPeriod.${limitType}`;
  const lifetimePath = `usage.lifetime.total${
    limitType.charAt(0).toUpperCase() + limitType.slice(1)
  }`;

  await this.constructor.findByIdAndUpdate(this._id, {
    $inc: {
      [usagePath]: amount,
      [lifetimePath]: amount,
    },
  });

  // Update local instance
  if (!this.usage.currentPeriod[limitType])
    this.usage.currentPeriod[limitType] = 0;
  this.usage.currentPeriod[limitType] += amount;
};

// Method to reset usage for new billing period
subscriptionSchema.methods.resetUsageForNewPeriod = async function () {
  await this.constructor.findByIdAndUpdate(this._id, {
    "usage.currentPeriod": {
      fileUploads: 0,
      storageUsed: 0,
      analysisRequests: 0,
      apiCalls: 0,
    },
  });
};

// Static method to find active subscription for user
subscriptionSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
  }).sort({ createdAt: -1 });
};

// Pre-save middleware to update related user
subscriptionSchema.pre("save", async function (next) {
  if (this.isModified("status")) {
    try {
      const User = mongoose.model("User");
      await User.findByIdAndUpdate(this.userId, {
        subscriptionStatus: this.status,
        lastSubscriptionUpdate: new Date(),
      });
    } catch (error) {
      console.error("Error updating user subscription status:", error);
    }
  }
  next();
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
