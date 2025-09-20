import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    mrn: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    demographics: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      dob: {
        type: Date,
        required: true,
      },
      sex: {
        type: String,
        required: true,
        enum: ['male', 'female', 'other', 'unknown'],
      },
      phone: {
        type: String,
        required: false,
        trim: true,
      },
      email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
      },
      height: {
        type: Number,
        required: false,
        min: 0,
        max: 300, // cm
      },
      weight: {
        type: Number,
        required: false,
        min: 0,
        max: 1000, // kg
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
    clinicalTimeline: [{
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true
      },
      type: {
        type: String,
        required: true,
        enum: ['assessment', 'medication', 'lab_result', 'radiology', 'note', 'procedure', 'visit', 'discharge', 'referral']
      },
      date: {
        type: Date,
        required: true,
        index: true
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
      },
      summary: {
        type: String,
        required: true,
        trim: true
      }
    }],
    currentMedications: [{
      drugCode: {
        type: String,
        required: true,
        trim: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      dose: {
        type: String,
        required: true,
        trim: true
      },
      route: {
        type: String,
        required: true,
        trim: true
      },
      frequency: {
        type: String,
        required: true,
        trim: true
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: false
      }
    }],
    allergies: [{
      substance: {
        type: String,
        required: true,
        trim: true
      },
      reaction: {
        type: String,
        required: true,
        trim: true
      },
      severity: {
        type: String,
        required: true,
        enum: ['mild', 'moderate', 'severe', 'life_threatening']
      }
    }],
    // Legacy fields for backward compatibility
    name: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    medicalRecordNumber: {
      type: String,
      required: false,
      trim: true,
    },
    primaryDiagnosis: {
      type: String,
      required: false,
      trim: true,
    },
    secondaryDiagnoses: [
      {
        type: String,
        trim: true,
      },
    ],
    conditions: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        status: {
          type: String,
          enum: ['active', 'inactive', 'resolved', 'chronic'],
          default: 'active',
        },
        onsetDate: {
          type: Date,
          required: false,
        },
        severity: {
          type: String,
          enum: ['mild', 'moderate', 'severe'],
          required: false,
        },
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
        required: false,
      },
      relationship: {
        type: String,
        required: false,
      },
      phone: {
        type: String,
        required: false,
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "discharged", "deceased"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
patientSchema.index({ mrn: 1 });
patientSchema.index({ "clinicalTimeline.date": 1 });
patientSchema.index({ createdBy: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ "demographics.name": 1 });

export default mongoose.model("Patient", patientSchema);
