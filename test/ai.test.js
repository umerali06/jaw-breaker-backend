import request from "supertest";
import app from "../index.js";
import User from "../models/User.js";
import File from "../models/File.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

describe("AI Controller Tests", () => {
  let authToken;
  let userId;
  let testFileId;

  beforeAll(async () => {
    // Create a test user
    const testUser = new User({
      email: "test@example.com",
      password: "hashedpassword",
      name: "Test User",
    });
    await testUser.save();
    userId = testUser._id;

    // Generate auth token
    authToken = jwt.sign({ userId: userId }, process.env.JWT_SECRET);

    // Create a test file record
    const testFile = new File({
      originalname: "test-document.pdf",
      filename: "test-document-123.pdf",
      path: path.join(__dirname, "data", "05-versions-space.pdf"),
      size: 1024,
      mimetype: "application/pdf",
      userId: userId,
      patientName: "John Doe",
      patientId: "P001",
    });
    await testFile.save();
    testFileId = testFile._id;
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: "test@example.com" });
    await File.deleteMany({ userId: userId });
  });

  describe("POST /api/ai/analyze/:fileId", () => {
    it("should analyze a file successfully", async () => {
      const response = await request(app)
        .post(`/api/ai/analyze/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("File analyzed successfully");
      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.summary).toBeDefined();
    }, 30000); // 30 second timeout for AI processing

    it("should return 404 for non-existent file", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .post(`/api/ai/analyze/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("File not found");
    });

    it("should return 401 without auth token", async () => {
      await request(app).post(`/api/ai/analyze/${testFileId}`).expect(401);
    });
  });

  describe("GET /api/ai/analysis/:fileId", () => {
    it("should get analysis results", async () => {
      // First analyze the file
      await request(app)
        .post(`/api/ai/analyze/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`);

      // Then get the analysis
      const response = await request(app)
        .get(`/api/ai/analysis/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fileId).toBe(testFileId.toString());
      expect(response.body.summary).toBeDefined();
    });

    it("should return 404 for file without analysis", async () => {
      // Create a new file without analysis
      const newFile = new File({
        originalname: "unanalyzed.pdf",
        filename: "unanalyzed-123.pdf",
        path: "/fake/path",
        size: 1024,
        mimetype: "application/pdf",
        userId: userId,
      });
      await newFile.save();

      const response = await request(app)
        .get(`/api/ai/analysis/${newFile._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("File has not been analyzed yet");

      // Clean up
      await File.findByIdAndDelete(newFile._id);
    });
  });

  describe("POST /api/ai/custom/:fileId", () => {
    it("should generate SOAP note", async () => {
      const response = await request(app)
        .post(`/api/ai/custom/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "soap",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe("soap");
      expect(response.body.result).toBeDefined();
    }, 30000);

    it("should generate OASIS scores", async () => {
      const response = await request(app)
        .post(`/api/ai/custom/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "oasis",
          items: ["M1830", "M1840"],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe("oasis");
      expect(response.body.result).toBeDefined();
    }, 30000);

    it("should generate custom analysis", async () => {
      const response = await request(app)
        .post(`/api/ai/custom/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "analysis",
          prompt: "Summarize the key clinical findings in this document",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
    }, 30000);

    it("should return 400 for custom analysis without prompt", async () => {
      const response = await request(app)
        .post(`/api/ai/custom/${testFileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "analysis",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Prompt is required for custom analysis"
      );
    });
  });

  describe("POST /api/ai/chat", () => {
    it("should respond to chat message", async () => {
      const response = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          message: "What is OASIS M1830?",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toBeDefined();
      expect(typeof response.body.response).toBe("string");
    }, 30000);

    it("should respond with patient context", async () => {
      const response = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          message: "Generate a care plan for this patient",
          patientId: "P001",
          context: {
            patientName: "John Doe",
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toBeDefined();
      expect(response.body.context.patientId).toBe("P001");
    }, 30000);

    it("should return 400 without message", async () => {
      const response = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Message is required");
    });
  });
});
