// Security and Compliance Service for HIPAA-compliant nursing data handling
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

class SecurityComplianceService {
  constructor() {
    this.encryptionKey =
      process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.algorithm = "aes-256-gcm";
    this.auditLogs = [];
    this.accessAttempts = new Map();
    this.maxAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.setupCompliance();
  }

  // Initial compliance settings
  setupCompliance() {
    this.complianceRules = {
      hipaa: {
        dataRetention: 6 * 365 * 24 * 60 * 60 * 1000, // 6 years in milliseconds
        auditLogRetention: 6 * 365 * 24 * 60 * 60 * 1000, // 6 years
        encryptionRequired: true,
        accessLoggingRequired: true,
        minimumPasswordLength: 12,
        passwordComplexityRequired: true,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxConcurrentSessions: 3,
      },
      gdpr: {
        dataPortabilityRequired: true,
        rightToErasure: true,
        consentRequired: true,
        dataRetention: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
      },
      sox: {
        auditTrailRequired: true,
        dataIntegrityChecks: true,
        accessControlRequired: true,
      },
    };

    console.log("Security compliance initialized");
  }

  // Generate secure encryption key
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString("hex");
  }

  // Encrypt sensitive data
  encryptData(data, additionalData = "") {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);

      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData));
      }

      let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        additionalData,
      };
    } catch (error) {
      this.logSecurityEvent("encryption_error", { error: error.message });
      throw new Error("Data encryption failed");
    }
  }

  // Decrypt sensitive data
  decryptData(encryptedData) {
    try {
      const { encrypted, iv, authTag, additionalData } = encryptedData;
      const decipher = crypto.createDecipher(
        this.algorithm,
        this.encryptionKey
      );

      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData));
      }

      decipher.setAuthTag(Buffer.from(authTag, "hex"));

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error) {
      this.logSecurityEvent("decryption_error", { error: error.message });
      throw new Error("Data decryption failed");
    }
  }

  // Hash sensitive identifiers
  hashIdentifier(identifier, salt = null) {
    const useSalt = salt || crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(identifier, useSalt, 100000, 64, "sha512");

    return {
      hash: hash.toString("hex"),
      salt: useSalt.toString("hex"),
    };
  }

  // Verify hashed identifier
  verifyHashedIdentifier(identifier, hashedData) {
    const { hash, salt } = hashedData;
    const verifyHash = crypto.pbkdf2Sync(
      identifier,
      Buffer.from(salt, "hex"),
      100000,
      64,
      "sha512"
    );

    return hash === verifyHash.toString("hex");
  }

  // Generate secure token
  generateSecureToken(payload, expiresIn = "1h") {
    try {
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn,
        issuer: "nursing-system",
        audience: "nursing-users",
      });

      this.logSecurityEvent("token_generated", {
        userId: payload.userId,
        expiresIn,
        timestamp: new Date(),
      });

      return token;
    } catch (error) {
      this.logSecurityEvent("token_generation_error", { error: error.message });
      throw new Error("Token generation failed");
    }
  }

  // Verify and decode tokens
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "nursing-system",
        audience: "nursing-users",
      });

      this.logSecurityEvent("token_verified", {
        userId: decoded.userId,
        timestamp: new Date(),
      });

      return decoded;
    } catch (error) {
      this.logSecurityEvent("token_verification_failed", {
        error: error.message,
      });
      throw new Error("Token verification failed");
    }
  }

  // Hash password securely
  async hashPassword(password) {
    const saltRounds = 12;
    const validation = this.validatePasswordComplexity(password);

    if (!validation.isValid) {
      throw new Error(
        `Password validation failed: ${validation.errors.join(", ")}`
      );
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    this.logSecurityEvent("password_hashed", {
      timestamp: new Date(),
    });

    return hashedPassword;
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    try {
      const isValid = await bcrypt.compare(password, hashedPassword);

      this.logSecurityEvent("password_verification", {
        success: isValid,
        timestamp: new Date(),
      });

      return isValid;
    } catch (error) {
      this.logSecurityEvent("password_verification_error", {
        error: error.message,
      });
      return false;
    }
  }

  // Validate password complexity
  validatePasswordComplexity(password) {
    const rules = this.complianceRules.hipaa;
    const errors = [];

    if (password.length < rules.minimumPasswordLength) {
      errors.push(
        `Password must be at least ${rules.minimumPasswordLength} characters long`
      );
    }

    if (rules.passwordComplexityRequired) {
      if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
      }
      if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
      }
      if (!/\d/.test(password)) {
        errors.push("Password must contain at least one number");
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push("Password must contain at least one special character");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Track and prevent brute force attacks
  trackAccessAttempt(identifier, success = false) {
    const now = Date.now();
    const attempts = this.accessAttempts.get(identifier) || {
      count: 0,
      lastAttempt: now,
      lockedUntil: null,
    };

    // Check if currently locked out
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      this.logSecurityEvent("access_blocked", {
        identifier,
        reason: "lockout_active",
      });

      return {
        allowed: false,
        reason: "Account temporarily locked",
        lockedUntil: new Date(attempts.lockedUntil),
      };
    }

    // Reset on successful login
    if (success) {
      this.accessAttempts.delete(identifier);
      this.logSecurityEvent("successful_access", { identifier });
      return { allowed: true };
    }

    // Increment attempt count
    attempts.count += 1;
    attempts.lastAttempt = now;

    // Check if max attempts exceeded
    if (attempts.count >= this.maxAttempts) {
      attempts.lockedUntil = now + this.lockoutDuration;

      this.logSecurityEvent("account_locked", {
        identifier,
        attempts: attempts.count - this.maxAttempts,
      });
    }

    this.accessAttempts.set(identifier, attempts);

    return {
      allowed: attempts.count < this.maxAttempts,
      remaining: Math.max(0, this.maxAttempts - attempts.count),
      lockedUntil: attempts.lockedUntil ? new Date(attempts.lockedUntil) : null,
    };
  }

  // Implement role-based access control
  checkPermission(userRole, resource, action) {
    const permissions = {
      admin: {
        "*": ["create", "read", "update", "delete", "manage"],
      },
      nurse: {
        assessments: ["create", "read", "update"],
        "soap-notes": ["create", "read", "update"],
        medications: ["create", "read", "update"],
        "care-plans": ["create", "read", "update"],
        progress: ["create", "read", "update"],
        oasis: ["create", "read", "update"],
        outcomes: ["read"],
      },
      doctor: {
        assessments: ["read", "update"],
        "soap-notes": ["create", "read", "update"],
        medications: ["create", "read", "update"],
        "care-plans": ["create", "read", "update"],
        progress: ["read", "update"],
        outcomes: ["read", "update"],
        "clinical-decisions": ["create", "read", "update"],
      },
      therapist: {
        assessments: ["create", "read", "update"],
        progress: ["create", "read", "update"],
        "care-plans": ["read", "update"],
        outcomes: ["read"],
      },
      viewer: {
        assessments: ["read"],
        "soap-notes": ["read"],
        progress: ["read"],
        outcomes: ["read"],
      },
    };

    const rolePermissions = permissions[userRole];
    if (!rolePermissions) {
      this.logSecurityEvent("access_denied", {
        userRole,
        resource,
        action,
        reason: "invalid_role",
      });
      return false;
    }

    const resourcePermissions = rolePermissions[resource];
    if (!resourcePermissions) {
      this.logSecurityEvent("access_denied", {
        userRole,
        resource,
        action,
        reason: "resource_not_allowed",
      });
      return false;
    }

    // Check wildcard permissions
    if (rolePermissions["*"] && rolePermissions["*"].includes(action)) {
      return true;
    }

    const hasPermission = resourcePermissions.includes(action);

    if (!hasPermission) {
      this.logSecurityEvent("access_denied", {
        userRole,
        resource,
        action,
        reason: "action_not_allowed",
      });
    }

    return hasPermission;
  }

  // Check compliance for data operations
  checkCompliance(operation, data) {
    const violations = [];

    // HIPAA compliance checks
    if (this.complianceRules.hipaa.encryptionRequired && !data.encrypted) {
      violations.push("HIPAA: Sensitive data must be encrypted");
    }

    if (
      this.complianceRules.hipaa.accessLoggingRequired &&
      !data.accessLogged
    ) {
      violations.push("HIPAA: Access must be logged for audit trail");
    }

    // GDPR compliance checks
    if (this.complianceRules.gdpr.consentRequired && !data.consentGiven) {
      violations.push("GDPR: User consent required for data processing");
    }

    // SOX compliance checks
    if (this.complianceRules.sox.auditTrailRequired && !data.auditTrail) {
      violations.push("SOX: Audit trail required for financial data");
    }

    if (violations.length > 0) {
      this.logSecurityEvent("compliance_violation", {
        operation,
        violations,
        timestamp: new Date(),
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  // Sanitize input data
  sanitizeInput(input, type = "general") {
    if (typeof input !== "string") {
      return input;
    }

    let sanitized = input;

    switch (type) {
      case "sql":
        // Prevent SQL injection
        sanitized = sanitized.replace(/['"\\]/g, "");
        break;
      case "html":
        // Prevent XSS
        sanitized = sanitized
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;")
          .replace(/\//g, "&#x2F;");
        break;
      case "general":
      default:
        // General sanitization
        sanitized = sanitized.trim();
        break;
    }

    return sanitized;
  }

  // Verify data integrity
  verifyDataIntegrity(data, expectedChecksum) {
    const actualChecksum = this.generateChecksum(data);
    const isValid = actualChecksum === expectedChecksum;

    if (!isValid) {
      this.logSecurityEvent("data_integrity_violation", {
        expectedChecksum,
        actualChecksum,
        timestamp: new Date(),
      });
    }

    return isValid;
  }

  // Generate data checksum
  generateChecksum(data) {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(data));
    return hash.digest("hex");
  }

  // Log security events for audit trail
  logSecurityEvent(eventType, details = {}) {
    const logEntry = {
      id: crypto.randomUUID(),
      eventType,
      timestamp: new Date(),
      ipAddress: details.ipAddress || "unknown",
      userAgent: details.userAgent || "unknown",
      userId: details.userId || "anonymous",
      sessionId: details.sessionId || null,
      severity: this.getEventSeverity(eventType),
      details,
    };

    this.auditLogs.push(logEntry);

    // Keep audit logs within retention period
    this.cleanupAuditLogs();

    // Send security alerts for high-severity events
    if (logEntry.severity === "high" || logEntry.severity === "critical") {
      this.sendSecurityAlert(logEntry);
    }

    // Log to console for immediate visibility
    console.log(`[SECURITY] ${eventType}:`, logEntry);
  }

  // Determine event severity
  getEventSeverity(eventType) {
    const severityMap = {
      successful_access: "low",
      token_generated: "low",
      token_verified: "low",
      access_denied: "medium",
      token_verification_failed: "medium",
      account_locked: "high",
      encryption_error: "high",
      decryption_error: "high",
      data_breach_attempt: "critical",
      unauthorized_access: "critical",
      system_compromise: "critical",
    };

    return severityMap[eventType] || "medium";
  }

  // Send security alerts for high-severity events
  sendSecurityAlert(logEntry) {
    // In production, this would integrate with alerting systems
    // - SIEM systems
    // - Slack/Teams
    // - Email notifications
    // Could integrate with:
    console.error(`[SECURITY ALERT] ${logEntry.eventType}:`, logEntry);
  }

  // Clean up old audit logs based on retention policy
  cleanupAuditLogs() {
    const retentionPeriod = this.complianceRules.hipaa.auditLogRetention;
    const cutoffDate = new Date(Date.now() - retentionPeriod);

    const initialCount = this.auditLogs.length;
    this.auditLogs = this.auditLogs.filter((log) => log.timestamp > cutoffDate);

    const removedCount = initialCount - this.auditLogs.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old audit log entries`);
    }
  }

  // Get security statistics
  getSecurityStats() {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const recentLogs = this.auditLogs.filter(
      (log) => log.timestamp.getTime() > last24Hours
    );
    const weeklyLogs = this.auditLogs.filter(
      (log) => log.timestamp.getTime() > last7Days
    );

    return {
      totalAuditLogs: this.auditLogs.length,
      last24Hours: {
        totalEvents: recentLogs.length,
        securityIncidents: recentLogs.filter(
          (log) => log.severity === "high" || log.severity === "critical"
        ).length,
        accessDenials: recentLogs.filter(
          (log) => log.eventType === "access_denied"
        ).length,
        uniqueUsers: new Set(recentLogs.map((log) => log.userId)).size,
      },
      last7Days: {
        totalEvents: weeklyLogs.length,
        complianceViolations: weeklyLogs.filter(
          (log) => log.eventType === "compliance_violation"
        ).length,
        activeAttempts: this.accessAttempts.size,
      },
    };
  }

  // Generate compliance report
  generateComplianceReport(startDate, endDate) {
    const logs = this.getAuditLogs({ startDate, endDate });

    const report = {
      reportPeriod: { startDate, endDate },
      totalEvents: logs.length,
      eventsByType: {},
      eventsBySeverity: {},
      securityIncidents: [],
      complianceViolations: [],
      recommendations: [],
    };

    // Analyze events
    logs.forEach((log) => {
      // Count by type
      report.eventsByType[log.eventType] =
        (report.eventsByType[log.eventType] || 0) + 1;

      // Count by severity
      report.eventsBySeverity[log.severity] =
        (report.eventsBySeverity[log.severity] || 0) + 1;

      // Collect violations and incidents
      if (log.eventType === "compliance_violation") {
        report.complianceViolations.push(log);
      }
      if (log.severity === "high" || log.severity === "critical") {
        report.securityIncidents.push(log);
      }
    });

    // Generate recommendations
    if (report.securityIncidents.length > 0) {
      report.recommendations.push(
        "Review and address high-severity security incidents"
      );
    }
    if (report.complianceViolations.length > 0) {
      report.recommendations.push("Implement additional compliance controls");
    }

    return report;
  }

  // Get audit logs with filtering
  getAuditLogs(filters = {}) {
    let logs = [...this.auditLogs];

    if (filters.startDate) {
      logs = logs.filter((log) => log.timestamp >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      logs = logs.filter((log) => log.timestamp <= new Date(filters.endDate));
    }
    if (filters.eventType) {
      logs = logs.filter((log) => log.eventType === filters.eventType);
    }
    if (filters.userId) {
      logs = logs.filter((log) => log.userId === filters.userId);
    }
    if (filters.severity) {
      logs = logs.filter((log) => log.severity === filters.severity);
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export default new SecurityComplianceService();
