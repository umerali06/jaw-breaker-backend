import express from 'express';
import {
  createRisk,
  getRisks,
  getRiskById,
  updateRisk,
  deleteRisk,
  getRiskAnalytics,
  performAIAnalysis,
  getAlerts,
  markAlertAsRead,
  deleteAlert
} from '../controllers/riskManagementController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Risk Management Routes
router.post('/risks', authenticateToken, createRisk);
router.get('/risks', authenticateToken, getRisks);
router.get('/risks/patient/:patientId', authenticateToken, getRisks);
router.get('/risks/:id', authenticateToken, getRiskById);
router.put('/risks/:id', authenticateToken, updateRisk);
router.delete('/risks/:id', authenticateToken, deleteRisk);

// Risk Analytics Routes
router.get('/analytics', authenticateToken, getRiskAnalytics);
router.get('/analytics/patient/:patientId', authenticateToken, getRiskAnalytics);
router.post('/risks/:id/analyze', authenticateToken, performAIAnalysis);

// Risk Alerts Routes
router.get('/alerts', authenticateToken, getAlerts);
router.get('/alerts/patient/:patientId', authenticateToken, getAlerts);
router.put('/alerts/:id/read', authenticateToken, markAlertAsRead);
router.delete('/alerts/:id', authenticateToken, deleteAlert);

export default router;


