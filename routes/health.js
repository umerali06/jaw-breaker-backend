import { Router } from "express";
import mongoose from "mongoose";

const r = Router();

r.get("/", async (req, res) => {
  try {
    // In development mode, always allow health checks
    const isDevelopment = process.env.NODE_ENV === "development";
    const featureEnabled = process.env.FEATURE_HEALTHCHECKS_ENABLED === "true";
    
    if (!isDevelopment && !featureEnabled) {
      return res.status(404).json({ 
        error: "Health checks disabled in production without feature flag" 
      });
    }
    
    res.json({
      ok: true,
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        ollama: !!process.env.OLLAMA_ENDPOINT
      },
      features: {
        ai: process.env.FEATURE_AI_ENABLED === "true",
        audit: process.env.FEATURE_AUDIT_ENABLED === "true",
        healthChecks: featureEnabled
      }
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Health check failed",
      message: error.message 
    });
  }
});

export default r;
