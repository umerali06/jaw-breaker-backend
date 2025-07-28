import AuthService from "../services/authService.js";

/**
 * Handle user signup
 */
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

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

    // Generate authentication response
    const authResponse = AuthService.createAuthResponse(result.user);

    res.status(201).json(authResponse);
  } catch (error) {
    console.error("Signup error:", error);
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
 * Handle user login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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

    // Generate authentication response
    const authResponse = AuthService.createAuthResponse(result.user);

    res.json(authResponse);
  } catch (error) {
    console.error("Login error:", error);
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
 * Get current user information
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User is attached to request by auth middleware
    const user = req.user;

    res.json({
      success: true,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Get current user error:", error);
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
 * Handle Google OAuth success
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
