import mongoose from 'mongoose';

const riskAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['critical', 'high', 'medium', 'low']
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  riskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Risk',
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  readBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  metadata: {
    riskScore: Number,
    category: String,
    severity: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
riskAlertSchema.index({ isRead: 1, createdAt: -1 });
riskAlertSchema.index({ type: 1, priority: 1 });
riskAlertSchema.index({ riskId: 1 });

export default mongoose.model('RiskAlert', riskAlertSchema);


