import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log(
  "Testing Gemini API with key:",
  apiKey ? apiKey.substring(0, 10) + "..." : "NOT SET"
);

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
  process.exit(1);
}

async function testGeminiAPI() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("Testing simple prompt...");
    const result = await model.generateContent(
      "Hello, can you respond with a simple JSON object containing a greeting?"
    );
    const response = await result.response;
    const text = response.text();

    console.log("✅ Gemini API is working!");
    console.log("Response:", text);

    // Test with a more complex medical prompt
    console.log("\nTesting medical analysis prompt...");
    const medicalPrompt = `Analyze this simple medical text and return JSON with summary and insights:
    
    "Patient reports mild headache and fatigue. Vital signs stable. Blood pressure 120/80."
    
    Return JSON format:
    {
      "summary": "brief summary here",
      "insights": ["insight 1", "insight 2"]
    }`;

    const medicalResult = await model.generateContent(medicalPrompt);
    const medicalResponse = await medicalResult.response;
    const medicalText = medicalResponse.text();

    console.log("✅ Medical analysis test successful!");
    console.log("Medical Response:", medicalText);
  } catch (error) {
    console.error("❌ Gemini API test failed:");
    console.error("Error:", error.message);
    console.error("Full error:", error);

    if (error.message.includes("API_KEY_INVALID")) {
      console.error(
        "🔑 The API key appears to be invalid. Please check your GEMINI_API_KEY."
      );
    } else if (error.message.includes("quota")) {
      console.error(
        "📊 API quota exceeded. Please check your Google AI Studio quota."
      );
    } else if (error.message.includes("PERMISSION_DENIED")) {
      console.error(
        "🚫 Permission denied. Please check your API key permissions."
      );
    }
  }
}

testGeminiAPI();
