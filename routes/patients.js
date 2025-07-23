import express from "express";
import patientsController from "../controllers/patientsController.js";
import { authenticateToken } from "../middleware/auth.js";
const router = express.Router();

// Get patient statistics (authenticated)
router.get("/stats", authenticateToken, patientsController.getPatientStats);

// Create patient (authenticated)
router.post("/", authenticateToken, patientsController.createPatient);

// Get all patients (authenticated)
router.get("/", authenticateToken, patientsController.getAllPatients);

// Get single patient by ID (authenticated)
router.get("/:id", authenticateToken, patientsController.getPatientById);

// Update patient (authenticated)
router.put("/:id", authenticateToken, patientsController.updatePatient);

// Delete patient (authenticated)
router.delete("/:id", authenticateToken, patientsController.deletePatient);

export default router;
