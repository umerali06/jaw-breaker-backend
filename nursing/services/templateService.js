import UserTemplate from '../models/UserTemplate.js';
import historyService from './historyService.js';

class TemplateService {
  /**
   * Save a new template
   */
  async saveTemplate(templateData, userId, patientId = null) {
    try {
      console.log('TemplateService.saveTemplate called with:', { templateData, userId, patientId });
      
      const {
        templateName,
        condition,
        templateType,
        templateContent,
        description = '',
        tags = [],
        isPublic = false
      } = templateData;

      console.log('💾 Template service save:', {
        templateName,
        condition,
        templateType,
        isPublic,
        isPublicType: typeof isPublic,
        userId
      });

      // Check if template with same name already exists for this user
      const existingTemplate = await UserTemplate.findOne({
        userId,
        templateName,
        condition,
        templateType,
        isDeleted: false
      });

      if (existingTemplate) {
        return {
          success: false,
          error: 'A template with this name already exists for this condition and type'
        };
      }

      const newTemplate = new UserTemplate({
        userId,
        patientId,
        templateName,
        condition,
        templateType,
        templateData: templateContent,
        description,
        tags,
        isPublic,
        isCustom: true
      });

      const savedTemplate = await newTemplate.save();

      // Save to history
      await historyService.saveAnalysisResult(
        patientId || 'template-creation',
        'Template Creation',
        'customTemplate',
        {
          templateId: savedTemplate._id,
          templateName,
          condition,
          templateType,
          action: 'created'
        },
        templateData,
        userId
      );

      return {
        success: true,
        data: {
          templateId: savedTemplate._id,
          template: savedTemplate,
          message: 'Template saved successfully'
        }
      };

    } catch (error) {
      console.error('Error saving template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Copy an existing template
   */
  async copyTemplate(templateId, userId, newTemplateName = null, patientId = null) {
    try {
      // Get the original template
      const originalTemplate = await UserTemplate.getTemplateById(templateId, userId);

      if (!originalTemplate) {
        return {
          success: false,
          error: 'Template not found or access denied'
        };
      }

      // Generate new template name if not provided
      const templateName = newTemplateName || `${originalTemplate.templateName} (Copy)`;

      // Check if template with same name already exists
      const existingTemplate = await UserTemplate.findOne({
        userId,
        templateName,
        condition: originalTemplate.condition,
        templateType: originalTemplate.templateType,
        isDeleted: false
      });

      if (existingTemplate) {
        return {
          success: false,
          error: 'A template with this name already exists'
        };
      }

      // Create the copy
      const copiedTemplate = new UserTemplate({
        userId,
        patientId,
        templateName,
        condition: originalTemplate.condition,
        templateType: originalTemplate.templateType,
        templateData: originalTemplate.templateData,
        description: originalTemplate.description,
        tags: [...originalTemplate.tags],
        isPublic: false, // Copies are private by default
        isCustom: true,
        sourceTemplate: originalTemplate._id
      });

      const savedCopy = await copiedTemplate.save();

      // Save to history
      await historyService.saveAnalysisResult(
        patientId || 'template-copy',
        'Template Copy',
        'templateUpdate',
        {
          templateId: savedCopy._id,
          originalTemplateId: originalTemplate._id,
          templateName,
          condition: originalTemplate.condition,
          templateType: originalTemplate.templateType,
          action: 'copied'
        },
        {
          originalTemplate: originalTemplate.templateName,
          newTemplateName
        },
        userId
      );

      return {
        success: true,
        data: {
          templateId: savedCopy._id,
          template: savedCopy,
          originalTemplate: originalTemplate,
          message: 'Template copied successfully'
        }
      };

    } catch (error) {
      console.error('Error copying template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Use a template (increment usage count)
   */
  async useTemplate(templateId, userId, patientId = null) {
    try {
      const template = await UserTemplate.getTemplateById(templateId, userId);

      if (!template) {
        return {
          success: false,
          error: 'Template not found or access denied'
        };
      }

      // Increment usage count
      await template.incrementUsage();

      // Save to history
      await historyService.saveAnalysisResult(
        patientId || 'template-usage',
        'Template Usage',
        'templateUpdate',
        {
          templateId: template._id,
          templateName: template.templateName,
          condition: template.condition,
          templateType: template.templateType,
          usageCount: template.usageCount,
          action: 'used'
        },
        {
          templateData: template.templateData
        },
        userId
      );

      return {
        success: true,
        data: {
          template,
          message: 'Template used successfully'
        }
      };

    } catch (error) {
      console.error('Error using template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user templates
   */
  async getUserTemplates(userId, condition = null, templateType = null) {
    try {
      console.log('TemplateService.getUserTemplates called with:', { userId, condition, templateType });
      
      const templates = await UserTemplate.getUserTemplates(userId, condition, templateType);
      
      console.log('Found templates:', templates.length);

      return {
        success: true,
        data: templates
      };

    } catch (error) {
      console.error('Error getting user templates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get public templates
   */
  async getPublicTemplates(condition = null, templateType = null) {
    try {
      const templates = await UserTemplate.getPublicTemplates(condition, templateType);

      return {
        success: true,
        data: {
          templates,
          count: templates.length
        }
      };

    } catch (error) {
      console.error('Error getting public templates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(userId, searchTerm, condition = null, templateType = null) {
    try {
      const templates = await UserTemplate.searchTemplates(userId, searchTerm, condition, templateType);

      return {
        success: true,
        data: {
          templates,
          count: templates.length,
          searchTerm
        }
      };

    } catch (error) {
      console.error('Error searching templates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId, userId, updateData) {
    try {
      console.log('🔍 Template service updateTemplate called:', {
        templateId,
        templateIdType: typeof templateId,
        userId,
        updateData
      });

      // Validate templateId
      if (!templateId || typeof templateId !== 'string') {
        return {
          success: false,
          error: 'Invalid template ID provided'
        };
      }

      const template = await UserTemplate.findOne({
        _id: templateId,
        userId,
        isDeleted: false
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found or access denied'
        };
      }

      // Update allowed fields
      const allowedUpdates = ['templateName', 'description', 'tags', 'isPublic', 'templateData'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          template[field] = updateData[field];
        }
      });

      template.updatedAt = new Date();
      const updatedTemplate = await template.save();

      // Save to history
      await historyService.saveAnalysisResult(
        'template-update',
        'Template Update',
        'templateUpdate',
        {
          templateId: updatedTemplate._id,
          templateName: updatedTemplate.templateName,
          condition: updatedTemplate.condition,
          templateType: updatedTemplate.templateType,
          action: 'updated',
          changes: updateData
        },
        updateData,
        userId
      );

      return {
        success: true,
        data: {
          template: updatedTemplate,
          message: 'Template updated successfully'
        }
      };

    } catch (error) {
      console.error('Error updating template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId, userId) {
    try {
      const template = await UserTemplate.findOne({
        _id: templateId,
        userId,
        isDeleted: false
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found or access denied'
        };
      }

      // Soft delete
      await template.softDelete();

      // Save to history
      await historyService.saveAnalysisResult(
        'template-deletion',
        'Template Deletion',
        'templateUpdate',
        {
          templateId: template._id,
          templateName: template.templateName,
          condition: template.condition,
          templateType: template.templateType,
          action: 'deleted'
        },
        {
          templateData: template.templateData
        },
        userId
      );

      return {
        success: true,
        data: {
          message: 'Template deleted successfully'
        }
      };

    } catch (error) {
      console.error('Error deleting template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(userId) {
    try {
      const stats = await UserTemplate.getTemplateStats(userId);

      return {
        success: true,
        data: {
          stats: stats[0] || {
            totalTemplates: 0,
            totalUsage: 0,
            conditions: [],
            templateTypes: []
          }
        }
      };

    } catch (error) {
      console.error('Error getting template stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TemplateService();
