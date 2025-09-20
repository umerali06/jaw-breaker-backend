import OASISAssessment from '../../models/nursing/OASISAssessment.js';
import azureOpenAIService from '../../services/azureOpenAIService.js';

// Create a new OASIS assessment
export const createOASISAssessment = async (req, res) => {
  try {
    const { patientId, assessmentType, episodeId, oasisData, referralDocument, assessmentText } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!patientId || !assessmentType || !episodeId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, assessment type, and episode ID are required'
      });
    }

    // Create new assessment
    const assessment = new OASISAssessment({
      patientId,
      userId,
      assessmentType,
      episodeId,
      oasisData: oasisData || {},
      status: 'draft',
      metadata: {
        startTime: new Date(),
        location: 'Web Application',
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress
      }
    });

    // Calculate initial scores
    assessment.calculateScores();

    // Save assessment
    await assessment.save();

    // If referral document or assessment text is provided, perform AI analysis
    if (referralDocument || assessmentText) {
      try {
        const aiAnalysis = await performAIAnalysis(assessment, referralDocument, assessmentText);
        assessment.aiAnalysis = aiAnalysis;
        await assessment.save();
      } catch (aiError) {
        console.error('AI Analysis Error:', aiError);
        // Don't fail the assessment creation if AI analysis fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'OASIS assessment created successfully',
      data: {
        assessmentId: assessment._id,
        status: assessment.status,
        completionPercentage: assessment.completionPercentage,
        scoring: assessment.scoring
      }
    });

  } catch (error) {
    console.error('Error creating OASIS assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create OASIS assessment',
      error: error.message
    });
  }
};

// Get OASIS assessments for a patient
export const getOASISAssessments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.id;

    const assessments = await OASISAssessment.find({
      patientId,
      userId
    })
    .populate('patientId', 'name id')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: assessments
    });

  } catch (error) {
    console.error('Error fetching OASIS assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OASIS assessments',
      error: error.message
    });
  }
};

// Get a specific OASIS assessment
export const getOASISAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    const assessment = await OASISAssessment.findOne({
      _id: assessmentId,
      userId
    }).populate('patientId', 'name id');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'OASIS assessment not found'
      });
    }

    res.json({
      success: true,
      data: assessment
    });

  } catch (error) {
    console.error('Error fetching OASIS assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OASIS assessment',
      error: error.message
    });
  }
};

// Update OASIS assessment
export const updateOASISAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { oasisData, status } = req.body;
    const userId = req.user.id;

    const assessment = await OASISAssessment.findOne({
      _id: assessmentId,
      userId
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'OASIS assessment not found'
      });
    }

    // Update OASIS data
    if (oasisData) {
      assessment.oasisData = { ...assessment.oasisData, ...oasisData };
    }

    // Update status
    if (status) {
      assessment.status = status;
    }

    // Recalculate scores
    assessment.calculateScores();

    // Add to history
    assessment.history.push({
      userId,
      action: 'updated',
      changes: { oasisData, status },
      timestamp: new Date()
    });

    await assessment.save();

    res.json({
      success: true,
      message: 'OASIS assessment updated successfully',
      data: {
        assessmentId: assessment._id,
        status: assessment.status,
        completionPercentage: assessment.completionPercentage,
        scoring: assessment.scoring
      }
    });

  } catch (error) {
    console.error('Error updating OASIS assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update OASIS assessment',
      error: error.message
    });
  }
};

// Complete OASIS assessment
export const completeOASISAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { oasisData, referralDocument, assessmentText } = req.body;
    const userId = req.user.id;

    const assessment = await OASISAssessment.findOne({
      _id: assessmentId,
      userId
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'OASIS assessment not found'
      });
    }

    // Update OASIS data
    if (oasisData) {
      assessment.oasisData = { ...assessment.oasisData, ...oasisData };
    }

    // Mark as completed
    assessment.status = 'completed';
    assessment.metadata.completedAt = new Date();
    assessment.metadata.duration = Math.floor(
      (assessment.metadata.completedAt - assessment.metadata.startTime) / 1000
    );

    // Recalculate scores
    assessment.calculateScores();

    // Perform AI analysis
    try {
      const aiAnalysis = await performAIAnalysis(assessment, referralDocument, assessmentText);
      assessment.aiAnalysis = aiAnalysis;
    } catch (aiError) {
      console.error('AI Analysis Error:', aiError);
      // Continue with completion even if AI analysis fails
    }

    // Add to history
    assessment.history.push({
      userId,
      action: 'completed',
      changes: { status: 'completed', oasisData },
      timestamp: new Date()
    });

    await assessment.save();

    res.json({
      success: true,
      message: 'OASIS assessment completed successfully',
      data: {
        assessmentId: assessment._id,
        status: assessment.status,
        completionPercentage: assessment.completionPercentage,
        scoring: assessment.scoring,
        aiAnalysis: assessment.aiAnalysis
      }
    });

  } catch (error) {
    console.error('Error completing OASIS assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete OASIS assessment',
      error: error.message
    });
  }
};

