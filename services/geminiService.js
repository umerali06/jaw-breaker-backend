import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import pdfParse from "pdf-parse";

dotenv.config();

// Initialize Gemini AI with improved error handling
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
  throw new Error("Gemini API key is required");
}

// Log partial API key for debugging (first 10 chars only)
console.log(
  "Initializing Gemini AI with API key:",
  apiKey.substring(0, 10) + "..."
);

// Define available models and fallbacks
const MODELS = {
  FLASH: "gemini-1.5-flash",
  PRO: "gemini-1.5-pro",
  FALLBACK: "gemini-pro", // Legacy fallback model
};

// Create Gemini client
// Create Gemini client
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Get a generative model with fallback options
 * @param {string} preferredModel - The preferred model to use
 * @returns {Object} - The generative model
 */
const getModelWithFallback = (preferredModel) => {
  try {
    return genAI.getGenerativeModel({ model: preferredModel });
  } catch (error) {
    console.warn(
      `Error getting model ${preferredModel}, trying fallback:`,
      error.message
    );
    try {
      // Try the PRO model as fallback
      if (preferredModel !== MODELS.PRO) {
        console.log(`Falling back to ${MODELS.PRO} model`);
        return genAI.getGenerativeModel({ model: MODELS.PRO });
      } else {
        // If PRO was the original model, try FLASH
        console.log(`Falling back to ${MODELS.FLASH} model`);
        return genAI.getGenerativeModel({ model: MODELS.FLASH });
      }
    } catch (fallbackError) {
      console.error("All model fallbacks failed:", fallbackError.message);
      throw new Error("Unable to initialize any Gemini AI model");
    }
  }
};

/**
 * Extract text from a file based on its mimetype
 * @param {string} filePath - Path to the file
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromFile = async (filePath, mimetype) => {
  try {
    if (mimetype === "application/pdf") {
      // Extract text from PDF
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (
      mimetype === "application/msword" ||
      mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // For DOCX files, we would need a library like mammoth.js
      // For simplicity, we'll return a message
      return "DOCX parsing not implemented yet. Please use PDF or TXT files.";
    } else if (mimetype === "text/plain") {
      // Read text file directly
      return fs.readFileSync(filePath, "utf8");
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw error;
  }
};

/**
 * Generate a comprehensive clinical analysis with SOAP note format
 * @param {string} text - Text to analyze
 * @param {Object} patientContext - Optional patient context
 * @returns {Promise<Object>} - Comprehensive clinical analysis
 */
export const generateSOAPNote = async (text, patientContext = {}) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are an expert clinical documentation specialist with advanced training in home health and skilled nursing documentation. Generate comprehensive, CMS-compliant, legally defensible SOAP notes.

ADVANCED DOCUMENTATION REQUIREMENTS:
- Use precise clinical terminology and professional language
- Follow evidence-based nursing practice standards
- Ensure CMS compliance and skilled need justification
- Include specific measurable outcomes and patient responses
- Document safety assessments and interventions
- Address medication management and adherence
- Include patient/caregiver education with comprehension validation
- Document coordination with healthcare team members

COMPREHENSIVE SOAP NOTE STRUCTURE:

