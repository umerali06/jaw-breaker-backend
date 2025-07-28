import mongoose from "mongoose";

const visitRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
    },
    visitDate: {
      type: Date,
      required: true,
    },
    visitType: {
      type: String,
      enum: ["initial", "routine", "discharge", "emergency"],
      required: true,
    },
    clinicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clinicianName: {
      type: String,
      required: true,
    },
    discipline: {
      type: String,
      enum: ["nursing", "pt", "ot", "st", "social_work"],
      required: true,
    },
    visitDuration: {
      type: Number, // in minutes
      required: true,
    },
    visitNotes: {
      type: String,
      required: true,
    },
    vitalSigns: {
      bloodPressure: String,
      heartRate: Number,
      respiratoryRate: Number,
      temperature: Number,
      oxygenSaturation: Number,
      painScore: Number,
      weight: Number,
    },
    assessmentFindings: {
      cardiovascular: String,
      pulmonary: String,
      neurological: String,
      integumentary: String,
      musculoskeletal: String,
      gastrointestinal: String,
      genitourinary: String,
    },
    functionalAssessment: {
      mobility: String,
      adlStatus: String,
      safetyAwareness: String,
      fallRisk: String,
    },
    interventionsProvided: [
      {
        type: String,
      },
    ],
    patientEducation: [
      {
        type: String,
      },
    ],
    medicationReview: {
      compliance: String,
      sideEffects: String,
      changes: [
        {
          type: String,
        },
      ],
    },
    nextVisitPlan: {
      type: String,
      required: true,
    },
    providerCommunications: [
      {
        type: String,
      },
    ],
    documentsGenerated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
visitRecordSchema.index({ patientId: 1, visitDate: -1 });
visitRecordSchema.index({ clinicianId: 1, visitDate: -1 });
visitRecordSchema.index({ visitType: 1 });
visitRecordSchema.index({ discipline: 1 });

// Virtual for visit summary
visitRecordSchema.virtual("visitSummary").get(function () {
  return {
    id: this._id,
    visitDate: this.visitDate,
    visitType: this.visitType,
    clinicianName: this.clinicianName,
    discipline: this.discipline,
    duration: this.visitDuration,
    summary: this.visitNotes.substring(0, 100) + "...",
  };
});

// Static method to get visit history for patient
visitRecordSchema.statics.getPatientHistory = function (patientId, limit = 10) {
  return this.find({ patientId })
    .sort({ visitDate: -1 })
    .limit(limit)
    .populate("clinicianId", "name email")
    .populate("documentsGenerated", "filename originalname createdAt");
};

// Static method to get visits by discipline
visitRecordSchema.statics.getVisitsByDiscipline = function (
  patientId,
  discipline
) {
  return this.find({ patientId, discipline })
    .sort({ visitDate: -1 })
    .populate("clinicianId", "name email");
};

const VisitRecord = mongoose.model("VisitRecord", visitRecordSchema);
export default VisitRecord;
