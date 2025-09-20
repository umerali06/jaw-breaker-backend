import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../../middleware/auth.js';
import clinicalDecisionController from '../controllers/clinicalDecisionController.js';
import workflowAutomationController from '../controllers/workflowAutomationController.js';
import templateController from '../controllers/templateController.js';
import qualityComplianceController from '../controllers/qualityComplianceController.js';
import historyRoutes from './historyRoutes.js';
import knowledgeTrainingRoutes from './knowledgeTrainingRoutes.js';
// Note: Other controllers will be implemented as needed
// import workflowController from '../controllers/workflowController.js';
// import complianceController from '../controllers/complianceController.js';
// import communicationController from '../controllers/communicationController.js';
// import knowledgeController from '../controllers/knowledgeController.js';
// import dataIntegrationController from '../controllers/dataIntegrationController.js';
// import taskManagementController from '../controllers/taskManagementController.js';
// import riskPredictionController from '../controllers/riskPredictionController.js';

const router = express.Router();

// Health check endpoint (no authentication required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nursing module is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// History routes
router.use('/history', historyRoutes);

// Knowledge & Training routes
router.use('/knowledge-training', knowledgeTrainingRoutes);

// Middleware to check if user has nursing subscription
const requireNursingAccess = (req, res, next) => {
  // For development/testing, allow access without strict authentication
  // In production, this should check proper authentication
  console.log('Nursing access check - req.user:', req.user);
  
  // If no user object, create a mock user for testing
  if (!req.user) {
    req.user = {
      id: '68a49366faf7ae8a360e9b93', // Use the actual user ID from JWT token
      _id: '68a49366faf7ae8a360e9b93',
      profession: 'nursing',
      subscriptions: [{ planId: 'nursing_monthly', status: 'active' }]
    };
    console.log('Created mock user for testing');
  }
  
  // Check if user has nursing subscription
  const hasNursingAccess = req.user.profession === 'nursing' || 
                          req.user.subscriptions?.some(sub => 
                            sub.planId?.includes('nursing') && sub.status === 'active'
                          );
  
  if (!hasNursingAccess) {
    return res.status(403).json({
      success: false,
      message: 'Nursing subscription required'
    });
  }
  
  next();
};

// Note: requireNursingAccess middleware is applied per route as needed

// Clinical Decision Support Routes
router.post('/clinical-decision',
  authenticateToken,
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('query').isString().notEmpty().withMessage('Clinical query is required'),
    body('context').optional().isObject().withMessage('Context must be an object')
  ],
  (req, res) => clinicalDecisionController.generateClinicalDecision(req, res)
);

router.post('/risk-assessment',
  authenticateToken,
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('includeVitalSigns').optional().isBoolean().withMessage('Include vital signs must be a boolean'),
    body('includeMedications').optional().isBoolean().withMessage('Include medications must be a boolean')
  ],
  (req, res) => clinicalDecisionController.generateRiskAssessment(req, res)
);

router.post('/vital-signs-analysis',
  authenticateToken,
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('vitalSigns').isObject().withMessage('Vital signs data is required'),
    body('timeRange').optional().isString().withMessage('Time range must be a string')
  ],
  (req, res) => clinicalDecisionController.analyzeVitalSigns(req, res)
);

router.post('/medication-analysis',
  authenticateToken,
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('medications').isArray().withMessage('Medications must be an array')
  ],
  (req, res) => clinicalDecisionController.analyzeMedications(req, res)
);

router.get('/clinical-alerts/:patientId',
  authenticateToken,
  [
    param('patientId').isString().notEmpty().withMessage('Patient ID is required')
  ],
  (req, res) => clinicalDecisionController.getClinicalAlerts(req, res)
);

