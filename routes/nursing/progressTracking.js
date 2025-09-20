import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import EnhancedProgressTrackingService from "../../services/nursing/EnhancedProgressTrackingService.js";

const router = express.Router();
const enhancedProgressService = new EnhancedProgressTrackingService();

// Enhanced Progress Tracking Routes
router.use(authenticateToken);

/**
 * GET /api/nursing/progress-tracking/enhanced-analysis/:patientId
 * Generate comprehensive progress analysis using advanced AI techniques
 */
router.get("/enhanced-analysis/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { timeframe = "30d" } = req.query;
    const userId = req.user.id;

    console.log(`Enhanced Progress Tracking: Generating analysis for patient ${patientId} by user ${userId}`);

    // Validate patient access
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required"
      });
    }

    // Generate enhanced progress analysis
    const analysis = await enhancedProgressService.generateEnhancedProgressAnalysis(
      patientId,
      timeframe
    );

    res.json(analysis);

  } catch (error) {
    console.error("Enhanced Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate enhanced progress analysis",
      error: error.message
    });
  }
});

/**
 * GET /api/nursing/progress-tracking/patient/:patientId
 * Get patient progress tracking data
 */
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { timeframe = "30d" } = req.query;
    const userId = req.user.id;

    console.log(`Progress Tracking: Getting data for patient ${patientId} by user ${userId}`);

    // Get patient progress data
    const progressData = await enhancedProgressService.getPatientProgressData(
      patientId,
      timeframe
    );

    res.json({
      success: true,
      data: progressData,
      message: "Patient progress data retrieved successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient progress data",
      error: error.message
    });
  }
});

/**
 * GET /api/nursing/progress-tracking/documents/:patientId
 * Get patient documents for progress tracking context
 */
router.get("/documents/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.id;

    console.log(`Progress Tracking: Getting documents for patient ${patientId} by user ${userId}`);

    // Get patient documents
    const documents = await enhancedProgressService.getPatientDocuments(patientId);

    res.json({
      success: true,
      documents: documents,
      count: documents.length,
      message: `Found ${documents.length} documents for patient ${patientId}`
    });

  } catch (error) {
    console.error("Progress Tracking Documents API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient documents",
      error: error.message
    });
  }
});

/**
 * POST /api/nursing/progress-tracking/entry
 * Create a new progress tracking entry
 */
router.post("/entry", async (req, res) => {
  try {
    const progressData = req.body;
    const userId = req.user.id;

    console.log(`Progress Tracking: Creating entry for patient ${progressData.patientId} by user ${userId}`);

    // Validate required fields
    if (!progressData.patientId || !progressData.assessmentDate) {
      return res.status(400).json({
        success: false,
        message: "Patient ID and assessment date are required"
      });
    }

    // Add user ID to the entry
    progressData.userId = userId;
    progressData.recordedBy = userId;

    // Create progress entry
    const newEntry = await enhancedProgressService.createProgressEntry(progressData);

    res.status(201).json({
      success: true,
      data: newEntry,
      message: "Progress entry created successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create progress entry",
      error: error.message
    });
  }
});

/**
 * PUT /api/nursing/progress-tracking/entry/:entryId
 * Update an existing progress tracking entry
 */
router.put("/entry/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    console.log(`Progress Tracking: Updating entry ${entryId} by user ${userId}`);

    // Update progress entry
    const updatedEntry = await enhancedProgressService.updateProgressEntry(
      entryId,
      updateData,
      userId
    );

    res.json({
      success: true,
      data: updatedEntry,
      message: "Progress entry updated successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update progress entry",
      error: error.message
    });
  }
});

/**
 * DELETE /api/nursing/progress-tracking/entry/:entryId
 * Delete a progress tracking entry
 */
router.delete("/entry/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const userId = req.user.id;

    console.log(`Progress Tracking: Deleting entry ${entryId} by user ${userId}`);

    // Delete progress entry
    await enhancedProgressService.deleteProgressEntry(entryId, userId);

    res.json({
      success: true,
      message: "Progress entry deleted successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete progress entry",
      error: error.message
    });
  }
});

/**
 * GET /api/nursing/progress-tracking/analytics/:patientId
 * Get progress analytics and insights
 */
router.get("/analytics/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { timeframe = "30d" } = req.query;
    const userId = req.user.id;

    console.log(`Progress Tracking: Getting analytics for patient ${patientId} by user ${userId}`);

    // Get progress analytics
    const analytics = await enhancedProgressService.generateProgressAnalytics(
      patientId,
      timeframe
    );

    res.json({
      success: true,
      data: analytics,
      message: "Progress analytics retrieved successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve progress analytics",
      error: error.message
    });
  }
});

/**
 * GET /api/nursing/progress-tracking/goals/:patientId
 * Get patient progress goals and milestones
 */
router.get("/goals/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.id;

    console.log(`Progress Tracking: Getting goals for patient ${patientId} by user ${userId}`);

    // Get patient goals
    const goals = await enhancedProgressService.getPatientGoals(patientId);

    res.json({
      success: true,
      data: goals,
      message: "Patient goals retrieved successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient goals",
      error: error.message
    });
  }
});

/**
 * POST /api/nursing/progress-tracking/goals/:patientId
 * Create or update patient progress goals
 */
router.post("/goals/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const goalsData = req.body;
    const userId = req.user.id;

    console.log(`Progress Tracking: Creating/updating goals for patient ${patientId} by user ${userId}`);

    // Create or update goals
    const goals = await enhancedProgressService.createOrUpdateGoals(
      patientId,
      goalsData,
      userId
    );

    res.json({
      success: true,
      data: goals,
      message: "Patient goals updated successfully"
    });

  } catch (error) {
    console.error("Progress Tracking API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update patient goals",
      error: error.message
    });
  }
});

export default router;
