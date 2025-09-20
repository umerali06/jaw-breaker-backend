import express from "express";
import { authenticateToken as auth } from "../middleware/auth.js";
import {
  validateNursingAccess,
  validateNursingFeature,
} from "../middleware/planValidation.js";

// Import nursing controllers
import NursingController from "../controllers/nursing/nursingController.js";
import OutcomeMeasuresController from "../controllers/nursing/OutcomeMeasuresController.js";
import MedicationManagementController from "../controllers/nursing/MedicationManagementController.js";
// QualityComplianceController moved to server/nursing/routes/nursingRoutes.js

const router = express.Router();

// Initialize controllers
const nursingController = new NursingController();
const outcomeMeasuresController = new OutcomeMeasuresController();
const medicationController = new MedicationManagementController();
// qualityComplianceController moved to server/nursing/routes/nursingRoutes.js

// Apply authentication and nursing access validation to all routes
router.use(auth);
router.use(validateNursingAccess);

// OASIS Assessment Routes - with specific feature validation
router.post(
  "/oasis/assessments",
  validateNursingFeature("advanced_oasis_scoring"),
  nursingController.createOASISAssessment.bind(nursingController)
);
router.get(
  "/oasis/assessments",
  validateNursingFeature("advanced_oasis_scoring"),
  nursingController.getOASISAssessments.bind(nursingController)
);
router.put(
  "/oasis/assessments/:id",
  validateNursingFeature("advanced_oasis_scoring"),
  nursingController.updateOASISAssessment.bind(nursingController)
);
router.get(
  "/oasis-assessments/patient/:patientId",
  validateNursingFeature("advanced_oasis_scoring"),
  nursingController.getAssessmentHistory.bind(nursingController)
);

// SOAP Notes Routes - with specific feature validation
router.post(
  "/soap/notes",
  validateNursingFeature("soap_note_generator"),
  nursingController.createSOAPNote.bind(nursingController)
);
router.get(
  "/soap/notes",
  validateNursingFeature("soap_note_generator"),
  nursingController.getSOAPNotes.bind(nursingController)
);
router.get(
  "/soap/notes/:id",
  validateNursingFeature("soap_note_generator"),
  nursingController.getSOAPNote.bind(nursingController)
);
router.put(
  "/soap/notes/:id",
  validateNursingFeature("soap_note_generator"),
  nursingController.updateSOAPNote.bind(nursingController)
);
router.delete(
  "/soap/notes/:id",
  validateNursingFeature("soap_note_generator"),
  nursingController.deleteSOAPNote.bind(nursingController)
);

// Progress Tracking Routes - with specific feature validation
router.post(
  "/progress/entries",
  validateNursingFeature("progress_tracking"),
  nursingController.createProgressEntry.bind(nursingController)
);
router.get(
  "/progress/entries",
  validateNursingFeature("progress_tracking"),
  nursingController.getProgressData.bind(nursingController)
);

// Enhanced Progress Tracking Routes with Advanced AI-ML-NLP
import enhancedProgressTrackingRoutes from "./nursing/progressTracking.js";
router.use("/progress-tracking", enhancedProgressTrackingRoutes);

// Advanced Progress Analytics Routes
router.post(
  "/progress/predict",
  nursingController.generateProgressPrediction.bind(nursingController)
);
router.post(
  "/progress/risk-assessment",
  nursingController.performRiskAssessment.bind(nursingController)
);
router.post(
  "/progress/optimize-interventions",
  nursingController.optimizeInterventions.bind(nursingController)
);
router.get(
  "/progress/reports/:patientId",
  nursingController.generateAdvancedProgressReport.bind(nursingController)
);
router.post(
  "/progress/monitoring/setup",
  nursingController.setupRealtimeMonitoring.bind(nursingController)
);
router.get(
  "/progress/trends/:patientId",
  nursingController.performTrendAnalysis.bind(nursingController)
);
router.get(
  "/progress/goals/:patientId/:goalId/predict",
  nursingController.predictGoalAchievement.bind(nursingController)
);

// Outcome Measures Routes - with specific feature validation
// Specific routes first (before parameterized routes)
router.get(
  "/outcome-measures/dashboard",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getQualityIndicatorsDashboard.bind(
    outcomeMeasuresController
  )
);
router.get(
  "/outcome-measures/benchmarks",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getBenchmarkingData.bind(outcomeMeasuresController)
);
router.get(
  "/outcome-measures/trends",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getTrendAnalysis.bind(outcomeMeasuresController)
);
router.get(
  "/outcome-measures/collection-status",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getCollectionStatus.bind(outcomeMeasuresController)
);
router.post(
  "/outcome-measures/configure-collection",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.configureAutomatedCollection.bind(
    outcomeMeasuresController
  )
);
router.post(
  "/outcome-measures/generate-report",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.generateReport.bind(outcomeMeasuresController)
);