router.get('/clinical-history/:patientId',
  authenticateToken,
  [
    param('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  (req, res) => clinicalDecisionController.getClinicalHistory(req, res)
);

router.put('/clinical-alerts/:alertId/acknowledge',
  authenticateToken,
  [
    param('alertId').isString().notEmpty().withMessage('Alert ID is required'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
  (req, res) => clinicalDecisionController.acknowledgeAlert(req, res)
);

// Workflow Automation Routes
router.post('/voice-transcription',
  authenticateToken,
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('audioData').isString().notEmpty().withMessage('Audio data is required'),
    body('context').optional().isString().withMessage('Context must be a string'),
    body('sessionId').optional().isString().withMessage('Session ID must be a string'),
    body('audioFileName').optional().isString().withMessage('Audio file name must be a string'),
    body('audioSize').optional().isNumeric().withMessage('Audio size must be a number'),
    body('audioDuration').optional().isNumeric().withMessage('Audio duration must be a number')
  ],
  (req, res) => workflowAutomationController.processVoiceTranscription(req, res)
);

// Voice Transcription History Routes
router.get('/voice-transcription/history',
  authenticateToken,
  [
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('isArchived').optional().isBoolean().withMessage('isArchived must be a boolean')
  ],
  (req, res) => workflowAutomationController.getVoiceTranscriptionHistory(req, res)
);

// Specific routes must come before parameterized routes
router.get('/voice-transcription/stats',
  authenticateToken,
  [
    query('patientId').optional().isString().withMessage('Patient ID must be a string')
  ],
  (req, res) => workflowAutomationController.getVoiceTranscriptionStats(req, res)
);

router.get('/voice-transcription/search',
  authenticateToken,
  [
    query('q').isString().notEmpty().withMessage('Search query is required'),
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer')
  ],
  (req, res) => workflowAutomationController.searchVoiceTranscriptions(req, res)
);

// Parameterized routes come after specific routes
router.get('/voice-transcription/:sessionId',
  authenticateToken,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required')
  ],
  (req, res) => workflowAutomationController.getVoiceTranscriptionBySessionId(req, res)
);

router.put('/voice-transcription/:transcriptionId',
  authenticateToken,
  [
    param('transcriptionId').isMongoId().withMessage('Transcription ID must be a valid MongoDB ObjectId'),
    body('transcriptionText').optional().isString().withMessage('Transcription text must be a string'),
    body('structuredDocumentation').optional().isObject().withMessage('Structured documentation must be an object'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
    body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1')
  ],
  (req, res) => workflowAutomationController.updateVoiceTranscription(req, res)
);

router.post('/voice-transcription/:transcriptionId/archive',
  authenticateToken,
  [
    param('transcriptionId').isMongoId().withMessage('Transcription ID must be a valid MongoDB ObjectId')
  ],
  (req, res) => workflowAutomationController.archiveVoiceTranscription(req, res)
);

router.delete('/voice-transcription/:transcriptionId',
  authenticateToken,
  [
    param('transcriptionId').isMongoId().withMessage('Transcription ID must be a valid MongoDB ObjectId')
  ],
  (req, res) => workflowAutomationController.deleteVoiceTranscription(req, res)
);

router.get('/templates/conditions',
  (req, res) => workflowAutomationController.getTemplateConditions(req, res)
);

router.get('/templates/built-in/:condition',
  [
    param('condition').isString().notEmpty().withMessage('Condition is required')
  ],
  (req, res) => workflowAutomationController.getBuiltInTemplate(req, res)
);

// Template Management Routes
router.post('/templates/save',
  authenticateToken,
  [
    body('templateName').isString().notEmpty().withMessage('Template name is required'),
    body('condition').isString().notEmpty().withMessage('Condition is required'),
    body('templateType').isIn(['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']).withMessage('Invalid template type'),
    body('templateContent').isObject().withMessage('Template content is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
  ],
  (req, res) => templateController.saveTemplate(req, res)
);

router.post('/templates/copy',
  authenticateToken,
  [
    body('templateId').isString().notEmpty().withMessage('Template ID is required'),
    body('newTemplateName').optional().isString().withMessage('New template name must be a string')
  ],
  (req, res) => templateController.copyTemplate(req, res)
);

router.post('/templates/use',
  authenticateToken,
  [
    body('templateId').isString().notEmpty().withMessage('Template ID is required')
  ],
  (req, res) => templateController.useTemplate(req, res)
);

router.get('/templates/my-templates',
  authenticateToken,
  [
    query('condition').optional().isString().withMessage('Condition must be a string'),
    query('templateType').optional().isIn(['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']).withMessage('Invalid template type')
  ],
  (req, res) => templateController.getUserTemplates(req, res)
);

router.get('/templates/public',
  authenticateToken,
  [
    query('condition').optional().isString().withMessage('Condition must be a string'),
    query('templateType').optional().isIn(['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']).withMessage('Invalid template type')
  ],
  (req, res) => templateController.getPublicTemplates(req, res)
);

router.get('/templates/search',
  authenticateToken,
  [
    query('q').optional().isString().withMessage('Search term must be a string'),
    query('condition').optional().isString().withMessage('Condition must be a string'),
    query('templateType').optional().isIn(['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']).withMessage('Invalid template type')
  ],
  (req, res) => templateController.searchTemplates(req, res)
);

router.put('/templates/:templateId',
  authenticateToken,
  [
    param('templateId').isString().notEmpty().withMessage('Template ID is required'),
    body('templateName').optional().isString().withMessage('Template name must be a string'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('templateData').optional().isObject().withMessage('Template data must be an object')
  ],
  (req, res) => templateController.updateTemplate(req, res)
);

router.delete('/templates/:templateId',
  authenticateToken,
  [
    param('templateId').isString().notEmpty().withMessage('Template ID is required')
  ],
  (req, res) => templateController.deleteTemplate(req, res)
);

router.get('/templates/stats',
  authenticateToken,
  (req, res) => templateController.getTemplateStats(req, res)
);

router.get('/templates/:condition',
  authenticateToken,
  [
    param('condition').isString().notEmpty().withMessage('Condition is required'),
    query('templateType').optional().isIn(['assessment', 'care_plan', 'monitoring', 'discharge', 'emergency', 'custom']).withMessage('Invalid template type'),
    query('patientId').optional().isString().withMessage('Patient ID must be a string')
  ],
  (req, res) => workflowAutomationController.getSmartTemplate(req, res)
);

router.post('/templates',
  authenticateToken,
  [
    body('name').isString().notEmpty().withMessage('Template name is required'),
    body('condition').isString().notEmpty().withMessage('Condition is required'),
    body('fields').optional().isArray().withMessage('Fields must be an array'),
    body('requirements').optional().isString().withMessage('Requirements must be a string'),
    body('careSetting').optional().isString().withMessage('Care setting must be a string')
  ],
  (req, res) => workflowAutomationController.createCustomTemplate(req, res)
);

// Note: Duplicate PUT /templates/:templateId route removed - using the first one above

// Quality & Compliance Routes - Coming Soon
// router.post('/oasis-compliance-check',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('oasisData').isObject().withMessage('OASIS data is required')
//   ],
//   complianceController.checkOASISCompliance
// );

// router.post('/medicare-compliance-check',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('visitData').isObject().withMessage('Visit data is required')
//   ],
//   complianceController.checkMedicareCompliance
// );

// router.get('/compliance-reports/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
//     query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
//   ],
//   complianceController.getComplianceReports
// );

// Patient Communication Support Routes - Coming Soon
// router.post('/patient-education',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('educationTopic').isString().notEmpty().withMessage('Education topic is required'),
//     body('literacyLevel').optional().isIn(['basic', 'intermediate', 'advanced']).withMessage('Invalid literacy level')
//   ],
//   communicationController.generatePatientEducation
// );

// router.post('/care-instructions',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('condition').isString().notEmpty().withMessage('Condition is required'),
//     body('instructions').optional().isString().withMessage('Instructions must be a string')
//   ],
//   communicationController.generateCareInstructions
// );

// router.get('/education-materials/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required')
//   ],
//   communicationController.getEducationMaterials
// );

// Knowledge Expansion & Training Routes - Coming Soon
// router.get('/daily-tips',
//   [
//     query('category').optional().isString().withMessage('Category must be a string')
//   ],
//   knowledgeController.getDailyTips
// );

// router.post('/micro-learning',
//   [
//     body('topic').isString().notEmpty().withMessage('Topic is required'),
//     body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level')
//   ],
//   knowledgeController.generateMicroLearning
// );

// router.get('/scenario-simulations',
//   [
//     query('condition').optional().isString().withMessage('Condition must be a string'),
//     query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level')
//   ],
//   knowledgeController.getScenarioSimulations
// );

// router.post('/competency-check',
//   [
//     body('competencyId').isString().notEmpty().withMessage('Competency ID is required'),
//     body('responses').isArray().withMessage('Responses must be an array')
//   ],
//   knowledgeController.submitCompetencyCheck
// );

// Data Integration Routes - Coming Soon
// router.post('/import-external-data',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('dataSource').isString().notEmpty().withMessage('Data source is required'),
//     body('data').isObject().withMessage('Data must be an object')
//   ],
//   dataIntegrationController.importExternalData
// );

// router.get('/patient-trends/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     query('metric').optional().isString().withMessage('Metric must be a string'),
//     query('timeRange').optional().isString().withMessage('Time range must be a string')
//   ],
//   dataIntegrationController.getPatientTrends
// );

// router.post('/generate-snapshot',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('includeData').optional().isArray().withMessage('Include data must be an array')
//   ],
//   dataIntegrationController.generateSnapshotSummary
// );

// Task & Time Management Routes - Coming Soon
// router.get('/patient-tasks/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     query('status').optional().isIn(['pending', 'in_progress', 'completed', 'overdue']).withMessage('Invalid status')
//   ],
//   taskManagementController.getPatientTasks
// );

// router.post('/generate-tasks',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('carePlan').optional().isObject().withMessage('Care plan must be an object')
//   ],
//   taskManagementController.generateTasks
// );

// router.put('/tasks/:taskId',
//   [
//     param('taskId').isString().notEmpty().withMessage('Task ID is required'),
//     body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid status'),
//     body('notes').optional().isString().withMessage('Notes must be a string')
//   ],
//   taskManagementController.updateTask
// );

// router.get('/reminders',
//   [
//     query('type').optional().isIn(['follow_up', 'prn_visit', 'care_plan_update', 'medication_review']).withMessage('Invalid reminder type')
//   ],
//   taskManagementController.getReminders
// );

// Risk Prediction & Safety Routes - Coming Soon
// router.post('/risk-assessment',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('riskType').isIn(['fall', 'hospitalization', 'decline']).withMessage('Invalid risk type')
//   ],
//   riskPredictionController.generateRiskAssessment
// );

// router.get('/risk-factors/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required')
//   ],
//   riskPredictionController.getRiskFactors
// );

// router.post('/safety-interventions',
//   [
//     body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
//     body('riskType').isIn(['fall', 'hospitalization', 'decline']).withMessage('Invalid risk type')
//   ],
//   riskPredictionController.generateSafetyInterventions
// );

// router.get('/safety-alerts/:patientId',
//   [
//     param('patientId').isString().notEmpty().withMessage('Patient ID is required')
//   ],
//   riskPredictionController.getSafetyAlerts
// );

// Quality and Compliance Routes
router.post('/quality-compliance/check',
  authenticateToken,
  [
    body('checkType').isString().notEmpty().withMessage('Check type is required'),
    body('checkCategory').isString().notEmpty().withMessage('Check category is required'),
    body('checkTitle').isString().notEmpty().withMessage('Check title is required'),
    body('checkDescription').isString().notEmpty().withMessage('Check description is required'),
    body('patientId').optional().isString().withMessage('Patient ID must be a string'),
    body('findings').optional().isArray().withMessage('Findings must be an array'),
    body('recommendations').optional().isArray().withMessage('Recommendations must be an array'),
    body('sessionId').optional().isString().withMessage('Session ID must be a string')
  ],
  (req, res) => qualityComplianceController.performQualityCheck(req, res)
);

router.get('/quality-compliance/history',
  authenticateToken,
  [
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('checkType').optional().isString().withMessage('Check type must be a string'),
    query('checkCategory').optional().isString().withMessage('Check category must be a string'),
    query('complianceStatus').optional().isString().withMessage('Compliance status must be a string'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer'),
    query('includeArchived').optional().isBoolean().withMessage('Include archived must be a boolean')
  ],
  (req, res) => qualityComplianceController.getQualityComplianceHistory(req, res)
);

router.get('/quality-compliance/stats',
  authenticateToken,
  [
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('includeArchived').optional().isBoolean().withMessage('Include archived must be a boolean')
  ],
  (req, res) => qualityComplianceController.getQualityComplianceStats(req, res)
);

router.get('/quality-compliance/trends',
  authenticateToken,
  [
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
  ],
  (req, res) => qualityComplianceController.getComplianceTrends(req, res)
);

router.get('/quality-compliance/options',
  authenticateToken,
  (req, res) => qualityComplianceController.getQualityComplianceOptions(req, res)
);

router.get('/quality-compliance/:checkId',
  authenticateToken,
  [
    param('checkId').isString().notEmpty().withMessage('Check ID is required')
  ],
  (req, res) => qualityComplianceController.getQualityCheckById(req, res)
);

router.put('/quality-compliance/:checkId',
  authenticateToken,
  [
    param('checkId').isString().notEmpty().withMessage('Check ID is required'),
    body('findings').optional().isArray().withMessage('Findings must be an array'),
    body('recommendations').optional().isArray().withMessage('Recommendations must be an array'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
  (req, res) => qualityComplianceController.updateQualityCheck(req, res)
);

router.post('/quality-compliance/:checkId/archive',
  authenticateToken,
  [
    param('checkId').isString().notEmpty().withMessage('Check ID is required')
  ],
  (req, res) => qualityComplianceController.archiveQualityCheck(req, res)
);

router.delete('/quality-compliance/:checkId',
  authenticateToken,
  [
    param('checkId').isString().notEmpty().withMessage('Check ID is required')
  ],
  (req, res) => qualityComplianceController.deleteQualityCheck(req, res)
);

router.get('/quality-compliance/search',
  authenticateToken,
  [
    query('q').isString().notEmpty().withMessage('Search query is required'),
    query('patientId').optional().isString().withMessage('Patient ID must be a string'),
    query('checkType').optional().isString().withMessage('Check type must be a string'),
    query('checkCategory').optional().isString().withMessage('Check category must be a string'),
    query('complianceStatus').optional().isString().withMessage('Compliance status must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer')
  ],
  (req, res) => qualityComplianceController.searchQualityChecks(req, res)
);

export default router;
