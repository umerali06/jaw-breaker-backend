import validator from "validator";
import crypto from "crypto";

/**
 * Enterprise-grade Payment Validation Service
 * Implements comprehensive card validation, fraud detection, and security measures
 */
class PaymentValidator {
  constructor() {
    this.cardTypes = {
      visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
      mastercard: /^5[1-5][0-9]{14}$/,
      amex: /^3[47][0-9]{13}$/,
      discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
      diners: /^3[0689][0-9]{11}$/,
      jcb: /^(?:2131|1800|35\d{3})\d{11}$/,
    };

    this.fraudPatterns = {
      suspiciousEmails: [
        /^[a-z0-9]+@(tempmail|10minutemail|guerrillamail|mailinator)/i,
        /^test.*@/i,
        /^fake.*@/i,
      ],
      suspiciousNames: [/^test/i, /^fake/i, /^john.*doe/i, /^jane.*doe/i],
    };
  }

  /**
   * Comprehensive card validation with Luhn algorithm
   */
  async validateCard(cardData) {
    const validation = {
      isValid: true,
      errors: [],
      cardType: null,
      riskScore: 0,
      warnings: [],
    };

    try {
      // 1. Basic format validation
      if (!cardData.number || typeof cardData.number !== "string") {
        validation.isValid = false;
        validation.errors.push("Card number is required");
        return validation;
      }

      // Remove spaces and dashes
      const cleanNumber = cardData.number.replace(/[\s-]/g, "");

      // 2. Length validation
      if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        validation.isValid = false;
        validation.errors.push("Invalid card number length");
      }

      // 3. Numeric validation
      if (!/^\d+$/.test(cleanNumber)) {
        validation.isValid = false;
        validation.errors.push("Card number must contain only digits");
      }

      // 4. Luhn algorithm validation
      if (!this.validateLuhn(cleanNumber)) {
        validation.isValid = false;
        validation.errors.push("Invalid card number (failed checksum)");
      }

      // 5. Card type detection
      validation.cardType = this.detectCardType(cleanNumber);
      if (!validation.cardType) {
        validation.isValid = false;
        validation.errors.push("Unsupported card type");
      }

      // 6. CVV validation
      if (!this.validateCVV(cardData.cvc, validation.cardType)) {
        validation.isValid = false;
        validation.errors.push("Invalid CVV/CVC");
      }

      // 7. Expiry date validation
      const expiryValidation = this.validateExpiryDate(
        cardData.exp_month,
        cardData.exp_year
      );
      if (!expiryValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...expiryValidation.errors);
      }

      // 8. Test card detection
      if (this.isTestCard(cleanNumber)) {
        validation.warnings.push("Test card detected");
        validation.riskScore += 10;
      }

      // 9. BIN validation (Bank Identification Number)
      const binValidation = await this.validateBIN(cleanNumber.substring(0, 6));
      if (binValidation.riskScore > 0) {
        validation.riskScore += binValidation.riskScore;
        validation.warnings.push(...binValidation.warnings);
      }

