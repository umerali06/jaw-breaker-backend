import taskManagementService from '../services/taskManagementService.js';

class TaskManagementController {
  // Task CRUD Operations
  async createTask(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const taskData = {
        ...req.body,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await taskManagementService.createTask(taskData);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Task created successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in createTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getTasks(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const filters = req.query;

      const result = await taskManagementService.getTasks(patientId, userId, filters);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getTasks controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getTaskById(req, res) {
    try {
      const { taskId } = req.params;

      const result = await taskManagementService.getTaskById(taskId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getTaskById controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateTask(req, res) {
    try {
      const { taskId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };

      const result = await taskManagementService.updateTask(taskId, updateData);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task updated successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async deleteTask(req, res) {
    try {
      const { taskId } = req.params;

      const result = await taskManagementService.deleteTask(taskId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task deleted successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in deleteTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Task Management Operations
  async updateTaskProgress(req, res) {
    try {
      const { taskId } = req.params;
      const { progress } = req.body;

      if (progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          message: 'Progress must be between 0 and 100'
        });
      }

      const result = await taskManagementService.updateTaskProgress(taskId, progress);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task progress updated successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateTaskProgress controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async completeTask(req, res) {
    try {
      const { taskId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.completeTask(taskId, userId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task completed successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in completeTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async cancelTask(req, res) {
    try {
      const { taskId } = req.params;
      const { reason } = req.body;

      const result = await taskManagementService.cancelTask(taskId, reason);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task cancelled successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in cancelTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // AI Analysis
  async analyzeAllTasks(req, res) {
    try {
      const { patientId, aiModel } = req.body;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.analyzeAllTasksWithAI(patientId, userId, aiModel);

      if (result.success) {
        res.json({
          success: true,
          message: 'All tasks analyzed successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in analyzeAllTasks controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async analyzeTask(req, res) {
    try {
      const { taskId } = req.params;

      const result = await taskManagementService.analyzeTaskWithAI(taskId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task analyzed successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in analyzeTask controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async generateInsights(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.generateTaskInsights(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in generateInsights controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Notifications
  async getNotifications(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.getNotifications(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getNotifications controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async markNotificationAsRead(req, res) {
    try {
      const { patientId, notificationId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.markNotificationAsRead(patientId, userId, notificationId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Notification marked as read',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in markNotificationAsRead controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // AI Suggestions
  async getAISuggestions(req, res) {
    try {
      const { patientId, taskTitle, category, aiModel } = req.body;
      const userId = String(req.user._id || req.user.id);

      if (!patientId || !taskTitle) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID and task title are required'
        });
      }

      const result = await taskManagementService.generateAITaskSuggestions(
        patientId, 
        taskTitle, 
        category || 'medication', 
        aiModel || 'gpt-5-chat'
      );

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getAISuggestions controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Analytics
  async getAnalytics(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

      const result = await taskManagementService.getTaskAnalytics(patientId, userId, dateRange);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getAnalytics controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Settings
  async getSettings(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await taskManagementService.getSettings(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getSettings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateSettings(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const settings = req.body;

      const result = await taskManagementService.updateSettings(patientId, userId, settings);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateSettings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new TaskManagementController();

