import User from "../models/User.js";

// Plan feature mapping
const PLAN_FEATURES = {
  // Free plan features
  free: [],

  // Nursing plans
  "nursing-monthly": [
    "advanced_oasis_scoring",
    "soap_note_generator",
    "care_plan_builder",
    "medication_management",
    "clinical_decision_support",
    "nursing_assessments",
    "progress_tracking",
    "outcome_measures",
  ],
  "nursing-annual": [
    "advanced_oasis_scoring",
    "soap_note_generator",
    "care_plan_builder",
    "medication_management",
    "clinical_decision_support",
    "nursing_assessments",
    "progress_tracking",
    "outcome_measures",
  ],
  "nursing-professional": [
    "advanced_oasis_scoring",
    "soap_note_generator",
    "care_plan_builder",
    "medication_management",
    "clinical_decision_support",
    "nursing_assessments",
    "progress_tracking",
    "outcome_measures",
  ],

  // Physical therapy plans
  "pt-monthly": ["pt_assessments", "treatment_plans", "exercise_protocols"],
  "pt-annual": ["pt_assessments", "treatment_plans", "exercise_protocols"],

  // General professional plans
  "general-professional": [
    "advanced_ai_analysis",
    "professional_templates",
    "advanced_reporting",
  ],

  // Legacy professional plan
  professional: [
    "advanced_ai_analysis",
    "unlimited_storage",
    "priority_processing",
  ],
};

// Nursing feature requirements
const NURSING_FEATURES = [
  "advanced_oasis_scoring",
  "soap_note_generator",
  "care_plan_builder",
  "medication_management",
  "clinical_decision_support",
  "nursing_assessments",
  "progress_tracking",
  "outcome_measures",
];

/**
 * Get user's active subscription plan IDs
 */
const getUserPlanIds = (user) => {
  if (!user) return [];

  // Check active subscriptions
  if (user.subscriptions && Array.isArray(user.subscriptions)) {
    const activeSubscriptions = user.subscriptions.filter((sub) => {
      if (!sub) return false;

      const isActive =
        sub.status === "active" || sub.status === "trialing" || !sub.status;
      const notExpired = !sub.endDate || new Date(sub.endDate) > new Date();
      const hasValidPlanId = sub.planId && sub.planId !== "undefined";

      return isActive && notExpired && hasValidPlanId;
    });

    if (activeSubscriptions.length > 0) {
      return activeSubscriptions.map((sub) => sub.planId);
    }
  }

  // Fallback to legacy fields
  if (user.billingPlan) {
    return [user.billingPlan];
  }

  if (
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing"
  ) {
    // Infer plan from profession
    if (user.profession === "nursing") return ["nursing-monthly"];
    if (user.profession === "physical-therapy") return ["pt-monthly"];
    return ["professional"];
  }

  return ["free"];
};

/**
 * Check if user has access to a specific feature
 */
const hasFeatureAccess = (user, feature) => {
  const planIds = getUserPlanIds(user);

  // Check each active plan
  for (const planId of planIds) {
    const planFeatures = PLAN_FEATURES[planId] || [];
    if (planFeatures.includes(feature)) {
      return true;
    }
  }

  return false;
};

/**
 * Check if user has access to any nursing features
 */
const hasNursingAccess = (user) => {
  const planIds = getUserPlanIds(user);

  // Check if any plan includes nursing features
  for (const planId of planIds) {
    const planFeatures = PLAN_FEATURES[planId] || [];
    const hasNursingFeature = NURSING_FEATURES.some((feature) =>
      planFeatures.includes(feature)
    );
    if (hasNursingFeature) {
      return true;
    }
  }

  return false;
};

/**
 * Middleware to validate nursing plan access
 */
export const validateNursingAccess = async (req, res, next) => {
  try {
    // Development bypass - allow access in development mode
    if (
      process.env.NODE_ENV === "development" ||
      process.env.BYPASS_NURSING_VALIDATION === "true"
    ) {
      console.log("[DEV] Bypassing nursing access validation");
      req.userPlans = ["nursing-professional"]; // Mock nursing access
      req.hasNursingAccess = true;
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get fresh user data to ensure we have latest subscription info
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has nursing access
    if (!hasNursingAccess(user)) {
      return res.status(403).json({
        success: false,
        message: "Nursing features require a nursing professional subscription",
        code: "NURSING_SUBSCRIPTION_REQUIRED",
        upgradeUrl: "/pricing?plan=nursing",
      });
    }

    // Add user plan info to request for controllers to use
    req.userPlans = getUserPlanIds(user);
    req.hasNursingAccess = true;

    next();
  } catch (error) {
    console.error("Plan validation error:", error);
    res.status(500).json({
      success: false,
      message: "Error validating subscription access",
    });
  }
};

/**
 * Middleware to validate specific nursing feature access
 */
export const validateNursingFeature = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      // Development bypass - allow access in development mode
      if (
        process.env.NODE_ENV === "development" ||
        process.env.BYPASS_NURSING_VALIDATION === "true"
      ) {
        console.log(
          `[DEV] Bypassing nursing feature validation for: ${requiredFeature}`
        );
        req.userPlans = ["nursing-professional"]; // Mock nursing access
        req.hasFeatureAccess = requiredFeature;
        return next();
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Get fresh user data
      const user = await User.findById(req.user.id).lean();
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Check specific feature access
      if (!hasFeatureAccess(user, requiredFeature)) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a subscription with ${requiredFeature} access`,
          code: "FEATURE_SUBSCRIPTION_REQUIRED",
          requiredFeature,
          upgradeUrl: "/pricing?plan=nursing",
        });
      }

      // Add feature access info to request
      req.userPlans = getUserPlanIds(user);
      req.hasFeatureAccess = requiredFeature;

      next();
    } catch (error) {
      console.error("Feature validation error:", error);
      res.status(500).json({
        success: false,
        message: "Error validating feature access",
      });
    }
  };
};

/**
 * Utility function to check plan access (for use in controllers)
 */
export const checkPlanAccess = (user, feature) => {
  return hasFeatureAccess(user, feature);
};

/**
 * Get user's plan information
 */
export const getUserPlanInfo = (user) => {
  const planIds = getUserPlanIds(user);
  const features = [];

  planIds.forEach((planId) => {
    const planFeatures = PLAN_FEATURES[planId] || [];
    features.push(...planFeatures);
  });

  return {
    planIds,
    features: [...new Set(features)], // Remove duplicates
    hasNursingAccess: hasNursingAccess(user),
  };
};

export default {
  validateNursingAccess,
  validateNursingFeature,
  checkPlanAccess,
  getUserPlanInfo,
  hasFeatureAccess,
  hasNursingAccess,
};
