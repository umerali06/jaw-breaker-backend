import dotenv from "dotenv";
import emailService from "./services/emailService.js";

// Load environment variables
dotenv.config();

async function testRealEmail() {
  try {
    console.log("🧪 Testing REAL email sending...");
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_HOST:", process.env.EMAIL_HOST);

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test email service connection
    console.log("\n🔍 Testing email service connection...");
    const connected = await emailService.verifyConnection();
    console.log("Connection status:", connected ? "✅ Connected" : "❌ Failed");

    if (connected) {
      // Test sending a real email
      console.log("\n📧 Sending test email to your Gmail...");
      const result = await emailService.testEmailSending(
        process.env.EMAIL_USER
      );

      if (result.success) {
        console.log("✅ Real email sent successfully!");
        console.log("Message ID:", result.messageId);
        console.log("📬 Check your inbox:", process.env.EMAIL_USER);
      } else {
        console.log("❌ Email sending failed:", result.error);
      }

      // Test password reset email
      console.log("\n🔐 Testing password reset email...");
      const resetResult = await emailService.sendPasswordResetEmail(
        process.env.EMAIL_USER,
        "test-reset-token-123",
        "Test User"
      );

      if (resetResult.success) {
        console.log("✅ Password reset email sent successfully!");
        console.log("📬 Check your inbox for password reset email!");
      } else {
        console.log("❌ Password reset email failed:", resetResult.error);
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testRealEmail();
