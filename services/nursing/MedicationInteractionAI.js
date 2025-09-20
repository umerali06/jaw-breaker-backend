// Advanced AI service for medication interaction checking
import OpenAI from "openai";

class MedicationInteractionAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.interactionDatabase = new Map();
    this.severityLevels = {
      CRITICAL: "critical",
      HIGH: "high",
      MODERATE: "moderate",
      LOW: "low",
    };
    this.initializeInteractionDatabase();
  }

  // Initialize known drug interaction database
  initializeInteractionDatabase() {
    // Common critical interactions
    this.interactionDatabase.set("warfarin+aspirin", {
      severity: this.severityLevels.CRITICAL,
      mechanism: "Increased bleeding risk",
      recommendation: "Avoid combination or monitor INR closely",
    });

    this.interactionDatabase.set("digoxin+furosemide", {
      severity: this.severityLevels.HIGH,
      mechanism: "Hypokalemia increases digoxin toxicity",
      recommendation: "Monitor potassium levels and digoxin levels",
    });

    this.interactionDatabase.set("metformin+contrast", {
      severity: this.severityLevels.HIGH,
      mechanism: "Risk of lactic acidosis",
      recommendation: "Hold metformin 48 hours before and after contrast",
    });

    // Add more interactions as needed
  }

  // Analyze polypharmacy risks
  async analyzePolypharmacy(medications, patientProfile = {}) {
    try {
      const analysis = {
        medicationCount: medications.length,
        riskLevel: this.calculatePolypharmacyRisk(
          medications.length,
          patientProfile
        ),
        interactions: await this.checkInteractions(medications, patientProfile),
        recommendations: [],
        concerns: [],
      };

      // Analyze medication burden
      if (medications.length >= 5) {
        analysis.concerns.push({
          type: "polypharmacy",
          severity: "moderate",
          description: "Patient is on 5 or more medications (polypharmacy)",
          impact: "Increased risk of adverse drug events and interactions",
        });
      }

      if (medications.length >= 10) {
        analysis.concerns.push({
          type: "excessive_polypharmacy",
          severity: "high",
          description:
            "Patient is on 10 or more medications (excessive polypharmacy)",
          impact:
            "Significantly increased risk of adverse events and medication errors",
        });
      }

      // Check for duplicate therapeutic classes
      const therapeuticClasses = this.groupByTherapeuticClass(medications);
      for (const [className, meds] of therapeuticClasses.entries()) {
        if (meds.length > 1) {
          analysis.concerns.push({
            type: "therapeutic_duplication",
            severity: "moderate",
            description: `Multiple medications in ${className} class`,
            medications: meds.map((m) => m.name),
            impact: "Risk of additive effects and toxicity",
          });
        }
      }

      // Generate recommendations
      analysis.recommendations = await this.generatePolypharmacyRecommendations(
        analysis
      );

      return analysis;
    } catch (error) {
      console.error("Error analyzing polypharmacy:", error);
      return {
        medicationCount: medications.length,
        riskLevel: "unknown",
        interactions: [],
        recommendations: [],
        concerns: [],
        error: error.message,
      };
    }
  }

  // Generate safety recommendations
  async generateSafetyRecommendations(interactionResults) {
    try {
      const recommendations = [];

      // Critical interactions
      const criticalInteractions =
        interactionResults.interactions?.filter(
          (i) => i.severity === "critical"
        ) || [];

      if (criticalInteractions.length > 0) {
        recommendations.push({
          type: "critical_alert",
          priority: "urgent",
          title: "Critical Drug Interactions Detected",
          description:
            "Immediate action required to prevent serious adverse events",
          actions: [
            "Contact prescribing physician immediately",
            "Consider alternative medications",
            "Implement enhanced monitoring protocols",
            "Document intervention in patient record",
          ],
          interactions: criticalInteractions,
        });
      }

      // High severity interactions
      const highInteractions =
        interactionResults.interactions?.filter((i) => i.severity === "high") ||
        [];

      if (highInteractions.length > 0) {
        recommendations.push({
          type: "high_priority",
          priority: "high",
          title: "High-Risk Drug Interactions",
          description: "Close monitoring and possible intervention required",
          actions: [
            "Increase monitoring frequency",
            "Review dosing and timing",
            "Monitor for specific adverse effects",
            "Consider dose adjustments",
          ],
          interactions: highInteractions,
        });
      }

      // Polypharmacy concerns
      if (interactionResults.medicationCount >= 5) {
        recommendations.push({
          type: "polypharmacy_management",
          priority: "medium",
          title: "Polypharmacy Management",
          description: "Multiple medications require careful coordination",
          actions: [
            "Conduct medication reconciliation",
            "Review for therapeutic duplications",
            "Assess for deprescribing opportunities",
            "Coordinate with pharmacy for medication review",
          ],
        });
      }

      // Age-related considerations
      if (interactionResults.patientAge >= 65) {
        recommendations.push({
          type: "geriatric_considerations",
          priority: "medium",
          title: "Geriatric Medication Safety",
          description: "Special considerations for older adult patients",
          actions: [
            "Review Beers Criteria medications",
            "Consider age-related pharmacokinetic changes",
            "Monitor for cognitive effects",
            "Assess fall risk from medications",
          ],
        });
      }

      return {
        recommendations,
        totalRecommendations: recommendations.length,
        highestPriority:
          recommendations.length > 0 ? recommendations[0].priority : "none",
        generatedAt: new Date(),
        summary: this.generateSafetySummary(recommendations),
      };
    } catch (error) {
      console.error("Error generating safety recommendations:", error);
      return {
        recommendations: [],
        totalRecommendations: 0,
        highestPriority: "none",
        generatedAt: new Date(),
        error: error.message,
      };
    }
  }

  // Calculate polypharmacy risk level
  calculatePolypharmacyRisk(medicationCount, patientProfile) {
    let riskScore = 0;

    // Base risk from medication count
    if (medicationCount >= 5) riskScore += 20;
    if (medicationCount >= 10) riskScore += 40;
    if (medicationCount >= 15) riskScore += 60;

    // Age factor
    if (patientProfile.age >= 65) riskScore += 15;
    if (patientProfile.age >= 80) riskScore += 25;

    // Comorbidity factor
    const comorbidityCount = patientProfile.conditions?.length || 0;
    riskScore += comorbidityCount * 5;

    // Kidney function
    if (
      patientProfile.creatinineClearance &&
      patientProfile.creatinineClearance < 60
    ) {
      riskScore += 20;
    }

    // Liver function
    if (patientProfile.liverFunction === "impaired") {
      riskScore += 15;
    }

    // Convert to risk level
    if (riskScore >= 80) return "very_high";
    if (riskScore >= 60) return "high";
    if (riskScore >= 40) return "moderate";
    if (riskScore >= 20) return "low";
    return "minimal";
  }

  // Group medications by therapeutic class
  groupByTherapeuticClass(medications) {
    const classes = new Map();

    medications.forEach((med) => {
      const therapeuticClass =
        med.therapeuticClass || this.inferTherapeuticClass(med.name);
      if (!classes.has(therapeuticClass)) {
        classes.set(therapeuticClass, []);
      }
      classes.get(therapeuticClass).push(med);
    });

    return classes;
  }

  // Infer therapeutic class from medication name
  inferTherapeuticClass(medicationName) {
    const name = medicationName.toLowerCase();

    // Common patterns
    if (name.includes("pril") || name.includes("sartan"))
      return "ACE Inhibitors/ARBs";
    if (name.includes("olol") || name.includes("atenolol"))
      return "Beta Blockers";
    if (name.includes("statin") || name.includes("vastatin")) return "Statins";
    if (name.includes("thiazide") || name.includes("furosemide"))
      return "Diuretics";
    if (name.includes("metformin") || name.includes("glyburide"))
      return "Antidiabetics";

    return "Other";
  }

  // Generate polypharmacy recommendations
  async generatePolypharmacyRecommendations(analysis) {
    const recommendations = [];

    if (analysis.riskLevel === "high" || analysis.riskLevel === "very_high") {
      recommendations.push({
        type: "medication_review",
        priority: "high",
        action: "Comprehensive medication review",
        rationale: "High polypharmacy risk requires systematic review",
      });
    }

    if (analysis.concerns.some((c) => c.type === "therapeutic_duplication")) {
      recommendations.push({
        type: "deprescribing",
        priority: "medium",
        action: "Review for therapeutic duplications",
        rationale: "Multiple medications in same class may be unnecessary",
      });
    }

    return recommendations;
  }

  // Generate safety summary
  generateSafetySummary(recommendations) {
    const criticalCount = recommendations.filter(
      (r) => r.priority === "urgent"
    ).length;
    const highCount = recommendations.filter(
      (r) => r.priority === "high"
    ).length;

    if (criticalCount > 0) {
      return `${criticalCount} critical safety issue(s) require immediate attention`;
    } else if (highCount > 0) {
      return `${highCount} high-priority safety concern(s) identified`;
    } else {
      return "No critical safety concerns identified";
    }
  }

  // Check for drug interactions using AI and database
  async checkInteractions(medications, patientData = {}) {
    try {
      const interactions = [];

      // First check against known database
      const databaseInteractions = this.checkDatabaseInteractions(medications);
      interactions.push(...databaseInteractions);

      // Then use AI for comprehensive analysis
      const aiInteractions = await this.checkAIInteractions(
        medications,
        patientData
      );
      interactions.push(...aiInteractions);

      // Deduplicate and prioritize
      const uniqueInteractions = this.deduplicateInteractions(interactions);

      return {
        hasInteractions: uniqueInteractions.length > 0,
        interactions: uniqueInteractions,
        riskScore: this.calculateRiskScore(uniqueInteractions),
        recommendations: this.generateRecommendations(uniqueInteractions),
      };
    } catch (error) {
      console.error("Error checking medication interactions:", error);
      throw error;
    }
  }

  // Check against known interaction database
  checkDatabaseInteractions(medications) {
    const interactions = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i].name.toLowerCase();
        const med2 = medications[j].name.toLowerCase();

        // Check both combinations
        const key1 = `${med1}+${med2}`;
        const key2 = `${med2}+${med1}`;

        const interaction =
          this.interactionDatabase.get(key1) ||
          this.interactionDatabase.get(key2);

        if (interaction) {
          interactions.push({
            medications: [medications[i], medications[j]],
            severity: interaction.severity,
            mechanism: interaction.mechanism,
            recommendation: interaction.recommendation,
            source: "database",
          });
        }
      }
    }

    return interactions;
  }

  // Use AI to check for interactions
  async checkAIInteractions(medications, patientData) {
    const medicationList = medications
      .map((med) => `${med.name} ${med.dosage} ${med.frequency}`)
      .join(", ");

    const patientInfo = this.formatPatientData(patientData);

    const prompt = `
    As a clinical pharmacist AI, analyze the following medication regimen for potential drug interactions:

    Medications: ${medicationList}
    
    Patient Information: ${patientInfo}

    Please identify:
    1. Any drug-drug interactions
    2. Drug-disease interactions based on patient conditions
    3. Drug-food interactions
    4. Severity level (critical, high, moderate, low)
    5. Clinical mechanism of interaction
    6. Specific recommendations

    Format response as JSON array with objects containing:
    - medications: array of interacting drugs
    - severity: string
    - mechanism: string
    - recommendation: string
    - type: string (drug-drug, drug-disease, drug-food)
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical pharmacist AI specializing in medication safety and drug interactions. Provide accurate, evidence-based analysis.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const aiResponse = response.choices[0].message.content;
      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error("AI interaction check failed:", error);
      return [];
    }
  }

  // Format patient data for AI analysis
  formatPatientData(patientData) {
    const info = [];

    if (patientData.age) info.push(`Age: ${patientData.age}`);
    if (patientData.weight) info.push(`Weight: ${patientData.weight}kg`);
    if (patientData.conditions)
      info.push(`Conditions: ${patientData.conditions.join(", ")}`);
    if (patientData.allergies)
      info.push(`Allergies: ${patientData.allergies.join(", ")}`);
    if (patientData.kidneyFunction)
      info.push(`Kidney function: ${patientData.kidneyFunction}`);
    if (patientData.liverFunction)
      info.push(`Liver function: ${patientData.liverFunction}`);

    return info.join("; ") || "No specific patient data provided";
  }

  // Parse AI response
  parseAIResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const interactions = JSON.parse(jsonMatch[0]);

      return interactions.map((interaction) => ({
        ...interaction,
        source: "ai",
      }));
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return [];
    }
  }

  // Remove duplicate interactions
  deduplicateInteractions(interactions) {
    const seen = new Set();
    const unique = [];

    for (const interaction of interactions) {
      const key = this.generateInteractionKey(interaction);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(interaction);
      }
    }

    // Sort by severity
    return unique.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Generate unique key for interaction
  generateInteractionKey(interaction) {
    const meds = interaction.medications
      .map((med) => med.name || med)
      .sort()
      .join("+");
    return `${meds}:${interaction.mechanism}`;
  }

  // Calculate overall risk score
  calculateRiskScore(interactions) {
    if (interactions.length === 0) return 0;

    const severityScores = { critical: 10, high: 7, moderate: 4, low: 2 };
    const totalScore = interactions.reduce((sum, interaction) => {
      return sum + (severityScores[interaction.severity] || 0);
    }, 0);

    return Math.min(100, totalScore);
  }

  // Generate clinical recommendations
  generateRecommendations(interactions) {
    const recommendations = [];

    const criticalCount = interactions.filter(
      (i) => i.severity === "critical"
    ).length;
    const highCount = interactions.filter((i) => i.severity === "high").length;

    if (criticalCount > 0) {
      recommendations.push({
        priority: "urgent",
        action: "Immediate review required",
        description: `${criticalCount} critical interaction(s) detected. Consider alternative medications or intensive monitoring.`,
      });
    }

    if (highCount > 0) {
      recommendations.push({
        priority: "high",
        action: "Enhanced monitoring",
        description: `${highCount} high-risk interaction(s) require close monitoring and possible dose adjustments.`,
      });
    }

    // Add specific recommendations from interactions
    interactions.forEach((interaction) => {
      if (interaction.recommendation) {
        recommendations.push({
          priority: interaction.severity,
          action: "Specific intervention",
          description: interaction.recommendation,
          medications: interaction.medications,
        });
      }
    });

    return recommendations;
  }

  // Check single medication against patient's current regimen
  async checkNewMedication(
    newMedication,
    currentMedications,
    patientData = {}
  ) {
    const allMedications = [...currentMedications, newMedication];
    const result = await this.checkInteractions(allMedications, patientData);

    // Filter to only interactions involving the new medication
    const relevantInteractions = result.interactions.filter((interaction) => {
      return interaction.medications.some(
        (med) => med.name === newMedication.name || med === newMedication.name
      );
    });

    return {
      ...result,
      interactions: relevantInteractions,
      isNewMedicationSafe:
        relevantInteractions.length === 0 ||
        !relevantInteractions.some((i) => i.severity === "critical"),
    };
  }

  // Get interaction details for specific drug pair
  async getInteractionDetails(drug1, drug2, patientData = {}) {
    const medications = [
      { name: drug1, dosage: "standard", frequency: "as prescribed" },
      { name: drug2, dosage: "standard", frequency: "as prescribed" },
    ];

    const result = await this.checkInteractions(medications, patientData);
    return result.interactions[0] || null;
  }

  // Batch check multiple medication regimens
  async batchCheckInteractions(medicationRegimens) {
    const results = [];

    for (const regimen of medicationRegimens) {
      try {
        const result = await this.checkInteractions(
          regimen.medications,
          regimen.patientData
        );
        results.push({
          patientId: regimen.patientId,
          ...result,
        });
      } catch (error) {
        results.push({
          patientId: regimen.patientId,
          error: error.message,
          hasInteractions: false,
          interactions: [],
        });
      }
    }

    return results;
  }

  // Update interaction database with new findings
  updateInteractionDatabase(drug1, drug2, interactionData) {
    const key = `${drug1.toLowerCase()}+${drug2.toLowerCase()}`;
    this.interactionDatabase.set(key, interactionData);
  }

  // Get statistics about interaction checking
  getStats() {
    return {
      databaseSize: this.interactionDatabase.size,
      severityLevels: Object.values(this.severityLevels),
      lastUpdated: new Date(),
    };
  }
}

export default new MedicationInteractionAI();
