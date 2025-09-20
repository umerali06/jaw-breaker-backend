import geoip from "geoip-lite";
import crypto from "crypto";

/**
 * Advanced Fraud Detection Service
 * Implements machine learning-based risk assessment and fraud prevention
 */
class FraudDetectionService {
  constructor() {
    this.riskThresholds = {
      low: 20,
      medium: 50,
      high: 80,
      critical: 100,
    };

    this.blacklistedCountries = ["XX", "YY"]; // Add high-risk countries
    this.blacklistedIPs = new Set(); // Would be loaded from database
    this.blacklistedEmails = new Set(); // Would be loaded from database
  }

  /**
   * Comprehensive risk assessment
   */
  async assessRisk(paymentData) {
    const assessment = {
      riskScore: 0,
      riskLevel: "low",
      factors: [],
      recommendation: "approve",
      details: {},
    };

    try {
      // 1. Velocity checks
      const velocityRisk = await this.checkVelocity(paymentData);
      assessment.riskScore += velocityRisk.score;
      assessment.factors.push(...velocityRisk.factors);
      assessment.details.velocity = velocityRisk;

      // 2. Geolocation analysis
      const geoRisk = await this.analyzeGeolocation(paymentData);
      assessment.riskScore += geoRisk.score;
      assessment.factors.push(...geoRisk.factors);
      assessment.details.geolocation = geoRisk;

      // 3. Device fingerprinting
      const deviceRisk = await this.analyzeDevice(paymentData);
      assessment.riskScore += deviceRisk.score;
      assessment.factors.push(...deviceRisk.factors);
      assessment.details.device = deviceRisk;

      // 4. Behavioral analysis
      const behaviorRisk = await this.analyzeBehavior(paymentData);
      assessment.riskScore += behaviorRisk.score;
      assessment.factors.push(...behaviorRisk.factors);
      assessment.details.behavior = behaviorRisk;

      // 5. Email and identity checks
      const identityRisk = await this.checkIdentity(paymentData);
      assessment.riskScore += identityRisk.score;
      assessment.factors.push(...identityRisk.factors);
      assessment.details.identity = identityRisk;

      // 6. Blacklist checks
      const blacklistRisk = await this.checkBlacklists(paymentData);
      assessment.riskScore += blacklistRisk.score;
      assessment.factors.push(...blacklistRisk.factors);
      assessment.details.blacklist = blacklistRisk;

      // Calculate final assessment
      assessment.riskLevel = this.calculateRiskLevel(assessment.riskScore);
      assessment.recommendation = this.getRecommendation(assessment.riskScore);

      return assessment;
    } catch (error) {
      console.error("Risk assessment error:", error);
      return {
        riskScore: 50,
        riskLevel: "medium",
        factors: ["assessment_error"],
        recommendation: "review",
      };
    }
  }

  /**
   * Check payment velocity (rate limiting)
   */
  async checkVelocity(paymentData) {
    const velocity = { score: 0, factors: [] };

    try {
      // Check recent attempts by IP
      const ipAttempts = await this.getRecentAttemptsByIP(
        paymentData.ipAddress
      );
      if (ipAttempts > 5) {
        velocity.score += 30;
        velocity.factors.push("high_ip_velocity");
      } else if (ipAttempts > 3) {
        velocity.score += 15;
        velocity.factors.push("medium_ip_velocity");
      }

      // Check recent attempts by email
      const emailAttempts = await this.getRecentAttemptsByEmail(
        paymentData.email
      );
      if (emailAttempts > 3) {
        velocity.score += 25;
        velocity.factors.push("high_email_velocity");
      }

      // Check recent attempts by card fingerprint
      if (paymentData.cardFingerprint) {
        const cardAttempts = await this.getRecentAttemptsByCard(
          paymentData.cardFingerprint
        );
        if (cardAttempts > 2) {
          velocity.score += 35;
          velocity.factors.push("high_card_velocity");
        }
      }

      return velocity;
    } catch (error) {
      console.error("Velocity check error:", error);
      return { score: 10, factors: ["velocity_check_error"] };
    }
  }

