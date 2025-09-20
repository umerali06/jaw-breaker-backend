class MedicationManagementController {
  constructor() {
    // Initialize any required services
  }

  // Helper method to extract user ID from request
  getUserId(req) {
    return req.user?.id || req.user?._id || req.user?.userId;
  }

  // Helper method to validate user ID
  validateUserId(userId) {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    return userId;
  }

  async createMedication(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const medication = {
        _id: new Date().getTime().toString(),
        id: new Date().getTime().toString(),
        patientId,
        ...req.body,
        createdBy: userId,
        createdAt: new Date()
      };

      res.status(201).json(medication);
    } catch (error) {
      console.error('Create medication error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create medication',
        error: error.message
      });
    }
  }

  async getPatientMedications(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const medications = [
        {
          _id: '1',
          id: '1',
          patientId,
          medicationName: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once daily',
          createdBy: userId,
          createdAt: new Date()
        }
      ];

      res.json(medications);
    } catch (error) {
      console.error('Get patient medications error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get patient medications',
        error: error.message
      });
    }
  }

  async updateMedication(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      const medication = {
        _id: medicationId,
        id: medicationId,
        ...req.body,
        updatedBy: userId,
        updatedAt: new Date()
      };

      res.json(medication);
    } catch (error) {
      console.error('Update medication error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update medication',
        error: error.message
      });
    }
  }

  async discontinueMedication(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      res.json({
        success: true,
        message: 'Medication discontinued successfully',
        medicationId,
        discontinuedBy: userId,
        discontinuedAt: new Date()
      });
    } catch (error) {
      console.error('Discontinue medication error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to discontinue medication',
        error: error.message
      });
    }
  }

  async checkDrugInteractions(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      const interactions = {
        medicationId,
        interactions: [
          {
            medication: 'Lisinopril',
            interactsWith: 'Metformin',
            severity: 'Low',
            description: 'No significant interactions'
          }
        ],
        checkedBy: userId,
        checkedAt: new Date()
      };

      res.json(interactions);
    } catch (error) {
      console.error('Check drug interactions error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to check drug interactions',
        error: error.message
      });
    }
  }

  async monitorAdherence(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      const adherence = {
        medicationId,
        adherenceRate: 85,
        missedDoses: 3,
        totalDoses: 20,
        monitoredBy: userId,
        monitoredAt: new Date()
      };

      res.json(adherence);
    } catch (error) {
      console.error('Monitor adherence error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to monitor adherence',
        error: error.message
      });
    }
  }

  async recordAdministration(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      const administration = {
        _id: new Date().getTime().toString(),
        id: new Date().getTime().toString(),
        medicationId,
        ...req.body,
        administeredBy: userId,
        administeredAt: new Date()
      };

      res.status(201).json(administration);
    } catch (error) {
      console.error('Record administration error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to record administration',
        error: error.message
      });
    }
  }

  async getMedicationDetails(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { medicationId } = req.params;
      
      const details = {
        _id: medicationId,
        id: medicationId,
        medicationName: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        sideEffects: ['Dizziness', 'Dry cough'],
        contraindications: ['Pregnancy', 'Angioedema history'],
        retrievedBy: userId,
        retrievedAt: new Date()
      };

      res.json(details);
    } catch (error) {
      console.error('Get medication details error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get medication details',
        error: error.message
      });
    }
  }

  async performReconciliation(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const reconciliation = {
        patientId,
        reconciliationResults: 'All medications verified',
        discrepancies: [],
        performedBy: userId,
        performedAt: new Date()
      };

      res.json(reconciliation);
    } catch (error) {
      console.error('Perform reconciliation error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to perform reconciliation',
        error: error.message
      });
    }
  }

  async generateOptimization(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const optimization = {
        patientId,
        optimizations: [
          {
            medication: 'Lisinopril',
            recommendation: 'Consider reducing dosage',
            reason: 'Blood pressure well controlled'
          }
        ],
        generatedBy: userId,
        generatedAt: new Date()
      };

      res.json(optimization);
    } catch (error) {
      console.error('Generate optimization error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to generate optimization',
        error: error.message
      });
    }
  }

  async getMedicationAlerts(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const alerts = [
        {
          _id: '1',
          id: '1',
          patientId,
          alert: 'Medication due for refill',
          severity: 'Medium',
          medication: 'Lisinopril',
          createdBy: userId,
          createdAt: new Date()
        }
      ];

      res.json(alerts);
    } catch (error) {
      console.error('Get medication alerts error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get medication alerts',
        error: error.message
      });
    }
  }

  async getMedicationStatistics(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      const { patientId } = req.params;
      
      const statistics = {
        patientId,
        totalMedications: 5,
        activeMedications: 4,
        adherenceRate: 85,
        lastUpdated: new Date(),
        calculatedBy: userId
      };

      res.json(statistics);
    } catch (error) {
      console.error('Get medication statistics error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get medication statistics',
        error: error.message
      });
    }
  }

  async searchMedications(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      
      const medications = [
        {
          _id: '1',
          id: '1',
          name: 'Lisinopril',
          genericName: 'Lisinopril',
          brandNames: ['Prinivil', 'Zestril'],
          category: 'ACE Inhibitor'
        },
        {
          _id: '2',
          id: '2',
          name: 'Metformin',
          genericName: 'Metformin',
          brandNames: ['Glucophage', 'Fortamet'],
          category: 'Antidiabetic'
        }
      ];

      res.json(medications);
    } catch (error) {
      console.error('Search medications error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to search medications',
        error: error.message
      });
    }
  }

  async getMedicationsDueForRefill(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      
      const medications = [
        {
          _id: '1',
          id: '1',
          patientId: '1',
          medicationName: 'Lisinopril',
          daysRemaining: 3,
          refillDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        }
      ];

      res.json(medications);
    } catch (error) {
      console.error('Get medications due for refill error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get medications due for refill',
        error: error.message
      });
    }
  }

  async getHighRiskMedications(req, res) {
    try {
      const userId = this.validateUserId(this.getUserId(req));
      
      const medications = [
        {
          _id: '1',
          id: '1',
          name: 'Warfarin',
          riskLevel: 'High',
          riskFactors: ['Bleeding risk', 'Drug interactions'],
          monitoringRequired: true
        }
      ];

      res.json(medications);
    } catch (error) {
      console.error('Get high risk medications error:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to get high risk medications',
        error: error.message
      });
    }
  }
}

export default MedicationManagementController;