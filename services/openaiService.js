import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import pdfParse from "pdf-parse";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import azureOpenAIService from "./azureOpenAIService.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the server directory
dotenv.config({ path: join(__dirname, "../.env") });

// Initialize OpenAI only if API key is provided
let openai = null;
if (
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== "placeholder-key-to-prevent-server-crash"
) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log("OpenAI service initialized successfully");
} else {
  console.log("OpenAI API key not provided - OpenAI features will be disabled");
}

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
    // Try Azure OpenAI first (primary)
    try {
      console.log("🚀 [SOAP Note] Using Azure OpenAI as primary service...");
      const azureResponse = await azureOpenAIService.chatWithAI(
        `Generate a comprehensive SOAP note based on the following clinical documentation:\n\n${text}`,
        patientContext
      );
      console.log("✅ [SOAP Note] Azure OpenAI response successful");
      return {
        success: true,
        soapNote: azureResponse,
        model: "gpt-5-chat",
        provider: "azure-openai"
      };
    } catch (azureError) {
      console.warn("⚠️ [SOAP Note] Azure OpenAI failed, falling back to OpenAI:", azureError.message);
    }

    // Fallback to OpenAI
    if (!openai) {
      console.log("OpenAI not available - returning fallback SOAP note");
      return {
        subjective:
          "AI service not configured. Please add API keys to environment variables.",
        objective: "Please manually document objective findings.",
        assessment: "Manual clinical assessment required.",
        plan: "Please create treatment plan manually.",
      };
    }

    const systemPrompt = `You are a clinical documentation assistant specializing in home health and skilled nursing documentation. You generate CMS-compliant, chart-ready documentation following SOAP format.

DOCUMENTATION REQUIREMENTS:
- Use clinical language and professional tone
- Follow structured SN/PT note format with Subjective, Objective, Assessment, Plan (SOAP)
- Include wound details if mentioned (size, stage, drainage, infection risk)
- Include rationale for education provided
- Address visit goals and patient responses
- Collaborate with MD/social work recommendations if relevant
- Never make up data - only use information provided

SOAP NOTE STRUCTURE:
1. SUBJECTIVE: Patient's report including pain level, satisfaction with services, new concerns, falls, mental state, medication adherence, continence, changes in condition
2. OBJECTIVE: 
   - Vital Signs: BP, Pulse, Respiration, Temperature, SpO2, Pain score
   - Home Environment: Safety, cleanliness, groceries present
   - System-Specific Assessments:
     * Cardiovascular: Heart sounds, pulse strength, edema, PVD signs
     * Pulmonary: Lung sounds, respiratory effort, adventitious sounds
     * Neurological: LOC, coordination, fall risk
3. ASSESSMENT: Clinical assessment, diagnoses, and interpretations
4. PLAN: Treatment plan, medications, education provided, follow-up instructions

Return response as JSON with subjective, objective, assessment, and plan sections.`;

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error generating SOAP note:", error);

    // Return a fallback SOAP note
    return {
      subjective:
        "SOAP note generation is currently unavailable due to AI service issues.",
      objective: "Please manually document objective findings.",
      assessment: "Manual clinical assessment required.",
      plan: "Please create treatment plan manually.",
    };
  }
};

/**
 * Generate OASIS scores with CMS-compliant format
 * @param {string} text - Text to analyze
 * @param {Array} items - Specific OASIS items to score
 * @returns {Promise<Object>} - OASIS scores with rationale
 */