// AI Analytics Route (must come before parameterized routes)
router.get(
  "/outcome-measures/ai-analytics",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getComprehensiveAIAnalytics.bind(
    outcomeMeasuresController
  )
);

// AI Service Cache Management Route
router.delete(
  "/outcome-measures/ai-cache",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.clearAIServiceCache.bind(
    outcomeMeasuresController
  )
);

// Parameterized routes after specific routes
router.post(
  "/outcome-measures",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.createOutcomeMeasure.bind(outcomeMeasuresController)
);
router.get(
  "/outcome-measures/:patientId",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getPatientOutcomeMeasures.bind(
    outcomeMeasuresController
  )
);
router.put(
  "/outcome-measures/:id",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.updateOutcomeMeasure.bind(outcomeMeasuresController)
);
router.delete(
  "/outcome-measures/:id",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.deleteOutcomeMeasure.bind(outcomeMeasuresController)
);
router.get(
  "/outcome-measures/collection-status",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getCollectionStatus.bind(outcomeMeasuresController)
);
router.post(
  "/outcome-measures/configure-collection",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.configureAutomatedCollection.bind(
    outcomeMeasuresController
  )
);
router.post(
  "/outcome-measures/generate-report",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.generateReport.bind(outcomeMeasuresController)
);

// Advanced Analytics Routes (Task 7.2)
router.post(
  "/outcome-measures/pattern-recognition",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.performPatternRecognition.bind(
    outcomeMeasuresController
  )
);
router.post(
  "/outcome-measures/predictive-model",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.createPredictiveModel.bind(
    outcomeMeasuresController
  )
);
router.get(
  "/outcome-measures/improvement-recommendations",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.generateImprovementRecommendations.bind(
    outcomeMeasuresController
  )
);
router.get(
  "/outcome-measures/executive-dashboard",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.generateExecutiveDashboard.bind(
    outcomeMeasuresController
  )
);
router.get(
  "/outcome-measures/analytics-summary",
  validateNursingFeature("outcome_measures"),
  outcomeMeasuresController.getAdvancedAnalyticsSummary.bind(
    outcomeMeasuresController
  )
);

// Medication Management Routes - with specific feature validation
// Specific routes first (before parameterized routes)
router.get(
  "/medications/records",
  validateNursingFeature("medication_management"),
  nursingController.getMedicationRecords.bind(nursingController)
);
router.post(
  "/medications/records",
  validateNursingFeature("medication_management"),
  nursingController.createMedicationRecord.bind(nursingController)
);
router.put(
  "/medications/records/:id",
  validateNursingFeature("medication_management"),
  nursingController.updateMedicationRecord.bind(nursingController)
);
router.delete(
  "/medications/records/:id",
  validateNursingFeature("medication_management"),
  nursingController.deleteMedicationRecord.bind(nursingController)
);
router.get(
  "/medications/details/:medicationId",
  validateNursingFeature("medication_management"),
  medicationController.getMedicationDetails.bind(medicationController)
);
router.get(
  "/medication-optimizations",
  validateNursingFeature("medication_management"),
  nursingController.getMedicationOptimizations.bind(nursingController)
);
router.get(
  "/medications/adherence",
  validateNursingFeature("medication_management"),
  nursingController.getMedicationAdherence.bind(nursingController)
);

// Core medication management (parameterized routes)
router.post(
  "/medications/:patientId",
  validateNursingFeature("medication_management"),
  medicationController.createMedication.bind(medicationController)
);
router.get(
  "/medications/:patientId",
  validateNursingFeature("medication_management"),
  medicationController.getPatientMedications.bind(medicationController)
);
router.put(
  "/medications/:medicationId",
  validateNursingFeature("medication_management"),
  medicationController.updateMedication.bind(medicationController)
);
router.delete(
  "/medications/:medicationId/discontinue",
  validateNursingFeature("medication_management"),
  medicationController.discontinueMedication.bind(medicationController)
);

// Drug interaction checking
router.post(
  "/medications/:medicationId/check-interactions",
  validateNursingFeature("medication_management"),
  medicationController.checkDrugInteractions.bind(medicationController)
);

