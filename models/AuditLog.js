import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  actorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  action: { 
    type: String, 
    required: true 
  },
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Patient" 
  },
  metadata: { 
    type: Object 
  }
}, { 
  timestamps: { 
    createdAt: "timestamp", 
    updatedAt: false 
  } 
});

AuditLogSchema.index({ timestamp: -1 });

export default mongoose.model('AuditLog', AuditLogSchema);