      return validation;
    } catch (error) {
      console.error("Card validation error:", error);
      return {
        isValid: false,
        errors: ["Card validation failed due to system error"],
        cardType: null,
        riskScore: 100,
      };
    }
  }

  /**
   * Luhn algorithm implementation for card number validation
   */
  validateLuhn(cardNumber) {
    let sum = 0;
    let isEven = false;

    // Loop through values starting from the rightmost side
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Detect card type based on number pattern
   */
  detectCardType(cardNumber) {
    for (const [type, pattern] of Object.entries(this.cardTypes)) {
      if (pattern.test(cardNumber)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Validate CVV/CVC based on card type
   */
  validateCVV(cvc, cardType) {
    if (!cvc || typeof cvc !== "string") {
      return false;
    }

    const cleanCVC = cvc.replace(/\s/g, "");

    // American Express uses 4-digit CVC, others use 3-digit
    if (cardType === "amex") {
      return /^\d{4}$/.test(cleanCVC);
    } else {
      return /^\d{3}$/.test(cleanCVC);
    }
  }

  /**
   * Validate expiry date
   */
  validateExpiryDate(month, year) {
    const validation = {
      isValid: true,
      errors: [],
    };

    // Convert to numbers
    const expMonth = parseInt(month);
    const expYear = parseInt(year);

    // Validate month
    if (!expMonth || expMonth < 1 || expMonth > 12) {
      validation.isValid = false;
      validation.errors.push("Invalid expiry month");
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (!expYear || expYear < currentYear) {
      validation.isValid = false;
      validation.errors.push("Card has expired");
    } else if (expYear === currentYear && expMonth < currentMonth) {
      validation.isValid = false;
      validation.errors.push("Card has expired");
    } else if (expYear > currentYear + 20) {
      validation.isValid = false;
      validation.errors.push("Invalid expiry year");
    }

    return validation;
  }

  /**
   * Check if card is a test card
   */
  isTestCard(cardNumber) {
    const testCards = [
      "4242424242424242", // Visa
      "4000000000000002", // Visa (declined)
      "5555555555554444", // Mastercard
      "2223003122003222", // Mastercard
      "378282246310005", // Amex
      "371449635398431", // Amex
      "6011111111111117", // Discover
      "30569309025904", // Diners Club
    ];

    return testCards.includes(cardNumber);
  }

  /**
   * Validate Bank Identification Number (BIN)
   */
  async validateBIN(bin) {
    const validation = {
      riskScore: 0,
      warnings: [],
      bankInfo: null,
    };

    try {
      // Check against known high-risk BINs
      const highRiskBins = [
        "400000", // Generic test BIN
        "424242", // Stripe test BIN
      ];

      if (highRiskBins.includes(bin)) {
        validation.riskScore += 20;
        validation.warnings.push("High-risk BIN detected");
      }

      // Check for prepaid cards (higher risk)
      const prepaidBins = [
        "403035",
        "404117",
        "404118",
        "404119",
        "404120",
        "404121",
      ];

      if (prepaidBins.includes(bin)) {
        validation.riskScore += 10;
        validation.warnings.push("Prepaid card detected");
      }

      return validation;
    } catch (error) {
      console.error("BIN validation error:", error);
      return validation;
    }
  }

  /**
   * Validate billing address format
   */
  validateBillingAddress(address) {
    const validation = {
      isValid: true,
      errors: [],
      riskScore: 0,
    };

    // Required fields
    const requiredFields = ["line1", "city", "postal_code", "country"];

    for (const field of requiredFields) {
      if (
        !address[field] ||
        typeof address[field] !== "string" ||
        address[field].trim().length === 0
      ) {
        validation.isValid = false;
        validation.errors.push(`${field.replace("_", " ")} is required`);
      }
    }

    // Validate postal code format based on country
    if (address.country && address.postal_code) {
      const postalValidation = this.validatePostalCode(
        address.postal_code,
        address.country
      );
      if (!postalValidation.isValid) {
        validation.isValid = false;
        validation.errors.push("Invalid postal code format");
      }
    }

    // Check for suspicious patterns
    if (address.line1 && /^(test|fake|123)/i.test(address.line1)) {
      validation.riskScore += 15;
    }

    return validation;
  }

  /**
   * Validate postal code based on country
   */
  validatePostalCode(postalCode, country) {
    // More flexible postal code validation
    const patterns = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
      GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
      DE: /^\d{5}$/,
      FR: /^\d{5}$/,
      AU: /^\d{4}$/,
      JP: /^\d{3}-\d{4}$/,
    };

    const pattern = patterns[country.toUpperCase()];
    if (!pattern) {
      // For unknown countries, use a more flexible pattern
      // Allow alphanumeric characters, spaces, and hyphens (3-10 characters)
      const flexiblePattern = /^[A-Za-z0-9\s-]{3,10}$/;
      return {
        isValid: flexiblePattern.test(postalCode.trim()),
      };
    }

    // For known countries, try the specific pattern first, then fall back to flexible
    const specificValid = pattern.test(postalCode);
    if (specificValid) {
      return { isValid: true };
    }

    // Fallback to flexible pattern for known countries too
    const flexiblePattern = /^[A-Za-z0-9\s-]{3,10}$/;
    return {
      isValid: flexiblePattern.test(postalCode.trim()),
    };
  }

  /**
   * Comprehensive fraud detection
   */
  async detectFraud(paymentData) {
    const riskAssessment = {
      riskScore: 0,
      riskLevel: "low",
      factors: [],
      recommendation: "approve",
    };

    try {
      // 1. Email validation
      if (paymentData.email) {
        const emailRisk = this.assessEmailRisk(paymentData.email);
        riskAssessment.riskScore += emailRisk.score;
        riskAssessment.factors.push(...emailRisk.factors);
      }

      // 2. Name validation
      if (paymentData.name) {
        const nameRisk = this.assessNameRisk(paymentData.name);
        riskAssessment.riskScore += nameRisk.score;
        riskAssessment.factors.push(...nameRisk.factors);
      }

      // 3. Velocity checks
      const velocityRisk = await this.checkVelocity(paymentData);
      riskAssessment.riskScore += velocityRisk.score;
      riskAssessment.factors.push(...velocityRisk.factors);

      // 4. Geolocation checks
      if (paymentData.ipAddress) {
        const geoRisk = await this.assessGeolocationRisk(
          paymentData.ipAddress,
          paymentData.billingAddress
        );
        riskAssessment.riskScore += geoRisk.score;
        riskAssessment.factors.push(...geoRisk.factors);
      }

      // 5. Device fingerprinting
      if (paymentData.deviceFingerprint) {
        const deviceRisk = await this.assessDeviceRisk(
          paymentData.deviceFingerprint
        );
        riskAssessment.riskScore += deviceRisk.score;
        riskAssessment.factors.push(...deviceRisk.factors);
      }

      // Calculate risk level and recommendation
      riskAssessment.riskLevel = this.calculateRiskLevel(
        riskAssessment.riskScore
      );
      riskAssessment.recommendation = this.getRecommendation(
        riskAssessment.riskScore
      );

      return riskAssessment;
    } catch (error) {
      console.error("Fraud detection error:", error);
      return {
        riskScore: 50,
        riskLevel: "medium",
        factors: ["fraud_detection_error"],
        recommendation: "review",
      };
    }
  }

  /**
   * Assess email risk
   */
  assessEmailRisk(email) {
    const risk = { score: 0, factors: [] };

    // Check for suspicious email patterns
    for (const pattern of this.fraudPatterns.suspiciousEmails) {
      if (pattern.test(email)) {
        risk.score += 25;
        risk.factors.push("suspicious_email_domain");
        break;
      }
    }

    // Check for disposable email domains
    const disposableDomains = [
      "tempmail.org",
      "10minutemail.com",
      "guerrillamail.com",
    ];
    const domain = email.split("@")[1];
    if (disposableDomains.includes(domain)) {
      risk.score += 30;
      risk.factors.push("disposable_email");
    }

    return risk;
  }

  /**
   * Assess name risk
   */
  assessNameRisk(name) {
    const risk = { score: 0, factors: [] };

    // Check for suspicious name patterns
    for (const pattern of this.fraudPatterns.suspiciousNames) {
      if (pattern.test(name)) {
        risk.score += 20;
        risk.factors.push("suspicious_name");
        break;
      }
    }

    // Check for very short names
    if (name.trim().length < 3) {
      risk.score += 15;
      risk.factors.push("short_name");
    }

    return risk;
  }

  /**
   * Check payment velocity (rate limiting)
   */
  async checkVelocity(paymentData) {
    // This would typically check against a database or cache
    // For now, return a basic implementation
    return {
      score: 0,
      factors: [],
    };
  }

  /**
   * Assess geolocation risk
   */
  async assessGeolocationRisk(ipAddress, billingAddress) {
    // This would typically use a geolocation service
    // For now, return a basic implementation
    return {
      score: 0,
      factors: [],
    };
  }

  /**
   * Assess device risk
   */
  async assessDeviceRisk(deviceFingerprint) {
    // This would typically check device reputation
    // For now, return a basic implementation
    return {
      score: 0,
      factors: [],
    };
  }

  /**
   * Calculate risk level from score
   */
  calculateRiskLevel(score) {
    if (score < 20) return "low";
    if (score < 50) return "medium";
    if (score < 80) return "high";
    return "critical";
  }

  /**
   * Get recommendation based on risk score
   */
  getRecommendation(score) {
    if (score < 20) return "approve";
    if (score < 50) return "review";
    if (score < 80) return "challenge";
    return "decline";
  }

  /**
   * Generate secure hash for card fingerprinting
   */
  generateCardFingerprint(cardNumber, expiryMonth, expiryYear) {
    const data = `${cardNumber.substring(0, 6)}${cardNumber.substring(
      cardNumber.length - 4
    )}${expiryMonth}${expiryYear}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

export default PaymentValidator;
