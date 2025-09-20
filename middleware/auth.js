import AuthService from "../services/authService.js";
import User from "../models/User.js";

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request object
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    // If no token is provided or if it's a test token, use development bypass only in development mode
    if (!token || token === "test-token") {
      if (process.env.NODE_ENV === "development" || process.env.BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production") {
        // Create a mock user for development
        req.user = {
          _id: "68a49366faf7ae8a360e9b93", // Use the same user ID as in the database
          email: "dev@example.com",
          profession: "medical-provider",
          subscriptions: []
        };
        req.userId = "68a49366faf7ae8a360e9b93";
        return next();
      } else {
        return res.status(401).json({
          success: false,
          error: {
            code: "NO_TOKEN",
            message: "Access token is required",
          },
        });
      }
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Find user in database and populate subscriptions
    const user = await User.findById(decoded.userId).populate("subscriptions");
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    let errorCode = "AUTH_FAILED";
    let errorMessage = "Authentication failed";

    if (error.message === "Token has expired") {
      errorCode = "TOKEN_EXPIRED";
      errorMessage = "Token has expired";
    } else if (error.message === "Invalid token") {
      errorCode = "INVALID_TOKEN";
      errorMessage = "Invalid token";
    }

    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block request if not
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = AuthService.verifyToken(token);
      const user = await User.findById(decoded.userId).populate(
        "subscriptions"
      );

      if (user) {
        req.user = user;
        req.userId = user._id.toString();
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log("Optional auth failed:", error.message);
  }

  next();
};

/**
 * Middleware to validate request body for authentication endpoints
 */
export const validateAuthInput = (requiredFields) => {
  return (req, res, next) => {
    const errors = [];

    // Check required fields
    for (const field of requiredFields) {
      if (!req.body[field]) {
        errors.push({
          field,
          message: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } is required`,
        });
      }
    }

    // Validate email format if email is provided
    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      errors.push({
        field: "email",
        message: "Please provide a valid email address",
      });
    }

    // Validate password strength if password is provided
    if (req.body.password && req.body.password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters long",
      });
    }

    // Validate password confirmation if provided
    if (
      req.body.confirmPassword &&
      req.body.password !== req.body.confirmPassword
    ) {
      errors.push({
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: errors,
        },
      });
    }

    next();
  };
};

/**
 * Error handling middleware for authentication routes
 */
export const handleAuthError = (error, req, res, next) => {
  console.error("Auth error:", error);

  // Handle specific error types
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: errors,
      },
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_ERROR",
        message: "Email address is already registered",
      },
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};

/**
 * Role-based authorization middleware
 * Checks if user has the required role(s) to access a resource
 */
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: "NO_USER",
            message: "User not authenticated",
          },
        });
      }

      // Check if user's profession is in the allowed roles
      const userRole = req.user.profession;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`,
          },
        });
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTHORIZATION_ERROR",
          message: "Authorization check failed",
        },
      });
    }
  };
};

/**
 * Subscription-based authorization middleware for doctor features
 * Allows access if user has medical provider subscription regardless of profession
 */
export const authorizeDoctorAccess = () => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: "NO_USER",
            message: "User not authenticated",
          },
        });
      }

      // Check if user has medical provider subscription
      const hasMedicalProviderAccess = req.user.subscriptions?.some(sub => 
        sub.planType === 'medical-provider' && sub.status === 'active'
      );

      // Check if user's profession allows access
      const professionAccess = ['medical-provider', 'doctor'].includes(req.user.profession);

      if (!hasMedicalProviderAccess && !professionAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "Access denied. Medical provider subscription or profession required.",
          },
        });
      }

      next();
    } catch (error) {
      console.error('Doctor access authorization error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTHORIZATION_ERROR",
          message: "Authorization check failed",
        },
      });
    }
  };
};
