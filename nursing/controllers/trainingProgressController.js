import trainingProgressService from '../services/trainingProgressService.js';

class TrainingProgressController {
  // Enroll in training
  async enrollInTraining(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { trainingId, patientId } = req.body;

      if (!trainingId) {
        return res.status(400).json({
          success: false,
          message: 'Training ID is required'
        });
      }

      const result = await trainingProgressService.enrollInTraining(
        userId, 
        trainingId, 
        patientId
      );

      if (result.success) {
        // Check if it's an existing enrollment
        const statusCode = result.message === 'Already enrolled in this training' ? 200 : 201;
        res.status(statusCode).json({
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
      console.error('Error in enrollInTraining controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get training progress
  async getTrainingProgress(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { trainingId } = req.params;

      const result = await trainingProgressService.getTrainingProgress(
        userId, 
        trainingId
      );

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
      console.error('Error in getTrainingProgress controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's all training progress
  async getUserTrainingProgress(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { status } = req.query;

      const result = await trainingProgressService.getUserTrainingProgress(
        userId, 
        status
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
      console.error('Error in getUserTrainingProgress controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update training progress
  async updateProgress(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { trainingId, moduleIndex, totalModules } = req.body;

      if (!trainingId || moduleIndex === undefined || !totalModules) {
        return res.status(400).json({
          success: false,
          message: 'Training ID, module index, and total modules are required'
        });
      }

      const result = await trainingProgressService.updateProgress(
        userId, 
        trainingId, 
        moduleIndex, 
        totalModules
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
      console.error('Error in updateProgress controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Complete training
  async completeTraining(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { trainingId, score, timeSpent, answers, completedModules } = req.body;

      if (!trainingId || score === undefined || timeSpent === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Training ID, score, and time spent are required'
        });
      }

      const completionData = {
        score,
        timeSpent,
        answers: answers || {},
        completedModules: completedModules || []
      };

      const result = await trainingProgressService.completeTraining(
        userId, 
        trainingId, 
        completionData
      );

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
      console.error('Error in completeTraining controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get training statistics
  async getTrainingStats(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);

      const result = await trainingProgressService.getTrainingStats(userId);

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
      console.error('Error in getTrainingStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Submit training feedback
  async submitFeedback(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { trainingId, rating, comment } = req.body;

      if (!trainingId || !rating) {
        return res.status(400).json({
          success: false,
          message: 'Training ID and rating are required'
        });
      }

      const feedback = {
        rating: parseInt(rating),
        comment: comment || ''
      };

      const result = await trainingProgressService.submitFeedback(
        userId, 
        trainingId, 
        feedback
      );

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
      console.error('Error in submitFeedback controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new TrainingProgressController();
