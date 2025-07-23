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
        // Estimate progress based on time elapsed
        const startTime = file.processingStarted
          ? new Date(file.processingStarted)
          : new Date();
        const currentTime = new Date();
        const elapsedTime = (currentTime - startTime) / 1000; // in seconds

        // Assume analysis takes about 30 seconds on average
        progress = Math.min(Math.round((elapsedTime / 30) * 100), 95);
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

    res.status(200).json({
      success: true,
      status,
      progress,
      error: file.processingError || null,
      result:
        status === "completed"
          ? {
              summary: file.aiSummary,
              oasisScores: file.oasisScores,
              soapNote: file.soapNote,
              clinicalInsights: file.clinicalInsights,
            }
          : null,
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
