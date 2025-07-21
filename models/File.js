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
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const File = mongoose.model("File", fileSchema);

export default File;
