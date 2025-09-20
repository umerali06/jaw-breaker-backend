import QualityComplianceHistory from '../models/QualityComplianceHistory.js';
import { v4 as uuidv4 } from 'uuid';

class QualityComplianceService {
  
  /**
   * Perform a quality compliance check
   */
  async performQualityCheck(checkData, userId, patientId = null) {
    try {
      console.log('QualityComplianceService.performQualityCheck called with:', { 
        userId, 
        patientId, 
        checkType: checkData.checkType 
      });

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
        notes = ''
      } = checkData;

      // Generate session ID if not provided
      const sessionId = checkData.sessionId || uuidv4();

      // Calculate compliance score based on findings
      const complianceScore = this.calculateComplianceScore(findings, recommendations);
      
      // Determine compliance status
      const complianceStatus = this.determineComplianceStatus(complianceScore, findings);
      
      // Assess overall risk
      const riskAssessment = this.assessRisk(findings, complianceScore);

      const newQualityCheck = new QualityComplianceHistory({
        userId,
        patientId,
        sessionId,
        checkType,
        checkCategory,
        checkTitle,
        checkDescription,
        patientContext,
        complianceStatus,
        complianceScore,
        findings,
        riskAssessment,
        recommendations,
        auditTrail: [{
          action: 'created',
          performedBy: userId,
          timestamp: new Date(),
          notes: 'Quality compliance check performed'
        }],
        regulatoryStandards,
        qualityMetrics,
        followUpActions,
        tags,
        notes
      });

      const savedCheck = await newQualityCheck.save();
      console.log('✅ Quality compliance check saved:', savedCheck._id);

      return {
        success: true,
        data: savedCheck
      };

    } catch (error) {
      console.error('❌ Error performing quality compliance check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's quality compliance history
   */
  async getUserQualityCompliance(userId, options = {}) {
    try {
      console.log('QualityComplianceService.getUserQualityCompliance called with:', { userId, options });

      const qualityChecks = await QualityComplianceHistory.getUserQualityCompliance(userId, options);

      return {
        success: true,
        data: qualityChecks
      };

    } catch (error) {
      console.error('❌ Error getting user quality compliance history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get quality compliance statistics
   */
  async getUserQualityStats(userId, patientId = null, options = {}) {
    try {
      console.log('QualityComplianceService.getUserQualityStats called with:', { userId, patientId, options });

      // Normalize empty strings - only pass patientId if it's a valid non-null value
      // Handle undefined, null, empty string, and "null" string cases
      const safePatientId = patientId && 
                           patientId !== 'null' && 
                           String(patientId).trim() !== '' && 
                           String(patientId).trim() !== 'null' ? 
                           String(patientId).trim() : null;

      // Wire includeArchived through to the model (default false)
      const includeArchived = options.includeArchived === true;

      const stats = await QualityComplianceHistory.getUserQualityStats(
        userId,
        safePatientId,
        { includeArchived }
      );

      const result = stats[0] || {
        totalChecks: 0,
        averageComplianceScore: 0,
        compliantChecks: 0,
        nonCompliantChecks: 0,
        partiallyCompliantChecks: 0,
        highRiskChecks: 0,
        criticalRiskChecks: 0,
        pendingFollowUps: 0,
        overdueFollowUps: 0,
        lastCheckDate: null
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('❌ Error getting user quality compliance stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get compliance trends
   */
  async getComplianceTrends(userId, patientId = null, days = 30) {
    try {
      console.log('QualityComplianceService.getComplianceTrends called with:', { userId, patientId, days });

      // Normalize empty strings - only pass patientId if it's a valid non-null value
      // Handle undefined, null, empty string, and "null" string cases
      const safePatientId = patientId && 
                           patientId !== 'null' && 
                           String(patientId).trim() !== '' && 
                           String(patientId).trim() !== 'null' ? 
                           String(patientId).trim() : null;

      const trends = await QualityComplianceHistory.getComplianceTrends(userId, safePatientId, days);

      return {
        success: true,
        data: trends
      };

    } catch (error) {
      console.error('❌ Error getting compliance trends:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get quality compliance check by ID
   */
  async getQualityCheckById(checkId, userId) {
    try {
      const qualityCheck = await QualityComplianceHistory.findOne({
        _id: checkId,
        userId,
        isDeleted: false
      }).lean();

      if (!qualityCheck) {
        return {
          success: false,
          error: 'Quality compliance check not found'
        };
      }

      return {
        success: true,
        data: qualityCheck
      };

    } catch (error) {
      console.error('❌ Error getting quality compliance check by ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update quality compliance check
   */
  async updateQualityCheck(checkId, userId, updateData) {
    try {
      const qualityCheck = await QualityComplianceHistory.findOne({
        _id: checkId,
        userId,
        isDeleted: false
      });

      if (!qualityCheck) {
        return {
          success: false,
          error: 'Quality compliance check not found'
        };
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          qualityCheck[key] = updateData[key];
        }
      });

      // Recalculate compliance score if findings or recommendations changed
      if (updateData.findings || updateData.recommendations) {
        qualityCheck.complianceScore = this.calculateComplianceScore(
          qualityCheck.findings, 
          qualityCheck.recommendations
        );
        qualityCheck.complianceStatus = this.determineComplianceStatus(
          qualityCheck.complianceScore, 
          qualityCheck.findings
        );
        qualityCheck.riskAssessment = this.assessRisk(
          qualityCheck.findings, 
          qualityCheck.complianceScore
        );
      }

      // Add audit trail entry
      qualityCheck.addAuditEntry('updated', userId, 'Quality compliance check updated', updateData);

      const updatedCheck = await qualityCheck.save();

      return {
        success: true,
        data: updatedCheck
      };

    } catch (error) {
      console.error('❌ Error updating quality compliance check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Archive quality compliance check
   */
  async archiveQualityCheck(checkId, userId) {
    try {
      const qualityCheck = await QualityComplianceHistory.findOne({
        _id: checkId,
        userId,
        isDeleted: false
      });

      if (!qualityCheck) {
        return {
          success: false,
          error: 'Quality compliance check not found'
        };
      }

      await qualityCheck.archive();
      qualityCheck.addAuditEntry('archived', userId, 'Quality compliance check archived');

      return {
        success: true,
        message: 'Quality compliance check archived successfully'
      };

    } catch (error) {
      console.error('❌ Error archiving quality compliance check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete quality compliance check
   */
  async deleteQualityCheck(checkId, userId) {
    try {
      const qualityCheck = await QualityComplianceHistory.findOne({
        _id: checkId,
        userId,
        isDeleted: false
      });

      if (!qualityCheck) {
        return {
          success: false,
          error: 'Quality compliance check not found'
        };
      }

      await qualityCheck.softDelete();
      qualityCheck.addAuditEntry('deleted', userId, 'Quality compliance check deleted');

      return {
        success: true,
        message: 'Quality compliance check deleted successfully'
      };

    } catch (error) {
      console.error('❌ Error deleting quality compliance check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search quality compliance checks
   */
  async searchQualityChecks(userId, searchQuery, options = {}) {
    try {
      const {
        patientId = null,
        checkType = null,
        checkCategory = null,
        complianceStatus = null,
        limit = 20,
        skip = 0
      } = options;

      const matchQuery = {
        userId,
        isDeleted: false,
        isArchived: false,
        $or: [
          { checkTitle: { $regex: searchQuery, $options: 'i' } },
          { checkDescription: { $regex: searchQuery, $options: 'i' } },
          { notes: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ]
      };

      if (patientId) {
        matchQuery.patientId = patientId;
      }

      if (checkType) {
        matchQuery.checkType = checkType;
      }

      if (checkCategory) {
        matchQuery.checkCategory = checkCategory;
      }

      if (complianceStatus) {
        matchQuery.complianceStatus = complianceStatus;
      }

      const results = await QualityComplianceHistory.find(matchQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ Error searching quality compliance checks:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate compliance score based on findings and recommendations
   */
  calculateComplianceScore(findings, recommendations) {
    if (!findings || findings.length === 0) {
      return 100; // Perfect score if no findings
    }

    let totalScore = 100;
    let totalWeight = 0;

    findings.forEach(finding => {
      const weight = this.getFindingWeight(finding.severity);
      const score = this.getFindingScore(finding.category);
      
      totalScore -= (score * weight);
      totalWeight += weight;
    });

    // Ensure score is within valid range (0-100)
    totalScore = Math.max(0, Math.min(100, totalScore));

    return Math.round(totalScore);
  }

  /**
   * Determine compliance status based on score and findings
   */
  determineComplianceStatus(score, findings) {
    if (score >= 90) return 'compliant';
    if (score >= 70) return 'partially_compliant';
    if (score >= 50) return 'non_compliant';
    
    // Check for critical findings
    const hasCriticalFindings = findings.some(finding => 
      finding.severity === 'critical' || finding.category === 'violation'
    );
    
    return hasCriticalFindings ? 'non_compliant' : 'requires_review';
  }

  /**
   * Assess overall risk based on findings and compliance score
   */
  assessRisk(findings, complianceScore) {
    let riskLevel = 'low';
    const riskFactors = [];
    const mitigationStrategies = [];

    // Determine risk level based on score
    if (complianceScore < 50) {
      riskLevel = 'critical';
    } else if (complianceScore < 70) {
      riskLevel = 'high';
    } else if (complianceScore < 85) {
      riskLevel = 'medium';
    }

    // Adjust risk level based on findings
    findings.forEach(finding => {
      if (finding.severity === 'critical') {
        riskLevel = 'critical';
        riskFactors.push(finding.title);
      } else if (finding.severity === 'high' && riskLevel !== 'critical') {
        riskLevel = 'high';
        riskFactors.push(finding.title);
      } else if (finding.severity === 'medium' && riskLevel === 'low') {
        riskLevel = 'medium';
        riskFactors.push(finding.title);
      }

      if (finding.recommendations && finding.recommendations.length > 0) {
        mitigationStrategies.push(...finding.recommendations);
      }
    });

    return {
      overallRisk: riskLevel,
      riskFactors,
      mitigationStrategies,
      monitoringRequired: riskLevel === 'high' || riskLevel === 'critical'
    };
  }

  /**
   * Get finding weight based on severity
   */
  getFindingWeight(severity) {
    const weights = {
      'low': 0.1,
      'medium': 0.3,
      'high': 0.6,
      'critical': 1.0
    };
    return weights[severity] || 0.3;
  }

  /**
   * Get finding score based on category
   */
  getFindingScore(category) {
    const scores = {
      'strength': -5, // Positive impact
      'observation': 0,
      'concern': 10,
      'recommendation': 15,
      'violation': 25
    };
    return scores[category] || 10;
  }

  /**
   * Get available check types
   */
  getAvailableCheckTypes() {
    return [
      { value: 'medication_safety', label: 'Medication Safety', category: 'safety' },
      { value: 'infection_control', label: 'Infection Control', category: 'safety' },
      { value: 'patient_safety', label: 'Patient Safety', category: 'safety' },
      { value: 'documentation_quality', label: 'Documentation Quality', category: 'quality' },
      { value: 'care_plan_compliance', label: 'Care Plan Compliance', category: 'compliance' },
      { value: 'vital_signs_monitoring', label: 'Vital Signs Monitoring', category: 'clinical' },
      { value: 'fall_prevention', label: 'Fall Prevention', category: 'safety' },
      { value: 'pressure_ulcer_prevention', label: 'Pressure Ulcer Prevention', category: 'clinical' },
      { value: 'medication_reconciliation', label: 'Medication Reconciliation', category: 'clinical' },
      { value: 'discharge_planning', label: 'Discharge Planning', category: 'administrative' },
      { value: 'pain_management', label: 'Pain Management', category: 'clinical' },
      { value: 'nutrition_assessment', label: 'Nutrition Assessment', category: 'clinical' },
      { value: 'mobility_assessment', label: 'Mobility Assessment', category: 'clinical' },
      { value: 'cognitive_assessment', label: 'Cognitive Assessment', category: 'clinical' },
      { value: 'family_education', label: 'Family Education', category: 'administrative' },
      { value: 'emergency_procedures', label: 'Emergency Procedures', category: 'safety' },
      { value: 'equipment_safety', label: 'Equipment Safety', category: 'safety' },
      { value: 'environmental_safety', label: 'Environmental Safety', category: 'safety' },
      { value: 'communication_quality', label: 'Communication Quality', category: 'quality' },
      { value: 'timeliness_of_care', label: 'Timeliness of Care', category: 'quality' }
    ];
  }

  /**
   * Get available check categories
   */
  getAvailableCheckCategories() {
    return [
      { value: 'safety', label: 'Safety', color: '#EF4444' },
      { value: 'quality', label: 'Quality', color: '#3B82F6' },
      { value: 'compliance', label: 'Compliance', color: '#8B5CF6' },
      { value: 'documentation', label: 'Documentation', color: '#10B981' },
      { value: 'clinical', label: 'Clinical', color: '#F59E0B' },
      { value: 'administrative', label: 'Administrative', color: '#6B7280' }
    ];
  }
}

export default new QualityComplianceService();
