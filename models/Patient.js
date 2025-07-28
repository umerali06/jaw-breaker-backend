import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    dateOfBirth: {
      type: Date,
      required: false, // Make optional for legacy compatibility
    },
    medicalRecordNumber: {
      type: String,
      required: false, // Make optional for legacy compatibility
      trim: true,
    },
    primaryDiagnosis: {
      type: String,
      required: false, // Make optional for legacy compatibility
    },
    secondaryDiagnoses: [
      {
        type: String,
        trim: true,
      },
    ],
    allergies: [
      {
        type: String,
        trim: true,
      },
    ],
    medications: [
      {
        name: {
          type: String,
          required: true,
        },
        dosage: {
          type: String,
          required: true,
        },
        frequency: {
          type: String,
          required: true,
        },
        prescriber: {
          type: String,
          required: true,
        },
      },
    ],
    emergencyContact: {
      name: {
        type: String,
        required: false, // Make optional for legacy compatibility
      },
      relationship: {
        type: String,
        required: false, // Make optional for legacy compatibility
      },
      phone: {
        type: String,
        required: false, // Make optional for legacy compatibility
      },
    },
    insuranceInfo: {
      primary: String,
      secondary: String,
      memberId: String,
    },
    clinicalData: {
      functionalStatus: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      cognitiveStatus: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      riskFactors: [
        {
          type: String,
        },
      ],
      careGoals: [
        {
          type: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
    visits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VisitRecord",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Make optional for legacy compatibility
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Legacy fields for backward compatibility
    age: { type: Number },
    gender: { type: String },
    phone: { type: String },
    condition: { type: String },
    notes: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
patientSchema.index({ medicalRecordNumber: 1 });
patientSchema.index({ createdBy: 1, createdAt: -1 });
patientSchema.index({ name: 1, createdBy: 1 });
patientSchema.index({ isActive: 1 });

// Virtual for age calculation
patientSchema.virtual("calculatedAge").get(function () {
  if (!this.dateOfBirth) return this.age; // Fallback to legacy age field
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
});

// Instance method to get safe patient data (HIPAA compliant)
patientSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    age: this.calculatedAge,
    primaryDiagnosis: this.primaryDiagnosis,
    medicalRecordNumber: this.medicalRecordNumber,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static method to search patients
patientSchema.statics.searchPatients = function (query, userId) {
  const searchRegex = new RegExp(query, "i");
  return this.find({
    $and: [
      { createdBy: userId },
      { isActive: true },
      {
        $or: [
          { name: searchRegex },
          { medicalRecordNumber: searchRegex },
          { primaryDiagnosis: searchRegex },
        ],
      },
    ],
  }).sort({ updatedAt: -1 });
};

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
