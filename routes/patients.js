import express from "express";
import patientsController from "../controllers/patientsController.js";
import { authenticateToken } from "../middleware/auth.js";
const router = express.Router();

// Get patient statistics (authenticated)
router.get("/stats", authenticateToken, patientsController.getPatientStats);

// Search patients (authenticated)
router.get("/search", authenticateToken, patientsController.searchPatients);

// Create patient (authenticated)
router.post("/", authenticateToken, patientsController.createPatient);

// Get all patients (authenticated)
router.get("/", authenticateToken, patientsController.getAllPatients);

// Get single patient by ID (authenticated)
router.get("/:id", authenticateToken, patientsController.getPatientById);

// Get patient summary for chat (authenticated)
router.get(
  "/:id/summary",
  authenticateToken,
  patientsController.getPatientSummary
);

// Get clinical timeline (authenticated)
router.get(
  "/:id/timeline",
  authenticateToken,
  patientsController.getClinicalTimeline
);

// Get visit history (authenticated)
router.get(
  "/:id/visits",
  authenticateToken,
  patientsController.getVisitHistory
);

// Get patient documents (authenticated)
router.get(
  "/:id/documents",
  authenticateToken,
  patientsController.getPatientDocuments
);

// Associate document with patient (authenticated)
router.post(
  "/:id/documents",
  authenticateToken,
  patientsController.associateDocument
);

// Fix patient document associations (authenticated)
router.post(
  "/:id/fix-documents",
  authenticateToken,
  patientsController.fixPatientDocuments
);

// Update patient (authenticated)
router.put("/:id", authenticateToken, patientsController.updatePatient);

// Delete patient (authenticated)
router.delete("/:id", authenticateToken, patientsController.deletePatient);

export default router;