// Adherence monitoring
router.get(
  "/medications/:medicationId/adherence",
  validateNursingFeature("medication_management"),
  medicationController.monitorAdherence.bind(medicationController)
);
router.post(
  "/medications/:medicationId/administration",
  validateNursingFeature("medication_management"),
  medicationController.recordAdministration.bind(medicationController)
);
router.post(
  "/medications/check-interactions",
  validateNursingFeature("medication_management"),
  nursingController.checkDrugInteractions.bind(nursingController)
);
router.post(
  "/medications/administration",
  validateNursingFeature("medication_management"),
  nursingController.recordMedicationAdministration.bind(nursingController)
);

// Clinical Decision Support Routes
router.get(
  "/clinical/alerts",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getClinicalAlerts.bind(nursingController)
);
router.get(
  "/clinical/recommendations",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getClinicalRecommendations.bind(nursingController)
);
router.get(
  "/clinical/risk-assessment",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getRiskAssessment.bind(nursingController)
);
router.get(
  "/clinical/risk-assessments",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getRiskAssessment.bind(nursingController)
);
router.get(
  "/clinical/drug-interactions",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getDrugInteractions.bind(nursingController)
);
router.get(
  "/clinical/vitals-analysis",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getVitalsAnalysis.bind(nursingController)
);
router.get(
  "/clinical/lab-results",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getLabResults.bind(nursingController)
);
router.post(
  "/clinical/analyze",
  validateNursingFeature("clinical_decision_support"),
  nursingController.analyzeClinicalData.bind(nursingController)
);
router.get(
  "/clinical/guidelines",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getClinicalGuidelines.bind(nursingController)
);

// AI-Enhanced Assessment Routes
router.post(
  "/ai/assessment-insights",
  validateNursingFeature("clinical_decision_support"),
  nursingController.generateAssessmentAIInsights.bind(nursingController)
);
router.post(
  "/ai/assessment-recommendations",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getAssessmentRecommendations.bind(nursingController)
);
router.post(
  "/ai/risk-alerts",
  validateNursingFeature("clinical_decision_support"),
  nursingController.generateRiskAlerts.bind(nursingController)
);
router.post(
  "/ai/quality-scoring",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getQualityScoring.bind(nursingController)
);
router.post(
  "/ai/improvement-suggestions",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getImprovementSuggestions.bind(nursingController)
);
router.post(
  "/ai/clinical-guidance",
  validateNursingFeature("clinical_decision_support"),
  nursingController.getClinicalGuidanceForAssessment.bind(nursingController)
);
router.post(
  "/ai/assessment-validation",
  validateNursingFeature("clinical_decision_support"),
  nursingController.validateAssessmentCompleteness.bind(nursingController)
);
router.post(
  "/ai/assessment-summary",
  validateNursingFeature("clinical_decision_support"),
  nursingController.generateAssessmentSummary.bind(nursingController)
);

// Medication reconciliation
router.post(
  "/medications/:patientId/reconciliation",
  validateNursingFeature("medication_management"),
  medicationController.performReconciliation.bind(medicationController)
);

// Therapeutic optimization
router.get(
  "/medications/:patientId/optimization",
  validateNursingFeature("medication_management"),
  medicationController.generateOptimization.bind(medicationController)
);

// Alerts and notifications
router.get(
  "/medications/:patientId/alerts",
  validateNursingFeature("medication_management"),
  medicationController.getMedicationAlerts.bind(medicationController)
);

// Statistics and analytics
router.get(
  "/medications/:patientId/statistics",
  validateNursingFeature("medication_management"),
  medicationController.getMedicationStatistics.bind(medicationController)
);

// Search and filtering
router.get(
  "/medications/search",
  validateNursingFeature("medication_management"),
  medicationController.searchMedications.bind(medicationController)
);

// Refill management
router.get(
  "/medications/due-for-refill",
  validateNursingFeature("medication_management"),
  medicationController.getMedicationsDueForRefill.bind(medicationController)
);

// High-risk medications
router.get(
  "/medications/high-risk",
  validateNursingFeature("medication_management"),
  medicationController.getHighRiskMedications.bind(medicationController)
);

// Legacy routes for backward compatibility
router.post(
  "/medications/records",
  validateNursingFeature("medication_management"),
  nursingController.createMedicationRecord.bind(nursingController)
);
router.get(
  "/medications/records",
  validateNursingFeature("medication_management"),
  nursingController.getMedicationRecords.bind(nursingController)
);

