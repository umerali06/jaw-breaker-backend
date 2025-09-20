import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  specialty: {
    type: String,
    required: true,
    enum: [
      'General Medicine',
      'Cardiology',
      'Neurology',
      'Oncology',
      'Pediatrics',
      'Psychiatry',
      'Surgery',
      'Emergency Medicine',
      'Family Medicine',
      'Internal Medicine',
      'Obstetrics and Gynecology',
      'Orthopedics',
      'Radiology',
      'Anesthesiology',
      'Dermatology',
      'Endocrinology',
      'Gastroenterology',
      'Hematology',
      'Infectious Disease',
      'Nephrology',
      'Ophthalmology',
      'Otolaryngology',
      'Pulmonology',
      'Rheumatology',
      'Urology'
    ],
    index: true
  },
  subSpecialty: {
    type: String,
    required: false,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  boardCertifications: [{
    board: {
      type: String,
      required: true
    },
    specialty: {
      type: String,
      required: true
    },
    certificationDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  education: [{
    degree: {
      type: String,
      required: true
    },
    institution: {
      type: String,
      required: true
    },
    graduationYear: {
      type: Number,
      required: true
    },
    country: {
      type: String,
      required: false
    }
  }],
  experience: {
    yearsOfPractice: {
      type: Number,
      required: true,
      min: 0
    },
    previousInstitutions: [{
      name: {
        type: String,
        required: true
      },
      position: {
        type: String,
        required: true
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: false
      },
      description: {
        type: String,
        required: false
      }
    }]
  },
  contact: {
    phone: {
      type: String,
      required: false
    },
    emergencyPhone: {
      type: String,
      required: false
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  availability: {
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  languages: [{
    type: String,
    required: false
  }],
  researchInterests: [{
    type: String,
    required: false
  }],
  publications: [{
    title: {
      type: String,
      required: true
    },
    journal: {
      type: String,
      required: false
    },
    year: {
      type: Number,
      required: false
    },
    doi: {
      type: String,
      required: false
    },
    url: {
      type: String,
      required: false
    }
  }],
  awards: [{
    name: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: false
    },
    description: {
      type: String,
      required: false
    }
  }],
  professionalMemberships: [{
    organization: {
      type: String,
      required: true
    },
    membershipType: {
      type: String,
      required: false
    },
    startDate: {
      type: Date,
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  clinicalFocus: {
    primaryConditions: [{
      type: String,
      required: false
    }],
    treatmentApproaches: [{
      type: String,
      required: false
    }],
    patientPopulations: [{
      type: String,
      required: false
    }]
  },
  aiPreferences: {
    enableClinicalDecisionSupport: {
      type: Boolean,
      default: true
    },
    enablePredictiveAnalytics: {
      type: Boolean,
      default: true
    },
    enableVoiceTranscription: {
      type: Boolean,
      default: true
    },
    enableAutoCoding: {
      type: Boolean,
      default: true
    },
    confidenceThreshold: {
      type: Number,
      default: 0.7,
      min: 0.1,
      max: 1.0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date,
    required: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      shareDataForResearch: {
        type: Boolean,
        default: false
      },
      allowAnalytics: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
doctorSchema.index({ specialty: 1, status: 1 });
doctorSchema.index({ licenseNumber: 1 });
doctorSchema.index({ email: 1 });
doctorSchema.index({ lastActive: -1 });

// Virtual for full name
doctorSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for isBoardCertified
doctorSchema.virtual('isBoardCertified').get(function() {
  return this.boardCertifications.some(cert => cert.isActive);
});

// Virtual for activeBoardCertifications
doctorSchema.virtual('activeBoardCertifications').get(function() {
  return this.boardCertifications.filter(cert => cert.isActive);
});

// Pre-save middleware
doctorSchema.pre('save', function(next) {
  // Update lastActive on save
  this.lastActive = new Date();
  
  // Validate license number format
  if (this.licenseNumber && !/^[A-Z]{2}\d{6}$/.test(this.licenseNumber)) {
    // Allow custom formats but log warning
    console.warn(`Warning: License number ${this.licenseNumber} doesn't match standard format`);
  }
  
  next();
});

// Instance methods
doctorSchema.methods.updateAvailability = function(availability) {
  this.availability = { ...this.availability, ...availability };
  return this.save();
};

doctorSchema.methods.addBoardCertification = function(certification) {
  this.boardCertifications.push(certification);
  return this.save();
};

doctorSchema.methods.updateBoardCertification = function(certId, updates) {
  const cert = this.boardCertifications.id(certId);
  if (cert) {
    Object.assign(cert, updates);
    return this.save();
  }
  throw new Error('Board certification not found');
};

doctorSchema.methods.addPublication = function(publication) {
  this.publications.push(publication);
  return this.save();
};

doctorSchema.methods.addAward = function(award) {
  this.awards.push(award);
  return this.save();
};

doctorSchema.methods.addProfessionalMembership = function(membership) {
  this.professionalMemberships.push(membership);
  return this.save();
};

// Static methods
doctorSchema.statics.findBySpecialty = function(specialty, limit = 50) {
  return this.find({ specialty, status: 'active' })
    .select('name specialty subSpecialty experience yearsOfPractice')
    .sort({ experience: -1 })
    .limit(limit);
};

doctorSchema.statics.findAvailableDoctors = function(specialty = null) {
  const query = { 
    status: 'active', 
    'availability.isAvailable': true 
  };
  
  if (specialty) {
    query.specialty = specialty;
  }
  
  return this.find(query)
    .select('name specialty availability contact')
    .sort({ lastActive: -1 });
};

doctorSchema.statics.searchDoctors = function(searchTerm, limit = 50) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { specialty: { $regex: searchTerm, $options: 'i' } },
      { subSpecialty: { $regex: searchTerm, $options: 'i' } }
    ],
    status: 'active'
  })
  .select('name specialty subSpecialty experience')
  .sort({ experience: -1 })
  .limit(limit);
};

doctorSchema.statics.getSpecialtyStats = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$specialty',
        count: { $sum: 1 },
        avgExperience: { $avg: '$experience.yearsOfPractice' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Validation
doctorSchema.path('email').validate(function(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}, 'Invalid email format');

doctorSchema.path('licenseNumber').validate(function(value) {
  return value && value.length >= 6;
}, 'License number must be at least 6 characters long');

export default mongoose.model('Doctor', doctorSchema);