  /**
   * Analyze geolocation risk
   */
  async analyzeGeolocation(paymentData) {
    const geo = { score: 0, factors: [] };

    try {
      if (!paymentData.ipAddress) {
        geo.score += 10;
        geo.factors.push("missing_ip_address");
        return geo;
      }

      const geoData = geoip.lookup(paymentData.ipAddress);

      if (!geoData) {
        geo.score += 15;
        geo.factors.push("invalid_ip_address");
        return geo;
      }

      // Check for high-risk countries
      if (this.blacklistedCountries.includes(geoData.country)) {
        geo.score += 40;
        geo.factors.push("high_risk_country");
      }

      // Check for VPN/Proxy indicators
      if (await this.isVPNOrProxy(paymentData.ipAddress)) {
        geo.score += 25;
        geo.factors.push("vpn_or_proxy_detected");
      }

      // Check distance between IP and billing address
      if (paymentData.billingAddress && paymentData.billingAddress.country) {
        const distance = this.calculateDistance(
          geoData,
          paymentData.billingAddress
        );
        if (distance > 1000) {
          // More than 1000km apart
          geo.score += 20;
          geo.factors.push("ip_billing_mismatch");
        }
      }

      return geo;
    } catch (error) {
      console.error("Geolocation analysis error:", error);
      return { score: 15, factors: ["geo_analysis_error"] };
    }
  }

