import dotenv from "dotenv";
import mongoose from "mongoose";
import AuthService from "./services/authService.js";
import emailService from "./services/emailService.js";

// Load environment variables
dotenv.config();

async function testPasswordReset() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Test email service initialization
    console.log("\n🧪 Testing email service initialization...");
    const emailConnected = await emailService.verifyConnection();
    console.log(
      "Email service status:",
      emailConnected ? "✅ Connected" : "❌ Not connected"
    );

    // Test email sending
    if (emailConnected) {
      console.log("\n🧪 Testing email sending...");
      const emailTest = await emailService.testEmailSending("test@example.com");
      if (emailTest.success) {
        console.log("✅ Test email sent successfully");
        if (emailTest.previewUrl) {
          console.log("📧 Preview URL:", emailTest.previewUrl);
        }
      } else {
        console.log("❌ Test email failed:", emailTest.error);
      }
    }

    // Test email (replace with a real email for testing)
    const testEmail = "test@example.com";

    console.log("\n🧪 Testing password reset functionality...");
    console.log("Test email:", testEmail);

    // Request password reset
    const resetResult = await AuthService.requestPasswordReset(testEmail);

    if (resetResult.success) {
      console.log("✅ Password reset request successful");
      console.log("Message:", resetResult.message);

      if (resetResult.resetToken) {
        console.log("Reset token:", resetResult.resetToken);

        // Test password reset with the token
        console.log("\n🧪 Testing password reset with token...");
        const newPassword = "newpassword123";

        const passwordResetResult = await AuthService.resetPassword(
          resetResult.resetToken,
          newPassword
        );

        if (passwordResetResult.success) {
          console.log("✅ Password reset successful");
          console.log("Message:", passwordResetResult.message);
        } else {
          console.log("❌ Password reset failed:", passwordResetResult.error);
        }
      }
    } else {
      console.log("❌ Password reset request failed:", resetResult.error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run the test
testPasswordReset();
