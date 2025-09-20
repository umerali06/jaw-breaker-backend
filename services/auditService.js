import AuditLog from '../models/AuditLog.js';
import { v4 as uuidv4 } from 'uuid';

class AuditService {
  constructor() {
    this.requestId = null;
  }
  
  // Set request ID for tracking
  setRequestId(requestId) {
    this.requestId = requestId;
  }
  
  // Generate new request ID
  generateRequestId() {
    return uuidv4();
  }
  
  // Log an action
  async logAction(data) {
    try {
      const auditLog = new AuditLog({
        actorId: data.actorId,
        action: data.action,
        patientId: data.patientId || null,
        entity: data.entity || {},
        meta: data.meta || {},
        at: new Date(),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        requestId: this.requestId || data.requestId,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        errorDetails: data.errorDetails,
        resourceChanges: data.resourceChanges
      });
      
      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw error to avoid breaking main functionality
      return null;
    }
  }
  
  // Log patient access
  async logPatientAccess(actorId, patientId, action = 'read_patient', meta = {}) {
    return this.logAction({
      actorId,
      action,
      patientId,
      entity: { type: 'patient', id: patientId },
      meta: { ...meta, accessType: action }
    });
  }
  
  // Log AI processing
  async logAIProcessing(actorId, patientId, action, meta = {}) {
    return this.logAction({
      actorId,
      action: 'ai_processing',
      patientId,
      entity: { type: 'ai_output', id: null },
      meta: { ...meta, aiAction: action }
    });
  }
  
  // Log document access
  async logDocumentAccess(actorId, patientId, documentId, action = 'download_doc', meta = {}) {
    return this.logAction({
      actorId,
      action,
      patientId,
      entity: { type: 'document', id: documentId },
      meta: { ...meta, documentAction: action }
    });
  }
  
  // Log data modification
  async logDataModification(actorId, patientId, entityType, entityId, action, before, after, meta = {}) {
    return this.logAction({
      actorId,
      action,
      patientId,
      entity: { type: entityType, id: entityId },
      meta: { ...meta, modificationType: action },
      resourceChanges: { before, after }
    });
  }
  
  // Log error
  async logError(actorId, action, error, meta = {}) {
    return this.logAction({
      actorId,
      action,
      patientId: meta.patientId || null,
      entity: meta.entity || {},
      meta: { ...meta, errorType: 'system_error' },
      errorDetails: {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        stack: error.stack
      }
    });
  }
  
  // Log API request
  async logAPIRequest(actorId, endpoint, method, statusCode, responseTime, meta = {}) {
    return this.logAction({
      actorId,
      action: 'api_request',
      patientId: meta.patientId || null,
      entity: meta.entity || {},
      meta: { ...meta, endpoint, method, statusCode, responseTime },
      endpoint,
      method,
      statusCode,
      responseTime
    });
  }
  
  // Log permission denied
  async logPermissionDenied(actorId, action, resource, meta = {}) {
    return this.logAction({
      actorId,
      action: 'permission_denied',
      patientId: meta.patientId || null,
      entity: meta.entity || {},
      meta: { ...meta, deniedAction: action, resource }
    });
  }
  
  // Get audit logs for a patient
  async getPatientAuditLogs(patientId, options = {}) {
    try {
      return await AuditLog.findByPatient(patientId, options);
    } catch (error) {
      console.error('Failed to get patient audit logs:', error);
      throw error;
    }
  }
  
  // Get audit logs for an actor
  async getActorAuditLogs(actorId, options = {}) {
    try {
      return await AuditLog.findByActor(actorId, options);
    } catch (error) {
      console.error('Failed to get actor audit logs:', error);
      throw error;
    }
  }
  
  // Get audit summary for compliance reporting
  async getAuditSummary(options = {}) {
    try {
      return await AuditLog.getAuditSummary(options);
    } catch (error) {
      console.error('Failed to get audit summary:', error);
      throw error;
    }
  }
  
  // Clean up old audit logs (for compliance)
  async cleanupOldLogs(retentionDays = 2555) { // 7 years default
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const result = await AuditLog.deleteMany({
        at: { $lt: cutoffDate }
      });
      
      console.log(`Cleaned up ${result.deletedCount} old audit logs`);
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }
  
  // Export audit logs for compliance
  async exportAuditLogs(options = {}) {
    try {
      const logs = await AuditLog.find(options.filter || {})
        .sort({ at: -1 })
        .populate('actorId', 'name email')
        .populate('patientId', 'demographics.name mrn')
        .lean();
      
      return logs.map(log => ({
        timestamp: log.at,
        actor: log.actorId ? `${log.actorId.name} (${log.actorId.email})` : 'Unknown',
        action: log.action,
        patient: log.patientId ? `${log.patientId.demographics?.name || 'Unknown'} (${log.patientId.mrn || 'No MRN'})` : 'N/A',
        entity: log.entity.type,
        details: log.meta,
        ipAddress: log.ipAddress,
        endpoint: log.endpoint
      }));
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();
export default auditService;
