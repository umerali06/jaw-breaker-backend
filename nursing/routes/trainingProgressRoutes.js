import express from 'express';
import trainingProgressController from '../controllers/trainingProgressController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Enroll in training
router.post('/enroll', trainingProgressController.enrollInTraining);

// Get specific training progress
router.get('/progress/:trainingId', trainingProgressController.getTrainingProgress);

// Get user's all training progress
router.get('/progress', trainingProgressController.getUserTrainingProgress);

// Update training progress
router.put('/progress', trainingProgressController.updateProgress);

// Complete training
router.post('/complete', trainingProgressController.completeTraining);

// Get training statistics
router.get('/stats', trainingProgressController.getTrainingStats);

// Submit training feedback
router.post('/feedback', trainingProgressController.submitFeedback);

export default router;
