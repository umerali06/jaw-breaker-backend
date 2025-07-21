import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
  process.exit(1);
}

console.log("Testing Gemini API connection...");
console.log(`API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);

// Create Gemini client
const genAI = new GoogleGenerativeAI(apiKey);

// Test function
async function testGeminiConnection() {
  try {
    console.log("Testing gemini-1.5-flash model...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      "Hello, respond with 'OK' if you can read this."
    );
    const response = result.response;
    const text = response.text();

    console.log("Gemini response:", text);

    if (text.toLowerCase().includes("ok")) {
      console.log("✅ Connection successful!");
      return true;
    } else {
      console.warn(
        "⚠️ Unexpected response from Gemini API. Expected 'OK' but got:",
        text
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Gemini connection test failed:", error.message);
    if (error.message.includes("API key")) {
      console.error(
        "The API key appears to be invalid or has insufficient permissions."
      );
    }
    if (error.message.includes("quota")) {
      console.error("You may have exceeded your API quota or rate limits.");
    }
    return false;
  }
}

// Run the test
testGeminiConnection()
  .then((success) => {
    if (success) {
      console.log(
        "All tests passed. Your Gemini API configuration is working correctly."
      );
    } else {
      console.log("Tests failed. Please check your API key and configuration.");
    }
  })
  .catch((err) => {
    console.error("Error running tests:", err);
  });