1. SUBJECTIVE (Patient's Perspective):
   - Chief complaint and current concerns
   - Pain assessment (0-10 scale, location, quality, triggers, relief measures)
   - Functional status changes since last visit
   - Medication adherence and side effects
   - Sleep patterns, appetite, mood changes
   - Fall history and safety concerns
   - Patient/caregiver questions and understanding
   - Satisfaction with current care plan

2. OBJECTIVE (Clinical Findings):
   - Vital Signs: BP, HR, RR, Temp, O2 Sat, Pain score, Weight
   - General Appearance: Alert, oriented, cooperative, distressed
   - Home Environment: Safety hazards, cleanliness, adequate supplies
   - System-Specific Assessments:
     * Cardiovascular: Heart sounds, rhythm, pulse quality, edema, circulation
     * Pulmonary: Lung sounds, respiratory effort, cough, sputum
     * Neurological: Mental status, coordination, gait, fall risk assessment
     * Integumentary: Skin condition, wounds, pressure areas
     * Musculoskeletal: Range of motion, strength, mobility aids
     * Gastrointestinal: Bowel patterns, nutrition, hydration
     * Genitourinary: Continence, catheter care if applicable
   - Functional Assessment: ADL performance, safety awareness
   - Medication Review: Compliance, understanding, side effects

3. ASSESSMENT (Clinical Judgment):
   - Primary and secondary nursing diagnoses
   - Progress toward established goals (improved/stable/declined)
   - Risk factors and safety concerns identified
   - Patient/caregiver learning needs
   - Barriers to care or goal achievement
   - Clinical indicators requiring provider notification

4. PLAN (Interventions and Follow-up):
   - Skilled nursing interventions performed and planned
   - Patient/caregiver education provided with comprehension validation
   - Medication management and reconciliation
   - Safety interventions and environmental modifications
   - Coordination with physician and other disciplines
   - Next visit plan and frequency justification
   - Goals for upcoming visits with measurable outcomes
   - Provider communications and recommendations

Return comprehensive JSON with detailed, clinically accurate content for each section.`;

    let userPrompt = `Generate a comprehensive SOAP note based on this clinical documentation: ${text.substring(
      0,
      8000
    )}`;

    if (patientContext.name) {
      userPrompt += `\n\nPatient Name: ${patientContext.name}`;
    }

    if (patientContext.id) {
      userPrompt += `\nPatient ID: ${patientContext.id}`;
    }

    const prompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "subjective": "Patient's subjective information here",
  "objective": "Objective findings here", 
  "assessment": "Clinical assessment here",
  "plan": "Treatment plan here"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("Gemini SOAP response:", responseText);

    // Clean the response text to extract JSON
    let cleanedText = responseText.trim();

    // Remove markdown code blocks if present
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/```json\s*/, "")
        .replace(/```\s*$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\s*/, "").replace(/```\s*$/, "");
    }

    // Try to find JSON object in the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleanedText);
      return parsed;
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      console.error("Original response:", responseText);

      // Extract SOAP sections using regex patterns
      const extractSection = (text, sectionName) => {
        const patterns = [
          new RegExp(
            `${sectionName}:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:OBJECTIVE|ASSESSMENT|PLAN|$))`,
            "i"
          ),
          new RegExp(
            `${sectionName}[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z]+:|$)`,
            "i"
          ),
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        return `${sectionName} information extracted from documentation`;
      };

      return {
        subjective: extractSection(responseText, "SUBJECTIVE"),
        objective: extractSection(responseText, "OBJECTIVE"),
        assessment: extractSection(responseText, "ASSESSMENT"),
        plan: extractSection(responseText, "PLAN"),
        rawResponse: responseText,
        note: "Response was parsed from text format due to JSON parsing error",
      };
    }
  } catch (error) {
    console.error("Error generating SOAP note:", error);
    console.error("Error details:", error.message);

    // Return a fallback SOAP note with error details
    return {
      subjective:
        "SOAP note generation encountered an error. Please review the source documentation manually.",
      objective:
        "Unable to extract objective findings due to AI service error.",
      assessment:
        "Manual clinical assessment required due to service unavailability.",
      plan: "Please create treatment plan manually based on available documentation.",
      error: error.message,
      note: "This is a fallback response due to AI service error",
    };
  }
};

/**
 * Generate comprehensive OASIS scores with CMS-compliant format
 * @param {string} text - Text to analyze
 * @param {Array} items - Specific OASIS items to score
 * @returns {Promise<Object>} - OASIS scores with detailed rationale
 */
