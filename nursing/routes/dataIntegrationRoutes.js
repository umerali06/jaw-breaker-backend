import express from 'express';
import dataIntegrationController, { uploadMiddleware } from '../controllers/dataIntegrationController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// File Upload Routes
router.post('/upload', uploadMiddleware, dataIntegrationController.uploadFiles.bind(dataIntegrationController));
router.get('/files/:patientId', dataIntegrationController.getFiles.bind(dataIntegrationController));

// Analysis Routes
router.post('/analyze', dataIntegrationController.analyzeData.bind(dataIntegrationController));
router.get('/analysis/:patientId', dataIntegrationController.getAnalysisResults.bind(dataIntegrationController));
router.get('/insights/:patientId', dataIntegrationController.getAIInsights.bind(dataIntegrationController));
router.delete('/cleanup/:patientId', dataIntegrationController.cleanupOldAnalysisResults.bind(dataIntegrationController));

// Export Routes
router.post('/export', dataIntegrationController.exportData.bind(dataIntegrationController));

// Settings Routes
router.get('/settings', dataIntegrationController.getSettings.bind(dataIntegrationController));
router.put('/settings', dataIntegrationController.updateSettings.bind(dataIntegrationController));

// General Data Routes
router.get('/:patientId', dataIntegrationController.getIntegrationData.bind(dataIntegrationController));

export default router;


