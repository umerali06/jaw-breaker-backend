import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: [
      {
        id: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["user", "ai"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        contextInfo: {
          hasDocumentContent: {
            type: Boolean,
            default: false,
          },
          focusedDocument: {
            type: String,
            default: null,
          },
          insightsIncluded: {
            type: Number,
            default: 0,
          },
          hasOasisScores: {
            type: Boolean,
            default: false,
          },
          hasSoapNote: {
            type: Boolean,
            default: false,
          },
        },
        contextNote: {
          type: String,
          default: null,
        },
        isError: {
          type: Boolean,
          default: false,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    context: {
      patientName: {
        type: String,
        required: true,
      },
      documents: [
        {
          type: String,
        },
      ],
      latestSummary: {
        type: String,
        default: null,
      },
      documentContext: {
        fileId: {
          type: String,
          default: null,
        },
        filename: {
          type: String,
          default: null,
        },
        type: {
          type: String,
          default: null,
        },
        date: {
          type: Date,
          default: null,
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
chatSessionSchema.index({ sessionId: 1 });
chatSessionSchema.index({ patientId: 1, isActive: 1, lastActivity: -1 });
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ isActive: 1, lastActivity: -1 });

// Virtual for message count
chatSessionSchema.virtual("messageCount").get(function () {
  return this.messages.length;
});

// Virtual for session duration
chatSessionSchema.virtual("sessionDuration").get(function () {
  return this.lastActivity.getTime() - this.createdAt.getTime();
});

// Instance method to add message
chatSessionSchema.methods.addMessage = function (messageData) {
  const message = {
    id: new mongoose.Types.ObjectId().toString(),
    type: messageData.type,
    content: messageData.content,
    timestamp: new Date(),
    contextInfo: messageData.contextInfo || {},
    contextNote: messageData.contextNote || null,
    isError: messageData.isError || false,
    metadata: messageData.metadata || {},
  };

  this.messages.push(message);
  this.lastActivity = new Date();
  return message;
};

// Instance method to update context
chatSessionSchema.methods.updateContext = function (contextData) {
  this.context = { ...this.context, ...contextData };
  this.lastActivity = new Date();
};

// Instance method to get recent messages
chatSessionSchema.methods.getRecentMessages = function (limit = 10) {
  return this.messages.slice(-limit).map((msg) => ({
    id: msg.id,
    type: msg.type,
    content: msg.content,
    timestamp: msg.timestamp,
    contextInfo: msg.contextInfo,
  }));
};

// Static method to find active session for patient
chatSessionSchema.statics.findActiveSession = function (patientId, userId) {
  return this.findOne({
    patientId,
    userId,
    isActive: true,
  }).sort({ lastActivity: -1 });
};

// Static method to create new session
chatSessionSchema.statics.createSession = function (sessionData) {
  const sessionId = new mongoose.Types.ObjectId().toString();
  return this.create({
    sessionId,
    patientId: sessionData.patientId,
    userId: sessionData.userId,
    context: {
      patientName: sessionData.patientName,
      documents: sessionData.documents || [],
      latestSummary: sessionData.latestSummary || null,
      documentContext: sessionData.documentContext || {},
    },
    messages: [],
  });
};

// Static method to get conversation history for patient
chatSessionSchema.statics.getConversationHistory = function (
  patientId,
  userId,
  limit = 5
) {
  return this.find({
    patientId,
    userId,
  })
    .sort({ lastActivity: -1 })
    .limit(limit)
    .select(
      "sessionId context messages.type messages.content messages.timestamp createdAt lastActivity"
    );
};

// Pre-save middleware to update lastActivity
chatSessionSchema.pre("save", function (next) {
  if (this.isModified("messages")) {
    this.lastActivity = new Date();
  }
  next();
});

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
export default ChatSession;
