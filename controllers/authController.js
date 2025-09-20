import AuthService from "../services/authService.js";
import UserDataValidationService from "../services/UserDataValidationService.js";
import FeatureAccessRepairService from "../services/FeatureAccessRepairService.js";
import ValidationUtilities from "../services/ValidationUtilities.js";

/**
 * Handle user signup with enhanced validation
 */
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input data
    if (!email || !ValidationUtilities.isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        },
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PASSWORD",
          message: "Password must be at least 8 characters long",
        },
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_NAME",
          message: "Name is required",
        },
      });
    }

    // Create user account
    const result = await AuthService.createUser({
      email,
      password,
      name,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "SIGNUP_FAILED",
          message: result.error,
        },
      });
    }

    // Validate and repair user data after creation
    try {
      const validationResult =
        await UserDataValidationService.validateAndRepairUser(result.user);
      if (validationResult.wasRepaired) {
        ValidationUtilities.logValidationSuccess(
          "AuthController.signup",
          result.user._id?.toString(),
          {
            action: "User data repaired during signup",
            errors: validationResult.errors,
          }
        );
        await result.user.save();
      }
    } catch (validationError) {
      ValidationUtilities.logValidationError(
        "AuthController.signup",
        result.user._id?.toString(),
        validationError
      );
      // Continue with signup even if validation fails
    }

    // Generate authentication response
    const authResponse = AuthService.createAuthResponse(result.user);

    res.status(201).json(authResponse);
  } catch (error) {
    console.error("Signup error:", error);
    ValidationUtilities.logValidationError(
      "AuthController.signup",
      null,
      error,
      { email, name }
    );
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Registration failed. Please try again.",
      },
    });
  }
};

/**
 * Handle user login with enhanced validation and automatic repair
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !ValidationUtilities.isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        },
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PASSWORD",
          message: "Password is required",
        },
      });
    }

    // Validate credentials
    const result = await AuthService.validateCredentials(email, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: {
          code: "LOGIN_FAILED",
          message: result.error,
        },
      });
    }

    // Validate and repair user data during login
    try {
      const validationResult =
        await UserDataValidationService.validateAndRepairUser(result.user);

      if (validationResult.wasRepaired) {
        ValidationUtilities.logValidationSuccess(
          "AuthController.login",
          result.user._id?.toString(),
          {
            action: "User data automatically repaired during login",
            errorsFixed: validationResult.errors.length,
            remainingErrors: validationResult.errors,
          }
        );

        // Save the repaired user data
        await result.user.save();
      } else if (validationResult.errors.length > 0) {
        ValidationUtilities.logValidationError(
          "AuthController.login",
          result.user._id?.toString(),
          {
            message: "User data validation issues detected",
            errors: validationResult.errors,
          },
          { errorCount: validationResult.errors.length }
        );
      }
    } catch (validationError) {
      ValidationUtilities.logValidationError(
        "AuthController.login",
        result.user._id?.toString(),
        validationError,
        { action: "Validation during login failed" }
      );
      // Continue with login even if validation fails
    }

    // Generate authentication response
    const authResponse = AuthService.createAuthResponse(result.user);

    res.json(authResponse);
  } catch (error) {
    console.error("Login error:", error);
    ValidationUtilities.logValidationError(
      "AuthController.login",
      null,
      error,
      { email }
    );
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Login failed. Please try again.",
      },
    });
  }
};

/**
 * Handle user logout
 */
export const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can track logout events or invalidate tokens if needed
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Logout failed",
      },
    });
  }
};

