import mongoose from "mongoose";
import ChatSession from "./models/ChatSession.js";
import Patient from "./models/Patient.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testChatSessionCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get a patient to test with
    const patients = await Patient.find({}).limit(1);
    if (patients.length === 0) {
      console.log("No patients found in database");
      return;
    }

    const testPatient = patients[0];
    console.log(
      `Testing with patient: ${testPatient._id} (${testPatient.name})`
    );

    // Test creating a chat session
    console.log("\n=== Testing ChatSession.createSession ===");
    try {
      const newSession = await ChatSession.createSession({
        patientId: testPatient._id.toString(),
        userId: testPatient.createdBy || testPatient.userId,
        patientName: testPatient.name,
        documents: [],
        latestSummary: null,
        documentContext: {},
      });

      console.log("✅ Chat session created successfully:");
      console.log(`   Session ID: ${newSession.sessionId}`);
      console.log(`   Patient ID: ${newSession.patientId}`);
      console.log(`   User ID: ${newSession.userId}`);
      console.log(`   Is Active: ${newSession.isActive}`);
      console.log(`   Messages: ${newSession.messages.length}`);

      // Test adding messages
      console.log("\n=== Testing addMessage ===");
      newSession.addMessage({
        type: "user",
        content: "Hello, this is a test message",
        contextInfo: {},
      });

      newSession.addMessage({
        type: "ai",
        content: "Hello! This is a test AI response",
        contextInfo: {},
      });

      await newSession.save();
      console.log("✅ Messages added and saved successfully");
      console.log(`   Total messages: ${newSession.messages.length}`);

      // Test findActiveSession
      console.log("\n=== Testing findActiveSession ===");
      const foundSession = await ChatSession.findActiveSession(
        testPatient._id.toString(),
        testPatient.createdBy || testPatient.userId
      );

      if (foundSession) {
        console.log("✅ Active session found successfully:");
        console.log(`   Session ID: ${foundSession.sessionId}`);
        console.log(`   Messages: ${foundSession.messages.length}`);
      } else {
        console.log("❌ Active session not found");
      }

      // Clean up - remove test session
      await ChatSession.deleteOne({ _id: newSession._id });
      console.log("🧹 Test session cleaned up");
    } catch (error) {
      console.error("❌ Error creating chat session:", error);
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

testChatSessionCreation();