// Nursing Assessments Routes - with specific feature validation
router.post(
  "/assessments",
  validateNursingFeature("nursing_assessments"),
  nursingController.createNursingAssessment.bind(nursingController)
);
router.get(
  "/assessments",
  validateNursingFeature("nursing_assessments"),
  nursingController.getNursingAssessments.bind(nursingController)
);
router.get(
  "/assessments/:assessmentId",
  validateNursingFeature("nursing_assessments"),
  nursingController.getAssessment.bind(nursingController)
);
router.get(
  "/assessments/history/:patientId/:assessmentType",
  validateNursingFeature("nursing_assessments"),
  nursingController.getAssessmentHistory.bind(nursingController)
);
router.post(
  "/assessments/save",
  validateNursingFeature("nursing_assessments"),
  nursingController.saveAssessment.bind(nursingController)
);
router.get(
  "/assessment-templates",
  validateNursingFeature("nursing_assessments"),
  nursingController.getAssessmentTemplates.bind(nursingController)
);

// Patient Management Routes
router.get(
  "/patients",
  validateNursingFeature("patient_management"),
  nursingController.getPatients.bind(nursingController)
);
router.get(
  "/patients/:patientId",
  validateNursingFeature("patient_management"),
  nursingController.getPatient.bind(nursingController)
);
router.post(
  "/patients",
  validateNursingFeature("patient_management"),
  nursingController.createPatient.bind(nursingController)
);
router.put(
  "/patients/:patientId",
  validateNursingFeature("patient_management"),
  nursingController.updatePatient.bind(nursingController)
);
router.delete(
  "/patients/:patientId",
  validateNursingFeature("patient_management"),
  nursingController.deletePatient.bind(nursingController)
);

// Assessment Tools Routes
router.get(
  "/assessment-tools/pain-scales",
  validateNursingFeature("nursing_assessments"),
  nursingController.getPainScales.bind(nursingController)
);
router.get(
  "/assessment-tools/fall-risk",
  validateNursingFeature("nursing_assessments"),
  nursingController.getFallRiskTools.bind(nursingController)
);
router.get(
  "/assessment-tools/mental-status",
  validateNursingFeature("nursing_assessments"),
  nursingController.getMentalStatusTools.bind(nursingController)
);
router.get(
  "/assessment-tools/:assessmentType",
  validateNursingFeature("nursing_assessments"),
  nursingController.getAssessmentTools.bind(nursingController)
);

// Care Plans Routes - with specific feature validation
router.post(
  "/care-plans",
  validateNursingFeature("care_plan_builder"),
  nursingController.createCarePlan.bind(nursingController)
);
router.get(
  "/care-plans",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlans.bind(nursingController)
);
router.get(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlan.bind(nursingController)
);
router.put(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.updateCarePlan.bind(nursingController)
);
router.delete(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.deleteCarePlan.bind(nursingController)
);
router.put(
  "/care-plans/:id/goals/:goalId/progress",
  validateNursingFeature("care_plan_builder"),
  nursingController.updateGoalProgress.bind(nursingController)
);
router.put(
  "/care-plans/:id/interventions/:interventionId/complete",
  validateNursingFeature("care_plan_builder"),
  nursingController.completeIntervention.bind(nursingController)
);
router.get(
  "/care-plans/:id/progress",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlanProgress.bind(nursingController)
);
router.get(
  "/care-plans/analytics",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlanAnalytics.bind(nursingController)
);
router.post(
  "/care-plans/ai-suggestions",
  validateNursingFeature("care_plan_builder"),
  nursingController.generateCarePlanSuggestions.bind(nursingController)
);
router.get(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlan.bind(nursingController)
);
router.put(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.updateCarePlan.bind(nursingController)
);
router.delete(
  "/care-plans/:id",
  validateNursingFeature("care_plan_builder"),
  nursingController.deleteCarePlan.bind(nursingController)
);
router.put(
  "/care-plans/:id/goals/:goalId/progress",
  validateNursingFeature("care_plan_builder"),
  nursingController.updateGoalProgress.bind(nursingController)
);
router.put(
  "/care-plans/:id/interventions/:interventionId/complete",
  validateNursingFeature("care_plan_builder"),
  nursingController.completeIntervention.bind(nursingController)
);
router.get(
  "/care-plans/:id/progress",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlanProgress.bind(nursingController)
);
router.get(
  "/care-plans/analytics",
  validateNursingFeature("care_plan_builder"),
  nursingController.getCarePlanAnalytics.bind(nursingController)
);

// Patient Clinical Data Routes
router.get(
  "/patients/:patientId/clinical-data",
  nursingController.getPatientClinicalData.bind(nursingController)
);

// Dashboard and Analytics
router.get(
  "/dashboard",
  nursingController.getDashboardData.bind(nursingController)
);

// Storage Management
router.get(
  "/storage/info",
  nursingController.getStorageInfo.bind(nursingController)
);

// Quality Compliance Routes moved to server/nursing/routes/nursingRoutes.js

// Quality Compliance CRUD routes moved to server/nursing/routes/nursingRoutes.js

export default router;
