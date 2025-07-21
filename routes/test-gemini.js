import express from "express";
import { testConnection } from "../services/geminiService.js";

const router = express.Router();

// Route to test Gemini API connection
router.get("/test-connection", async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      res.status(200).json({
        success: true,
        message: "Gemini API connection successful",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Gemini API connection failed",
      });
    }
  } catch (error) {
    console.error("Error testing Gemini API connection:", error);
    res.status(500).json({
      success: false,
      message: "Error testing Gemini API connection",
      error: error.message,
    });
  }
});

export default router;