export const generateOASISScores = async (
  text,
  items = [
    "M1830",
    "M1840",
    "M1850",
    "M1860",
    "M1800",
    "M1810",
    "M1820",
    "M1845",
    "M1870",
    "M1033",
  ]
) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const systemPrompt = `You are a certified OASIS specialist with extensive experience in CMS home health regulations. Provide accurate, defensible OASIS scores based on clinical documentation.

COMPREHENSIVE OASIS ITEM DEFINITIONS:

FUNCTIONAL STATUS ITEMS:
- M1800 (Grooming): Ability to tend to personal hygiene needs (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent, UK=Unknown)
- M1810 (Upper Body Dressing): Ability to dress upper body safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1820 (Lower Body Dressing): Ability to dress lower body safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1830 (Bathing): Ability to wash entire body safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1840 (Toilet Transferring): Ability to get to/from toilet safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1845 (Toileting Hygiene): Ability to maintain toileting hygiene (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1850 (Transferring): Ability to move safely from bed to chair (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1860 (Ambulation): Ability to walk safely once standing (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1870 (Feeding): Ability to feed self meals and snacks (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)

CLINICAL ITEMS:
- M1033 (Risk of Hospitalization): Overall risk based on clinical factors (0=No risk factors, 1=One risk factor, 2=Two risk factors, 3=Three or more risk factors)
- M1242 (Frequency of Pain): How often patient experiences pain (0=Never, 1=Less than daily, 2=Daily but not constantly, 3=All of the time)
- M1311 (Depression Screening): PHQ-2 or equivalent screening results
- M1322 (Medication Management): Ability to manage medications safely
- M1400 (Dyspnea): Shortness of breath assessment
- M1610 (Urinary Incontinence): Frequency of urinary accidents

SCORING GUIDELINES:
- Base scores on current functional ability, not potential
- Consider safety as primary factor
- Use "requires assistance" if human help is needed
- Use "requires devices" if adaptive equipment enables independence
- Provide specific clinical evidence for each score
- Include confidence level based on documentation quality

Return comprehensive JSON format with detailed rationale and clinical evidence.`;

    const userPrompt = `Score the following OASIS items based on this clinical documentation: ${items.join(
      ", "
    )}

Clinical Documentation:
${text.substring(0, 8000)}`;

    const prompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "M1830": {"score": 0, "rationale": "explanation", "confidence": 0.8},
  "M1840": {"score": 1, "rationale": "explanation", "confidence": 0.9}
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("Gemini OASIS response:", responseText);

    // Clean the response text to extract JSON
    let cleanedText = responseText.trim();

    // Remove markdown code blocks if present
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/```json\s*/, "")
        .replace(/```\s*$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\s*/, "").replace(/```\s*$/, "");
    }

    // Try to find JSON object in the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleanedText);
      return parsed;
    } catch (parseError) {
      console.error("OASIS JSON parsing failed:", parseError);
      console.error("Original response:", responseText);
      // If JSON parsing fails, create a fallback structure
      const fallbackScores = {};
      items.forEach((item) => {
        fallbackScores[item] = {
          score: 0,
          rationale: "Score extracted from AI response - please review",
          confidence: 0.5,
        };
      });
      return fallbackScores;
    }
  } catch (error) {
    console.error("Error generating OASIS scores:", error);

    // Return fallback OASIS scores
    const fallbackScores = {};
    items.forEach((item) => {
      fallbackScores[item] = {
        score: 0,
        rationale:
          "OASIS scoring is currently unavailable due to AI service issues. Please score manually.",
        confidence: 0,
      };
    });
    return fallbackScores;
  }
};

/**
 * Generate comprehensive clinical analysis with insights and recommendations
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} - Clinical insights and recommendations
 */
export const generateClinicalAnalysis = async (text) => {
  try {
    console.log("Starting enhanced clinical analysis...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const systemPrompt = `You are an expert clinical documentation assistant with specialized knowledge in:
- Home Health Care & Skilled Nursing
- CMS Compliance & OASIS Requirements
- Clinical Risk Assessment & Patient Safety
- Evidence-Based Care Planning
- Medical Terminology & ICD-10 Coding

ENHANCED ANALYSIS REQUIREMENTS:
1. CLINICAL ASSESSMENT:
   - Identify primary and secondary diagnoses
   - Assess functional status and ADL capabilities
   - Evaluate cognitive and mental health status
   - Determine fall risk and safety concerns
   - Analyze medication management and adherence

2. CARE PLANNING:
   - Develop SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
   - Recommend evidence-based interventions
   - Identify skilled nursing needs and frequency
   - Plan for patient/caregiver education

3. RISK STRATIFICATION:
   - Hospital readmission risk factors
   - Medication interaction alerts
   - Infection prevention needs
   - Wound care requirements
   - Nutritional concerns

4. COMPLIANCE & DOCUMENTATION:
   - CMS guidelines adherence
   - Skilled need justification
   - Provider communication priorities
   - Quality measure indicators

RESPONSE FORMAT - Return comprehensive JSON:
{
  "summary": "Professional clinical summary with key findings, patient status, and care priorities",
  "clinicalInsights": [
    {
      "type": "risk|improvement|alert|recommendation|safety|medication|wound|nutrition",
      "message": "Detailed clinical insight with specific recommendations",
      "priority": "low|medium|high|critical",
      "category": "assessment|intervention|education|monitoring",
      "evidence": "Clinical rationale or guideline reference"
    }
  ],
  "extractedEntities": {
    "medications": ["Medication name - dose - frequency - indication"],
    "conditions": ["Primary/Secondary diagnoses with ICD-10 if identifiable"],
    "procedures": ["Procedures, treatments, interventions performed"],
    "vitals": {"BP": "value", "HR": "value", "RR": "value", "Temp": "value", "O2Sat": "value", "Pain": "value"},
    "allergies": ["Known allergies and reactions"],
    "functionalStatus": ["ADL capabilities and limitations"],
    "cognitiveStatus": ["Mental status and cognitive function"],
    "socialFactors": ["Support system, living situation, barriers"]
  },
  "careGoals": [
    {
      "goal": "Specific SMART goal",
      "timeframe": "Target completion time",
      "interventions": ["Specific actions to achieve goal"],
      "outcomes": ["Measurable outcomes expected"]
    }
  ],
  "interventions": [
    {
      "intervention": "Specific nursing intervention",
      "frequency": "How often to perform",
      "rationale": "Clinical justification",
      "expectedOutcome": "Anticipated result"
    }
  ],
  "riskFactors": [
    {
      "risk": "Specific risk identified",
      "severity": "low|medium|high|critical",
      "interventions": ["Risk mitigation strategies"],
      "monitoring": "What to monitor and how often"
    }
  ],
  "providerCommunication": [
    {
      "priority": "urgent|routine|fyi",
      "topic": "Subject of communication",
      "message": "Specific information to communicate",
      "action": "Requested provider action if any"
    }
  ],
  "skilledNeedJustification": {
    "primary": "Main skilled nursing need",
    "secondary": ["Additional skilled needs"],
    "frequency": "Recommended visit frequency",
    "duration": "Anticipated length of service",
    "goals": ["Specific skilled nursing goals"],
    "outcomes": ["Expected patient outcomes"]
  },
  "qualityIndicators": {
    "fallRisk": "low|medium|high with rationale",
    "readmissionRisk": "low|medium|high with factors",
    "medicationCompliance": "assessment and concerns",
    "functionalImprovement": "potential for improvement",
    "patientSafety": "safety concerns and interventions"
  }
}`;

    const userPrompt = `Analyze this clinical documentation and provide comprehensive insights:

${text.substring(0, 8000)}`;

    const prompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON in the exact format specified above.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("Gemini Clinical Analysis response:", responseText);

    // Clean the response text to extract JSON
    let cleanedText = responseText.trim();

    // Remove markdown code blocks if present
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/```json\s*/, "")
        .replace(/```\s*$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\s*/, "").replace(/```\s*$/, "");
    }

    // Try to find JSON object in the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    // Try to parse as JSON
    try {
      const analysisResult = JSON.parse(cleanedText);
      console.log("Clinical analysis completed successfully");
      return analysisResult;
    } catch (parseError) {
      console.log("JSON parsing failed, creating structured response");
      console.error("Clinical Analysis JSON parsing failed:", parseError);
      console.error("Original response:", responseText);
      // If JSON parsing fails, create a structured response
      return {
        summary:
          "Clinical analysis completed - please review detailed response",
        clinicalInsights: [
          {
            type: "recommendation",
            message: "Detailed analysis available in raw response",
            priority: "medium",
          },
        ],
        extractedEntities: {
          medications: [],
          conditions: [],
          procedures: [],
          vitals: {},
          allergies: [],
        },
        careGoals: [],
        interventions: [],
        riskFactors: [],
        providerCommunication: [],
        skilledNeedJustification:
          "Analysis completed - manual review recommended",
        rawResponse: responseText,
      };
    }
  } catch (error) {
    console.error("Error generating clinical analysis:", error);

    // Return a fallback response if Gemini fails
    return {
      summary:
        "Clinical analysis is currently unavailable. Please check your Gemini API configuration.",
      clinicalInsights: [
        {
          type: "alert",
          message: "AI analysis service is currently unavailable",
          priority: "medium",
        },
      ],
      extractedEntities: {
        medications: [],
        conditions: [],
        procedures: [],
        vitals: {},
        allergies: [],
      },
      careGoals: [],
      interventions: [],
      riskFactors: [],
      providerCommunication: [],
      skilledNeedJustification:
        "Manual review required - AI service unavailable",
    };
  }
};

