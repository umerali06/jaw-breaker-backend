import express from 'express';
import knowledgeTrainingController from '../controllers/knowledgeTrainingController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Knowledge Base Routes
router.post('/knowledge', knowledgeTrainingController.createKnowledgeBase);
router.put('/knowledge/:knowledgeId', knowledgeTrainingController.updateKnowledgeBase);
router.get('/knowledge/search', knowledgeTrainingController.searchKnowledge);
router.get('/knowledge/popular', knowledgeTrainingController.getPopularKnowledge);
router.get('/knowledge/category/:category', knowledgeTrainingController.getKnowledgeByCategory);
router.get('/knowledge/:knowledgeId', knowledgeTrainingController.getKnowledgeBase);
router.post('/knowledge/:knowledgeId/analyze', knowledgeTrainingController.analyzeKnowledgeWithAI);

// Training Module Routes
router.post('/training', knowledgeTrainingController.createTrainingModule);
router.get('/training/popular', knowledgeTrainingController.getPopularTraining);
router.get('/training/category/:category', knowledgeTrainingController.getTrainingByCategory);
router.get('/training/:trainingId', knowledgeTrainingController.getTrainingModule);

// Patient Knowledge Context Routes
router.get('/patient/:patientId/context', knowledgeTrainingController.getPatientKnowledgeContext);
router.post('/patient/:patientId/analyze-document', knowledgeTrainingController.analyzePatientDocument);
router.post('/patient/:patientId/knowledge', knowledgeTrainingController.addPatientKnowledge);
router.post('/patient/:patientId/enroll-training', knowledgeTrainingController.enrollInTraining);
router.put('/patient/:patientId/training/:trainingId/progress', knowledgeTrainingController.updateTrainingProgress);
router.get('/patient/:patientId/analytics', knowledgeTrainingController.getPatientLearningAnalytics);
router.put('/patient/:patientId/care-plan', knowledgeTrainingController.updateCarePlanIntegration);

// Create new content routes
router.post('/training', knowledgeTrainingController.createTrainingModule);
router.post('/knowledge', knowledgeTrainingController.createKnowledgeArticle);

export default router;
