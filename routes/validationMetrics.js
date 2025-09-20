/**
 * Validation Metrics API Routes
 * Provides endpoints for monitoring validation system health and metrics
 */

import express from "express";
import validationMonitoringService from "../services/ValidationMonitoringService.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/validation-metrics/health
 * Get validation system health status
 */
router.get("/health", authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to access metrics
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const healthStatus = validationMonitoringService.getHealthStatus();

    res.json({
      success: true,
      health: healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting validation health:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get validation health status",
      error: error.message,
    });
  }
});

/**
 * GET /api/validation-metrics/metrics
 * Get comprehensive validation metrics
 */
router.get("/metrics", authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to access metrics
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const metrics = validationMonitoringService.getMetrics();

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting validation metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get validation metrics",
      error: error.message,
    });
  }
});

/**
 * GET /api/validation-metrics/user/:userId
 * Get user-specific validation metrics
 */
router.get("/user/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only access their own metrics, admins can access any
    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own metrics.",
      });
    }

    const userMetrics = validationMonitoringService.getUserMetrics(userId);

    res.json({
      success: true,
      userMetrics,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting user validation metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user validation metrics",
      error: error.message,
    });
  }
});

/**
 * POST /api/validation-metrics/reset
 * Reset validation metrics (admin only)
 */
router.post("/reset", authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to reset metrics
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    validationMonitoringService.resetMetrics();

    res.json({
      success: true,
      message: "Validation metrics have been reset",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error resetting validation metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset validation metrics",
      error: error.message,
    });
  }
});

/**
 * GET /api/validation-metrics/alerts
 * Get current validation alerts
 */
router.get("/alerts", authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to access alerts
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const metrics = validationMonitoringService.getMetrics();

    res.json({
      success: true,
      alerts: metrics.alerts,
      alertCount: metrics.alerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting validation alerts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get validation alerts",
      error: error.message,
    });
  }
});

/**
 * GET /api/validation-metrics/summary
 * Get validation metrics summary (lightweight endpoint)
 */
router.get("/summary", authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to access metrics
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const metrics = validationMonitoringService.getMetrics();
    const healthStatus = validationMonitoringService.getHealthStatus();

    // Return a lightweight summary
    const summary = {
      health: healthStatus.status,
      totalValidations: metrics.validationAttempts,
      totalRepairs: metrics.repairAttempts,
      failureRate: metrics.rates.validationFailureRate,
      repairSuccessRate: metrics.rates.repairSuccessRate,
      averageValidationTime: metrics.performanceMetrics.averageValidationTime,
      activeAlerts: metrics.alerts.length,
      uptime: metrics.uptime,
    };

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting validation summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get validation summary",
      error: error.message,
    });
  }
});

export default router;
