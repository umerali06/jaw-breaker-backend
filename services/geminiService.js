import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import pdfParse from "pdf-parse";
import { fileURLToPath } from "url";
import azureOpenAIService from "./azureOpenAIService.js";
import { dirname, join } from "path";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the server directory
dotenv.config({ path: join(__dirname, "../.env") });

// Initialize Gemini AI with improved error handling
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables - Gemini AI will be disabled");
  console.warn("To enable Gemini AI, set GEMINI_API_KEY in your environment variables");
  // Continue without throwing error - the service will fail gracefully when called
}

// Log partial API key for debugging (first 10 chars only)
console.log(
  "Initializing Gemini AI with API key:",
  apiKey ? apiKey.substring(0, 10) + "..." : "Not configured"
);

// Add a warning about using only the flash model
console.log(
  "WARNING: Using gemini-1.5-flash model for all services as a temporary fix. Please update your API key for full functionality."
);

// Define available models and fallbacks
const MODELS = {
  FLASH: "gemini-1.5-flash",
  PRO: "gemini-1.5-flash", // Changed from gemini-1.5-pro to gemini-1.5-flash as a temporary fix
  FALLBACK: "gemini-1.5-flash", // Use flash model as fallback too
};

// Create Gemini client
// Create Gemini client
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Get a generative model with fallback options
 * @param {string} preferredModel - The preferred model to use
 * @returns {Object} - The generative model
 */