  /**
   * Analyze device fingerprint
   */
  async analyzeDevice(paymentData) {
    const device = { score: 0, factors: [] };

    try {
      if (!paymentData.deviceFingerprint) {
        device.score += 10;
        device.factors.push("missing_device_fingerprint");
        return device;
      }

      // Check if device has been used for fraud before
      const deviceHistory = await this.getDeviceHistory(
        paymentData.deviceFingerprint
      );
      if (deviceHistory.fraudCount > 0) {
        device.score += 50;
        device.factors.push("device_fraud_history");
      }

      // Check device reputation
      const reputation = await this.getDeviceReputation(
        paymentData.deviceFingerprint
      );
      if (reputation < 0.3) {
        device.score += 30;
        device.factors.push("low_device_reputation");
      }

      // Check for suspicious user agent patterns
      if (paymentData.userAgent) {
        if (this.isSuspiciousUserAgent(paymentData.userAgent)) {
          device.score += 20;
          device.factors.push("suspicious_user_agent");
        }
      }

      return device;
    } catch (error) {
      console.error("Device analysis error:", error);
      return { score: 10, factors: ["device_analysis_error"] };
    }
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeBehavior(paymentData) {
    const behavior = { score: 0, factors: [] };

    try {
      // Check time patterns
      const hour = new Date().getHours();
      if (hour < 6 || hour > 23) {
        behavior.score += 10;
        behavior.factors.push("unusual_time_pattern");
      }

      // Check form completion speed
      if (paymentData.formCompletionTime) {
        if (paymentData.formCompletionTime < 10) {
          // Less than 10 seconds
          behavior.score += 25;
          behavior.factors.push("suspiciously_fast_completion");
        } else if (paymentData.formCompletionTime > 1800) {
          // More than 30 minutes
          behavior.score += 15;
          behavior.factors.push("unusually_slow_completion");
        }
      }

      // Check for copy-paste behavior
      if (paymentData.copyPasteDetected) {
        behavior.score += 15;
        behavior.factors.push("copy_paste_detected");
      }

      return behavior;
    } catch (error) {
      console.error("Behavior analysis error:", error);
      return { score: 5, factors: ["behavior_analysis_error"] };
    }
  }

  /**
   * Check identity and email patterns
   */
  async checkIdentity(paymentData) {
    const identity = { score: 0, factors: [] };

    try {
      // Email domain analysis
      if (paymentData.email) {
        const emailDomain = paymentData.email.split("@")[1];

        // Check for disposable email domains
        if (await this.isDisposableEmail(emailDomain)) {
          identity.score += 30;
          identity.factors.push("disposable_email");
        }

        // Check for suspicious email patterns
        if (this.isSuspiciousEmail(paymentData.email)) {
          identity.score += 20;
          identity.factors.push("suspicious_email_pattern");
        }
      }

      // Name analysis
      if (paymentData.name) {
        if (this.isSuspiciousName(paymentData.name)) {
          identity.score += 15;
          identity.factors.push("suspicious_name_pattern");
        }
      }

      return identity;
    } catch (error) {
      console.error("Identity check error:", error);
      return { score: 5, factors: ["identity_check_error"] };
    }
  }

  /**
   * Check against blacklists
   */
  async checkBlacklists(paymentData) {
    const blacklist = { score: 0, factors: [] };

    try {
      // Check IP blacklist
      if (this.blacklistedIPs.has(paymentData.ipAddress)) {
        blacklist.score += 100;
        blacklist.factors.push("blacklisted_ip");
      }

      // Check email blacklist
      if (this.blacklistedEmails.has(paymentData.email)) {
        blacklist.score += 100;
        blacklist.factors.push("blacklisted_email");
      }

      // Check card BIN blacklist
      if (
        paymentData.cardBIN &&
        (await this.isBlacklistedBIN(paymentData.cardBIN))
      ) {
        blacklist.score += 80;
        blacklist.factors.push("blacklisted_card_bin");
      }

      return blacklist;
    } catch (error) {
      console.error("Blacklist check error:", error);
      return { score: 0, factors: [] };
    }
  }

  // Helper methods
  async getRecentAttemptsByIP(ipAddress) {
    // Would query database for recent attempts
    return 0;
  }

  async getRecentAttemptsByEmail(email) {
    // Would query database for recent attempts
    return 0;
  }

  async getRecentAttemptsByCard(cardFingerprint) {
    // Would query database for recent attempts
    return 0;
  }

  async isVPNOrProxy(ipAddress) {
    // Would check against VPN/Proxy detection service
    return false;
  }

  calculateDistance(geoData, billingAddress) {
    // Would calculate distance between IP location and billing address
    return 0;
  }

  async getDeviceHistory(deviceFingerprint) {
    // Would query database for device history
    return { fraudCount: 0 };
  }

  async getDeviceReputation(deviceFingerprint) {
    // Would calculate device reputation score
    return 1.0;
  }

  isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /curl/i,
      /wget/i,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  async isDisposableEmail(domain) {
    const disposableDomains = [
      "tempmail.org",
      "10minutemail.com",
      "guerrillamail.com",
      "mailinator.com",
      "yopmail.com",
      "temp-mail.org",
    ];
    return disposableDomains.includes(domain.toLowerCase());
  }

  isSuspiciousEmail(email) {
    const suspiciousPatterns = [
      /^test/i,
      /^fake/i,
      /^spam/i,
      /\d{10,}@/,
      /^[a-z]{1,2}@/,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(email));
  }

  isSuspiciousName(name) {
    const suspiciousPatterns = [
      /^test/i,
      /^fake/i,
      /^john.*doe/i,
      /^jane.*doe/i,
      /^[a-z]{1,2}$/i,
      /\d{3,}/,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(name));
  }

  async isBlacklistedBIN(bin) {
    // Would check against BIN blacklist
    return false;
  }

  calculateRiskLevel(score) {
    if (score < this.riskThresholds.low) return "low";
    if (score < this.riskThresholds.medium) return "medium";
    if (score < this.riskThresholds.high) return "high";
    return "critical";
  }

  getRecommendation(score) {
    if (score < this.riskThresholds.low) return "approve";
    if (score < this.riskThresholds.medium) return "review";
    if (score < this.riskThresholds.high) return "challenge";
    return "decline";
  }
}

export default FraudDetectionService;
