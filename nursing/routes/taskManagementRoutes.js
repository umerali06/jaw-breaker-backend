import express from 'express';
import taskManagementController from '../controllers/taskManagementController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Task CRUD Routes
router.post('/tasks', taskManagementController.createTask);
router.get('/tasks/patient/:patientId', taskManagementController.getTasks);
router.get('/tasks/:taskId', taskManagementController.getTaskById);
router.put('/tasks/:taskId', taskManagementController.updateTask);
router.delete('/tasks/:taskId', taskManagementController.deleteTask);

// Task Management Routes
router.put('/tasks/:taskId/progress', taskManagementController.updateTaskProgress);
router.put('/tasks/:taskId/complete', taskManagementController.completeTask);
router.put('/tasks/:taskId/cancel', taskManagementController.cancelTask);

// AI Analysis Routes
router.post('/analyze', taskManagementController.analyzeAllTasks);
router.post('/tasks/:taskId/analyze', taskManagementController.analyzeTask);
router.get('/insights/patient/:patientId', taskManagementController.generateInsights);
router.post('/ai-suggestions', taskManagementController.getAISuggestions);

// Notification Routes
router.get('/notifications/patient/:patientId', taskManagementController.getNotifications);
router.put('/notifications/:notificationId/read', taskManagementController.markNotificationAsRead);

// Analytics Routes
router.get('/analytics/patient/:patientId', taskManagementController.getAnalytics);

// Settings Routes
router.get('/settings/patient/:patientId', taskManagementController.getSettings);
router.put('/settings/patient/:patientId', taskManagementController.updateSettings);

export default router;

