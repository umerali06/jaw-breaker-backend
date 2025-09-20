import mongoose from 'mongoose';
import PatientCommunication from '../models/PatientCommunication.js';
import Patient from '../models/Patient.js';
import File from '../models/File.js';
import azureOpenAIService from '../services/azureOpenAIService.js';
import { validationResult } from 'express-validator';

// Get patient communication history
const getCommunicationHistory = async (req, res) => {
  try {
    const { patientId, limit = 50, offset = 0, communicationType, search } = req.query;
    const userId = req.user.id;

    let query = { userId };
    
    if (patientId && patientId !== 'null' && patientId !== '') {
      query.patientId = patientId;
    }
    
    if (communicationType) {
      query.communicationType = communicationType;
    }
    
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { response: { $regex: search, $options: 'i' } }
      ];
    }

    const communications = await PatientCommunication.find(query)
      .populate('patientId', 'demographics.name demographics.dob demographics.sex')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await PatientCommunication.countDocuments(query);

    res.json({
      success: true,
      data: {
        communications,
        total,
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching communication history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communication history',
      error: error.message
    });
  }
};

// Create new patient communication
const createCommunication = async (req, res) => {
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
      patientId,
      communicationType,
      message,
      context,
      templateUsed,
      metadata
    } = req.body;

    const userId = req.user.id;

    // Verify patient exists and user has access
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }
    }

    // Create communication record
    const communication = new PatientCommunication({
      patientId: patientId || null,
      userId,
      communicationType,
      message,
      context: context || {},
      templateUsed: templateUsed || {},
      metadata: metadata || {},
      aiGenerated: false
    });

    await communication.save();

    // Populate patient data for response
    await communication.populate('patientId', 'demographics.name demographics.dob demographics.sex');

    // Broadcast new communication via WebSocket
    if (req.app.locals.patientCommWS) {
      req.app.locals.patientCommWS.broadcastNewCommunication(communication);
    }

    res.status(201).json({
      success: true,
      message: 'Communication created successfully',
      data: communication
    });
  } catch (error) {
    console.error('Error creating communication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create communication',
      error: error.message
    });
  }
};

