import axios from "axios";

/**
 * Address Verification Service (AVS)
 * Validates billing addresses and detects fraud patterns
 */
class AddressVerificationService {
  constructor() {
    this.uspsApiKey = process.env.USPS_API_KEY;
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Comprehensive address verification
   */
  async verifyAddress(billingAddress) {
    const verification = {
      isValid: true,
      confidence: 0,
      normalizedAddress: null,
      riskScore: 0,
      warnings: [],
      errors: [],
    };

    try {
      // 1. Basic format validation
      const formatValidation = this.validateAddressFormat(billingAddress);
      if (!formatValidation.isValid) {
        verification.isValid = false;
        verification.errors.push(...formatValidation.errors);
        return verification;
      }

      // 2. Country-specific validation
      const countryValidation = await this.validateByCountry(billingAddress);
      verification.confidence = countryValidation.confidence;
      verification.normalizedAddress = countryValidation.normalizedAddress;
      verification.riskScore += countryValidation.riskScore;

      // 3. Fraud pattern detection
      const fraudCheck = this.detectAddressFraud(billingAddress);
      verification.riskScore += fraudCheck.riskScore;
      verification.warnings.push(...fraudCheck.warnings);

      // 4. PO Box detection
      if (this.isPOBox(billingAddress.line1)) {
        verification.riskScore += 10;
        verification.warnings.push("PO Box address detected");
      }

      return verification;
    } catch (error) {
      console.error("Address verification error:", error);
      return {
        isValid: false,
        confidence: 0,
        errors: ["Address verification service unavailable"],
        riskScore: 25,
      };
    }
  }

  /**
   * Validate address format
   */
  validateAddressFormat(address) {
    const validation = { isValid: true, errors: [] };

    // Required fields
    if (!address.line1 || address.line1.trim().length < 3) {
      validation.isValid = false;
      validation.errors.push("Street address is required");
    }

    if (!address.city || address.city.trim().length < 2) {
      validation.isValid = false;
      validation.errors.push("City is required");
    }

    if (!address.postal_code) {
      validation.isValid = false;
      validation.errors.push("Postal code is required");
    }

    if (!address.country || address.country.length !== 2) {
      validation.isValid = false;
      validation.errors.push("Valid country code is required");
    }

    return validation;
  }

  /**
   * Country-specific address validation
   */
  async validateByCountry(address) {
    const validation = {
      confidence: 0,
      normalizedAddress: null,
      riskScore: 0,
    };

    switch (address.country.toUpperCase()) {
      case "US":
        return await this.validateUSAddress(address);
      case "CA":
        return await this.validateCanadianAddress(address);
      case "GB":
        return await this.validateUKAddress(address);
      default:
        return await this.validateInternationalAddress(address);
    }
  }

  /**
   * Validate US address using USPS API
   */
  async validateUSAddress(address) {
    try {
      // Basic validation for now - would integrate with USPS API
      const validation = {
        confidence: 75,
        normalizedAddress: {
          line1: address.line1.toUpperCase(),
          city: address.city.toUpperCase(),
          state: address.state ? address.state.toUpperCase() : "",
          postal_code: address.postal_code,
          country: "US",
        },
        riskScore: 0,
      };

      // Validate ZIP code format
      if (!/^\d{5}(-\d{4})?$/.test(address.postal_code)) {
        validation.riskScore += 15;
        validation.confidence = 30;
      }

      // Validate state code
      const validStates = [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
      ];

      if (address.state && !validStates.includes(address.state.toUpperCase())) {
        validation.riskScore += 20;
        validation.confidence = 25;
      }

      return validation;
    } catch (error) {
      console.error("US address validation error:", error);
      return { confidence: 0, riskScore: 30 };
    }
  }

  /**
   * Validate Canadian address
   */
  async validateCanadianAddress(address) {
    const validation = {
      confidence: 70,
      normalizedAddress: {
        line1: address.line1.toUpperCase(),
        city: address.city.toUpperCase(),
        state: address.state ? address.state.toUpperCase() : "",
        postal_code: address.postal_code.toUpperCase().replace(/\s/g, ""),
        country: "CA",
      },
      riskScore: 0,
    };

    // Validate postal code format (A1A 1A1)
    if (!/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(address.postal_code)) {
      validation.riskScore += 15;
      validation.confidence = 30;
    }

    return validation;
  }

  /**
   * Validate UK address
   */
  async validateUKAddress(address) {
    const validation = {
      confidence: 70,
      normalizedAddress: {
        line1: address.line1.toUpperCase(),
        city: address.city.toUpperCase(),
        postal_code: address.postal_code.toUpperCase(),
        country: "GB",
      },
      riskScore: 0,
    };

    // Validate postcode format
    if (
      !/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(address.postal_code)
    ) {
      validation.riskScore += 15;
      validation.confidence = 30;
    }

    return validation;
  }

  /**
   * Validate international address
   */
  async validateInternationalAddress(address) {
    return {
      confidence: 50,
      normalizedAddress: {
        line1: address.line1,
        city: address.city,
        state: address.state || "",
        postal_code: address.postal_code,
        country: address.country.toUpperCase(),
      },
      riskScore: 5, // Slightly higher risk for international
    };
  }

  /**
   * Detect fraudulent address patterns
   */
  detectAddressFraud(address) {
    const fraud = { riskScore: 0, warnings: [] };

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^(test|fake|123|sample)/i,
      /^(n\/a|na|none|null)/i,
      /^(street|address|line)/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(address.line1)) {
        fraud.riskScore += 25;
        fraud.warnings.push("Suspicious address pattern detected");
        break;
      }
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(address.line1)) {
      fraud.riskScore += 20;
      fraud.warnings.push("Repeated character pattern in address");
    }

    // Check for very short addresses
    if (address.line1.trim().length < 5) {
      fraud.riskScore += 15;
      fraud.warnings.push("Unusually short address");
    }

    return fraud;
  }

  /**
   * Check if address is a PO Box
   */
  isPOBox(addressLine) {
    const poBoxPatterns = [
      /^p\.?o\.?\s*box/i,
      /^post\s*office\s*box/i,
      /^postal\s*box/i,
      /^box\s*\d+/i,
    ];

    return poBoxPatterns.some((pattern) => pattern.test(addressLine));
  }

  /**
   * Normalize address for consistent storage
   */
  normalizeAddress(address) {
    return {
      line1: address.line1.trim().toUpperCase(),
      line2: address.line2 ? address.line2.trim().toUpperCase() : "",
      city: address.city.trim().toUpperCase(),
      state: address.state ? address.state.trim().toUpperCase() : "",
      postal_code: address.postal_code.trim().toUpperCase(),
      country: address.country.toUpperCase(),
    };
  }
}

export default AddressVerificationService;
