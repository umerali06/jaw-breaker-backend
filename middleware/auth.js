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

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "NO_TOKEN",
          message: "Access token is required",
        },
      });
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Find user in database
    const user = await User.findById(decoded.userId);
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
      const user = await User.findById(decoded.userId);

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