/**
 * Get current user information with comprehensive validation
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User is attached to request by auth middleware (already populated with subscriptions)
    const user = req.user;

    // Debug logging for user data
    console.log("🔍 [AuthController] getCurrentUser - User data:", {
      id: user._id,
      email: user.email,
      name: user.name,
      profession: user.profession,
      subscriptionStatus: user.subscriptionStatus,
      billingPlan: user.billingPlan,
      subscriptionsCount: user.subscriptions?.length || 0,
      featureAccess: user.featureAccess ? "Present" : "Missing",
      signupSource: user.signupSource,
    });

    // Comprehensive user data validation and repair
    try {
      const validationResult =
        await UserDataValidationService.validateAndRepairUser(user);

      if (validationResult.wasRepaired) {
        ValidationUtilities.logValidationSuccess(
          "AuthController.getCurrentUser",
          user._id?.toString(),
          {
            action: "User data automatically repaired",
            errorsFixed: validationResult.errors.length,
            remainingErrors: validationResult.errors,
          }
        );

        // Save the repaired user data
        if (typeof user.save === 'function') {
          await user.save();
        }
      } else if (validationResult.errors.length > 0) {
        ValidationUtilities.logValidationError(
          "AuthController.getCurrentUser",
          user._id?.toString(),
          {
            message: "User data validation issues detected",
            errors: validationResult.errors,
          },
          { errorCount: validationResult.errors.length }
        );
      }
    } catch (validationError) {
      ValidationUtilities.logValidationError(
        "AuthController.getCurrentUser",
        user._id?.toString(),
        validationError,
        { action: "Validation during getCurrentUser failed" }
      );
    }

    // Ensure feature access is up to date with enhanced validation
    const shouldRefreshFeatureAccess =
      !user.featureAccess ||
      !user.featureAccess.lastUpdated ||
      Date.now() - user.featureAccess.lastUpdated.getTime() >
        24 * 60 * 60 * 1000 ||
      (typeof user.isFeatureAccessValid === 'function' && !user.isFeatureAccessValid());

    if (shouldRefreshFeatureAccess) {
      console.log(
        "🔄 [AuthController] Refreshing stale or invalid feature access"
      );

      try {
        // Use repair service to ensure proper structure
        const repairResult =
          await FeatureAccessRepairService.repairFeatureAccess(user);

        if (repairResult.success) {
          // Update with current features and limits
          const activeFeatures = typeof user.getCombinedFeatures === 'function' ? user.getCombinedFeatures() : [];
          const limits = typeof user.getCombinedLimits === 'function' ? user.getCombinedLimits() : FeatureAccessRepairService.getDefaultLimits();

          user.featureAccess.features = activeFeatures;
          user.featureAccess.limits = {
            ...user.featureAccess.limits,
            ...limits,
          };
          user.featureAccess.lastUpdated = new Date();

          // Also update legacy fields for backward compatibility
          user.activeFeatures = activeFeatures;
          user.limits = limits;

          if (typeof user.save === 'function') {
            await user.save();
          }

          ValidationUtilities.logValidationSuccess(
            "AuthController.getCurrentUser",
            user._id?.toString(),
            { action: "Feature access refreshed and repaired" }
          );
        }
      } catch (refreshError) {
        ValidationUtilities.logValidationError(
          "AuthController.getCurrentUser",
          user._id?.toString(),
          refreshError,
          { action: "Feature access refresh failed" }
        );

        // Apply fallback defaults if refresh fails
        user.featureAccess =
          FeatureAccessRepairService.getDefaultFeatureAccess();
        if (typeof user.save === 'function') {
          await user.save();
        }
      }
    }

    const publicUserData = typeof user.toPublicJSON === 'function' ? user.toPublicJSON() : {
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      profession: user.profession,
      subscriptionStatus: user.subscriptionStatus,
      billingPlan: user.billingPlan,
      subscriptions: user.subscriptions || [],
      featureAccess: user.featureAccess,
      activeFeatures: user.activeFeatures || [],
      limits: user.limits || {},
      signupSource: user.signupSource
    };

    console.log("✅ [AuthController] Sending user data to frontend:", {
      hasSubscriptions: !!publicUserData.subscriptions?.length,
      hasFeatureAccess: !!publicUserData.featureAccess,
      hasActiveFeatures: !!publicUserData.activeFeatures?.length,
      subscriptionsCount: publicUserData.subscriptions?.length || 0,
      activeFeaturesCount: publicUserData.activeFeatures?.length || 0,
      featureAccessValid: typeof user.isFeatureAccessValid === 'function' ? user.isFeatureAccessValid() : false,
    });

    res.json({
      success: true,
      user: publicUserData,
    });
  } catch (error) {
    console.error("❌ [AuthController] Get current user error:", error);
    ValidationUtilities.logValidationError(
      "AuthController.getCurrentUser",
      req.user?._id?.toString(),
      error
    );

    // Try to provide a fallback response with basic user data
    try {
      if (req.user) {
        const basicUserData = {
          id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          featureAccess: FeatureAccessRepairService.getDefaultFeatureAccess(),
          subscriptions: req.user.subscriptions || [],
        };

        return res.json({
          success: true,
          user: basicUserData,
          warning: "User data was partially recovered due to validation errors",
        });
      }
    } catch (fallbackError) {
      ValidationUtilities.logValidationError(
        "AuthController.getCurrentUser",
        req.user?._id?.toString(),
        fallbackError,
        { action: "Fallback response failed" }
      );
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get user information",
      },
    });
  }
};

/**
 * Handle Google OAuth success with validation
 */
