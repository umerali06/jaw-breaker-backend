import qualityComplianceService from '../services/qualityComplianceService.js';
import { validationResult } from 'express-validator';

class QualityComplianceController {
  
  /**
   * Perform a quality compliance check
   * POST /api/nursing/quality-compliance/check
   */
  async performQualityCheck(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        checkType,
        checkCategory,
        checkTitle,
        checkDescription,
        patientContext,
        findings = [],
        recommendations = [],
        regulatoryStandards = [],
        qualityMetrics = {},
        followUpActions = [],
        tags = [],
        notes = '',
        sessionId
      } = req.body;

      const userId = String(req.user._id || req.user.id);
      const patientId = req.body.patientId || null;

      console.log('🔍 Quality compliance check request received:', {
        userId,
        patientId,
        checkType,
        checkCategory,
        sessionId
      });

      // Get patient context if not provided
      let finalPatientContext = patientContext;
      if (patientId && !patientContext) {
        console.log('🔍 Getting patient context...');
        finalPatientContext = await this.getPatientContext(patientId, userId);
        console.log('✅ Patient context retrieved:', finalPatientContext?.name);
      }

      const checkData = {
        checkType,
        checkCategory,
        checkTitle,
        checkDescription,
        patientContext: finalPatientContext,
        findings,
        recommendations,
        regulatoryStandards,
        qualityMetrics,
        followUpActions,
        tags,
        notes,
        sessionId
      };

      console.log('🔄 Performing quality compliance check...');
      const result = await qualityComplianceService.performQualityCheck(
        checkData,
        userId,
        patientId
      );

