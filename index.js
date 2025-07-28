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

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/patients", patientsRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// MongoDB connection with improved error handling
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/jawbreaker";
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

// Connect to MongoDB
connectDB();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
