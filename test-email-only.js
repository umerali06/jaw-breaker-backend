import dotenv from "dotenv";
import emailService from "./services/emailService.js";

// Load environment variables
dotenv.config();

async function testEmailOnly() {
  try {
    console.log("🧪 Testing email service only...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");

    // Wait a bit for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test email service connection
    console.log("\n🔍 Testing email service connection...");
    const connected = await emailService.verifyConnection();
    console.log("Connection status:", connected ? "✅ Connected" : "❌ Failed");

    if (connected) {
      // Test sending an email
      console.log("\n📧 Testing email sending...");
      const result = await emailService.testEmailSending("test@example.com");

      if (result.success) {
        console.log("✅ Email sent successfully!");
        console.log("Message ID:", result.messageId);
        if (result.previewUrl) {
          console.log("📧 Preview URL:", result.previewUrl);
        }
      } else {
        console.log("❌ Email sending failed:", result.error);
      }

      // Test password reset email
      console.log("\n🔐 Testing password reset email...");
      const resetResult = await emailService.sendPasswordResetEmail(
        "test@example.com",
        "test-token-123",
        "Test User"
      );

      if (resetResult.success) {
        console.log("✅ Password reset email sent successfully!");
        if (resetResult.previewUrl) {
          console.log("📧 Preview URL:", resetResult.previewUrl);
        }
      } else {
        console.log("❌ Password reset email failed:", resetResult.error);
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testEmailOnly();
