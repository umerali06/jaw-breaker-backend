import nursingAIService from '../services/aiService.js';
import historyService from '../services/historyService.js';
import riskAssessmentService from '../services/riskAssessmentService.js';
import ClinicalAlert from '../models/ClinicalAlert.js';
import { validationResult } from 'express-validator';

class ClinicalDecisionController {
  /**
   * Generate clinical decision support for a patient
   * POST /api/nursing/clinical-decision
   */
  async generateClinicalDecision(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { patientId, query, context } = req.body;
      const userId = req.user.id;

      // Get patient data (this would typically come from your patient service)
      const patientData = await this.getPatientData(patientId, userId);
      
      if (!patientData) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Add context to patient data
      const enrichedPatientData = {
        ...patientData,
        clinicalContext: context,
        query: query
      };

      // Generate AI-powered clinical decision support
      const result = await nursingAIService.generateClinicalDecisionSupport(
        enrichedPatientData,
        query
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate clinical decision support',
          error: result.error
        });
      }

      // Log the clinical decision request
      await this.logClinicalDecisionRequest(userId, patientId, query, result);

      // Save to database
      const saveResult = await historyService.saveAnalysisResult(
        patientId,
        patientData.name || 'Unknown Patient',
        'clinicalDecisions',
        result,
        { query, context },
        userId
      );

      if (!saveResult.success) {
        console.error('Failed to save clinical decision to database:', saveResult.error);
      }

      res.json({
        success: true,
        data: {
          patientId,
          query,
          recommendations: result.recommendations,
          confidence: result.confidence,
          timestamp: result.timestamp,
          generatedBy: 'AI Clinical Decision Support'
        }
      });

    } catch (error) {
      console.error('Error in generateClinicalDecision:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Analyze vital signs and generate alerts
   * POST /api/nursing/vital-signs-analysis
   */
  async analyzeVitalSigns(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { patientId, vitalSigns, timeRange } = req.body;
      const userId = req.user.id;

      // Get patient context
      const patientContext = await this.getPatientContext(patientId, userId);
      
      if (!patientContext) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Analyze vital signs with AI
      const result = await nursingAIService.analyzeVitalSigns(
        vitalSigns,
        patientContext
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to analyze vital signs',
          error: result.error
        });
      }

      // Store vital signs analysis
      await this.storeVitalSignsAnalysis(userId, patientId, vitalSigns, result);

      // Save to database
      const saveResult = await historyService.saveAnalysisResult(
        patientId,
        patientContext.name || 'Unknown Patient',
        'vitalSigns',
        result,
        vitalSigns,
        userId
      );

      if (!saveResult.success) {
        console.error('Failed to save vital signs analysis to database:', saveResult.error);
      }

      // Create alerts if analysis contains alerts
      if (result.alerts && result.alerts.length > 0) {
        await this.createAlertsFromAnalysis(
          userId, 
          patientId, 
          result.alerts, 
          'ai_analysis',
          saveResult.analysisId
        );
      }

      res.json({
        success: true,
        data: {
          patientId,
          analysis: result.analysis,
          alerts: result.alerts,
          recommendations: result.recommendations,
          timestamp: result.timestamp
        }
      });

    } catch (error) {
      console.error('Error in analyzeVitalSigns:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Analyze medication interactions
   * POST /api/nursing/medication-analysis
   */
  async analyzeMedications(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { patientId, medications } = req.body;
      const userId = req.user.id;

      // Get patient profile
      const patientProfile = await this.getPatientProfile(patientId, userId);
      
      if (!patientProfile) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Analyze medications with AI
      const result = await nursingAIService.analyzeMedicationInteractions(
        medications,
        patientProfile
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to analyze medications',
          error: result.error
        });
      }

      // Store medication analysis
      await this.storeMedicationAnalysis(userId, patientId, medications, result);

      // Save to database
      const saveResult = await historyService.saveAnalysisResult(
        patientId,
        patientProfile.name || 'Unknown Patient',
        'medications',
        result,
        medications,
        userId
      );

      if (!saveResult.success) {
        console.error('Failed to save medication analysis to database:', saveResult.error);
      }

      // Create alerts if analysis contains alerts
      if (result.alerts && result.alerts.length > 0) {
        await this.createAlertsFromAnalysis(
          userId, 
          patientId, 
          result.alerts, 
          'ai_analysis',
          saveResult.analysisId
        );
      }

      res.json({
        success: true,
        data: {
          patientId,
          interactions: result.interactions,
          alerts: result.alerts,
          recommendations: result.recommendations,
          timestamp: result.timestamp
        }
      });

    } catch (error) {
      console.error('Error in analyzeMedications:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get clinical alerts for a patient
   * GET /api/nursing/clinical-alerts/:patientId
   */
  async getClinicalAlerts(req, res) {
    try {
      const { patientId } = req.params;
      const userId = req.user.id;

      // Get active alerts for the patient
      const alerts = await this.getActiveAlerts(userId, patientId);

      res.json({
        success: true,
        data: {
          patientId,
          alerts: alerts,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in getClinicalAlerts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Acknowledge a clinical alert
   * PUT /api/nursing/clinical-alerts/:alertId/acknowledge
   */
  async acknowledgeAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      // Find the alert
      const alert = await ClinicalAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Check if user has permission to acknowledge this alert
      if (alert.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to acknowledge this alert'
        });
      }

      // Acknowledge the alert
      await alert.acknowledge(userId, notes);

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: {
          alertId: alert._id,
          acknowledgedAt: alert.acknowledgedAt,
          acknowledgedBy: alert.acknowledgedBy
        }
      });

    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get clinical decision history for a patient
   * GET /api/nursing/clinical-history/:patientId
   */
  async getClinicalHistory(req, res) {
    try {
      const { patientId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = req.user.id;

      // Get clinical decision history
      const history = await this.getClinicalDecisionHistory(userId, patientId, limit, offset);

      res.json({
        success: true,
        data: {
          patientId,
          history: history,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: history.length
          }
        }
      });

    } catch (error) {
      console.error('Error in getClinicalHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Acknowledge a clinical alert
   * PUT /api/nursing/clinical-alerts/:alertId/acknowledge
   */
  async acknowledgeAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      // Acknowledge the alert
      const result = await this.acknowledgeClinicalAlert(userId, alertId, notes);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: {
          alertId,
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date().toISOString(),
          notes: notes
        }
      });

    } catch (error) {
      console.error('Error in acknowledgeAlert:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Generate comprehensive risk assessment for a patient
   * POST /api/nursing/risk-assessment
   */
  async generateRiskAssessment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { patientId, includeVitalSigns, includeMedications } = req.body;
      const userId = req.user.id;

      // Get patient data
      const patientData = await this.getPatientData(patientId, userId);
      
      if (!patientData) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Get current vital signs and medications if requested
      const vitalSigns = includeVitalSigns ? patientData.vitalSigns : null;
      const medications = includeMedications ? patientData.medications : null;

      // Generate comprehensive risk assessment
      const riskAssessment = await riskAssessmentService.calculateComprehensiveRiskAssessment(
        patientData,
        vitalSigns,
        medications
      );

      if (!riskAssessment.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate risk assessment',
          error: riskAssessment.error
        });
      }

      // Save to database
      const saveResult = await historyService.saveAnalysisResult(
        patientId,
        patientData.name || 'Unknown Patient',
        'riskAssessment',
        riskAssessment,
        { includeVitalSigns, includeMedications },
        userId
      );

      if (!saveResult.success) {
        console.error('Failed to save risk assessment to database:', saveResult.error);
      }

      res.json({
        success: true,
        data: {
          patientId,
          patientName: patientData.name,
          riskAssessment,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in generateRiskAssessment:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Helper methods (these would typically interact with your database)
  async getPatientData(patientId, userId) {
    // This would typically fetch from your patient database
    // For now, returning an enhanced mock structure with comprehensive patient data
    const patientHistory = await this.getPatientHistory(patientId, userId);
    const previousDecisions = await this.getPreviousClinicalDecisions(patientId, userId);
    
    // Generate patient-specific data based on patientId for more realistic scenarios
    const patientProfiles = this.generatePatientProfiles();
    const profile = patientProfiles[patientId] || patientProfiles['default'];
    
    return {
      id: patientId,
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      conditions: profile.conditions,
      medications: profile.medications,
      vitalSigns: profile.vitalSigns,
      allergies: profile.allergies,
      lastVisit: new Date().toISOString(),
      documentHistory: patientHistory,
      previousDecisions: previousDecisions,
      clinicalContext: {
        currentSymptoms: profile.currentSymptoms,
        recentLabs: profile.recentLabs,
        recentImaging: profile.recentImaging,
        carePlan: profile.carePlan,
        socialHistory: profile.socialHistory,
        familyHistory: profile.familyHistory,
        functionalStatus: profile.functionalStatus,
        riskFactors: profile.riskFactors
      },
      demographics: profile.demographics,
      insurance: profile.insurance,
      emergencyContact: profile.emergencyContact
    };
  }

  generatePatientProfiles() {
    return {
      'patient-001': {
        name: 'Sarah Johnson',
        age: 72,
        gender: 'Female',
        dateOfBirth: '1952-03-15',
        conditions: ['Type 2 Diabetes', 'Hypertension', 'Osteoarthritis', 'Mild Cognitive Impairment'],
        medications: ['Metformin 1000mg BID', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily', 'Acetaminophen 650mg PRN'],
        vitalSigns: {
          bloodPressure: '145/88',
          heartRate: 78,
          temperature: 98.4,
          oxygenSaturation: 96,
          respiratoryRate: 16,
          weight: 165,
          height: 65
        },
        allergies: ['Penicillin', 'Sulfa drugs'],
        currentSymptoms: ['Elevated blood pressure', 'Joint stiffness', 'Occasional confusion'],
        recentLabs: ['HbA1c: 8.1%', 'Creatinine: 1.3 mg/dL', 'eGFR: 52', 'LDL: 145 mg/dL'],
        recentImaging: ['Chest X-ray: Mild cardiomegaly', 'Knee X-ray: Moderate osteoarthritis'],
        carePlan: 'Diabetes management, blood pressure control, fall prevention',
        socialHistory: 'Lives alone, former smoker (quit 10 years ago), limited mobility',
        familyHistory: 'Mother: diabetes, Father: heart disease',
        functionalStatus: 'Independent with ADLs, uses walker for long distances',
        riskFactors: ['Fall risk', 'Medication non-adherence', 'Social isolation'],
        demographics: { race: 'Caucasian', ethnicity: 'Non-Hispanic' },
        insurance: 'Medicare',
        emergencyContact: { name: 'John Johnson', relationship: 'Son', phone: '555-0123' }
      },
      'patient-002': {
        name: 'Michael Rodriguez',
        age: 58,
        gender: 'Male',
        dateOfBirth: '1966-07-22',
        conditions: ['COPD', 'Heart Failure (EF 35%)', 'Atrial Fibrillation', 'Depression'],
        medications: ['Albuterol inhaler PRN', 'Furosemide 40mg daily', 'Metoprolol 50mg BID', 'Warfarin 5mg daily', 'Sertraline 100mg daily'],
        vitalSigns: {
          bloodPressure: '118/72',
          heartRate: 95,
          temperature: 98.1,
          oxygenSaturation: 92,
          respiratoryRate: 22,
          weight: 185,
          height: 70
        },
        allergies: ['ACE inhibitors'],
        currentSymptoms: ['Shortness of breath', 'Fatigue', 'Swelling in legs', 'Irregular heartbeat'],
        recentLabs: ['BNP: 450 pg/mL', 'INR: 2.1', 'Creatinine: 1.1 mg/dL', 'Potassium: 4.2 mEq/L'],
        recentImaging: ['Echocardiogram: EF 35%, moderate mitral regurgitation', 'Chest CT: Emphysematous changes'],
        carePlan: 'Heart failure management, COPD exacerbation prevention, anticoagulation monitoring',
        socialHistory: 'Former construction worker, current smoker (1 pack/day), lives with spouse',
        familyHistory: 'Father: heart attack at 55, Mother: diabetes',
        functionalStatus: 'Limited by dyspnea, requires assistance with heavy tasks',
        riskFactors: ['High fall risk', 'Medication complexity', 'Smoking', 'Depression'],
        demographics: { race: 'Hispanic', ethnicity: 'Mexican-American' },
        insurance: 'Medicaid',
        emergencyContact: { name: 'Maria Rodriguez', relationship: 'Wife', phone: '555-0456' }
      },
      'patient-003': {
        name: 'Eleanor Thompson',
        age: 85,
        gender: 'Female',
        dateOfBirth: '1939-11-08',
        conditions: ['Dementia (Alzheimer\'s)', 'Osteoporosis', 'Urinary Incontinence', 'Chronic Kidney Disease Stage 3'],
        medications: ['Donepezil 10mg daily', 'Calcium 600mg BID', 'Vitamin D3 1000 IU daily', 'Oxybutynin 5mg BID'],
        vitalSigns: {
          bloodPressure: '132/78',
          heartRate: 72,
          temperature: 98.6,
          oxygenSaturation: 98,
          respiratoryRate: 14,
          weight: 125,
          height: 62
        },
        allergies: ['None known'],
        currentSymptoms: ['Memory loss', 'Confusion', 'Frequent falls', 'Urinary urgency'],
        recentLabs: ['Creatinine: 1.8 mg/dL', 'eGFR: 32', 'Calcium: 9.2 mg/dL', 'Vitamin D: 28 ng/mL'],
        recentImaging: ['Bone density: T-score -2.8 (osteoporosis)', 'Head CT: Mild atrophy'],
        carePlan: 'Dementia care, fall prevention, osteoporosis management, incontinence care',
        socialHistory: 'Widowed, lives in assisted living, no smoking history',
        familyHistory: 'Mother: dementia, Father: stroke',
        functionalStatus: 'Requires assistance with ADLs, wheelchair for long distances',
        riskFactors: ['High fall risk', 'Wandering risk', 'Medication management', 'Social isolation'],
        demographics: { race: 'African American', ethnicity: 'Non-Hispanic' },
        insurance: 'Medicare + Long-term care insurance',
        emergencyContact: { name: 'Robert Thompson', relationship: 'Son', phone: '555-0789' }
      },
      'default': {
        name: 'John Doe',
        age: 65,
        gender: 'Male',
        dateOfBirth: '1959-01-01',
        conditions: ['Diabetes', 'Hypertension'],
        medications: ['Metformin 500mg BID', 'Lisinopril 5mg daily'],
        vitalSigns: {
          bloodPressure: '140/90',
          heartRate: 85,
          temperature: 98.6,
          oxygenSaturation: 98,
          respiratoryRate: 16,
          weight: 180,
          height: 68
        },
        allergies: ['Penicillin'],
        currentSymptoms: ['Elevated blood pressure', 'Fatigue'],
        recentLabs: ['HbA1c: 7.2%', 'Creatinine: 1.1 mg/dL'],
        recentImaging: ['Chest X-ray: Normal'],
        carePlan: 'Diabetes and hypertension management',
        socialHistory: 'Lives with spouse, non-smoker',
        familyHistory: 'Father: diabetes',
        functionalStatus: 'Independent with ADLs',
        riskFactors: ['Medication adherence'],
        demographics: { race: 'Caucasian', ethnicity: 'Non-Hispanic' },
        insurance: 'Medicare',
        emergencyContact: { name: 'Jane Doe', relationship: 'Wife', phone: '555-0000' }
      }
    };
  }

  async getPatientHistory(patientId, userId) {
    // Mock patient history - in production, this would query the database
    return [
      {
        date: '2024-01-15',
        type: 'Visit Note',
        content: 'Patient reported improved blood sugar control with current medication regimen. Blood pressure slightly elevated.',
        provider: 'Dr. Smith'
      },
      {
        date: '2024-01-01',
        type: 'Lab Results',
        content: 'HbA1c: 7.2%, Blood pressure: 145/92, Weight: 165 lbs',
        provider: 'Lab Services'
      },
      {
        date: '2023-12-15',
        type: 'Medication Review',
        content: 'Started Lisinopril 10mg daily for blood pressure management. Patient tolerating well.',
        provider: 'Dr. Smith'
      }
    ];
  }

  async getPreviousClinicalDecisions(patientId, userId) {
    // Get stored clinical decisions for this patient
    if (this.decisionHistory && this.decisionHistory.has(patientId)) {
      const storedDecisions = this.decisionHistory.get(patientId);
      return storedDecisions.map(decision => ({
        date: decision.timestamp,
        query: decision.query,
        recommendations: decision.recommendations,
        confidence: decision.confidence,
        outcome: 'Decision recorded for future reference'
      }));
    }
    
    // Return mock data if no stored decisions exist
    return [
      {
        date: '2024-01-15',
        query: 'Blood pressure management',
        recommendations: 'Continue current medication, monitor blood pressure weekly, consider lifestyle modifications',
        confidence: 0.85,
        outcome: 'Patient reported improved compliance with medication'
      },
      {
        date: '2024-01-01',
        query: 'Diabetes management',
        recommendations: 'Maintain current Metformin dose, continue dietary modifications, schedule follow-up in 3 months',
        confidence: 0.90,
        outcome: 'HbA1c improved from 7.8% to 7.2%'
      }
    ];
  }

  async getPatientContext(patientId, userId) {
    // Get comprehensive patient context
    return {
      id: patientId,
      conditions: ['Diabetes', 'Hypertension'],
      medications: ['Metformin', 'Lisinopril'],
      allergies: ['Penicillin'],
      recentLabs: [],
      recentImaging: [],
      carePlan: {}
    };
  }

  async getPatientProfile(patientId, userId) {
    // Get patient profile for medication analysis
    return {
      id: patientId,
      age: 65,
      gender: 'Female',
      weight: 70,
      height: 165,
      conditions: ['Diabetes', 'Hypertension'],
      allergies: ['Penicillin'],
      kidneyFunction: 'Normal',
      liverFunction: 'Normal'
    };
  }

  async logClinicalDecisionRequest(userId, patientId, query, result) {
    // Log the clinical decision request for audit purposes and store for future reference
    const decisionRecord = {
      id: `decision-${Date.now()}`,
      userId: userId,
      patientId: patientId,
      query: query,
      recommendations: result.recommendations,
      confidence: result.confidence,
      timestamp: new Date().toISOString(),
      generatedBy: 'AI Clinical Decision Support'
    };
    
    console.log(`Clinical decision request logged:`, decisionRecord);
    
    // In production, this would save to a database for future reference
    // For now, we'll store it in memory (in production, use a proper database)
    if (!this.decisionHistory) {
      this.decisionHistory = new Map();
    }
    
    if (!this.decisionHistory.has(patientId)) {
      this.decisionHistory.set(patientId, []);
    }
    
    this.decisionHistory.get(patientId).push(decisionRecord);
    
    // Keep only the last 10 decisions per patient to manage memory
    const patientDecisions = this.decisionHistory.get(patientId);
    if (patientDecisions.length > 10) {
      patientDecisions.splice(0, patientDecisions.length - 10);
    }
  }

  async storeVitalSignsAnalysis(userId, patientId, vitalSigns, result) {
    // Store vital signs analysis results
    console.log(`Vital signs analysis stored: User ${userId}, Patient ${patientId}`);
    // This would typically save to a database
  }

  async storeMedicationAnalysis(userId, patientId, medications, result) {
    // Store medication analysis results
    console.log(`Medication analysis stored: User ${userId}, Patient ${patientId}`);
    // This would typically save to a database
  }

  async getActiveAlerts(userId, patientId) {
    try {
      // Get active clinical alerts for the patient from database
      const alerts = await ClinicalAlert.getActiveAlerts(patientId, userId);
      
      // Transform the data to match frontend expectations
      return alerts.map(alert => ({
        id: alert._id.toString(),
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        details: alert.details,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
        source: alert.source,
        metadata: alert.metadata
      }));
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      // Return empty array if there's an error
      return [];
    }
  }

  /**
   * Create clinical alerts from analysis results
   * @param {string} userId - User ID
   * @param {string} patientId - Patient ID
   * @param {Array} alerts - Array of alert objects
   * @param {string} source - Source of the alerts
   * @param {string} sourceId - ID of the source analysis
   */
  async createAlertsFromAnalysis(userId, patientId, alerts, source = 'ai_analysis', sourceId = null) {
    try {
      if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        return [];
      }

      const createdAlerts = [];
      
      for (const alertData of alerts) {
        const alert = await ClinicalAlert.createAlert({
          patientId,
          userId,
          type: alertData.type || 'general',
          severity: alertData.severity || 'medium',
          title: alertData.title || alertData.message?.substring(0, 200) || 'Clinical Alert',
          message: alertData.message || 'No message provided',
          details: alertData.details || null,
          source,
          sourceId,
          metadata: {
            confidence: alertData.confidence || 0.8,
            category: alertData.category || 'clinical',
            tags: alertData.tags || [],
            relatedAnalysisId: sourceId
          }
        });
        
        createdAlerts.push(alert);
      }

      return createdAlerts;
    } catch (error) {
      console.error('Error creating alerts from analysis:', error);
      return [];
    }
  }

  async getClinicalDecisionHistory(userId, patientId, limit, offset) {
    try {
      // Import the history service
      const historyService = (await import('../services/historyService.js')).default;
      
      // Get clinical decision history from database
      const historyResult = await historyService.getPatientHistory(
        patientId, 
        'clinicalDecisions', 
        userId
      );
      
      if (historyResult.success && historyResult.data) {
        // Transform the data to match the expected format
        return historyResult.data.map(entry => ({
          id: entry._id,
          query: entry.inputData?.query || 'Clinical Decision',
          recommendations: entry.analysisData?.recommendations || entry.analysisData,
          confidence: entry.analysisData?.confidence || 0.8,
          timestamp: entry.timestamp || entry.createdAt
        }));
      }
      
      // Return empty array if no data found
      return [];
    } catch (error) {
      console.error('Error getting clinical decision history:', error);
      // Return mock data as fallback
      return [
        {
          id: 'decision-1',
          query: 'Blood pressure management',
          recommendations: 'Monitor closely, consider medication adjustment',
          timestamp: new Date().toISOString(),
          confidence: 0.85
        }
      ];
    }
  }

  async acknowledgeClinicalAlert(userId, alertId, notes) {
    // Acknowledge a clinical alert
    console.log(`Alert ${alertId} acknowledged by user ${userId} with notes: ${notes}`);
    return { success: true };
  }
}

export default new ClinicalDecisionController();