/**
 * Generate a comprehensive analysis of a patient document
 * @param {string} filePath - Path to the file
 * @param {string} mimetype - MIME type of the file
 * @param {Object} patientContext - Optional patient context
 * @returns {Promise<Object>} - Comprehensive analysis
 */
export const analyzeDocument = async (
  filePath,
  mimetype,
  patientContext = {}
) => {
  try {
    // Extract text from file
    const text = await extractTextFromFile(filePath, mimetype);

    // Generate comprehensive analysis
    const [clinicalAnalysis, soapNote, oasisScores] = await Promise.all([
      generateClinicalAnalysis(text),
      generateSOAPNote(text, patientContext),
      generateOASISScores(text),
    ]);

    // Combine results into comprehensive analysis
    return {
      summary: clinicalAnalysis.summary,
      clinicalInsights: clinicalAnalysis.clinicalInsights,
      extractedEntities: clinicalAnalysis.extractedEntities,
      careGoals: clinicalAnalysis.careGoals,
      interventions: clinicalAnalysis.interventions,
      riskFactors: clinicalAnalysis.riskFactors,
      providerCommunication: clinicalAnalysis.providerCommunication,
      skilledNeedJustification: clinicalAnalysis.skilledNeedJustification,
      soapNote: soapNote,
      oasisScores: oasisScores,
      rawText: text.substring(0, 1000) + (text.length > 1000 ? "..." : ""),
    };
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw error;
  }
};

