import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken as auth } from '../middleware/auth.js';
import {
  getCommunicationHistory,
  createCommunication,
  generateAICommunication,
  updateCommunication,
  getCommunicationAnalytics,
  getCommunicationTemplates,
  searchCommunications,
  deleteCommunication
} from '../controllers/patientCommunicationController.js';

const router = express.Router();

// Validation middleware
const validateCommunication = [
  body('communicationType')
    .isIn(['chat', 'education', 'instruction', 'reminder', 'followup', 'emergency', 'family_update'])
    .withMessage('Invalid communication type'),
  body('message')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message must be between 1 and 10000 characters'),
  body('patientId')
    .optional()
    .isMongoId()
    .withMessage('Invalid patient ID'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('templateUsed')
    .optional()
    .isObject()
    .withMessage('Template used must be an object')
];

const validateAICommunication = [
  body('communicationType')
    .isIn(['chat', 'education', 'instruction', 'reminder', 'followup', 'emergency', 'family_update'])
    .withMessage('Invalid communication type'),
  body('userMessage')
    .isLength({ min: 1, max: 5000 })
    .withMessage('User message must be between 1 and 5000 characters'),
  body('patientId')
    .optional()
    .isMongoId()
    .withMessage('Invalid patient ID'),
  body('targetAudience')
    .optional()
    .isIn(['patient', 'family', 'caregiver', 'healthcare_team'])
    .withMessage('Invalid target audience'),
  body('urgencyLevel')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid urgency level')
];

const validateUpdate = [
  body('response')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Response must be less than 10000 characters'),
  body('feedback')
    .optional()
    .isObject()
    .withMessage('Feedback must be an object'),
  body('outcomes')
    .optional()
    .isObject()
    .withMessage('Outcomes must be an object'),
  body('aiSuggestions')
    .optional()
    .isArray()
    .withMessage('AI suggestions must be an array')
];

// Routes
router.get('/history', auth, getCommunicationHistory);
router.post('/create', auth, validateCommunication, createCommunication);
router.post('/generate-ai', auth, validateAICommunication, generateAICommunication);
router.put('/:id', auth, validateUpdate, updateCommunication);
router.get('/analytics', auth, getCommunicationAnalytics);
router.get('/templates', auth, getCommunicationTemplates);
router.get('/search', auth, searchCommunications);
router.delete('/:id', auth, deleteCommunication);

export default router;
