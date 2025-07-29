import mongoose from "mongoose";
import ChatSession from "./models/ChatSession.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function debugChatSessions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all chat sessions
    const allSessions = await ChatSession.find({}).sort({ createdAt: -1 });
    console.log(`\nFound ${allSessions.length} total chat sessions:`);

    allSessions.forEach((session, index) => {
      console.log(`\n--- Session ${index + 1} ---`);
      console.log(`Session ID: ${session.sessionId}`);
      console.log(`Patient ID: ${session.patientId}`);
      console.log(`User ID: ${session.userId}`);
      console.log(`Patient Name: ${session.context?.patientName || "Unknown"}`);
      console.log(`Is Active: ${session.isActive}`);
      console.log(`Message Count: ${session.messages.length}`);
      console.log(`Created: ${session.createdAt}`);
      console.log(`Last Activity: ${session.lastActivity}`);

      if (session.messages.length > 0) {
        console.log(`\nMessages:`);
        session.messages.forEach((msg, msgIndex) => {
          console.log(
            `  ${msgIndex + 1}. [${msg.type}] ${msg.content.substring(
              0,
              100
            )}...`
          );
          console.log(`     Time: ${msg.timestamp}`);
        });
      }
    });

    // Group by patient
    const sessionsByPatient = {};
    allSessions.forEach((session) => {
      if (!sessionsByPatient[session.patientId]) {
        sessionsByPatient[session.patientId] = [];
      }
      sessionsByPatient[session.patientId].push(session);
    });

    console.log(`\n\n=== SESSIONS BY PATIENT ===`);
    Object.keys(sessionsByPatient).forEach((patientId) => {
      const sessions = sessionsByPatient[patientId];
      console.log(`\nPatient ID: ${patientId}`);
      console.log(
        `Patient Name: ${sessions[0]?.context?.patientName || "Unknown"}`
      );
      console.log(`Total Sessions: ${sessions.length}`);

      sessions.forEach((session, index) => {
        console.log(
          `  Session ${index + 1}: ${
            session.isActive ? "ACTIVE" : "INACTIVE"
          } - ${session.messages.length} messages`
        );
      });

      const activeSessions = sessions.filter((s) => s.isActive);
      console.log(`Active Sessions: ${activeSessions.length}`);

      if (activeSessions.length > 1) {
        console.log(
          `⚠️  WARNING: Multiple active sessions found for patient ${patientId}`
        );
      }
    });

    // Test findActiveSession method
    console.log(`\n\n=== TESTING findActiveSession METHOD ===`);
    const testPatientIds = [...new Set(allSessions.map((s) => s.patientId))];
    const testUserIds = [...new Set(allSessions.map((s) => s.userId))];

    for (const patientId of testPatientIds.slice(0, 3)) {
      // Test first 3 patients
      for (const userId of testUserIds.slice(0, 1)) {
        // Test first user
        console.log(
          `\nTesting findActiveSession for Patient: ${patientId}, User: ${userId}`
        );
        const activeSession = await ChatSession.findActiveSession(
          patientId,
          userId
        );

        if (activeSession) {
          console.log(`✅ Found active session: ${activeSession.sessionId}`);
          console.log(`   Messages: ${activeSession.messages.length}`);
          console.log(`   Last Activity: ${activeSession.lastActivity}`);
        } else {
          console.log(`❌ No active session found`);

          // Check if there are any sessions for this patient/user combo
          const anySessions = await ChatSession.find({ patientId, userId });
          console.log(
            `   Total sessions for this patient/user: ${anySessions.length}`
          );

          if (anySessions.length > 0) {
            console.log(`   Session details:`);
            anySessions.forEach((s, i) => {
              console.log(
                `     ${i + 1}. Active: ${s.isActive}, Messages: ${
                  s.messages.length
                }`
              );
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

debugChatSessions();