// Generate AI-powered communication
const generateAICommunication = async (req, res) => {
  try {
    const {
      patientId,
      communicationType,
      userMessage,
      context,
      targetAudience = 'patient',
      urgencyLevel = 'medium'
    } = req.body;

    const userId = req.user.id;

    // Get comprehensive patient context
    let patientContext = {};
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (patient) {
        console.log('🔍 [PatientCommunication] Retrieved patient data:', {
          id: patient._id,
          name: patient.demographics?.name,
          age: patient.demographics?.age,
          gender: patient.demographics?.sex,
          mrn: patient.mrn,
          fullPatient: patient
        });
        
        patientContext = {
          name: patient.demographics?.name || 'Patient',
          age: patient.demographics?.age || 'Unknown',
          gender: patient.demographics?.sex || 'Unknown',
          mrn: patient.mrn || 'Unknown',
          conditions: patient.demographics?.conditions || [],
          medications: patient.demographics?.medications || [],
          allergies: patient.demographics?.allergies || [],
          vitalSigns: patient.demographics?.vitalSigns || {},
          carePlan: typeof patient.demographics?.carePlan === 'object' 
            ? JSON.stringify(patient.demographics?.carePlan) 
            : (patient.demographics?.carePlan || ''),
          lastVisit: patient.demographics?.lastVisit || null,
          emergencyContact: typeof patient.demographics?.emergencyContact === 'object'
            ? JSON.stringify(patient.demographics?.emergencyContact)
            : (patient.demographics?.emergencyContact || ''),
          insurance: typeof patient.demographics?.insurance === 'object'
            ? JSON.stringify(patient.demographics?.insurance)
            : (patient.demographics?.insurance || ''),
          preferences: typeof patient.demographics?.preferences === 'object'
            ? JSON.stringify(patient.demographics?.preferences)
            : (patient.demographics?.preferences || ''),
          riskFactors: patient.demographics?.riskFactors || [],
          treatmentGoals: patient.demographics?.treatmentGoals || [],
          // Add more comprehensive patient data
          phone: patient.demographics?.phone || '',
          email: patient.demographics?.email || '',
          address: patient.demographics?.address || '',
          dob: patient.demographics?.dob || '',
          // Include any additional fields from the patient record
          additionalInfo: patient.demographics?.additionalInfo || '',
          medicalHistory: patient.demographics?.medicalHistory || [],
          familyHistory: patient.demographics?.familyHistory || [],
          socialHistory: patient.demographics?.socialHistory || {}
        };
        
        console.log('🔍 [PatientCommunication] Patient context prepared:', patientContext);
      } else {
        console.log('⚠️ [PatientCommunication] Patient not found for ID:', patientId);
      }
    } else {
      console.log('⚠️ [PatientCommunication] No patientId provided');
    }

    // Get document context
    let documentContext = {};
    if (patientId) {
      const recentFiles = await File.find({ 
        patientId, 
        processingStatus: 'completed' 
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

      documentContext = {
        referencedDocuments: recentFiles.map(file => ({
          documentId: file._id,
          documentName: file.originalname,
          relevanceScore: 0.8, // Default relevance score
          extractedInsights: file.analysis?.clinicalInsights || []
        })),
        clinicalInsights: recentFiles.flatMap(file => file.analysis?.clinicalInsights || []),
        soapNotes: recentFiles.map(file => file.analysis?.soapNote).filter(Boolean),
        oasisScores: recentFiles.map(file => file.analysis?.oasisScores).filter(Boolean)
      };
    }

    // Get recent communication history for context
    const recentCommunications = await PatientCommunication.find({
      patientId: patientId || null,
      userId
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('message communicationType createdAt')
    .lean();

    // Prepare context and variety factors
    const requestId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Generate AI response
    const aiResponse = await azureOpenAIService.generatePatientCommunication({
      userMessage,
      communicationType,
      patientContext,
      documentContext,
      recentCommunications,
      targetAudience,
      urgencyLevel,
      context: {
        ...context,
        requestId,
        timestamp,
        userId,
        sessionId: req.sessionID || 'default'
      }
    });

    // Create communication record with schema-compliant context
    const communication = new PatientCommunication({
      patientId: patientId || null,
      userId,
      communicationType,
      message: userMessage,
      response: aiResponse,
      aiGenerated: true,
      aiModel: 'azure-openai',
      context: {
        patientContext: {
          currentConditions: patientContext.conditions || [],
          medications: patientContext.medications || [],
          allergies: patientContext.allergies || [],
          recentVitals: patientContext.vitalSigns || {},
          carePlan: patientContext.carePlan || '',
          riskFactors: patientContext.riskFactors || []
        },
        documentContext,
        communicationContext: {
          previousMessages: recentCommunications.map(c => c.message),
          communicationGoals: [communicationType],
          urgencyLevel,
          targetAudience
        }
      },
      metadata: {
        deviceType: req.headers['user-agent'] || 'unknown',
        sessionId: req.sessionID || 'unknown'
      }
    });

    await communication.save();
    await communication.populate('patientId', 'demographics.name demographics.dob demographics.sex');

    // Broadcast new communication via WebSocket
    if (req.app.locals.patientCommWS) {
      req.app.locals.patientCommWS.broadcastNewCommunication(communication);
    }

    res.json({
      success: true,
      message: 'AI communication generated successfully',
      data: {
        communication,
        aiResponse,
        context: {
          patientContext,
          documentContext,
          recentCommunications: recentCommunications.length
        }
      }
    });
  } catch (error) {
    console.error('Error generating AI communication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI communication',
      error: error.message
    });
  }
};

// Update communication (for responses, feedback, etc.)
const updateCommunication = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const communication = await PatientCommunication.findOne({
      _id: id,
      userId
    });

    if (!communication) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'response', 'responseReceived', 'responseTimestamp',
      'feedback', 'outcomes', 'aiSuggestions'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        communication[field] = updates[field];
      }
    });

    communication.updatedAt = new Date();
    await communication.save();

    await communication.populate('patientId', 'demographics.name demographics.dob demographics.sex');

    res.json({
      success: true,
      message: 'Communication updated successfully',
      data: communication
    });
  } catch (error) {
    console.error('Error updating communication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update communication',
      error: error.message
    });
  }
};