export const generateOASISScores = async (
  text,
  items = ["M1830", "M1840", "M1850", "M1860"]
) => {
  try {
    // Try Azure OpenAI first (primary)
    try {
      console.log("🚀 [OASIS Scores] Using Azure OpenAI as primary service...");
      const azureResponse = await azureOpenAIService.chatWithAI(
        `Generate accurate OASIS scores based on the following clinical documentation:\n\n${text}`,
        { items }
      );
      console.log("✅ [OASIS Scores] Azure OpenAI response successful");
      return {
        success: true,
        scores: azureResponse,
        model: "gpt-5-chat",
        provider: "azure-openai"
      };
    } catch (azureError) {
      console.warn("⚠️ [OASIS Scores] Azure OpenAI failed, falling back to OpenAI:", azureError.message);
    }

    // Fallback to OpenAI
    if (!openai) {
      console.log("OpenAI not available - returning fallback OASIS scores");
      const fallbackScores = {};
      items.forEach((item) => {
        fallbackScores[item] = {
          score: 0,
          rationale:
            "AI service not configured. Please add API keys to environment variables.",
          confidence: 0,
        };
      });
      return fallbackScores;
    }
    const systemPrompt = `You are an OASIS scoring specialist with expertise in CMS guidelines. When OASIS items are requested, provide:
- CMS score format (e.g., M1830: 2)
- Short clinical rationale for each score
- Confidence level (0-1) for each assessment

OASIS ITEM DEFINITIONS:
- M1830 (Bathing): Current ability to wash entire body safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1840 (Toilet Transferring): Current ability to get to/from toilet safely (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1850 (Transferring): Current ability to move safely from bed to chair (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1860 (Ambulation): Current ability to walk safely once standing (0=Independent, 1=Requires use of devices, 2=Requires assistance, 3=Totally dependent)
- M1033 (Risk of Hospitalization): Overall risk factors
- M1800 (Grooming): Current ability to tend to personal hygiene
- M1810 (Upper Body Dressing): Current ability to dress upper body
- M1820 (Lower Body Dressing): Current ability to dress lower body
- M1845 (Toileting Hygiene): Current ability to manage toileting hygiene
- M1870 (Feeding): Current ability to feed self meals and snacks

Return JSON format with each OASIS item containing score, rationale, and confidence.`;

    const userPrompt = `Score the following OASIS items based on this clinical documentation: ${items.join(
      ", "
    )}

Clinical Documentation:
${text.substring(0, 8000)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1500,
    });

    return JSON.parse(response.choices[0].message.content);
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
    console.log("Starting clinical analysis...");

    // Check if OpenAI is available
    if (!openai) {
      console.log(
        "OpenAI not available - returning fallback clinical analysis"
      );
      return {
        summary:
          "OpenAI service not configured. Please add OPENAI_API_KEY to environment variables.",
        clinicalInsights: [
          {
            type: "alert",
            message: "OpenAI API key not configured - AI analysis unavailable",
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
          "Manual review required - OpenAI service not configured",
      };
    }
    const systemPrompt = `You are a clinical documentation assistant specializing in home health care analysis. Analyze the provided documentation and generate comprehensive clinical insights.

ANALYSIS REQUIREMENTS:
- Identify clinical problems and generate medical solutions
- Create care plans with goals and interventions
- Assess trends (improvement, decline, stability)
- Flag potential risks (fall risk, medication interactions, readmission risk)
- Suggest "what to look for" during assessments
- Provide provider communication prompts
- Ensure CMS compliance and skilled need justification

RESPONSE FORMAT - Return JSON with:
{
  "summary": "Concise clinical summary highlighting key findings and changes",
  "clinicalInsights": [
    {
      "type": "risk|improvement|alert|recommendation",
      "message": "Specific clinical insight",
      "priority": "low|medium|high"
    }
  ],
  "extractedEntities": {
    "medications": ["List of medications"],
    "conditions": ["Diagnoses and conditions"],
    "procedures": ["Procedures mentioned"],
    "vitals": {"BP": "value", "HR": "value"},
    "allergies": ["Known allergies"]
  },
  "careGoals": ["Specific care goals identified"],
  "interventions": ["Recommended interventions"],
  "riskFactors": ["Identified risk factors"],
  "providerCommunication": ["Points to communicate to MD/provider"],
  "skilledNeedJustification": "Rationale for skilled nursing services"
}`;

    const userPrompt = `Analyze this clinical documentation and provide comprehensive insights:

${text.substring(0, 8000)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2000,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content);
    console.log("Clinical analysis completed successfully");
    return analysisResult;
  } catch (error) {
    console.error("Error generating clinical analysis:", error);

    // Return a fallback response if OpenAI fails
    return {
      summary:
        "Clinical analysis is currently unavailable. Please check your OpenAI API configuration.",
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
    console.log("🔍 [Document Analysis] Starting analysis with Azure OpenAI...");
    
    // Use Azure OpenAI for document analysis
    const analysis = await azureOpenAIService.analyzeDocument(filePath, mimetype, {
      patientId: patientContext.patientId,
      documentType: patientContext.documentType || 'Clinical Document',
      patientContext: patientContext
    });

    if (analysis.success) {
      console.log("✅ [Document Analysis] Azure OpenAI analysis completed successfully");
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
    console.error("❌ [Document Analysis] Azure OpenAI failed, falling back to legacy analysis:", error.message);
    
    // Fallback to legacy analysis if Azure OpenAI fails
    try {
      const text = await extractTextFromFile(filePath, mimetype);
      const [clinicalAnalysis, soapNote, oasisScores] = await Promise.all([
        generateClinicalAnalysis(text),
        generateSOAPNote(text, patientContext),
        generateOASISScores(text),
      ]);

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
        provider: 'Legacy OpenAI',
        fallback: true
      };
    } catch (fallbackError) {
      console.error("❌ [Document Analysis] Both Azure OpenAI and fallback failed:", fallbackError.message);
      throw fallbackError;
    }
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
    console.log("💬 [Chat AI] Starting chat with Azure OpenAI...");
    
    // Use Azure OpenAI for chat
    const response = await azureOpenAIService.chatWithAI(message, context);
    
    console.log("✅ [Chat AI] Azure OpenAI chat completed successfully");
    return response;
    
  } catch (error) {
    console.error("❌ [Chat AI] Azure OpenAI failed, falling back to legacy chat:", error.message);
    
    // Fallback to legacy OpenAI chat if Azure OpenAI fails
    try {
      if (!openai) {
        return "AI service is not configured. Please check your API keys to enable AI chat features.";
      }
      
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      console.log("✅ [Chat AI] Legacy OpenAI fallback successful");
      return response.choices[0].message.content;
      
    } catch (fallbackError) {
      console.error("❌ [Chat AI] Both Azure OpenAI and fallback failed:", fallbackError.message);
      throw fallbackError;
    }
  }
};

export default {
  extractTextFromFile,
  generateSOAPNote,
  generateOASISScores,
  generateClinicalAnalysis,
  analyzeDocument,
  chatWithAI,
};