// Delete OASIS assessment
export const deleteOASISAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    const assessment = await OASISAssessment.findOneAndDelete({
      _id: assessmentId,
      userId
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'OASIS assessment not found'
      });
    }

    res.json({
      success: true,
      message: 'OASIS assessment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting OASIS assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete OASIS assessment',
      error: error.message
    });
  }
};

// Get OASIS assessment statistics
export const getOASISAssessmentStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { patientId, startDate, endDate } = req.query;

    const matchStage = { userId };
    if (patientId) matchStage.patientId = patientId;
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await OASISAssessment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAssessments: { $sum: 1 },
          completedAssessments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageScore: { $avg: '$scoring.totalScore' },
          averageCompletionTime: { $avg: '$metadata.duration' },
          assessmentTypes: { $push: '$assessmentType' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAssessments: 1,
          completedAssessments: 1,
          completionRate: {
            $multiply: [
              { $divide: ['$completedAssessments', '$totalAssessments'] },
              100
            ]
          },
          averageScore: { $round: ['$averageScore', 2] },
          averageCompletionTime: { $round: ['$averageCompletionTime', 0] },
          assessmentTypes: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalAssessments: 0,
        completedAssessments: 0,
        completionRate: 0,
        averageScore: 0,
        averageCompletionTime: 0,
        assessmentTypes: []
      }
    });

  } catch (error) {
    console.error('Error fetching OASIS assessment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OASIS assessment statistics',
      error: error.message
    });
  }
};

// Perform AI analysis on OASIS assessment
const performAIAnalysis = async (assessment, referralDocument, assessmentText) => {
  try {
    const prompt = `
Please provide a comprehensive OASIS assessment analysis based on the following information:

Patient: ${assessment.patientId}
Assessment Type: ${assessment.assessmentType}
Episode ID: ${assessment.episodeId}

OASIS Responses: ${JSON.stringify(assessment.oasisData)}

${referralDocument ? `Referral Document: ${referralDocument}` : ''}
${assessmentText ? `Assessment Text: ${assessmentText}` : ''}

Please provide:
1. Complete OASIS scoring for all relevant items
2. Clinical rationale for each score
3. Risk factors and care recommendations
4. Compliance with CMS guidelines
5. Quality indicators and outcome predictions

Format your response as a comprehensive markdown document with clear sections and professional medical analysis.
    `;

    const aiResponse = await azureOpenAIService.callAzureOpenAI(
      "You are a clinical AI assistant specializing in OASIS assessments. Provide comprehensive analysis and recommendations based on the assessment data provided.",
      prompt
    );
    
    return {
      completenessScore: calculateCompletenessScore(assessment.oasisData),
      accuracyScore: 85, // Placeholder - would need more sophisticated analysis
      recommendations: extractRecommendations(aiResponse),
      flaggedItems: extractFlaggedItems(assessment.oasisData),
      qualityScore: calculateQualityScore(assessment.oasisData),
      riskPredictions: {
        readmissionRisk: {
          probability: 0.3,
          confidence: 0.8,
          factors: ['High OASIS score', 'Multiple comorbidities']
        },
        deteriorationRisk: {
          probability: 0.2,
          confidence: 0.7,
          factors: ['Functional limitations', 'Cognitive impairment']
        },
        fallRisk: {
          probability: 0.4,
          confidence: 0.9,
          factors: ['Mobility issues', 'Balance problems']
        }
      },
      insights: [aiResponse],
      confidence: 85
    };

  } catch (error) {
    console.error('Error in AI analysis:', error);
    throw error;
  }
};

// Helper functions
const calculateCompletenessScore = (oasisData) => {
  const totalFields = Object.keys(oasisData).length;
  const completedFields = Object.values(oasisData).filter(
    value => value !== null && value !== undefined && value !== ''
  ).length;
  return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
};

const calculateQualityScore = (oasisData) => {
  // Simple quality scoring based on data consistency
  let score = 0;
  const functionalItems = ['M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860', 'M1870'];
  
  functionalItems.forEach(item => {
    if (oasisData[item] && !isNaN(parseInt(oasisData[item]))) {
      score += 10;
    }
  });
  
  return Math.min(score, 100);
};

const extractRecommendations = (response) => {
  // Extract recommendations from AI response
  const recommendations = [];
  const lines = response.split('\n');
  
  lines.forEach(line => {
    if (line.includes('recommend') || line.includes('suggest') || line.includes('consider')) {
      recommendations.push(line.trim());
    }
  });
  
  return recommendations.slice(0, 5); // Limit to 5 recommendations
};

const extractFlaggedItems = (oasisData) => {
  // Flag items that need attention
  const flagged = [];
  
  // Check for high-risk scores
  const highRiskItems = ['M1830', 'M1840', 'M1850', 'M1860', 'M1700', 'M1710'];
  highRiskItems.forEach(item => {
    if (oasisData[item] && parseInt(oasisData[item]) >= 3) {
      flagged.push(`${item}: High risk score (${oasisData[item]})`);
    }
  });
  
  return flagged;
};