// Get communication analytics
const getCommunicationAnalytics = async (req, res) => {
  try {
    const { patientId, dateRange } = req.query;
    const userId = req.user.id;

    console.log('🔍 [Analytics] Request params:', { userId, patientId, dateRange });

    // First, let's check if there are any communications at all
    const totalCount = await PatientCommunication.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });
    console.log('🔍 [Analytics] Total communications for user:', totalCount);

    if (patientId) {
      const patientCount = await PatientCommunication.countDocuments({ 
        userId: new mongoose.Types.ObjectId(userId), 
        patientId: new mongoose.Types.ObjectId(patientId) 
      });
      console.log('🔍 [Analytics] Communications for specific patient:', patientCount);
    }

    const analytics = await PatientCommunication.getCommunicationAnalytics(
      new mongoose.Types.ObjectId(userId),
      patientId ? new mongoose.Types.ObjectId(patientId) : null,
      dateRange ? JSON.parse(dateRange) : {}
    );

    console.log('🔍 [Analytics] Raw analytics result:', analytics);

    // Get additional insights
    const communicationTypes = await PatientCommunication.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$communicationType',
          count: { $sum: 1 },
          avgEffectiveness: {
            $avg: {
              $cond: [
                { $and: ['$feedback.clarity', '$feedback.accuracy', '$feedback.patientSatisfaction'] },
                {
                  $divide: [
                    { $add: ['$feedback.clarity', '$feedback.accuracy', '$feedback.patientSatisfaction'] },
                    3
                  ]
                },
                null
              ]
            }
          }
        }
      }
    ]);

    const urgencyDistribution = await PatientCommunication.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$context.communicationContext.urgencyLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...analytics,
        communicationTypes,
        urgencyDistribution,
        insights: {
          mostEffectiveType: communicationTypes.reduce((max, current) => 
            (current.avgEffectiveness || 0) > (max.avgEffectiveness || 0) ? current : max
          , communicationTypes[0] || {}),
          totalPatients: await PatientCommunication.distinct('patientId', { userId }).then(ids => ids.length),
          avgCommunicationsPerPatient: analytics.totalCommunications / Math.max(1, await PatientCommunication.distinct('patientId', { userId }).then(ids => ids.length))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching communication analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communication analytics',
      error: error.message
    });
  }
};

// Get communication templates and suggestions
const getCommunicationTemplates = async (req, res) => {
  try {
    const { communicationType, patientId } = req.query;
    const userId = req.user.id;

    // Get patient context for personalized templates
    let patientContext = {};
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (patient) {
        patientContext = {
          name: patient.demographics?.name || 'Patient',
          conditions: patient.demographics?.conditions || [],
          medications: patient.demographics?.medications || []
        };
      }
    }

    // Generate AI-powered templates
    const templates = await azureOpenAIService.generateCommunicationTemplates({
      communicationType,
      patientContext,
      userId
    });

    res.json({
      success: true,
      data: {
        templates,
        patientContext,
        suggestions: templates.map(template => ({
          id: template.id,
          title: template.title,
          preview: template.content.substring(0, 100) + '...',
          useCase: template.useCase,
          customizationLevel: template.customizationLevel
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching communication templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communication templates',
      error: error.message
    });
  }
};

// Search communications
const searchCommunications = async (req, res) => {
  try {
    const { query, filters } = req.query;
    const userId = req.user.id;

    const searchResults = await PatientCommunication.searchCommunications(
      userId,
      query,
      filters ? JSON.parse(filters) : {}
    );

    res.json({
      success: true,
      data: {
        results: searchResults,
        total: searchResults.length,
        query,
        filters: filters ? JSON.parse(filters) : {}
      }
    });
  } catch (error) {
    console.error('Error searching communications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search communications',
      error: error.message
    });
  }
};

// Delete communication
const deleteCommunication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const communication = await PatientCommunication.findOneAndDelete({
      _id: id,
      userId
    });

    if (!communication) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    res.json({
      success: true,
      message: 'Communication deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting communication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete communication',
      error: error.message
    });
  }
};

export {
  getCommunicationHistory,
  createCommunication,
  generateAICommunication,
  updateCommunication,
  getCommunicationAnalytics,
  getCommunicationTemplates,
  searchCommunications,
  deleteCommunication
};
