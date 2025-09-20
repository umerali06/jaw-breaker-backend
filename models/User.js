import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import UserDataValidationService from "../services/UserDataValidationService.js";
import FeatureAccessRepairService from "../services/FeatureAccessRepairService.js";
import ValidationUtilities from "../services/ValidationUtilities.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password required only if not using Google OAuth
      },
      minlength: [8, "Password must be at least 8 characters long"],
      validate: {
        validator: function (password) {
          // Only validate if password is provided (for Google OAuth users)
          if (!password && this.googleId) return true;
          return password && password.length >= 8;
        },
        message: "Password must be at least 8 characters long",
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [25, "First name cannot exceed 25 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [25, "Last name cannot exceed 25 characters"],
    },
    avatar: {
      type: String,
      default: null,
    },
    profession: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, or valid enum values
          return (
            value === null ||
            value === undefined ||
            [
              "nursing",
              "physical-therapy",
              "medical-provider"
            ].includes(value)
          );
        },
        message:
          "Please select a valid profession: nursing, physical-therapy, or medical-provider",
      },
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    institution: {
      type: String,
      trim: true,
    },
    yearsExperience: {
      type: String,
      enum: ["0-1", "2-5", "6-10", "11-15", "16+"],
    },
    // Multi-subscription support
    subscriptions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subscription",
        },
      ],
      default: [], // Ensure subscriptions is always an array
    },

    // Stripe customer information
    stripeCustomerId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Feature access cache for performance with enhanced validation
    featureAccess: {
      lastUpdated: {
        type: Date,
        default: Date.now,
        required: true,
      },
      features: {
        type: [String],
        default: [],
        validate: {
          validator: function (features) {
            return Array.isArray(features);
          },
          message: "Features must be an array",
        },
      },
      limits: {
        fileUploads: {
          type: Number,
          default: 10,
          validate: {
            validator: function (value) {
              return typeof value === "number" && (value >= 0 || value === -1);
            },
            message:
              "File uploads limit must be a non-negative number or -1 for unlimited",
          },
        },
        storageGB: {
          type: Number,
          default: 1,
          validate: {
            validator: function (value) {
              return typeof value === "number" && (value >= 0 || value === -1);
            },
            message:
              "Storage limit must be a non-negative number or -1 for unlimited",
          },
        },
        analysisRequests: {
          type: Number,
          default: 5,
          validate: {
            validator: function (value) {
              return typeof value === "number" && (value >= 0 || value === -1);
            },
            message:
              "Analysis requests limit must be a non-negative number or -1 for unlimited",
          },
        },
        teamMembers: {
          type: Number,
          default: 0,
          validate: {
            validator: function (value) {
              return typeof value === "number" && value >= 0;
            },
            message: "Team members limit must be a non-negative number",
          },
        },
        apiCalls: {
          type: Number,
          default: 0,
          validate: {
            validator: function (value) {
              return typeof value === "number" && (value >= 0 || value === -1);
            },
            message:
              "API calls limit must be a non-negative number or -1 for unlimited",
          },
        },
      },
    },

    // Backward compatibility fields (computed from subscriptions)
    subscriptionStatus: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, or valid enum values
          return (
            value === null ||
            value === undefined ||
            [
              "trialing",
              "active",
              "past_due",
              "canceled",
              "unpaid",
              "incomplete",
            ].includes(value)
          );
        },
        message:
          "Please select a valid subscription status: trialing, active, past_due, canceled, unpaid, or incomplete",
      },
    },
    billingPlan: {
      type: String,
      default: null,
    },
    lastSubscriptionUpdate: {
      type: Date,
      default: null,
    },
    signupSource: {
      type: String,
      enum: ["free", "professional", "google"],
      default: "free",
    },
    billingAddress: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "US" },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ resetPasswordToken: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash password if it's modified and exists
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // No password set (Google OAuth user)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual fields for backward compatibility
userSchema.virtual("computedSubscriptionStatus").get(function () {
  if (!this.subscriptions || this.subscriptions.length === 0) {
    return null;
  }

  // If any subscription is active, user is active
  const activeStatuses = ["active", "trialing"];
  const hasActiveSubscription = this.subscriptions.some((sub) =>
    activeStatuses.includes(sub.status)
  );

  return hasActiveSubscription ? "active" : "canceled";
});

userSchema.virtual("computedBillingPlan").get(function () {
  if (!this.subscriptions || this.subscriptions.length === 0) {
    return null;
  }

  // Return the highest tier active plan
  const activePlans = this.subscriptions
    .filter((sub) => ["active", "trialing"].includes(sub.status))
    .map((sub) => sub.planId);

  // Check for general professional first (highest tier)
  if (activePlans.includes("general-professional"))
    return "general-professional";

  // Check for legacy professional plans
  if (activePlans.includes("nursing-professional"))
    return "nursing-professional";
  if (activePlans.includes("physical-therapy-professional"))
    return "physical-therapy-professional";

  // Check for new monthly/annual plans
  if (activePlans.some((plan) => plan.includes("nursing")))
    return activePlans.find((plan) => plan.includes("nursing"));
  if (activePlans.some((plan) => plan.includes("pt")))
    return activePlans.find((plan) => plan.includes("pt"));

  return activePlans[0] || null;
});

