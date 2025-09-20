import knowledgeTrainingService from '../services/knowledgeTrainingService.js';

class KnowledgeTrainingController {
  // Knowledge Base Controllers
  async createKnowledgeBase(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const knowledgeData = {
        ...req.body,
        createdBy: userId,
        lastModifiedBy: userId
      };

      const result = await knowledgeTrainingService.createKnowledgeBase(knowledgeData);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Knowledge base created successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in createKnowledgeBase controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateKnowledgeBase(req, res) {
    try {
      const { knowledgeId } = req.params;
      const userId = String(req.user._id || req.user.id);
      
      const updateData = {
        ...req.body,
        lastModifiedBy: userId
      };

      const result = await knowledgeTrainingService.updateKnowledgeBase(knowledgeId, updateData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Knowledge base updated successfully',
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateKnowledgeBase controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getKnowledgeBase(req, res) {
    try {
      const { knowledgeId } = req.params;
      const result = await knowledgeTrainingService.getKnowledgeBase(knowledgeId);
      
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
      console.error('Error in getKnowledgeBase controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async analyzeKnowledgeWithAI(req, res) {
    try {
      const { knowledgeId } = req.params;
      const result = await knowledgeTrainingService.analyzeKnowledgeWithAI(knowledgeId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'AI analysis completed successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in analyzeKnowledgeWithAI controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async searchKnowledge(req, res) {
    try {
      const { query, category, difficulty } = req.query;
      const filters = {};
      
      if (category) filters.category = category;
      if (difficulty) filters['aiAnalysis.complexity'] = difficulty;

      const result = await knowledgeTrainingService.searchKnowledge(query, filters);
      
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
      console.error('Error in searchKnowledge controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getKnowledgeByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit = 20 } = req.query;
      
      const result = await knowledgeTrainingService.getKnowledgeByCategory(category, parseInt(limit));
      
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
      console.error('Error in getKnowledgeByCategory controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getPopularKnowledge(req, res) {
    try {
      const { limit = 10 } = req.query;
      const result = await knowledgeTrainingService.getPopularKnowledge(parseInt(limit));
      
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
      console.error('Error in getPopularKnowledge controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Training Module Controllers
  async createTrainingModule(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const trainingData = {
        ...req.body,
        createdBy: userId,
        lastModifiedBy: userId
      };

      const result = await knowledgeTrainingService.createTrainingModule(trainingData);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Training module created successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in createTrainingModule controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getTrainingModule(req, res) {
    try {
      const { trainingId } = req.params;
      const result = await knowledgeTrainingService.getTrainingModule(trainingId);
      
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
      console.error('Error in getTrainingModule controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getTrainingByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit = 20 } = req.query;
      
      const result = await knowledgeTrainingService.getTrainingByCategory(category, parseInt(limit));
      
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
      console.error('Error in getTrainingByCategory controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getPopularTraining(req, res) {
    try {
      const { limit = 10 } = req.query;
      const result = await knowledgeTrainingService.getPopularTraining(parseInt(limit));
      
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
      console.error('Error in getPopularTraining controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Patient Knowledge Context Controllers
  async getPatientKnowledgeContext(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      
      const result = await knowledgeTrainingService.getPatientKnowledgeContext(patientId, userId);
      
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
      console.error('Error in getPatientKnowledgeContext controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async analyzePatientDocument(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const documentData = req.body;

      const result = await knowledgeTrainingService.analyzePatientDocument(patientId, userId, documentData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Document analyzed successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in analyzePatientDocument controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async addPatientKnowledge(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const knowledgeData = {
        ...req.body,
        addedBy: userId
      };

      const result = await knowledgeTrainingService.addPatientKnowledge(patientId, userId, knowledgeData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Knowledge added to patient context successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in addPatientKnowledge controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async enrollInTraining(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const trainingData = {
        ...req.body,
        enrolledBy: userId
      };

      const result = await knowledgeTrainingService.enrollInTraining(patientId, userId, trainingData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Enrolled in training successfully',
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

  async updateTrainingProgress(req, res) {
    try {
      const { patientId, trainingId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const progressData = req.body;

      const result = await knowledgeTrainingService.updateTrainingProgress(patientId, userId, trainingId, progressData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Training progress updated successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateTrainingProgress controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getPatientLearningAnalytics(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      
      const result = await knowledgeTrainingService.getPatientLearningAnalytics(patientId, userId);
      
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
      console.error('Error in getPatientLearningAnalytics controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateCarePlanIntegration(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);
      const carePlanData = req.body;

      const result = await knowledgeTrainingService.updateCarePlanIntegration(patientId, userId, carePlanData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Care plan integration updated successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateCarePlanIntegration controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create new training module
  async createTrainingModule(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const trainingData = {
        ...req.body,
        createdBy: userId,
        lastModifiedBy: userId
      };

      const result = await knowledgeTrainingService.createTrainingModule(trainingData);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Training module created successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in createTrainingModule controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create new knowledge article
  async createKnowledgeArticle(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const knowledgeData = {
        ...req.body,
        createdBy: userId,
        lastModifiedBy: userId
      };

      const result = await knowledgeTrainingService.createKnowledgeArticle(knowledgeData);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Knowledge article created successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in createKnowledgeArticle controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new KnowledgeTrainingController();