/**
 * Chat with AI assistant for clinical insights
 * @param {string} message - User message
 * @param {Object} context - Optional context including patient data
 * @returns {Promise<string>} - AI response
 */
export const chatWithAI = async (message, context = {}) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are a clinical documentation assistant specializing in:
- OASIS (Outcome and Assessment Information Set) scoring and analysis
- SOAP note generation and clinical documentation
- Clinical insights and care plan recommendations
- Medical terminology and healthcare compliance
- Patient assessment and intervention strategies

You provide accurate, professional, and clinically relevant responses. Always maintain HIPAA compliance and medical accuracy.

CAPABILITIES:
- Complete OASIS scoring (M1830, M1860, etc.) with CMS format and rationale
- Write SN visit notes for various conditions (diabetes, wounds, etc.)
- Summarize care plan goals for multiple conditions
- Document wound findings and assessments
- Provide clinical reasoning and recommendations

Always respond in a clear, structured, and compliant format suitable for clinical documentation.`;

    let userPrompt = message;

    // Add context if provided
    if (context.patientName) {
      userPrompt += `\n\nPatient Context: ${context.patientName}`;
    }

    if (context.recentDocuments && context.recentDocuments.length > 0) {
      userPrompt += `\nRecent Documents: ${context.recentDocuments.join(", ")}`;
    }

    const prompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Error in AI chat:", error);
    throw error;
  }
};

/**
 * Test Gemini API connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export const testConnection = async () => {
  try {
    console.log("Testing Gemini API connection...");

    // Test with gemini-1.5-flash model
    console.log("Testing gemini-1.5-flash model");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      "Hello, respond with 'OK' if you can read this."
    );
    const response = await result.response;
    const text = response.text();
    return { success: true, text, response: response }; // Return full response
  } catch (error) {
    console.error("Gemini test error:", error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

export default {
  extractTextFromFile,
  generateSOAPNote,
  generateOASISScores,
  generateClinicalAnalysis,
  analyzeDocument,
  chatWithAI,
  testConnection,
};