export const googleAuthSuccess = async (req, res) => {
  try {
    console.log("Google OAuth success callback triggered");
    console.log("Environment CLIENT_URL:", process.env.CLIENT_URL);
    console.log("Environment NODE_ENV:", process.env.NODE_ENV);

    // User is attached by passport middleware
    const user = req.user;
    console.log("User from passport:", user ? user.email : "No user");

    if (!user) {
      console.log("No user found, OAuth failed");
      return res.status(401).json({
        success: false,
        error: {
          code: "OAUTH_FAILED",
          message: "Google authentication failed",
        },
      });
    }

    // Validate and repair user data after OAuth
    try {
      const validationResult =
        await UserDataValidationService.validateAndRepairUser(user);
      if (validationResult.wasRepaired) {
        ValidationUtilities.logValidationSuccess(
          "AuthController.googleAuthSuccess",
          user._id?.toString(),
          {
            action: "User data repaired during Google OAuth",
            errors: validationResult.errors,
          }
        );
        await user.save();
      }
    } catch (validationError) {
      ValidationUtilities.logValidationError(
        "AuthController.googleAuthSuccess",
        user._id?.toString(),
        validationError
      );
      // Continue with OAuth even if validation fails
    }

    // Generate authentication response
    console.log("Generating auth response for user:", user.email);
    const authResponse = AuthService.createAuthResponse(user);
    console.log(
      "Generated token:",
      authResponse.token ? "Token created" : "No token"
    );

    // Redirect to frontend with token
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const redirectUrl = `${clientUrl}/auth?token=${authResponse.token}`;
    console.log("Final redirect URL:", redirectUrl);

    // Add a small delay and more explicit redirect
    res.writeHead(302, {
      Location: redirectUrl,
      "Cache-Control": "no-cache",
    });
    res.end();
  } catch (error) {
    console.error("Google auth success error:", error);
    ValidationUtilities.logValidationError(
      "AuthController.googleAuthSuccess",
      req.user?._id?.toString(),
      error
    );
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    console.log(
      "Error redirect URL:",
      `${clientUrl}/auth?error=authentication_failed`
    );
    res.redirect(`${clientUrl}/auth?error=authentication_failed`);
  }
};

/**
 * Handle Google OAuth failure
 */
export const googleAuthFailure = async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.redirect(`${clientUrl}/auth?error=oauth_cancelled`);
};

/**
 * Handle password reset request
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_EMAIL",
          message: "Email is required",
        },
      });
    }

    // Request password reset through AuthService
    const result = await AuthService.requestPasswordReset(email);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "RESET_REQUEST_FAILED",
          message: result.error,
        },
      });
    }

    res.json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to process password reset request",
      },
    });
  }
};

/**
 * Handle password reset
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Reset token and new password are required",
        },
      });
    }

    // Reset password through AuthService
    const result = await AuthService.resetPassword(token, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "RESET_FAILED",
          message: result.error,
        },
      });
    }

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to reset password",
      },
    });
  }
};
