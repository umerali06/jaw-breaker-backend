import Risk from '../models/Risk.js';
import RiskAlert from '../models/RiskAlert.js';
import azureOpenAIService from '../../services/azureOpenAIService.js';

class RiskManagementService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
  }

  // Risk Assessment
  async createRisk(riskData, userId) {
    try {
      const risk = new Risk({
        ...riskData,
        createdBy: userId,
        lastModifiedBy: userId
      });
      
      await risk.save();
      
      // Create alert if risk score is high
      if (risk.riskScore >= 3.0) {
        await this.createRiskAlert(risk, userId);
      }
      
      return risk;
    } catch (error) {
      throw new Error(`Failed to create risk: ${error.message}`);
    }
  }

  async getRisks(filters = {}) {
    try {
      const query = {};
      
      if (filters.patientId) query.patientId = filters.patientId;
      if (filters.category) query.category = filters.category;
      if (filters.severity) query.severity = filters.severity;
      if (filters.status) query.status = filters.status;
      if (filters.assignedTo) query.assignedTo = filters.assignedTo;
      
      const risks = await Risk.find(query)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });
      
      console.log(`🔍 [RiskManagement] Found ${risks.length} risks for filters:`, filters);
      return risks;
    } catch (error) {
      console.error('Error getting risks:', error);
      throw new Error(`Failed to get risks: ${error.message}`);
    }
  }

  async getRiskById(riskId) {
    try {
      const risk = await Risk.findById(riskId)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email')
        .populate('assignedTo', 'name email');
      
      if (!risk) {
        throw new Error('Risk not found');
      }
      
      return risk;
    } catch (error) {
      throw new Error(`Failed to get risk: ${error.message}`);
    }
  }

  async updateRisk(riskId, updateData, userId) {
    try {
      const risk = await Risk.findByIdAndUpdate(
        riskId,
        { ...updateData, lastModifiedBy: userId },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email')
       .populate('lastModifiedBy', 'name email')
       .populate('assignedTo', 'name email');
      
      if (!risk) {
        throw new Error('Risk not found');
      }
      
      return risk;
    } catch (error) {
      throw new Error(`Failed to update risk: ${error.message}`);
    }
  }

  async deleteRisk(riskId) {
    try {
      const risk = await Risk.findByIdAndDelete(riskId);
      
      if (!risk) {
        throw new Error('Risk not found');
      }
      
      // Delete associated alerts
      await RiskAlert.deleteMany({ riskId });
      
      return { message: 'Risk deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete risk: ${error.message}`);
    }
  }

  // Risk Analytics
  async getRiskAnalytics(timeRange = '7d') {
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const risks = await Risk.find({
        createdAt: { $gte: startDate }
      });
      
      const totalRisks = risks.length;
      const criticalRisks = risks.filter(r => r.severity === 'critical').length;
      const highRisks = risks.filter(r => r.severity === 'high').length;
      const mediumRisks = risks.filter(r => r.severity === 'medium').length;
      const lowRisks = risks.filter(r => r.severity === 'low').length;
      
      const categoryBreakdown = risks.reduce((acc, risk) => {
        acc[risk.category] = (acc[risk.category] || 0) + 1;
        return acc;
      }, {});
      
      const severityBreakdown = risks.reduce((acc, risk) => {
        acc[risk.severity] = (acc[risk.severity] || 0) + 1;
        return acc;
      }, {});
      
      return {
        totalRisks,
        criticalRisks,
        highRisks,
        mediumRisks,
        lowRisks,
        categoryBreakdown,
        severityBreakdown
      };
    } catch (error) {
      throw new Error(`Failed to get risk analytics: ${error.message}`);
    }
  }

  // AI Analysis
  async performAIAnalysis(riskId, patientId, userId, aiModel = 'gpt-5-chat') {
    try {
      const risk = await this.getRiskById(riskId);
      
      // Get patient context for better AI analysis
      const patientContext = await this.getPatientContext(patientId);
      
      // Prepare comprehensive context for AI analysis
      const context = `
        RISK ASSESSMENT ANALYSIS REQUEST
        
        Patient Information:
        - Name: ${patientContext.name}
        - Age: ${patientContext.age}
        - Gender: ${patientContext.gender}
        - Medical History: ${patientContext.medicalHistory}
        - Current Medications: ${patientContext.medications}
        - Allergies: ${patientContext.allergies}
        - Care Level: ${patientContext.careLevel}
        
        Risk Assessment Details:
        - Category: ${risk.category}
        - Severity: ${risk.severity}
        - Likelihood: ${risk.likelihood}
        - Impact: ${risk.impact}
        - Description: ${risk.description}
        - Risk Score: ${risk.riskScore}
        - Factors: ${risk.factors?.join(', ') || 'None specified'}
        - Mitigation: ${risk.mitigation || 'None specified'}
        - Priority: ${risk.priority}
        
        Please provide a comprehensive AI analysis including:
        1. Risk assessment validation and accuracy
        2. Specific recommendations based on patient context
        3. Potential complications and early warning signs
        4. Evidence-based interventions
        5. Monitoring and follow-up requirements
        6. Risk mitigation strategies
        7. Confidence level in the analysis
        
        Format the response as JSON with the following structure:
        {
          "recommendations": ["recommendation1", "recommendation2", ...],
          "riskFactors": ["factor1", "factor2", ...],
          "interventions": ["intervention1", "intervention2", ...],
          "monitoring": ["monitoring1", "monitoring2", ...],
          "complications": ["complication1", "complication2", ...],
          "confidence": 0.85,
          "summary": "Brief summary of the analysis",
          "priority": "high/medium/low"
        }
      `;
      
      console.log('🤖 [RiskManagement] AI Analysis Context:', context.substring(0, 200) + '...');
      
      // Use Azure OpenAI for real AI analysis
      const aiResponse = await this.azureOpenAI.callAzureOpenAI(context, aiModel);
      
      let aiAnalysis;
      try {
        // Try to parse JSON response
        aiAnalysis = JSON.parse(aiResponse);
      } catch (parseError) {
        console.warn('⚠️ [RiskManagement] Failed to parse AI response as JSON, using fallback');
        // Fallback to text parsing
        aiAnalysis = this.parseAIResponse(aiResponse);
      }
      
      // Ensure required fields exist
      const validatedAnalysis = {
        recommendations: aiAnalysis.recommendations || this.generateAIRecommendations(risk),
        riskFactors: aiAnalysis.riskFactors || [],
        interventions: aiAnalysis.interventions || [],
        monitoring: aiAnalysis.monitoring || [],
        complications: aiAnalysis.complications || [],
        confidence: typeof aiAnalysis.confidence === 'number' && !isNaN(aiAnalysis.confidence) 
          ? aiAnalysis.confidence 
          : 0.8,
        summary: aiAnalysis.summary || 'AI analysis completed',
        priority: aiAnalysis.priority || risk.priority,
        lastAnalyzed: new Date(),
        aiModel: aiModel
      };
      
      console.log('🤖 [RiskManagement] AI Analysis Result:', {
        recommendations: validatedAnalysis.recommendations?.length || 0,
        confidence: validatedAnalysis.confidence,
        confidenceType: typeof validatedAnalysis.confidence,
        model: aiModel
      });
      
      const updatedRisk = await this.updateRisk(riskId, { aiAnalysis: validatedAnalysis }, userId);
      
      return updatedRisk;
    } catch (error) {
      console.error('❌ [RiskManagement] AI Analysis Error:', error);
      throw new Error(`Failed to perform AI analysis: ${error.message}`);
    }
  }

  // Get patient context for AI analysis
  async getPatientContext(patientId) {
    try {
      // Dynamically import Patient model to avoid circular dependencies
      const { default: Patient } = await import('../../models/Patient.js');
      
      const patient = await Patient.findById(patientId).select(
        'demographics medicalHistory medications allergies vitalSigns'
      );
      
      if (!patient) {
        return {
          name: 'Unknown Patient',
          age: 'Unknown',
          gender: 'Unknown',
          medicalHistory: 'No medical history available',
          medications: 'No medications listed',
          allergies: 'No known allergies',
          careLevel: 'Standard'
        };
      }
      
      const demographics = patient.demographics || {};
      const medicalHistory = patient.medicalHistory || {};
      const medications = patient.medications || [];
      const allergies = patient.allergies || [];
      
      // Calculate age
      const age = demographics.dateOfBirth 
        ? Math.floor((new Date() - new Date(demographics.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
        : 'Unknown';
      
      // Determine care level based on medical history
      let careLevel = 'Standard';
      if (medicalHistory.conditions?.length > 3 || medications.length > 5) {
        careLevel = 'High';
      } else if (medicalHistory.conditions?.length > 1 || medications.length > 2) {
        careLevel = 'Moderate';
      }
      
      return {
        name: `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim() || 'Unknown Patient',
        age: age,
        gender: demographics.sex || 'Unknown',
        medicalHistory: medicalHistory.conditions?.join(', ') || 'No significant medical history',
        medications: medications.map(med => `${med.name} (${med.dosage})`).join(', ') || 'No current medications',
        allergies: allergies.join(', ') || 'No known allergies',
        careLevel: careLevel
      };
    } catch (error) {
      console.error('Error getting patient context:', error);
      return {
        name: 'Unknown Patient',
        age: 'Unknown',
        gender: 'Unknown',
        medicalHistory: 'Unable to retrieve medical history',
        medications: 'Unable to retrieve medications',
        allergies: 'Unable to retrieve allergies',
        careLevel: 'Standard'
      };
    }
  }

  // Parse AI response when JSON parsing fails
  parseAIResponse(response) {
    const analysis = {
      recommendations: [],
      riskFactors: [],
      interventions: [],
      monitoring: [],
      complications: [],
      confidence: 0.8,
      summary: 'AI analysis completed',
      priority: 'medium'
    };
    
    // Extract recommendations
    const recMatch = response.match(/recommendations?[:\-]?\s*([^\n]+(?:\n[^\n]+)*)/i);
    if (recMatch) {
      analysis.recommendations = recMatch[1]
        .split(/[,\n•\-\*]/)
        .map(rec => rec.trim())
        .filter(rec => rec.length > 0)
        .slice(0, 5);
    }
    
    // Extract confidence
    const confMatch = response.match(/confidence[:\-]?\s*(\d+\.?\d*)/i);
    if (confMatch) {
      analysis.confidence = Math.min(Math.max(parseFloat(confMatch[1]), 0), 1);
    }
    
    // Extract summary
    const summaryMatch = response.match(/summary[:\-]?\s*([^\n]+)/i);
    if (summaryMatch) {
      analysis.summary = summaryMatch[1].trim();
    }
    
    return analysis;
  }

  generateAIRecommendations(risk) {
    const recommendations = [];
    
    switch (risk.category) {
      case 'falls':
        recommendations.push('Implement fall prevention protocols');
        recommendations.push('Assess patient mobility and balance');
        recommendations.push('Ensure proper lighting and clear pathways');
        break;
      case 'infection':
        recommendations.push('Strict hand hygiene protocols');
        recommendations.push('Monitor vital signs closely');
        recommendations.push('Implement isolation precautions if needed');
        break;
      case 'medication':
        recommendations.push('Double-check medication dosages');
        recommendations.push('Verify patient allergies');
        recommendations.push('Monitor for adverse reactions');
        break;
      case 'pressure_ulcer':
        recommendations.push('Implement turning schedule');
        recommendations.push('Use pressure-relieving devices');
        recommendations.push('Monitor skin integrity regularly');
        break;
      case 'dehydration':
        recommendations.push('Monitor fluid intake and output');
        recommendations.push('Assess skin turgor and mucous membranes');
        recommendations.push('Consider IV fluids if necessary');
        break;
      case 'delirium':
        recommendations.push('Maintain consistent sleep-wake cycle');
        recommendations.push('Provide orientation cues');
        recommendations.push('Minimize environmental changes');
        break;
    }
    
    if (risk.riskScore >= 3.5) {
      recommendations.push('Consider escalating to senior staff');
      recommendations.push('Implement additional monitoring');
    }
    
    return recommendations;
  }

  // Risk Alerts
  async createRiskAlert(risk, userId) {
    try {
      const alertType = risk.riskScore >= 3.5 ? 'critical' : 
                       risk.riskScore >= 2.5 ? 'high' : 
                       risk.riskScore >= 1.5 ? 'medium' : 'low';
      
      const alert = new RiskAlert({
        type: alertType,
        title: `${risk.category.replace('_', ' ')} Risk Alert`,
        message: `High risk detected: ${risk.description}`,
        riskId: risk._id,
        priority: risk.priority,
        metadata: {
          riskScore: risk.riskScore,
          category: risk.category,
          severity: risk.severity
        },
        createdBy: userId
      });
      
      await alert.save();
      return alert;
    } catch (error) {
      throw new Error(`Failed to create risk alert: ${error.message}`);
    }
  }

  async getAlerts(filters = {}) {
    try {
      const query = {};
      
      if (filters.type) query.type = filters.type;
      if (filters.isRead !== undefined) query.isRead = filters.isRead;
      
      let alerts = await RiskAlert.find(query)
        .populate('riskId', 'category severity description patientId')
        .populate('createdBy', 'name email')
        .populate('readBy', 'name email')
        .sort({ createdAt: -1 });
      
      // Filter by patientId if specified
      if (filters.patientId) {
        alerts = alerts.filter(alert => 
          alert.riskId && alert.riskId.patientId === filters.patientId
        );
      }
      
      console.log(`🚨 [RiskManagement] Found ${alerts.length} alerts for filters:`, filters);
      return alerts;
    } catch (error) {
      console.error('Error getting alerts:', error);
      throw new Error(`Failed to get alerts: ${error.message}`);
    }
  }

  async markAlertAsRead(alertId, userId) {
    try {
      const alert = await RiskAlert.findByIdAndUpdate(
        alertId,
        { 
          isRead: true, 
          readAt: new Date(),
          readBy: userId
        },
        { new: true }
      );
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      return alert;
    } catch (error) {
      throw new Error(`Failed to mark alert as read: ${error.message}`);
    }
  }

  async deleteAlert(alertId) {
    try {
      const alert = await RiskAlert.findByIdAndDelete(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      return { message: 'Alert deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete alert: ${error.message}`);
    }
  }
}

export default new RiskManagementService();


