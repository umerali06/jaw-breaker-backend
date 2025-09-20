import mongoose from 'mongoose';

const ClinicalAIOutputSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Patient", 
    index: true, 
    required: true 
  },
  documentIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PatientDocument", 
    index: true 
  }],
  task: { 
    type: String, 
    enum: ["entity_extraction","summarization","differential_diagnosis","treatment_planning","medication_safety","soap_note"], 
    required: true 
  },
  inputContext: { 
    type: Object, 
    required: true 
  },
  output: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  model: { 
    provider: String, 
    name: String, 
    temperature: { 
      type: Number, 
      default: 0.2 
    } 
  },
  version: { 
    type: Number, 
    required: true 
  },
  hallucinationFlags: [{ 
    reason: String, 
    span: String 
  }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { timestamps: true });

ClinicalAIOutputSchema.index({ patientId: 1, task: 1, version: -1 });

ClinicalAIOutputSchema.pre("validate", async function(next) {
  if (this.isNew && (this.version == null)) {
    const latest = await this.constructor.findOne({ 
      patientId: this.patientId, 
      task: this.task 
    }).sort({ version: -1 }).select("version");
    this.version = latest ? latest.version + 1 : 1;
  }
  next();
});

export default mongoose.model('ClinicalAIOutput', ClinicalAIOutputSchema);