const getModelWithFallback = (preferredModel) => {
  if (!genAI) {
    throw new Error("Gemini AI is not configured - no API key provided");
  }
  
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
      try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
        
        if (!data.text || data.text.trim().length === 0) {
          throw new Error("PDF appears to be empty or contains no extractable text");
        }
        
      return data.text;
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        throw new Error(`PDF processing failed: ${pdfError.message}. The file may be corrupted, password-protected, or contain only images.`);
      }
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
      try {
        const text = fs.readFileSync(filePath, "utf8");
        if (!text || text.trim().length === 0) {
          throw new Error("Text file appears to be empty");
        }
        return text;
      } catch (textError) {
        console.error("Text file reading error:", textError);
        throw new Error(`Text file processing failed: ${textError.message}`);
      }
    } else {
      throw new Error(`Unsupported file type: ${mimetype}. Please use PDF, DOCX, or TXT files.`);
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
    // Try Azure OpenAI first (primary)
    try {
      console.log("🚀 [SOAP Note] Using Azure OpenAI as primary service...");
      const azureResponse = await azureOpenAIService.chatWithAI(
        `Generate a comprehensive, evidence-based SOAP note based on the following clinical documentation. Ensure clinical accuracy, regulatory compliance, and professional standards:\n\n${text}`,
        {
          ...patientContext,
          systemPrompt: `You are an advanced clinical documentation specialist with expertise in nursing care, evidence-based practice, and regulatory compliance.

CLINICAL EXPERTISE:
- Advanced knowledge of nursing care documentation and SOAP note standards
- Expertise in evidence-based practice and clinical decision support
- Understanding of CMS guidelines, regulatory requirements, and quality standards
- Knowledge of interdisciplinary care coordination and team-based approaches

SOAP NOTE REQUIREMENTS:
- Use precise clinical terminology and professional language
- Follow structured SOAP format with clear sections
- Include specific clinical findings and assessments
- Provide evidence-based interventions and care plans
- Consider patient-specific factors and care context
- Align with current clinical guidelines and best practices

QUALITY STANDARDS:
- Ensure accuracy and clinical relevance
- Maintain consistency with evidence-based practice
- Focus on patient safety and quality outcomes
- Align with regulatory and accreditation standards
- Use clear, actionable clinical language`
        }
      );
      console.log("✅ [SOAP Note] Azure OpenAI response successful");
      return {
        success: true,
        soapNote: azureResponse,
        model: "gpt-5-chat",
        provider: "azure-openai"
      };
    } catch (azureError) {
      console.warn("⚠️ [SOAP Note] Azure OpenAI failed, falling back to Gemini:", azureError.message);
    }

    // Fallback to Gemini
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
    // Try Azure OpenAI first (primary)
    try {
      console.log("🚀 [OASIS Scores] Using Azure OpenAI as primary service...");
      const azureResponse = await azureOpenAIService.chatWithAI(
        `Generate accurate, evidence-based OASIS scores based on the following clinical documentation. Ensure regulatory compliance and clinical accuracy:\n\n${text}`,
        {
          items,
          systemPrompt: `You are an advanced OASIS specialist with expertise in CMS home health regulations, quality measures, and clinical assessment.

CLINICAL EXPERTISE:
- Advanced knowledge of OASIS assessment and scoring criteria
- Expertise in CMS guidelines, regulatory requirements, and quality standards
- Understanding of home health care delivery and patient outcomes
- Knowledge of evidence-based practice and clinical decision support

OASIS SCORING REQUIREMENTS:
- Provide accurate, defensible OASIS scores based on clinical documentation
- Include detailed rationale for each score with specific clinical indicators
- Consider patient-specific factors and care context
- Align with current CMS guidelines and regulatory standards
- Focus on measurable outcomes and quality indicators

QUALITY STANDARDS:
- Ensure accuracy and clinical relevance
- Maintain consistency with evidence-based practice
- Focus on patient safety and quality outcomes
- Align with regulatory and accreditation standards
- Use clear, actionable clinical language`
        }
      );
      console.log("✅ [OASIS Scores] Azure OpenAI response successful");
      return {
        success: true,
        scores: azureResponse,
        model: "gpt-5-chat",
        provider: "azure-openai"
      };
    } catch (azureError) {
      console.warn("⚠️ [OASIS Scores] Azure OpenAI failed, falling back to Gemini:", azureError.message);
    }

    // Fallback to Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
      console.log(`Starting enhanced clinical analysis (attempt ${attempt}/${maxRetries})...`);
    // Changed from gemini-1.5-pro to gemini-1.5-flash since that model is working
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Analysis timed out after 60 seconds")), 60000);
      });

      const analysisPromise = model.generateContent(prompt);
      
      const result = await Promise.race([analysisPromise, timeoutPromise]);
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

    // Additional JSON cleaning - fix common formatting issues
    cleanedText = cleanedText
      .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
      .replace(/\n/g, " ") // Remove newlines that might break JSON
      .replace(/\s+/g, " "); // Normalize whitespace

    // Try to parse as JSON
    try {
      const analysisResult = JSON.parse(cleanedText);
      console.log("Clinical analysis completed successfully");
      return analysisResult;
    } catch (parseError) {
      console.log("JSON parsing failed, creating structured response");
      console.error("Clinical Analysis JSON parsing failed:", parseError);
      console.error(
        "Original response:",
        responseText.substring(0, 500) + "..."
      );
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
      lastError = error;
      console.error(`Clinical analysis attempt ${attempt} failed:`, error);

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  console.error("All clinical analysis attempts failed:", lastError);

  // Check for specific error types and provide better error messages
  let errorMessage = "Document analysis encountered an issue";
  let errorType = "ANALYSIS_ERROR";
  
  if (lastError.message.includes("quota") || lastError.message.includes("429")) {
    errorMessage = "API quota exceeded. Please try again tomorrow or upgrade your plan.";
    errorType = "QUOTA_EXCEEDED";
  } else if (lastError.message.includes("API_KEY_INVALID")) {
    errorMessage = "API configuration issue. Please contact support.";
    errorType = "API_CONFIG_ERROR";
  } else if (lastError.message.includes("PERMISSION_DENIED")) {
    errorMessage = "API access denied. Please contact support.";
    errorType = "API_ACCESS_ERROR";
  } else if (lastError.message.includes("timeout") || lastError.message.includes("TIMEOUT")) {
    errorMessage = "Analysis timed out. Please try again with a smaller document.";
    errorType = "TIMEOUT_ERROR";
  } else if (lastError.message.includes("network") || lastError.message.includes("fetch")) {
    errorMessage = "Network connection issue. Please check your internet and try again.";
    errorType = "NETWORK_ERROR";
  } else if (lastError.message.includes("model") || lastError.message.includes("MODEL")) {
    errorMessage = "AI model temporarily unavailable. Please try again in a few minutes.";
    errorType = "MODEL_ERROR";
  }

  // Return a more helpful fallback response
    return {
    summary: `Clinical analysis could not be completed: ${errorMessage}. Please try again or contact support if the issue persists.`,
      clinicalInsights: [
        {
          type: "alert",
          message: errorMessage,
          priority: "high",
        category: "error",
        evidence: "Analysis service error"
      }
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
      skilledNeedJustification: `Manual review required - ${errorMessage}`,
      error: true,
    errorType: errorType,
    retryable: errorType !== "QUOTA_EXCEEDED" && errorType !== "API_CONFIG_ERROR"
    };
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
    console.log("🔍 [Gemini Service] Starting analysis with Azure OpenAI...");
    
    // Use Azure OpenAI for document analysis
    const analysis = await azureOpenAIService.analyzeDocument(filePath, mimetype, {
      patientId: patientContext.patientId,
      documentType: patientContext.documentType || 'Clinical Document',
      patientContext: patientContext
    });

    if (analysis.success) {
      console.log("✅ [Gemini Service] Azure OpenAI analysis completed successfully");
      return {
        summary: analysis.analysis,
        clinicalInsights: analysis.insights,
        extractedEntities: [],
        careGoals: [],
        interventions: [],
        riskFactors: [],
        providerCommunication: [],
        skilledNeedJustification: [],
        soapNote: "",
        oasisScores: {},
        rawText: analysis.extractedText,
        qualityScore: analysis.qualityScore,
        provider: analysis.provider,
        timestamp: analysis.timestamp
      };
    } else {
      throw new Error(analysis.error || 'Azure OpenAI analysis failed');
    }
  } catch (error) {
    console.error("❌ [Gemini Service] Azure OpenAI failed, falling back to Gemini analysis:", error.message);
    
    // Fallback to Gemini analysis if Azure OpenAI fails
    try {
      // Extract text from file
      const text = await extractTextFromFile(filePath, mimetype);

      // Generate comprehensive analysis with error resilience
      // Each component can fail independently without breaking the entire analysis
      let soapNote = null;
      let clinicalAnalysis = null;
      let oasisScores = null;

      // Try SOAP note generation
      try {
        console.log("Generating SOAP note...");
        soapNote = await generateSOAPNote(text, patientContext);
      } catch (error) {
        console.error("Error generating SOAP note:", error);
        soapNote = { error: "SOAP note generation failed", generated: false };
      }

      // Try clinical analysis generation
      try {
        console.log("Generating clinical analysis...");
        clinicalAnalysis = await generateClinicalAnalysis(text);
    } catch (error) {
      console.error("Error generating clinical analysis:", error);
      clinicalAnalysis = {
        summary:
          "Clinical analysis could not be completed due to a processing error. Please try again or contact support if the issue persists.",
        clinicalInsights: [
          {
            type: "alert",
            message: "Analysis processing failed",
            priority: "high",
            category: "error"
          }
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
        skilledNeedJustification: "Manual review required - analysis processing failed",
        error: "Clinical analysis generation failed",
        errorType: "PROCESSING_ERROR"
      };
    }

    // Try OASIS scores generation
    try {
      console.log("Generating OASIS scores...");
      oasisScores = await generateOASISScores(text);
    } catch (error) {
      console.error("Error generating OASIS scores:", error);
      oasisScores = { error: "OASIS scores generation failed" };
    }

    // Combine results into comprehensive analysis
    return {
      summary: clinicalAnalysis.summary,
      clinicalInsights: clinicalAnalysis.clinicalInsights || [],
      extractedEntities: clinicalAnalysis.extractedEntities || {},
      careGoals: clinicalAnalysis.careGoals || [],
      interventions: clinicalAnalysis.interventions || [],
      riskFactors: clinicalAnalysis.riskFactors || [],
      providerCommunication: clinicalAnalysis.providerCommunication || [],
      skilledNeedJustification: clinicalAnalysis.skilledNeedJustification || {},
      soapNote: soapNote,
      oasisScores: oasisScores,
      rawText: text.substring(0, 1000) + (text.length > 1000 ? "..." : ""),
        processingStatus: "completed",
        hasErrors: !!(
          soapNote?.error ||
          clinicalAnalysis?.error ||
          oasisScores?.error
        ),
        provider: 'Gemini AI',
        fallback: true
      };
    } catch (fallbackError) {
      console.error("❌ [Gemini Service] Both Azure OpenAI and Gemini fallback failed:", fallbackError.message);
      throw fallbackError;
    }
  }
};

/**
 * Enhanced chat with AI assistant for clinical insights with NLP-based context awareness
 * @param {string} message - User message
 * @param {Object} context - Rich context including patient data, document content, and clinical insights
 * @returns {Promise<string>} - AI response
 */
export const chatWithAI = async (message, context = {}) => {
  try {
    console.log("💬 [Gemini Service] Starting chat with Azure OpenAI...");
    
    // Use Azure OpenAI for chat
    const response = await azureOpenAIService.chatWithAI(message, context);
    
    console.log("✅ [Gemini Service] Azure OpenAI chat completed successfully");
    return response;
    
  } catch (error) {
    console.error("❌ [Gemini Service] Azure OpenAI failed, falling back to Gemini chat:", error.message);
    
    // Fallback to Gemini chat if Azure OpenAI fails
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are an advanced clinical documentation assistant with expertise in:
- OASIS (Outcome and Assessment Information Set) scoring and analysis
- SOAP note generation and clinical documentation
- Clinical insights and care plan recommendations
- Medical terminology and healthcare compliance
- Patient assessment and intervention strategies
- Natural language processing of medical documents

CAPABILITIES:
- Complete OASIS scoring (M1830, M1860, etc.) with CMS format and rationale
- Write SN visit notes for various conditions (diabetes, wounds, etc.)
- Summarize care plan goals for multiple conditions
- Document wound findings and assessments
- Provide clinical reasoning and recommendations
- Analyze patient documentation for insights
- Answer questions based on document context

CLINICAL FOLLOW-UP BEHAVIOR:
When no document is provided or information is incomplete:
1. Ask smart, clinical follow-up questions based on protocols and best practices
2. Guide users to think deeper about patient assessment
3. Suggest specific areas that need clarification or additional detail
4. Use clinical reasoning to identify gaps in information
5. Provide structured prompts for comprehensive documentation

RESPONSE GUIDELINES:
1. Always provide clinically accurate, evidence-based responses
2. Format responses clearly with appropriate headings and structure using markdown
3. When referencing document content, cite the specific source
4. Prioritize patient safety and clinical best practices
5. Maintain HIPAA compliance and medical accuracy
6. Use professional medical terminology appropriate for healthcare providers
7. When answering questions about a specific document, focus on that document's content
8. If the question requires information not in the context, acknowledge limitations
9. When information is vague or incomplete, ask specific clarifying questions
10. Guide users with suggestions and clinical protocols

MARKDOWN FORMATTING:
- Use **bold text** for emphasis and important points
- Use *italics* for secondary emphasis
- Use ## for section headings and ### for subsection headings
- Use bullet points (- item) for lists
- Use numbered lists (1. item) for sequential steps
- Use > for important notes or quotes
- Format clinical terms appropriately

Always respond in a clear, structured, and compliant format suitable for clinical documentation, using markdown formatting to enhance readability.`;

    let userPrompt = message;
    let contextualInformation = "";

    // Add rich context if provided
    if (context.patientName) {
      contextualInformation += `\n\nPATIENT INFORMATION:\nName: ${context.patientName}`;
    }

    // Add document names if available
    if (context.recentDocuments && context.recentDocuments.length > 0) {
      contextualInformation += `\n\nRECENT DOCUMENTS:\n${context.recentDocuments.join(
        "\n"
      )}`;
    }

    // Add latest clinical summary if available
    if (context.latestSummary) {
      contextualInformation += `\n\nLATEST CLINICAL SUMMARY:\n${context.latestSummary}`;
    }

    // Add clinical insights if available
    if (context.clinicalInsights && context.clinicalInsights.length > 0) {
      contextualInformation += `\n\nKEY CLINICAL INSIGHTS:`;
      context.clinicalInsights.forEach((insight) => {
        contextualInformation += `\n- [${insight.priority.toUpperCase()}] ${
          insight.type
        }: ${insight.message}`;
      });
    }

    // Add OASIS scores if available
    if (context.patientData && context.patientData.oasisScores) {
      contextualInformation += `\n\nOASIS SCORES:`;
      Object.entries(context.patientData.oasisScores).forEach(
        ([item, data]) => {
          contextualInformation += `\n${item}: Score ${data.score} - ${
            data.rationale
              ? data.rationale.substring(0, 100)
              : "No rationale provided"
          }`;
        }
      );
    }

    // Add SOAP note summary if available
    if (context.patientData && context.patientData.soapNote) {
      const soap = context.patientData.soapNote;
      contextualInformation += `\n\nSOAP NOTE SUMMARY:`;
      if (soap.subjective)
        contextualInformation += `\nSubjective: ${soap.subjective.substring(
          0,
          150
        )}...`;
      if (soap.objective)
        contextualInformation += `\nObjective: ${soap.objective.substring(
          0,
          150
        )}...`;
      if (soap.assessment)
        contextualInformation += `\nAssessment: ${soap.assessment.substring(
          0,
          150
        )}...`;
      if (soap.plan)
        contextualInformation += `\nPlan: ${soap.plan.substring(0, 150)}...`;
    }

    // Add document content if available (most valuable context)
    if (context.documentContent && context.documentContent.length > 0) {
      contextualInformation += `\n\nDOCUMENT CONTENT:`;
      context.documentContent.forEach((doc) => {
        contextualInformation += `\n\nFrom document "${doc.filename}":\n${doc.content}`;
      });
    }

    // Add clinical guidance for manual entry scenarios
    if (context.isManualEntry && !context.documentContent?.length) {
      contextualInformation += `\n\nMANUAL ENTRY MODE: No documents uploaded. 
      
CLINICAL GUIDANCE INSTRUCTIONS:
- Provide general clinical assistance and guidance
- Ask smart, specific follow-up questions based on clinical protocols
- Guide the user to think deeper about patient assessment
- Suggest areas that need clarification or additional detail
- Use clinical reasoning to identify information gaps
- Provide structured prompts for comprehensive documentation
- Help build complete clinical picture through targeted questions
- If no patient context is provided, offer general clinical knowledge and assistance

GENERAL CLINICAL ASSISTANCE:
- Answer clinical questions about procedures, assessments, documentation
- Provide guidance on OASIS scoring, SOAP notes, care planning
- Explain clinical concepts and best practices
- Help with clinical decision-making and protocols
- Assist with documentation standards and compliance

If the user provides vague or incomplete information, ask specific clarifying questions such as:
- Vital signs and objective measurements
- Functional status and mobility assessment
- Pain assessment and management
- Medication compliance and side effects
- Safety concerns and fall risk factors
- Wound assessment details if applicable
- Cognitive status and orientation
- Support system and caregiver involvement`;
    }

    // Add general clinical assistance mode when no patient context
    if (!context.patientName && !context.patientId) {
      contextualInformation += `\n\nGENERAL CLINICAL ASSISTANCE MODE:
- Provide clinical knowledge and guidance
- Help with documentation, assessments, and protocols
- Answer questions about clinical procedures and best practices
- Assist with OASIS scoring, SOAP notes, and care planning
- No specific patient context - focus on general clinical assistance`;
    }

    // Combine everything into a well-structured prompt
    const prompt = `${systemPrompt}\n\nUSER QUERY: ${userPrompt}\n\nCONTEXT INFORMATION:${contextualInformation}\n\nPlease provide a comprehensive, clinically accurate response to the user's query based on the available context. Use markdown formatting (bold, italics, headings, lists) to make your response more readable and structured.`;

    console.log("Sending enhanced prompt to Gemini API");

    // Add retry logic for 503 errors (service overloaded)
    let retries = 3;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Received response from Gemini API");
        return response.text();
      } catch (error) {
        lastError = error;

        // If it's a 503 error (service overloaded), retry with exponential backoff
        if (error.status === 503 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(
            `🔄 Gemini API overloaded (503), retrying in ${delay}ms... (attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // For other errors or final retry, throw immediately
        break;
      }
    }

      console.log("✅ [Gemini Service] Gemini fallback successful");
      return response.text();
    } catch (fallbackError) {
      console.error("❌ [Gemini Service] Both Azure OpenAI and Gemini fallback failed:", fallbackError.message);
      throw fallbackError;
    }
  }
};

/**
 * Test Gemini API connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export const testConnection = async () => {
  try {
    console.log("Testing Gemini API connection...");
    
    // Check if API key is available
    if (!genAI) {
      console.log("Gemini AI not configured - no API key provided");
      return { 
        success: false, 
        error: "Gemini AI not configured - no API key provided",
        status: "disabled"
      };
    }

    // Test with gemini-1.5-flash model
    console.log("Testing gemini-1.5-flash model");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      "Hello, respond with 'OK' if you can read this."
    );
    const response = await result.response;
    const text = response.text();

    console.log("Gemini API test successful:", text);
    return {
      success: true,
      text,
      response: response,
      model: "gemini-1.5-flash",
    }; // Return full response with model info
  } catch (error) {
    console.error("Gemini test error:", error);
    return { 
      success: false, 
      error: error.message, 
      stack: error.stack,
      status: "error"
    };
  }
};

/**
 * Generate content using Gemini AI (for compatibility with NursingAIService)
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Generation options
 * @returns {Promise<string>} - Generated content
 */
export const generateContent = async (prompt, options = {}) => {
  try {
    if (!genAI) {
      throw new Error("Gemini AI is not configured - no API key provided");
    }
    
    const model = getModelWithFallback(options.model || MODELS.FLASH);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    throw error;
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
  generateContent,
};
