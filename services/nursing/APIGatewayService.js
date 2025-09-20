// API Gateway Service for nursing backend integration
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import SecurityComplianceService from "./SecurityComplianceService.js";

class APIGatewayService {
  constructor() {
    this.app = express();
    this.routes = new Map();
    this.middleware = [];
    this.rateLimiters = new Map();
    this.apiVersions = ["v1", "v2"];
    this.currentVersion = "v1";
    this.setupMiddleware();
    this.setupRateLimiting();
    this.setupRouting();
  }

  // Setup core middleware
  setupMiddleware() {
    // Security headers
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || [
          "http://localhost:3000",
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-API-Version",
          "X-Request-ID",
        ],
      })
    );

    // Compression
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.headers["x-no-compression"]) {
            return false;
          }
          return compression.filter(req, res);
        },
        threshold: 1024,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging and tracking
    this.app.use(this.requestLogger.bind(this));
    this.app.use(this.requestTracker.bind(this));

    // Authentication middleware
    this.app.use(this.authenticationMiddleware.bind(this));

    console.log("API Gateway middleware configured");
  }

  // Setup rate limiting
  setupRateLimiting() {
    // General API rate limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: "Too many requests from this IP",
        retryAfter: "15 minutes",
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        SecurityComplianceService.logSecurityEvent("rate_limit_exceeded", {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          endpoint: req.path,
        });
        res.status(429).json({
          error: "Too many requests",
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
      },
    });

    // Strict rate limiting for authentication endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: {
        error: "Too many authentication attempts",
        retryAfter: "15 minutes",
      },
    });

    // AI service rate limiting
    const aiLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 AI requests per minute
      message: {
        error: "AI service rate limit exceeded",
        retryAfter: "1 minute",
      },
    });

    this.rateLimiters.set("general", generalLimiter);
    this.rateLimiters.set("auth", authLimiter);
    this.rateLimiters.set("ai", aiLimiter);

    // Apply general rate limiting
    this.app.use(generalLimiter);

    console.log("Rate limiting configured");
  }

  // Setup API routing
  setupRouting() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date(),
        version: this.currentVersion,
        uptime: process.uptime(),
      });
    });

    // API version routing
    this.apiVersions.forEach((version) => {
      const router = express.Router();
      this.setupVersionedRoutes(router, version);
      this.app.use(`/api/${version}`, router);
    });

    // Default to current version
    const defaultRouter = express.Router();
    this.setupVersionedRoutes(defaultRouter, this.currentVersion);
    this.app.use("/api", defaultRouter);

    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        path: req.originalUrl,
        method: req.method,
      });
    });

    // Error handler
    this.app.use(this.errorHandler.bind(this));

    console.log("API routing configured");
  }

  // Setup versioned routes
  setupVersionedRoutes(router, version) {
    // Authentication routes
    router.use("/auth", this.rateLimiters.get("auth"));

    // Nursing service routes
    router.use("/nursing/assessments", this.createServiceProxy("assessments"));
    router.use("/nursing/soap", this.createServiceProxy("soap"));
    router.use("/nursing/medications", this.createServiceProxy("medications"));
    router.use("/nursing/care-plans", this.createServiceProxy("care-plans"));
    router.use("/nursing/progress", this.createServiceProxy("progress"));
    router.use("/nursing/outcomes", this.createServiceProxy("outcomes"));
    router.use("/nursing/oasis", this.createServiceProxy("oasis"));
    router.use(
      "/nursing/clinical-decisions",
      this.createServiceProxy("clinical-decisions")
    );

    // AI service routes
    router.use("/ai", this.rateLimiters.get("ai"));
    router.use("/ai/clinical", this.createServiceProxy("clinical-ai"));
    router.use("/ai/nursing", this.createServiceProxy("nursing-ai"));

    // Real-time routes
    router.use("/realtime", this.createServiceProxy("realtime"));

    console.log(`Versioned routes configured for ${version}`);
  }

  // Create service proxy middleware
  createServiceProxy(serviceName) {
    return (req, res, next) => {
      // Add service context
      req.serviceContext = {
        serviceName,
        version: req.params.version || this.currentVersion,
        requestId: req.requestId,
        userId: req.user?.id,
        userRole: req.user?.role,
      };

      // Check permissions
      if (!this.checkServicePermissions(req, serviceName)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          service: serviceName,
          requiredRole: this.getRequiredRole(serviceName),
        });
      }

      // Add service-specific middleware
      this.applyServiceMiddleware(req, res, next, serviceName);
    };
  }

  // Check service permissions
  checkServicePermissions(req, serviceName) {
    if (!req.user) {
      return false;
    }

    const servicePermissions = {
      assessments: ["nurse", "doctor", "therapist", "admin"],
      soap: ["nurse", "doctor", "admin"],
      medications: ["nurse", "doctor", "admin"],
      "care-plans": ["nurse", "doctor", "therapist", "admin"],
      progress: ["nurse", "doctor", "therapist", "admin"],
      outcomes: ["nurse", "doctor", "admin"],
      oasis: ["nurse", "admin"],
      "clinical-decisions": ["doctor", "admin"],
      "clinical-ai": ["nurse", "doctor", "admin"],
      "nursing-ai": ["nurse", "admin"],
      realtime: ["nurse", "doctor", "therapist", "admin"],
    };

    const allowedRoles = servicePermissions[serviceName] || [];
    return allowedRoles.includes(req.user.role);
  }

  // Get required role for service
  getRequiredRole(serviceName) {
    const roleMap = {
      assessments: "nurse",
      soap: "nurse",
      medications: "nurse",
      "care-plans": "nurse",
      progress: "nurse",
      outcomes: "nurse",
      oasis: "nurse",
      "clinical-decisions": "doctor",
      "clinical-ai": "nurse",
      "nursing-ai": "nurse",
      realtime: "nurse",
    };
    return roleMap[serviceName] || "nurse";
  }

  // Apply service-specific middleware
  applyServiceMiddleware(req, res, next, serviceName) {
    // Add service-specific headers
    res.set("X-Service", serviceName);
    res.set("X-API-Version", req.serviceContext.version);
    res.set("X-Request-ID", req.requestId);

    // Service-specific validation
    switch (serviceName) {
      case "medications":
        this.validateMedicationRequest(req, res, next);
        break;
      case "clinical-ai":
      case "nursing-ai":
        this.validateAIRequest(req, res, next);
        break;
      default:
        next();
    }
  }

  // Validate medication requests
  validateMedicationRequest(req, res, next) {
    if (req.method === "POST" || req.method === "PUT") {
      const { patientId, medicationId } = req.body;
      if (!patientId || !medicationId) {
        return res.status(400).json({
          error: "Patient ID and Medication ID are required",
          service: "medications",
        });
      }
    }
    next();
  }

  // Validate AI requests
  validateAIRequest(req, res, next) {
    // Check AI quota
    const userQuota = req.user?.aiQuota || 0;
    if (userQuota <= 0) {
      return res.status(429).json({
        error: "AI quota exceeded",
        service: "ai",
        quota: userQuota,
      });
    }
    next();
  }

  // Request logging middleware
  requestLogger(req, res, next) {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        userId: req.user?.id,
        requestId: req.requestId,
      };

      // Log to security service for audit trail
      SecurityComplianceService.logSecurityEvent("api_request", logData);

      console.log(
        `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
      );
    });

    next();
  }

  // Request tracking middleware
  requestTracker(req, res, next) {
    // Generate unique request ID
    req.requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Add request metadata
    req.requestMetadata = {
      startTime: Date.now(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      origin: req.get("Origin"),
    };

    next();
  }

  // Authentication middleware
  authenticationMiddleware(req, res, next) {
    // Skip authentication for health check and public endpoints
    const publicEndpoints = [
      "/health",
      "/api/auth/login",
      "/api/auth/register",
    ];
    if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
      return next();
    }

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        message: "No token provided",
      });
    }

    try {
      const decoded = SecurityComplianceService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      SecurityComplianceService.logSecurityEvent("authentication_failed", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        error: error.message,
      });

      res.status(401).json({
        error: "Authentication failed",
        message: "Invalid or expired token",
      });
    }
  }

  // Error handler middleware
  errorHandler(error, req, res, next) {
    const errorId = `err_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Log error
    SecurityComplianceService.logSecurityEvent("api_error", {
      errorId,
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      requestId: req.requestId,
    });

    // Determine error type and response
    let statusCode = 500;
    let message = "Internal server error";

    if (error.name === "ValidationError") {
      statusCode = 400;
      message = "Validation error";
    } else if (error.name === "UnauthorizedError") {
      statusCode = 401;
      message = "Unauthorized";
    } else if (error.name === "ForbiddenError") {
      statusCode = 403;
      message = "Forbidden";
    } else if (error.name === "NotFoundError") {
      statusCode = 404;
      message = "Not found";
    }

    res.status(statusCode).json({
      error: message,
      errorId,
      timestamp: new Date(),
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
        stack: error.stack,
      }),
    });
  }

  // Register custom route
  registerRoute(method, path, handler, options = {}) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.routes.set(routeKey, {
      handler,
      options,
      registeredAt: new Date(),
    });

    // Apply route to express app
    this.app[method.toLowerCase()](path, handler);

    console.log(`Registered route: ${routeKey}`);
  }

  // Add custom middleware
  addMiddleware(middleware, options = {}) {
    this.middleware.push({
      middleware,
      options,
      addedAt: new Date(),
    });

    if (options.global !== false) {
      this.app.use(middleware);
    }

    console.log("Added custom middleware");
  }

  // Get API statistics
  getAPIStats() {
    return {
      registeredRoutes: this.routes.size,
      customMiddleware: this.middleware.length,
      supportedVersions: this.apiVersions,
      currentVersion: this.currentVersion,
      rateLimiters: Array.from(this.rateLimiters.keys()),
      uptime: process.uptime(),
    };
  }

  // Get rate limit status
  getRateLimitStatus(req) {
    const limiter = this.rateLimiters.get("general");
    return {
      limit: limiter.max,
      remaining: req.rateLimit?.remaining || 0,
      resetTime: req.rateLimit?.resetTime || 0,
      windowMs: limiter.windowMs,
    };
  }

  // Start the API gateway
  start(port = process.env.PORT || 3001) {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(port, () => {
          console.log(`API Gateway started on port ${port}`);
          console.log(`Supported API versions: ${this.apiVersions.join(", ")}`);
          console.log(`Current API version: ${this.currentVersion}`);
          resolve(server);
        });

        server.on("error", (error) => {
          console.error("API Gateway startup error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Graceful shutdown
  shutdown() {
    console.log("Shutting down API Gateway...");
    // Close connections, cleanup resources
    return Promise.resolve();
  }
}

export default new APIGatewayService();
