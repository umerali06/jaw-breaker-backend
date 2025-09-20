import mongoose from 'mongoose';

const PatientDocumentSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Patient", 
    index: true, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ["lab","imaging","note","report","other"], 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  source: { 
    type: String, 
    default: "uploaded" 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { timestamps: true });

PatientDocumentSchema.index({ patientId: 1, type: 1, createdAt: -1 });

export default mongoose.model('PatientDocument', PatientDocumentSchema);
