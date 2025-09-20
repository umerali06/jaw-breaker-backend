import riskManagementService from '../services/riskManagementService.js';

export const createRisk = async (req, res) => {
  try {
    const risk = await riskManagementService.createRisk(req.body, req.user._id || req.userId);
    res.status(201).json({
      success: true,
      message: 'Risk created successfully',
      data: risk
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getRisks = async (req, res) => {
  try {
    const filters = req.query;
    
    // If patientId is in params, add it to filters
    if (req.params.patientId) {
      filters.patientId = req.params.patientId;
    }
    
    const risks = await riskManagementService.getRisks(filters);
    res.status(200).json({
      success: true,
      data: risks
    });
  } catch (error) {
    console.error('Error in getRisks controller:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getRiskById = async (req, res) => {
  try {
    const risk = await riskManagementService.getRiskById(req.params.id);
    res.status(200).json({
      success: true,
      data: risk
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

export const updateRisk = async (req, res) => {
  try {
    const risk = await riskManagementService.updateRisk(req.params.id, req.body, req.user._id || req.userId);
    res.status(200).json({
      success: true,
      message: 'Risk updated successfully',
      data: risk
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteRisk = async (req, res) => {
  try {
    await riskManagementService.deleteRisk(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Risk deleted successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

export const getRiskAnalytics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '7d';
    const analytics = await riskManagementService.getRiskAnalytics(timeRange);
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const performAIAnalysis = async (req, res) => {
  try {
    const { id: riskId } = req.params;
    const { patientId, aiModel = 'gpt-5-chat' } = req.body;
    const userId = req.user?._id || req.user?.id;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required for AI analysis'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    const risk = await riskManagementService.performAIAnalysis(riskId, patientId, userId, aiModel);
    res.status(200).json({
      success: true,
      message: 'AI analysis completed',
      data: risk
    });
  } catch (error) {
    console.error('Error in performAIAnalysis controller:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const filters = req.query;
    
    // If patientId is in params, add it to filters
    if (req.params.patientId) {
      filters.patientId = req.params.patientId;
    }
    
    const alerts = await riskManagementService.getAlerts(filters);
    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error in getAlerts controller:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const markAlertAsRead = async (req, res) => {
  try {
    const alert = await riskManagementService.markAlertAsRead(req.params.id, req.user._id || req.userId);
    res.status(200).json({
      success: true,
      message: 'Alert marked as read',
      data: alert
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteAlert = async (req, res) => {
  try {
    await riskManagementService.deleteAlert(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};
