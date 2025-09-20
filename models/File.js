import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalname: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for legacy compatibility
    ref: "User",
    required: false, // Make optional to handle legacy files
    default: null,
  },
  patientName: {
    type: String,
    default: null,
  },
  patientId: {
    type: String,
    default: null,
  },
  processingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  processingStarted: {
    type: Date,
    default: null,
  },
  processingCompleted: {
    type: Date,
    default: null,
  },
  processingError: {
    type: String,
    default: null,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  autoAnalyzeEnabled: {
    type: Boolean,
    default: true,
  },
  // Add fields for storing extracted content
  extractedText: {
    type: String,
    default: null,
  },
  contentLength: {
    type: Number,
    default: 0,
  },
  // AI analysis results
  aiSummary: {
    type: Object,
    default: null,
  },
  clinicalInsights: {
    type: Array,
    default: [],
  },
  extractedEntities: {
    type: Object,
    default: {},
  },
  oasisScores: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map(),
  },
  soapNote: {
    type: Object,
    default: null,
  },
  careGoals: {
    type: Array,
    default: [],
  },
  interventions: {
    type: Array,
    default: [],
  },
  riskFactors: {
    type: Array,
    default: [],
  },
  providerCommunication: {
    type: Array,
    default: [],
  },
  skilledNeedJustification: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and Object
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const File = mongoose.model("File", fileSchema);

export default File;
