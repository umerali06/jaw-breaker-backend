import express from "express";
import {
  analyzeFile,
  getAnalysis,
  generateCustomAnalysis,
  chatWithAI,
  testGeminiConnection,
} from "../controllers/aiController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Route to test Gemini API health (public)
router.get("/gemini-health", testGeminiConnection);

// Apply authentication to all AI routes
router.use(authenticateToken);

// Route to analyze a file
router.post("/analyze/:fileId", analyzeFile);

// Route to get analysis results
router.get("/analysis/:fileId", getAnalysis);

// Route to get analysis status
router.get("/analysis/:fileId/status", async (req, res) => {
  try {
    const { fileId } = req.params;
    const File = (await import("../models/File.js")).default;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Verify file belongs to the authenticated user
    if (file.userId && file.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this file",
      });
    }

    let progress = 0;
    let status = file.processingStatus || "pending";

    // Calculate progress based on status
    switch (status) {
      case "pending":
        progress = 0;
        break;
      case "processing":
        // Estimate progress based on time elapsed with more realistic stages
        const startTime = file.processingStarted
          ? new Date(file.processingStarted)
          : new Date();
        const currentTime = new Date();
        const elapsedTime = (currentTime - startTime) / 1000; // in seconds

        // More granular progress estimation:
        // 0-5 seconds: 10-30% (initialization)
        // 5-15 seconds: 30-60% (text extraction and analysis)
        // 15-30 seconds: 60-90% (generating insights)
        // 30+ seconds: 90-95% (finalizing)
        if (elapsedTime < 5) {
          // Initialization phase
          progress = Math.min(10 + (elapsedTime / 5) * 20, 30);
        } else if (elapsedTime < 15) {
          // Text extraction and analysis
          progress = Math.min(30 + ((elapsedTime - 5) / 10) * 30, 60);
        } else if (elapsedTime < 30) {
          // Generating insights
          progress = Math.min(60 + ((elapsedTime - 15) / 15) * 30, 90);
        } else {
          // Finalizing
          progress = 95;
        }

        // Round to nearest integer
        progress = Math.round(progress);

        // Update status with more specific information
        if (elapsedTime < 5) {
          status = "initializing";
        } else if (elapsedTime < 15) {
          status = "extracting";
        } else if (elapsedTime < 30) {
          status = "analyzing";
        } else {
          status = "generating";
        }
        break;
      case "completed":
        progress = 100;
        break;
      case "failed":
        progress = 100;
        break;
      default:
        progress = 0;
    }

    // Convert oasisScores Map to object if it exists
    const oasisScores = file.oasisScores
      ? Object.fromEntries(file.oasisScores)
      : {};

    // Check if we have data but there was a validation error
    // If so, force the status to completed
    if (
      file.aiSummary &&
      status !== "completed" &&
      file.processingError &&
      file.processingError.includes("validation failed")
    ) {
      console.log(
        "Data available despite validation error, forcing status to completed"
      );
      status = "completed";
      progress = 100;
    }

    // Always include the result data regardless of status
    // This ensures the client gets the data even if status is not properly updated
    res.status(200).json({
      success: true,
      status,
      progress,
      error: file.processingError || null,
      result: {
        summary: file.aiSummary,
        oasisScores: oasisScores,
        soapNote: file.soapNote,
        clinicalInsights: file.clinicalInsights || [],
      },
    });
  } catch (error) {
    console.error("Error getting analysis status:", error);
    res.status(500).json({
      success: false,
      message: "Error getting analysis status",
      error: error.message,
    });
  }
});

// Route to generate custom analysis
router.post("/custom/:fileId", generateCustomAnalysis);

// Route to regenerate analysis (force re-analysis)
router.post("/regenerate/:fileId", analyzeFile);

// Route for AI chat functionality
router.post("/chat", chatWithAI);

// Test route to check Gemini AI connectivity
router.get("/test", async (req, res) => {
  try {
    const { chatWithAI: testChat, generateSOAPNote } = await import(
      "../services/geminiService.js"
    );

    // Test basic chat
    const chatResponse = await testChat("Hello, this is a test message");

    // Test SOAP note generation with sample text
    const sampleText =
      "Patient reports feeling better today. Vital signs stable. Blood pressure 120/80, heart rate 72. Patient ambulating independently. Continue current medications.";
    const soapResponse = await generateSOAPNote(sampleText, {
      name: "Test Patient",
    });

    res.json({
      success: true,
      message: "Gemini AI service is working",
      tests: {
        chat: {
          success: true,
          response: chatResponse,
        },
        soap: {
          success: true,
          response: soapResponse,
        },
      },
    });
  } catch (error) {
    console.error("Gemini test error:", error);
    res.status(500).json({
      success: false,
      message: "Gemini AI service error",
      error: error.message,
      stack: error.stack,
    });
  }
});

// Migration route to fix legacy files (temporary - remove in production)
router.post("/migrate-files", async (req, res) => {
  try {
    const File = (await import("../models/File.js")).default;

    // Find all files with legacy userId
    const legacyFiles = await File.find({
      $or: [
        { userId: "anonymous" },
        { userId: { $type: "string" } },
        { userId: null },
        { userId: { $exists: false } },
      ],
    });

    console.log(`Found ${legacyFiles.length} legacy files to migrate`);

    // Update all legacy files to belong to the current user
    const updateResult = await File.updateMany(
      {
        $or: [
          { userId: "anonymous" },
          { userId: { $type: "string" } },
          { userId: null },
          { userId: { $exists: false } },
        ],
      },
      { userId: req.userId }
    );

    res.json({
      success: true,
      message: `Migrated ${updateResult.modifiedCount} files to current user`,
      legacyFilesFound: legacyFiles.length,
      filesUpdated: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message,
    });
  }
});

// Debug route to check files (temporary - remove in production)
router.get("/debug-files", async (req, res) => {
  try {
    const File = (await import("../models/File.js")).default;

    // Get all files with their userId info
    const allFiles = await File.find({})
      .select("_id originalname userId createdAt")
      .limit(10);

    const fileInfo = allFiles.map((file) => ({
      id: file._id,
      name: file.originalname,
      userId: file.userId,
      userIdType: typeof file.userId,
      userIdString: file.userId ? file.userId.toString() : null,
      createdAt: file.createdAt,
      belongsToCurrentUser:
        file.userId && file.userId.toString() === req.userId,
    }));

    res.json({
      success: true,
      currentUserId: req.userId,
      currentUserIdType: typeof req.userId,
      totalFiles: allFiles.length,
      files: fileInfo,
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      success: false,
      message: "Debug failed",
      error: error.message,
    });
  }
});

// Migration route to fix legacy files (temporary - remove in production)
router.post("/migrate-files", async (req, res) => {
  try {
    const File = (await import("../models/File.js")).default;

    // Update all legacy files to belong to the current user
    const updateResult = await File.updateMany(
      {
        $or: [
          { userId: "anonymous" },
          { userId: { $type: "string" } },
          { userId: null },
          { userId: { $exists: false } },
        ],
      },
      { userId: req.userId }
    );

    res.json({
      success: true,
      message: `Migrated ${updateResult.modifiedCount} files to current user`,
      filesUpdated: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message,
    });
  }
});

export default router;
