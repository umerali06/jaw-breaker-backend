import { Router } from "express";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { noMock } from "../middleware/noMock.js";
import Patient from "../models/Patient.js";
import PatientDocument from "../models/PatientDocument.js";
import ClinicalAIOutput from "../models/ClinicalAIOutput.js";
import { runAiTask } from "../services/ai/index.js";
import { audit } from "../services/audit.js";

const r = Router();

// Apply authentication and role-based access control to all doctor routes
r.use(authenticateToken, authorizeRole(["medical-provider", "doctor"]), noMock);

// GET /patients
r.get("/patients", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q ? { name: new RegExp(q, "i") } : {};
    const patients = await Patient.find(filter).sort({ updatedAt: -1 }).limit(50);
    
    await audit(req.userId, "VIEW_PATIENT_LIST");
    res.json({ success: true, patients });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patients" });
  }
});

// GET /patients/:id/context
r.get("/patients/:id/context", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });

    const docs = await PatientDocument.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(50);
    const outputs = await ClinicalAIOutput.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(5);

    await audit(req.userId, "VIEW_PATIENT", { patientId: patient._id });

    res.json({
      success: true,
      patient: {
        mrn: patient.mrn,
        name: patient.name,
        dob: patient.dob,
        sex: patient.sex,
        allergies: patient.allergies,
        medications: patient.medications
      },
      documents: docs,
      recentOutputs: outputs
    });
  } catch (error) {
    console.error("Error fetching patient context:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient context" });
  }
});

// GET /patients/:id/documents
r.get("/patients/:id/documents", async (req, res) => {
  try {
    const { type, q, from, to } = req.query;
    const f = { patientId: req.params.id };

    if (type) f.type = type;
    if (q) f.title = new RegExp(q, "i");
    if (from || to) f.createdAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {})
    };

    const docs = await PatientDocument.find(f).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, documents: docs });
  } catch (error) {
    console.error("Error fetching patient documents:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient documents" });
  }
});

// POST /ai/run  { patientId, documentIds:[], task }
r.post("/ai/run", async (req, res) => {
  console.log("🔍 AI Route Hit: /api/doctor/ai/run");
  console.log("🔍 Request Body:", req.body);
  console.log("🔍 Request Method:", req.method);
  console.log("🔍 Request URL:", req.url);
  
  try {
    const { patientId, documentIds, task } = req.body || {};

    if (!patientId || !Array.isArray(documentIds) || !documentIds.length || !task) {
      return res.status(400).json({ 
        success: false, 
        error: "patientId, documentIds[], task required" 
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });

    const docs = await PatientDocument.find({ _id: { $in: documentIds } });
    if (docs.length !== documentIds.length) {
      return res.status(403).json({ success: false, error: "One or more documents invalid" });
    }
    if (!docs.every(d => String(d.patientId) === String(patientId))) {
      return res.status(403).json({ success: false, error: "Document ownership mismatch" });
    }

    const inputContext = {
      demographics: { name: patient.name, dob: patient.dob, sex: patient.sex },
      allergies: patient.allergies,
      medications: patient.medications,
      documents: docs.map(d => ({
        id: String(d._id),
        type: d.type,
        title: d.title,
        text: d.text
      }))
    };

    const result = await runAiTask({ task, inputContext });
    // result: { output, model, hallucinationFlags }

    const record = await ClinicalAIOutput.create({
      patientId,
      documentIds,
      task,
      inputContext,
      output: result.output,
      model: result.model,
      hallucinationFlags: result.hallucinationFlags,
      createdBy: req.userId
    });

    await audit(req.userId, "RUN_AI_TASK", { patientId, task, model: result.model });
    res.json({ 
      success: true, 
      id: record._id, 
      version: record.version, 
      ...result 
    });
  } catch (error) {
    console.error("Error running AI task:", error);
    
    // Provide more detailed error information
    let errorMessage = "Failed to run AI task";
    let statusCode = 500;
    
    if (error.message && error.message.includes("All AI providers failed")) {
      errorMessage = error.message;
      statusCode = 503; // Service Unavailable
    } else if (error.status) {
      statusCode = error.status;
      errorMessage = error.message || errorMessage;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /ai/outputs
r.get("/ai/outputs", async (req, res) => {
  try {
    const { patientId, task, limit = 20 } = req.query;
    const f = {};
    if (patientId) f.patientId = patientId;
    if (task) f.task = task;
    
    const list = await ClinicalAIOutput.find(f).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ success: true, outputs: list });
  } catch (error) {
    console.error("Error fetching AI outputs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch AI outputs" });
  }
});

// GET /ai/outputs/:id
r.get("/ai/outputs/:id", async (req, res) => {
  try {
    const o = await ClinicalAIOutput.findById(req.params.id);
    if (!o) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, output: o });
  } catch (error) {
    console.error("Error fetching AI output:", error);
    res.status(500).json({ success: false, error: "Failed to fetch AI output" });
  }
});

export default r;
