import Patient from "../models/Patient.js";
import File from "../models/File.js";
import PatientDataService from "../services/patientDataService.js";

// Create a new patient (authenticated)
export const createPatient = async (req, res) => {
  try {
    // Validate required fields
    const { name, age, gender, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Patient name is required",
      });
    }

    if (!age || isNaN(Number(age)) || Number(age) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid age is required",
      });
    }

    if (!gender) {
      return res.status(400).json({
        success: false,
        message: "Gender is required",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Map old field structure to new schema structure
    const patientData = {
      mrn: req.body.mrn || `MRN${Date.now()}`, // Generate MRN if not provided
      demographics: {
        name: req.body.name,
        dob: req.body.dob || new Date(Date.now() - (req.body.age * 365 * 24 * 60 * 60 * 1000)), // Calculate DOB from age if not provided
        sex: req.body.gender,
        phone: req.body.phone,
        email: req.body.email || null,
      },
      condition: req.body.condition || "stable",
      notes: req.body.notes || "",
      userId: req.userId, // Keep for legacy compatibility
      createdBy: req.userId, // Add for new format
    };

    const patient = new Patient(patientData);

    await patient.save();
    res.status(201).json({ success: true, patient });
  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all patients for the current user (authenticated)
export const getAllPatients = async (req, res) => {
  try {
    console.log("Fetching patients for userId:", req.userId); // Debug log

    const { page = 1, limit = 50, search, condition } = req.query; // Increased default limit
    const skip = (page - 1) * limit;

    // Build query
    let query = { 
      $or: [
        { userId: req.userId }, // Old format
        { createdBy: req.userId }, // New format
      ]
    };

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by condition
    if (condition) {
      query.condition = condition;
    }

    console.log("Query:", query); // Debug log

    // First get patients with basic info
    const patients = await Patient.find(query)
      .populate({
        path: 'documents',
        select: 'filename originalname createdAt processingStatus mimetype analysis extractedText contentLength'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Enhance patients with document counts and diagnosis info
    const enhancedPatients = await Promise.all(
      patients.map(async (patient) => {
        const patientObj = patient.toObject();
        
        // Get document count for this patient
        let documentCount = 0;
        if (patientObj.documents && patientObj.documents.length > 0) {
          documentCount = patientObj.documents.length;
        } else {
          // Fallback: count documents by patientId or patientName
          const docCount = await File.countDocuments({
            $or: [
              { patientId: patientObj._id.toString() },
              { patientName: patientObj.name }
            ],
            $or: [
              { userId: req.userId },
              { userId: req.userId.toString() }
            ]
          });
          documentCount = docCount;
        }

        // Ensure diagnosis fields are properly set
        const enhancedPatient = {
          ...patientObj,
          documents: patientObj.documents || [],
          documentCount: documentCount,
          primaryDiagnosis: patientObj.primaryDiagnosis || patientObj.diagnosis || null,
          secondaryDiagnoses: patientObj.secondaryDiagnoses || [],
          // Ensure we have the diagnosis field for backward compatibility
          diagnosis: patientObj.primaryDiagnosis || patientObj.diagnosis || null
        };

        return enhancedPatient;
      })
    );

    const total = await Patient.countDocuments(query);

    console.log(`Found ${enhancedPatients.length} patients out of ${total} total`); // Debug log

    res.json({
      success: true,
      patients: enhancedPatients,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: enhancedPatients.length,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single patient by ID (authenticated)
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    // Support both old and new user field formats
    const patient = await Patient.findOne({
      _id: id,
      $or: [
        { userId: req.userId }, // Old format
        { createdBy: req.userId }, // New format
      ],
    }).populate({
      path: "documents",
      select:
        "filename originalname createdAt processingStatus mimetype analysis",
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Ensure documents field is always an array
    const patientData = patient.toObject();
    patientData.documents = patientData.documents || [];

    res.json({ success: true, patient: patientData });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a patient (authenticated)
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const patient = await Patient.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({ success: true, patient });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a patient (authenticated)
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      message: "Patient deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient statistics (authenticated)
export const getPatientStats = async (req, res) => {
  try {
    const userId = req.userId;

    // Get total count
    const totalPatients = await Patient.countDocuments({ userId });

    // Get condition breakdown
    const conditionStats = await Patient.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get recent patients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPatients = await Patient.countDocuments({
      userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get gender breakdown
    const genderStats = await Patient.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        total: totalPatients,
        recent: recentPatients,
        conditions: conditionStats,
        genders: genderStats,
      },
    });
  } catch (error) {
    console.error("Error fetching patient stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search patients with medical record number lookup (authenticated)
export const searchPatients = async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        patients: [],
        message: "Query too short",
      });
    }

    // Use direct Patient model search to avoid encryption issues with existing data
    const searchRegex = new RegExp(query.trim(), "i");

    // Search in both old and new patient fields and populate documents
    const patients = await Patient.find({
      $and: [
        {
          $or: [
            { userId: req.userId }, // Old format
            { createdBy: req.userId }, // New format
          ],
        },
        {
          $or: [
            { isActive: { $ne: false } }, // Include records where isActive is not false
            { isActive: { $exists: false } }, // Include records where isActive doesn't exist (legacy)
          ],
        },
        {
          $or: [
            { name: searchRegex },
            { medicalRecordNumber: searchRegex },
            { primaryDiagnosis: searchRegex },
            { condition: searchRegex }, // Legacy field
          ],
        },
      ],
    })
      .populate({
        path: "documents",
        select: "filename originalname createdAt processingStatus mimetype",
      })
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      patients: patients.map((patient) => ({
        id: patient._id,
        name: patient.name,
        medicalRecordNumber: patient.medicalRecordNumber || "N/A",
        primaryDiagnosis:
          patient.primaryDiagnosis || patient.condition || "N/A",
        age: patient.calculatedAge || patient.age || "N/A",
        createdAt: patient.createdAt,
        documents: patient.documents || [], // Include documents in search results
        files: patient.documents || [], // Alias for compatibility
      })),
    });
  } catch (error) {
    console.error("Error searching patients:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient summary for chat context (authenticated)
export const getPatientSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await PatientDataService.getPatientSummaryForChat(
      id,
      req.userId
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error getting patient summary:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get clinical timeline for patient (authenticated)
export const getClinicalTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const timeline = await PatientDataService.getClinicalTimeline(
      id,
      req.userId
    );

    res.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error("Error getting clinical timeline:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get visit history for patient (authenticated)
export const getVisitHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const visits = await PatientDataService.getVisitHistory(
      id,
      req.userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      visits,
    });
  } catch (error) {
    console.error("Error getting visit history:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Associate document with patient (authenticated)
export const associateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    const result = await PatientDataService.addDocumentToPatient(
      id,
      fileId,
      req.userId
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error associating document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient documents (authenticated)
export const getPatientDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await PatientDataService.getPatientDocuments(
      id,
      req.userId
    );

    res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Error getting patient documents:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fix patient document associations (authenticated)
export const fixPatientDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the patient
    const patient = await Patient.findOne({
      _id: id,
      $or: [
        { userId: req.userId }, // Old format
        { createdBy: req.userId }, // New format
      ],
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Find all potential documents for this patient
    const potentialDocuments = [];

    // Method 1: Find by patientId
    const docsByPatientId = await File.find({
      patientId: id,
      $or: [{ userId: req.userId }, { userId: req.userId.toString() }],
    });
    potentialDocuments.push(...docsByPatientId);

    // Method 2: Find by patientName
    const docsByPatientName = await File.find({
      patientName: patient.name,
      $or: [{ userId: req.userId }, { userId: req.userId.toString() }],
    });
    potentialDocuments.push(...docsByPatientName);

    // Remove duplicates
    const uniqueDocuments = potentialDocuments.filter(
      (doc, index, self) =>
        index === self.findIndex((d) => d._id.toString() === doc._id.toString())
    );

    // Check which documents are actually new (not already in patient.documents array)
    const existingDocumentIds = patient.documents.map((id) => id.toString());
    const newDocuments = uniqueDocuments.filter(
      (doc) => !existingDocumentIds.includes(doc._id.toString())
    );

    // Only update if there are new documents to add
    if (newDocuments.length > 0) {
      const newDocumentIds = newDocuments.map((doc) => doc._id);
      patient.documents = [...patient.documents, ...newDocumentIds];
      await patient.save();
      console.log(
        `Added ${newDocuments.length} new documents to patient ${patient.name}`
      );
    }

    // Update each file's patient information (for all documents, not just new ones)
    // This is just metadata cleanup and doesn't count as "fixing" associations
    for (const doc of uniqueDocuments) {
      let fileUpdated = false;

      if (doc.patientId !== id) {
        doc.patientId = id;
        fileUpdated = true;
      }

      if (doc.patientName !== patient.name) {
        doc.patientName = patient.name;
        fileUpdated = true;
      }

      if (fileUpdated) {
        await doc.save();
      }
    }

    // Only count newly associated documents as "fixed"
    const actuallyFixed = newDocuments.length;

    res.json({
      success: true,
      message:
        actuallyFixed > 0
          ? `Fixed ${actuallyFixed} document association${
              actuallyFixed > 1 ? "s" : ""
            }`
          : `All documents already properly associated`,
      documentsFixed: actuallyFixed,
      totalDocuments: uniqueDocuments.length,
      alreadyAssociated: uniqueDocuments.length - actuallyFixed,
      documents: uniqueDocuments.map((doc) => ({
        id: doc._id,
        originalname: doc.originalname,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fixing patient documents:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getPatientStats,
  searchPatients,
  getPatientSummary,
  getClinicalTimeline,
  getVisitHistory,
  associateDocument,
  getPatientDocuments,
  fixPatientDocuments,
};