// Pre-save hook for data validation and repair
userSchema.pre("save", async function (next) {
  try {
    // Ensure subscriptions is always an array
    if (!this.subscriptions || !Array.isArray(this.subscriptions)) {
      this.subscriptions = [];
    }

    // Initialize featureAccess if missing
    if (!this.featureAccess) {
      this.featureAccess = FeatureAccessRepairService.getDefaultFeatureAccess();
      ValidationUtilities.logValidationSuccess(
        "UserModelPreSave",
        this._id?.toString(),
        { action: "Initialized missing featureAccess" }
      );
    }

    // Validate and repair featureAccess structure
    const repairResult = await FeatureAccessRepairService.repairFeatureAccess(
      this
    );
    if (repairResult.success && repairResult.changes.length > 0) {
      ValidationUtilities.logValidationSuccess(
        "UserModelPreSave",
        this._id?.toString(),
        {
          action: "Repaired featureAccess",
          changes: repairResult.changes,
        }
      );
    }

    // Sanitize user fields
    UserDataValidationService.sanitizeUserFields(this);

    next();
  } catch (error) {
    ValidationUtilities.logValidationError(
      "UserModelPreSave",
      this._id?.toString(),
      error
    );
    next(error);
  }
});

// Pre-save hook to ensure subscriptions is always an array (kept for backward compatibility)
userSchema.pre("save", function (next) {
  // This is now handled in the main pre-save hook above, but keeping for safety
  if (!this.subscriptions || !Array.isArray(this.subscriptions)) {
    this.subscriptions = [];
  }
  next();
});

// Instance methods for multi-subscription support
userSchema.methods.getActiveSubscriptions = function () {
  if (!this.subscriptions || !Array.isArray(this.subscriptions)) {
    return [];
  }
  return this.subscriptions.filter((sub) => {
    if (!sub) return false;
    return ["active", "trialing"].includes(sub.status);
  });
};

userSchema.methods.hasFeatureAccess = function (feature) {
  return this.featureAccess?.features?.includes(feature) || false;
};

userSchema.methods.getCombinedFeatures = function () {
  return this.featureAccess?.features || [];
};

userSchema.methods.getCombinedLimits = function () {
  return (
    this.featureAccess?.limits || {
      fileUploads: 10,
      storageGB: 1,
      analysisRequests: 5,
      teamMembers: 0,
      apiCalls: 0,
    }
  );
};

// Enhanced validation methods
userSchema.methods.validateUserData = async function () {
  return await UserDataValidationService.validateUserData(this);
};

userSchema.methods.repairUserData = async function () {
  return await UserDataValidationService.validateAndRepairUser(this);
};

userSchema.methods.isFeatureAccessValid = function () {
  const validation = ValidationUtilities.isValidFeatureAccessStructure(
    this.featureAccess
  );
  return validation.isValid;
};

userSchema.methods.getValidationErrors = async function () {
  const validation = await this.validateUserData();
  return validation.errors;
};

// Instance method to get public user data
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    firstName: this.firstName,
    lastName: this.lastName,
    avatar: this.avatar,
    isEmailVerified: this.isEmailVerified,
    profession: this.profession,
    subscriptionStatus:
      this.computedSubscriptionStatus || this.subscriptionStatus,
    billingPlan: this.computedBillingPlan || this.billingPlan,
    signupSource: this.signupSource,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    // Multi-subscription data
    subscriptions: this.subscriptions,
    featureAccess: this.featureAccess,
    activeFeatures: this.featureAccess?.features || this.getCombinedFeatures(),
    limits: this.featureAccess?.limits || {
      fileUploads: 10,
      storageGB: 1,
      analysisRequests: 5,
      teamMembers: 0,
      apiCalls: 0,
    },
  };
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find user by Google ID
userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId });
};

// Enhanced post-save error handling with automatic repair
userSchema.post("save", async function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    if (error.keyPattern.email) {
      next(new Error("Email address is already registered"));
    } else if (error.keyPattern.googleId) {
      next(new Error("Google account is already linked to another user"));
    } else {
      next(error);
    }
  } else if (error.name === "ValidationError") {
    // Handle validation errors with automatic repair attempt
    ValidationUtilities.logValidationError(
      "UserModelPostSave",
      doc?._id?.toString(),
      error,
      { errorType: "ValidationError", errors: error.errors }
    );

    try {
      // Attempt automatic repair for validation errors
      const repairResult =
        await UserDataValidationService.validateAndRepairUser(doc);

      if (repairResult.wasRepaired && repairResult.errors.length === 0) {
        // Retry save after successful repair
        ValidationUtilities.logValidationSuccess(
          "UserModelPostSave",
          doc._id?.toString(),
          { action: "Automatic repair successful, retrying save" }
        );

        // Save the repaired document
        await doc.save();
        next();
      } else {
        // If repair failed or errors remain, apply fallback defaults
        const fallbackResult =
          await UserDataValidationService.applyFallbackDefaults(doc);
        if (fallbackResult.applied) {
          ValidationUtilities.logValidationSuccess(
            "UserModelPostSave",
            doc._id?.toString(),
            {
              action: "Applied fallback defaults",
              changes: fallbackResult.changes,
            }
          );

          await doc.save();
          next();
        } else {
          next(error);
        }
      }
    } catch (repairError) {
      ValidationUtilities.logValidationError(
        "UserModelPostSave",
        doc?._id?.toString(),
        repairError,
        { originalError: error.message }
      );
      next(error); // Return original error if repair fails
    }
  } else {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);

export default User;
