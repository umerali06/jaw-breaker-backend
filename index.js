import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// Load environment variables
dotenv.config();

// Set default feature flags if not specified
if (!process.env.FEATURE_AI_ENABLED) process.env.FEATURE_AI_ENABLED = "true";
if (!process.env.FEATURE_AUDIT_ENABLED) process.env.FEATURE_AUDIT_ENABLED = "true";
if (!process.env.FEATURE_HEALTHCHECKS_ENABLED) process.env.FEATURE_HEALTHCHECKS_ENABLED = "true";

// Debug: Check if Google OAuth environment variables are loaded
console.log("Google OAuth Config Check:");
console.log(
  "GOOGLE_CLIENT_ID:",
  process.env.GOOGLE_CLIENT_ID ? "Set" : "Not Set"
);
console.log(
  "GOOGLE_CLIENT_SECRET:",
  process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not Set"
);
console.log("GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL);

// Import passport and initialize it after env vars are loaded
import passport, { initializePassport } from "./config/passport.js";

// Email service will be imported lazily when needed
console.log("📧 Email service will be initialized when first used...");

// Initialize passport configuration
initializePassport();

// Routes
import uploadRoutes from "./routes/upload.js";
import aiRoutes from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import patientsRoutes from "./routes/patients.js";
import billingRoutes from "./routes/billing.js";
import newNursingRoutes from "./nursing/routes/nursingRoutes.js";
import trainingProgressRoutes from "./nursing/routes/trainingProgressRoutes.js";
import dataIntegrationRoutes from "./nursing/routes/dataIntegrationRoutes.js";
import taskManagementRoutes from "./nursing/routes/taskManagementRoutes.js";
import riskManagementRoutes from "./nursing/routes/riskManagementRoutes.js";
import oasisAssessmentRoutes from "./nursing/routes/oasisAssessmentRoutes.js";
import validationMetricsRoutes from "./routes/validationMetrics.js";
import doctorRoutes from "./routes/doctor.js";
import healthRoutes from "./routes/health.js";
import patientCommunicationRoutes from "./routes/patientCommunication.js";

// import WebSocketManager from "./services/nursing/WebSocketManager.js"; // Temporarily disabled
import PatientCommunicationWebSocket from "./services/patientCommunicationWebSocket.js";
import { createServer } from "http";

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize Patient Communication WebSocket
const patientCommWS = new PatientCommunicationWebSocket();
patientCommWS.initialize(server);

// Make WebSocket manager available to routes
app.locals.patientCommWS = patientCommWS;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Get client URL from environment variable or use default origins
const clientUrl = process.env.CLIENT_URL;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://jaw-breaker-06.netlify.app",
  "https://jawbreaker.help",
  "https://www.jawbreaker.help", // Include www version
];

// Add client URL to allowed origins if it's not already included
if (clientUrl && !allowedOrigins.includes(clientUrl)) {
  allowedOrigins.push(clientUrl);
}

// Log CORS configuration
console.log("CORS allowed origins:", allowedOrigins);
console.log("CLIENT_URL from env:", clientUrl);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS blocked origin: ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Increase body parser limits for voice transcription
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware for passport
app.use(
  session({
    secret: process.env.JWT_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use("/uploads", express.static(join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/nursing", newNursingRoutes);
app.use("/api/nursing/training-progress", trainingProgressRoutes);
app.use("/api/nursing/data-integration", dataIntegrationRoutes);
app.use("/api/nursing/task-management", taskManagementRoutes);
app.use("/api/nursing/risk-management", riskManagementRoutes);
app.use("/api/nursing/oasis-assessments", oasisAssessmentRoutes);
app.use("/api/patient-communication", patientCommunicationRoutes);
app.use("/api/validation-metrics", validationMetricsRoutes);

app.use("/api/health", healthRoutes);

// Add a direct health check route as backup
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(error.status || 500).json({
    success: false,
    error: "Internal server error",
    message: isDevelopment ? error.message : "Something went wrong",
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString()
  });
});

// Catch-all handler for non-API routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// MongoDB connection with improved error handling
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/jawbreakers";
    console.log("Attempting to connect to MongoDB...");
    console.log(
      "MongoDB URI:",
      mongoURI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")
    ); // Hide credentials in logs

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);

    // More specific error handling
    if (error.message.includes("ETIMEOUT")) {
      console.error(
        "🔍 DNS/Network timeout - Check your internet connection and MongoDB Atlas IP whitelist"
      );
    } else if (error.message.includes("authentication failed")) {
      console.error(
        "🔍 Authentication failed - Check your MongoDB credentials"
      );
    } else if (error.message.includes("ENOTFOUND")) {
      console.error(
        "🔍 DNS resolution failed - Check your MongoDB cluster URL"
      );
    }

    // Don't exit in development, but log the error
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.log(
        "⚠️  Continuing without MongoDB connection in development mode"
      );
      return false;
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️  Mongoose disconnected from MongoDB");
});

// Start server function
const startServer = async () => {
  try {
    // Try to connect to database
    const dbConnected = await connectDB();
    
    if (dbConnected) {
      console.log("🚀 Starting server with database connection...");
    } else {
      console.log("⚠️  Starting server without database connection (fallback mode)...");
    }

    // Start the server
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`🌐 Health check available at: http://localhost:${PORT}/api/health`);
      console.log(`📊 API endpoints available at: http://localhost:${PORT}/api/`);
      
      if (!dbConnected) {
        console.log("⚠️  Server is running in fallback mode - some features may not work");
        console.log("💡 To enable full functionality, ensure MongoDB is running and accessible");
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error("💡 Try stopping other services or using a different port");
        process.exit(1);
      } else {
        console.error("❌ Server error:", error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Connect to MongoDB
startServer();
