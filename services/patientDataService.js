import Patient from "../models/Patient.js";
import VisitRecord from "../models/VisitRecord.js";
import File from "../models/File.js";
import ClinicalAnalysis from "../models/ClinicalAnalysis.js";
import crypto from "crypto";

class PatientDataService {
  // Encryption key for HIPAA compliance
  static getEncryptionKey() {
    return process.env.PATIENT_ENCRYPTION_KEY || crypto.randomBytes(32);
  }

  // Encrypt sensitive patient data
  static encryptData(text) {
    if (!text) return text;
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher("aes-256-cbc", key);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  // Decrypt sensitive patient data
  static decryptData(encryptedText) {
    if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
    const key = this.getEncryptionKey();
    const textParts = encryptedText.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedData = textParts.join(":");
    const decipher = crypto.createDecipher("aes-256-cbc", key);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Patient Management Methods
  static async createPatient(patientData, userId) {
    try {
      // Encrypt sensitive fields
      const encryptedData = {
        ...patientData,
        name: this.encryptData(patientData.name),
        medicalRecordNumber: patientData.medicalRecordNumber, // Keep searchable
        createdBy: userId,
      };

      const patient = new Patient(encryptedData);
      await patient.save();

      // Return decrypted data for immediate use
      return this.decryptPatientData(patient);
    } catch (error) {
      throw new Error(`Failed to create patient: ${error.message}`);
    }
  }

  static async updatePatient(patientId, updates, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      // Encrypt sensitive updates
      if (updates.name) {
        updates.name = this.encryptData(updates.name);
      }

      Object.assign(patient, updates);
      await patient.save();

      return this.decryptPatientData(patient);
    } catch (error) {
      throw new Error(`Failed to update patient: ${error.message}`);
    }
  }

  static async getPatient(patientId, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      })
        .populate(
          "documents",
          "filename originalname createdAt processingStatus"
        )
        .populate("visits");

      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      return this.decryptPatientData(patient);
    } catch (error) {
      throw new Error(`Failed to get patient: ${error.message}`);
    }
  }

  // Patient Search with Medical Record Number Lookup
  static async searchPatients(query, userId) {
    try {
      const searchRegex = new RegExp(query, "i");

      // Search by medical record number (not encrypted) and other fields
      const patients = await Patient.find({
        $and: [
          {
            $or: [
              { createdBy: userId }, // New format
              { userId: userId }, // Legacy format
            ],
          },
          {
            $or: [
              { isActive: true },
              { isActive: { $exists: false } }, // Legacy records without isActive field
            ],
          },
          {
            $or: [
              { medicalRecordNumber: searchRegex },
              { primaryDiagnosis: searchRegex },
              // For encrypted name, we'll need to decrypt and check
            ],
          },
        ],
      }).sort({ updatedAt: -1 });

      // Decrypt and filter by name if needed
      const decryptedPatients = patients.map((patient) =>
        this.decryptPatientData(patient)
      );

      // Additional filtering for encrypted name field
      const filteredPatients = decryptedPatients.filter((patient) => {
        return (
          patient.name.toLowerCase().includes(query.toLowerCase()) ||
          patient.medicalRecordNumber
            .toLowerCase()
            .includes(query.toLowerCase()) ||
          patient.primaryDiagnosis.toLowerCase().includes(query.toLowerCase())
        );
      });

      return filteredPatients;
    } catch (error) {
      throw new Error(`Failed to search patients: ${error.message}`);
    }
  }

  static async findByMedicalRecordNumber(mrn, userId) {
    try {
      const patient = await Patient.findOne({
        $and: [
          { medicalRecordNumber: mrn },
          {
            $or: [
              { createdBy: userId }, // New format
              { userId: userId }, // Legacy format
            ],
          },
          {
            $or: [
              { isActive: true },
              { isActive: { $exists: false } }, // Legacy records
            ],
          },
        ],
      });

      if (!patient) {
        return null;
      }

      return this.decryptPatientData(patient);
    } catch (error) {
      throw new Error(`Failed to find patient by MRN: ${error.message}`);
    }
  }

  // Document Association Methods
  static async addDocumentToPatient(patientId, fileId, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      const file = await File.findOne({
        _id: fileId,
        $or: [
          { userId: userId },
          { userId: userId.toString() }, // Handle string vs ObjectId
        ],
      });
      if (!file) {
        throw new Error("File not found or access denied");
      }

      // Add document to patient's documents array
      if (!patient.documents.includes(fileId)) {
        patient.documents.push(fileId);
        await patient.save();
        console.log(
          `Added document ${file.originalname} to patient ${patient.name}`
        );
      }

      // Update file with patient information
      file.patientId = patientId.toString();
      file.patientName = this.decryptData(patient.name);
      await file.save();

      return { success: true, message: "Document associated with patient" };
    } catch (error) {
      throw new Error(`Failed to associate document: ${error.message}`);
    }
  }

  static async getPatientDocuments(patientId, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      // Try multiple approaches to find documents
      let documents = [];

      // Method 1: Find by documents array (preferred method)
      if (patient.documents && patient.documents.length > 0) {
        const documentsFromArray = await File.find({
          _id: { $in: patient.documents },
          $or: [
            { userId: userId },
            { userId: userId.toString() }, // Handle string vs ObjectId
          ],
        }).sort({ createdAt: -1 });
        documents = documents.concat(documentsFromArray);
      }

      // Method 2: Find by patientId field (fallback)
      const documentsByPatientId = await File.find({
        patientId: patientId.toString(),
        $or: [
          { userId: userId },
          { userId: userId.toString() }, // Handle string vs ObjectId
        ],
      }).sort({ createdAt: -1 });

      // Method 3: Find by patientName (additional fallback)
      const documentsByPatientName = await File.find({
        patientName: patient.name,
        $or: [
          { userId: userId },
          { userId: userId.toString() }, // Handle string vs ObjectId
        ],
      }).sort({ createdAt: -1 });

      // Combine and deduplicate documents
      const allDocuments = [
        ...documents,
        ...documentsByPatientId,
        ...documentsByPatientName,
      ];

      // Remove duplicates based on _id
      const uniqueDocuments = allDocuments.filter(
        (doc, index, self) =>
          index ===
          self.findIndex((d) => d._id.toString() === doc._id.toString())
      );

      // If we found documents but the patient.documents array is empty, update it
      if (
        uniqueDocuments.length > 0 &&
        (!patient.documents || patient.documents.length === 0)
      ) {
        console.log(
          `Updating patient ${patient.name} documents array with ${uniqueDocuments.length} documents`
        );
        patient.documents = uniqueDocuments.map((doc) => doc._id);
        await patient.save();
      }

      return uniqueDocuments;
    } catch (error) {
      throw new Error(`Failed to get patient documents: ${error.message}`);
    }
  }

  // Visit History Management
  static async addVisitRecord(patientId, visitData, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      const visitRecord = new VisitRecord({
        ...visitData,
        patientId,
        clinicianId: userId,
      });

      await visitRecord.save();

      // Add visit to patient's visits array
      patient.visits.push(visitRecord._id);
      await patient.save();

      return visitRecord;
    } catch (error) {
      throw new Error(`Failed to add visit record: ${error.message}`);
    }
  }

  static async getVisitHistory(patientId, userId, limit = 10) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      const visits = await VisitRecord.getPatientHistory(patientId, limit);
      return visits;
    } catch (error) {
      throw new Error(`Failed to get visit history: ${error.message}`);
    }
  }

  // Clinical Timeline Generation
  static async getClinicalTimeline(patientId, userId) {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        $or: [
          { createdBy: userId }, // New format
          { userId: userId }, // Legacy format
        ],
      });
      if (!patient) {
        throw new Error("Patient not found or access denied");
      }

      // Get all visits
      const visits = await VisitRecord.find({ patientId })
        .sort({ visitDate: -1 })
        .populate("clinicianId", "name");

      // Get all documents
      const documents = await File.find({ patientId }).sort({ createdAt: -1 });

      // Get all clinical analyses
      const analyses = await ClinicalAnalysis.find({ patientId })
        .sort({ createdAt: -1 })
        .populate("fileId", "filename");

      // Combine into timeline events
      const timelineEvents = [];

      // Add visit events
      visits.forEach((visit) => {
        timelineEvents.push({
          type: "visit",
          date: visit.visitDate,
          title: `${
            visit.visitType.charAt(0).toUpperCase() + visit.visitType.slice(1)
          } Visit - ${visit.discipline.toUpperCase()}`,
          description: visit.visitNotes.substring(0, 100) + "...",
          clinician: visit.clinicianName,
          data: visit.visitSummary,
        });
      });

      // Add document events
      documents.forEach((doc) => {
        timelineEvents.push({
          type: "document",
          date: doc.createdAt,
          title: `Document Uploaded: ${doc.originalname}`,
          description: `File processed with status: ${doc.processingStatus}`,
          data: {
            filename: doc.filename,
            originalname: doc.originalname,
            processingStatus: doc.processingStatus,
          },
        });
      });

      // Add analysis events
      analyses.forEach((analysis) => {
        timelineEvents.push({
          type: "analysis",
          date: analysis.createdAt,
          title: `Clinical Analysis - ${analysis.analysisType}`,
          description: analysis.summary.substring(0, 100) + "...",
          data: {
            analysisType: analysis.analysisType,
            confidence: analysis.confidence,
            insightsCount: analysis.clinicalInsights.length,
          },
        });
      });

      // Sort by date (most recent first)
      timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

      return timelineEvents;
    } catch (error) {
      throw new Error(`Failed to generate clinical timeline: ${error.message}`);
    }
  }

  // Helper method to decrypt patient data
  static decryptPatientData(patient) {
    if (!patient) return patient;

    const patientObj = patient.toObject ? patient.toObject() : patient;

    return {
      ...patientObj,
      name: this.decryptData(patientObj.name),
    };
  }

  // Get patient summary for chat context
  static async getPatientSummaryForChat(patientId, userId) {
    try {
      const patient = await this.getPatient(patientId, userId);
      const recentVisits = await this.getVisitHistory(patientId, userId, 3);
      const documents = await this.getPatientDocuments(patientId, userId);

      return {
        patient: {
          name: patient.name,
          age: patient.calculatedAge,
          primaryDiagnosis: patient.primaryDiagnosis,
          medicalRecordNumber: patient.medicalRecordNumber,
        },
        recentVisits: recentVisits.map((visit) => ({
          date: visit.visitDate,
          type: visit.visitType,
          discipline: visit.discipline,
          clinician: visit.clinicianName,
        })),
        documentCount: documents.length,
        lastActivity: patient.updatedAt,
      };
    } catch (error) {
      throw new Error(`Failed to get patient summary: ${error.message}`);
    }
  }
}

export default PatientDataService;
