import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../../middleware/auth.js';
import {
  createOASISAssessment,
  getOASISAssessments,
  getOASISAssessment,
  updateOASISAssessment,
  completeOASISAssessment,
  deleteOASISAssessment,
  getOASISAssessmentStats
} from '../controllers/oasisAssessmentController.js';

const router = express.Router();

// Create a new OASIS assessment
router.post('/',
  authenticateToken,
  [
    body('patientId').isMongoId().withMessage('Valid patient ID is required'),
    body('assessmentType').isIn(['SOC', 'ROC', 'FU', 'TRF', 'DC']).withMessage('Valid assessment type is required'),
    body('episodeId').isString().notEmpty().withMessage('Episode ID is required'),
    body('oasisData').optional().isObject().withMessage('OASIS data must be an object'),
    body('referralDocument').optional().isString().withMessage('Referral document must be a string'),
    body('assessmentText').optional().isString().withMessage('Assessment text must be a string')
  ],
  createOASISAssessment
);

// Get OASIS assessments for a patient
router.get('/patient/:patientId',
  authenticateToken,
  [
    param('patientId').isMongoId().withMessage('Valid patient ID is required')
  ],
  getOASISAssessments
);

// Get a specific OASIS assessment
router.get('/:assessmentId',
  authenticateToken,
  [
    param('assessmentId').isMongoId().withMessage('Valid assessment ID is required')
  ],
  getOASISAssessment
);

// Update OASIS assessment
router.put('/:assessmentId',
  authenticateToken,
  [
    param('assessmentId').isMongoId().withMessage('Valid assessment ID is required'),
    body('oasisData').optional().isObject().withMessage('OASIS data must be an object'),
    body('status').optional().isIn(['draft', 'in_progress', 'completed', 'reviewed', 'submitted', 'locked']).withMessage('Valid status is required')
  ],
  updateOASISAssessment
);

// Complete OASIS assessment
router.post('/:assessmentId/complete',
  authenticateToken,
  [
    param('assessmentId').isMongoId().withMessage('Valid assessment ID is required'),
    body('oasisData').optional().isObject().withMessage('OASIS data must be an object'),
    body('referralDocument').optional().isString().withMessage('Referral document must be a string'),
    body('assessmentText').optional().isString().withMessage('Assessment text must be a string')
  ],
  completeOASISAssessment
);

// Delete OASIS assessment
router.delete('/:assessmentId',
  authenticateToken,
  [
    param('assessmentId').isMongoId().withMessage('Valid assessment ID is required')
  ],
  deleteOASISAssessment
);

// Get OASIS assessment statistics
router.get('/stats',
  authenticateToken,
  [
    query('patientId').optional().isMongoId().withMessage('Valid patient ID is required'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  getOASISAssessmentStats
);

export default router;
