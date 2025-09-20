import templateService from '../services/templateService.js';
import { validationResult } from 'express-validator';

class TemplateController {
  /**
   * Save a new template
   * POST /api/nursing/templates/save
   */
  async saveTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { templateName, condition, templateType, templateContent, description, tags, isPublic } = req.body;
      const userId = req.user._id || req.user.id;
      const { patientId } = req.query;

      console.log('💾 Template save request:', {
        templateName,
        condition,
        templateType,
        isPublic,
        isPublicType: typeof isPublic,
        userId,
        patientId
      });

      const result = await templateService.saveTemplate({
        templateName,
        condition,
        templateType,
        templateContent,
        description,
        tags,
        isPublic
      }, userId, patientId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in saveTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Copy an existing template
   * POST /api/nursing/templates/copy
   */
  async copyTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { templateId, newTemplateName } = req.body;
      const userId = req.user._id || req.user.id;
      const { patientId } = req.query;

      const result = await templateService.copyTemplate(templateId, userId, newTemplateName, patientId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in copyTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Use a template
   * POST /api/nursing/templates/use
   */
  async useTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { templateId } = req.body;
      const userId = req.user._id || req.user.id;
      const { patientId } = req.query;

      const result = await templateService.useTemplate(templateId, userId, patientId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in useTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user templates
   * GET /api/nursing/templates/my-templates
   */
  async getUserTemplates(req, res) {
    try {
      const { condition, templateType } = req.query;
      const userId = req.user._id || req.user.id;

      console.log('🔍 getUserTemplates called with:', { userId, condition, templateType });
      console.log('🔍 req.user:', req.user);

      const result = await templateService.getUserTemplates(userId, condition, templateType);
      console.log('📋 getUserTemplates result:', result);

      if (!result.success) {
        console.error('❌ getUserTemplates failed:', result.error);
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      console.log('✅ getUserTemplates success, returning:', result.data);
      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('❌ Error in getUserTemplates:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get public templates
   * GET /api/nursing/templates/public
   */
  async getPublicTemplates(req, res) {
    try {
      const { condition, templateType } = req.query;

      const result = await templateService.getPublicTemplates(condition, templateType);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getPublicTemplates:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Search templates
   * GET /api/nursing/templates/search
   */
  async searchTemplates(req, res) {
    try {
      const { q: searchTerm, condition, templateType } = req.query;
      const userId = req.user._id || req.user.id;

      const result = await templateService.searchTemplates(userId, searchTerm, condition, templateType);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in searchTemplates:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update template
   * PUT /api/nursing/templates/:templateId
   */
  async updateTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { templateId } = req.params;
      const updateData = req.body;
      const userId = req.user._id || req.user.id;

      console.log('🔄 Template update request:', {
        templateId,
        templateIdType: typeof templateId,
        userId,
        updateData
      });

      // Validate templateId is a valid string
      if (!templateId || typeof templateId !== 'string' || templateId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID provided'
        });
      }

      const result = await templateService.updateTemplate(templateId.trim(), userId, updateData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: {
          ...result.data,
          templateId: templateId,
          changes: updateData
        }
      });

    } catch (error) {
      console.error('Error in updateTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete template
   * DELETE /api/nursing/templates/:templateId
   */
  async deleteTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const userId = req.user._id || req.user.id;

      const result = await templateService.deleteTemplate(templateId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in deleteTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get template statistics
   * GET /api/nursing/templates/stats
   */
  async getTemplateStats(req, res) {
    try {
      const userId = req.user._id || req.user.id;

      const result = await templateService.getTemplateStats(userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getTemplateStats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

export default new TemplateController();
