import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import historyService from '../services/historyService.js';

const router = express.Router();

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Middleware to get user ID (mock for now)
const getUserId = (req, res, next) => {
  // TODO: Replace with actual authentication
  req.userId = req.user?.id || 'mock-user-id';
  next();
};

/**
 * @route GET /api/nursing/history/patient/:patientId
 * @desc Get patient's analysis history
 */
router.get('/patient/:patientId', [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  query('type').optional().isIn(['vitalSigns', 'medications', 'clinicalDecisions']).withMessage('Invalid analysis type'),
  getUserId,
  validateRequest
], async (req, res) => {
  try {
    const { patientId } = req.params;
    const { type } = req.query;
    const { userId } = req;

    const result = await historyService.getPatientHistory(patientId, type, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        count: result.data.length
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in get patient history route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/nursing/history/user
 * @desc Get user's analysis history
 */
router.get('/user', [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  getUserId,
  validateRequest
], async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const { userId } = req;

    const result = await historyService.getUserHistory(userId, parseInt(limit));
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        count: result.data.length
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in get user history route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route DELETE /api/nursing/history/entry/:entryId
 * @desc Delete specific analysis entry
 */
router.delete('/entry/:entryId', [
  param('entryId').isMongoId().withMessage('Invalid entry ID'),
  getUserId,
  validateRequest
], async (req, res) => {
  try {
    const { entryId } = req.params;
    const { userId } = req;

    const result = await historyService.deleteAnalysisEntry(entryId, userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error in delete analysis entry route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route DELETE /api/nursing/history/patient/:patientId
 * @desc Clear all patient history
 */
router.delete('/patient/:patientId', [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  getUserId,
  validateRequest
], async (req, res) => {
  try {
    const { patientId } = req.params;
    const { userId } = req;

    const result = await historyService.clearPatientHistory(patientId, userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in clear patient history route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/nursing/history/stats
 * @desc Get analysis statistics
 */
router.get('/stats', [
  getUserId,
  validateRequest
], async (req, res) => {
  try {
    const { userId } = req;

    const result = await historyService.getAnalysisStats(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in get analysis stats route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