      console.log('✅ Quality compliance check completed:', result.success);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to perform quality compliance check',
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          checkId: result.data._id,
          sessionId: result.data.sessionId,
          complianceStatus: result.data.complianceStatus,
          complianceScore: result.data.complianceScore,
          riskAssessment: result.data.riskAssessment,
          recommendations: result.data.recommendations,
          followUpActions: result.data.followUpActions,
          timestamp: result.data.createdAt
        }
      });

    } catch (error) {
      console.error('Error in performQualityCheck:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user's quality compliance history
   * GET /api/nursing/quality-compliance/history
   */
  async getQualityComplianceHistory(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const {
        patientId,
        checkType,
        checkCategory,
        complianceStatus,
        startDate,
        endDate,
        limit = 20,
        skip = 0,
        includeArchived = false
      } = req.query;

      const options = {
        patientId,
        checkType,
        checkCategory,
        complianceStatus,
        startDate,
        endDate,
        limit: parseInt(limit),
        skip: parseInt(skip),
        includeArchived: includeArchived === 'true'
      };

      console.log('📋 Getting quality compliance history:', { userId, options });

      const result = await qualityComplianceService.getUserQualityCompliance(userId, options);

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
      console.error('Error in getQualityComplianceHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get quality compliance statistics
   * GET /api/nursing/quality-compliance/stats
   */
  async getQualityComplianceStats(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const patientId = req.query.patientId || null; // Normalize undefined to null
      const includeArchived = req.query.includeArchived === 'true';

      console.log('📊 Getting quality compliance stats:', { userId, patientId });

      const result = await qualityComplianceService.getUserQualityStats(
        userId,
        patientId,
        { includeArchived }
      );

      console.log('📊 Controller result:', result);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      console.log('📊 Controller sending response:', {
        success: true,
        data: result.data
      });

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getQualityComplianceStats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get compliance trends
   * GET /api/nursing/quality-compliance/trends
   */
  async getComplianceTrends(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const patientId = req.query.patientId || null; // Normalize undefined to null
      const days = parseInt(req.query.days) || 30;

      console.log('📈 Getting compliance trends:', { userId, patientId, days });

      const result = await qualityComplianceService.getComplianceTrends(
        userId,
        patientId,
        days
      );

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
      console.error('Error in getComplianceTrends:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get quality compliance check by ID
   * GET /api/nursing/quality-compliance/:checkId
   */
  async getQualityCheckById(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { checkId } = req.params;

      console.log('🔍 Getting quality compliance check by ID:', { userId, checkId });

      const result = await qualityComplianceService.getQualityCheckById(checkId, userId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in getQualityCheckById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update quality compliance check
   * PUT /api/nursing/quality-compliance/:checkId
   */
  async updateQualityCheck(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = String(req.user._id || req.user.id);
      const { checkId } = req.params;
      const updateData = req.body;

      console.log('🔄 Updating quality compliance check:', { userId, checkId });

      const result = await qualityComplianceService.updateQualityCheck(
        checkId,
        userId,
        updateData
      );

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error in updateQualityCheck:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Archive quality compliance check
   * POST /api/nursing/quality-compliance/:checkId/archive
   */
  async archiveQualityCheck(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { checkId } = req.params;

      console.log('📁 Archiving quality compliance check:', { userId, checkId });

      const result = await qualityComplianceService.archiveQualityCheck(checkId, userId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error in archiveQualityCheck:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete quality compliance check
   * DELETE /api/nursing/quality-compliance/:checkId
   */
  async deleteQualityCheck(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { checkId } = req.params;

      console.log('🗑️ Deleting quality compliance check:', { userId, checkId });

      const result = await qualityComplianceService.deleteQualityCheck(checkId, userId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error in deleteQualityCheck:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Search quality compliance checks
   * GET /api/nursing/quality-compliance/search
   */
  async searchQualityChecks(req, res) {
    try {
      const userId = String(req.user._id || req.user.id);
      const { q: searchQuery } = req.query;
      const {
        patientId,
        checkType,
        checkCategory,
        complianceStatus,
        limit = 20,
        skip = 0
      } = req.query;

      if (!searchQuery || searchQuery.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const options = {
        patientId,
        checkType,
        checkCategory,
        complianceStatus,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };

      console.log('🔍 Searching quality compliance checks:', { userId, searchQuery, options });

      const result = await qualityComplianceService.searchQualityChecks(
        userId,
        searchQuery,
        options
      );

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
      console.error('Error in searchQualityChecks:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get available check types and categories
   * GET /api/nursing/quality-compliance/options
   */
  async getQualityComplianceOptions(req, res) {
    try {
      const checkTypes = qualityComplianceService.getAvailableCheckTypes();
      const checkCategories = qualityComplianceService.getAvailableCheckCategories();

      res.json({
        success: true,
        data: {
          checkTypes,
          checkCategories
        }
      });

    } catch (error) {
      console.error('Error in getQualityComplianceOptions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Archive quality compliance check
   * POST /api/nursing/quality-compliance/:checkId/archive
   */
  async archiveQualityCheck(req, res) {
    try {
      const { checkId } = req.params;
      const userId = String(req.user._id || req.user.id);

      console.log('📦 Archiving quality compliance check:', { checkId, userId });

      const result = await qualityComplianceService.archiveQualityCheck(checkId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error in archiveQualityCheck:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get patient context for quality compliance checks
   */
  async getPatientContext(patientId, userId) {
    try {
      // Import Patient model dynamically to avoid circular dependencies
      const { default: Patient } = await import('../../../models/Patient.js');
      
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        console.log('⚠️ Patient not found, using default context');
        return {
          name: 'Unknown Patient',
          age: null,
          gender: 'Unknown',
          condition: 'Unknown',
          allergies: [],
          medications: [],
          riskFactors: [],
          carePlan: 'No care plan available'
        };
      }

      return {
        name: patient.name || 'Unknown Patient',
        age: patient.age || null,
        gender: patient.gender || 'Unknown',
        condition: patient.condition || 'Unknown',
        allergies: patient.allergies || [],
        medications: patient.currentMedications || [],
        riskFactors: patient.riskFactors || [],
        carePlan: patient.carePlan || 'No care plan available'
      };

    } catch (error) {
      console.error('❌ Error getting patient context:', error);
      return {
        name: 'Unknown Patient',
        age: null,
        gender: 'Unknown',
        condition: 'Unknown',
        allergies: [],
        medications: [],
        riskFactors: [],
        carePlan: 'No care plan available'
      };
    }
  }
}

export default new QualityComplianceController();
