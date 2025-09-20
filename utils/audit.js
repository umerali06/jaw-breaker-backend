import mongoose from 'mongoose';
import { logger } from './logger.js';

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    required: false,
    index: true
  },
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development'
  }
}, {
  timestamps: true
});

// Indexes for performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Virtual for time since creation
auditLogSchema.virtual('timeSinceCreation').get(function() {
  return Date.now() - this.timestamp;
});

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Set environment
  this.environment = process.env.NODE_ENV || 'development';
  
  // Log to console in development
  if (this.environment === 'development') {
    logger.info(`Audit: ${this.action} on ${this.resource} by user ${this.userId}`);
  }
  
  next();
});

// Static methods
auditLogSchema.statics.findByUser = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByResource = function(resource, limit = 100) {
  return this.find({ resource })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByDateRange = function(startDate, endDate, limit = 1000) {
  return this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

auditLogSchema.statics.getAuditSummary = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastAction: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Create the model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/**
 * Create an audit log entry
 * @param {Object} auditData - The audit data
 * @param {string} auditData.userId - User ID
 * @param {string} auditData.action - Action performed
 * @param {string} auditData.resource - Resource affected
 * @param {string} auditData.resourceId - Resource ID (optional)
 * @param {Object} auditData.details - Additional details (optional)
 * @param {string} auditData.ipAddress - IP address (optional)
 * @param {string} auditData.userAgent - User agent (optional)
 * @param {string} auditData.sessionId - Session ID (optional)
 * @returns {Promise<Object>} - Created audit log entry
 */
const createAuditLog = async (auditData) => {
  try {
    const auditLog = new AuditLog(auditData);
    await auditLog.save();
    
    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Audit Log Created: ${auditData.action} on ${auditData.resource}`);
    }
    
    return auditLog;
  } catch (error) {
    logger.error('Error creating audit log:', error);
    // Don't throw error for audit logging failures
    return null;
  }
};

/**
 * Get audit logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} - Array of audit logs
 */
const getUserAuditLogs = async (userId, limit = 100) => {
  try {
    return await AuditLog.findByUser(userId, limit);
  } catch (error) {
    logger.error('Error fetching user audit logs:', error);
    throw error;
  }
};

/**
 * Get audit logs for a specific action
 * @param {string} action - Action to filter by
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} - Array of audit logs
 */
const getActionAuditLogs = async (action, limit = 100) => {
  try {
    return await AuditLog.findByAction(action, limit);
  } catch (error) {
    logger.error('Error fetching action audit logs:', error);
    throw error;
  }
};

/**
 * Get audit logs for a specific resource
 * @param {string} resource - Resource to filter by
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} - Array of audit logs
 */
const getResourceAuditLogs = async (resource, limit = 100) => {
  try {
    return await AuditLog.findByResource(resource, limit);
  } catch (error) {
    logger.error('Error fetching resource audit logs:', error);
    throw error;
  }
};

/**
 * Get audit logs within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} - Array of audit logs
 */
const getDateRangeAuditLogs = async (startDate, endDate, limit = 1000) => {
  try {
    return await AuditLog.findByDateRange(startDate, endDate, limit);
  } catch (error) {
    logger.error('Error fetching date range audit logs:', error);
    throw error;
  }
};

/**
 * Get audit summary for a user
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} - Audit summary
 */
const getUserAuditSummary = async (userId, startDate, endDate) => {
  try {
    return await AuditLog.getAuditSummary(userId, startDate, endDate);
  } catch (error) {
    logger.error('Error fetching user audit summary:', error);
    throw error;
  }
};

/**
 * Clean up old audit logs (for compliance and storage management)
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {Promise<number>} - Number of logs deleted
 */
const cleanupOldAuditLogs = async (daysToKeep = 365) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old audit logs:', error);
    throw error;
  }
};

export {
  AuditLog,
  createAuditLog,
  getUserAuditLogs,
  getActionAuditLogs,
  getResourceAuditLogs,
  getDateRangeAuditLogs,
  getUserAuditSummary,
  cleanupOldAuditLogs
};
