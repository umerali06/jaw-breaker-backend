import File from "../models/File.js";
import {
  analyzeDocument,
  generateSOAPNote,
  generateOASISScores,
  chatWithAI as aiChatService,
  testConnection,
} from "../services/geminiService.js";

/**
 * Analyze a document and generate comprehensive AI insights
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const analyzeFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log("Analyzing file request:", { fileId, userId: req.userId });

    // Find the file in the database
    const file = await File.findById(fileId);
    console.log(
      "File found:",
      file
        ? {
            id: file._id,
            name: file.originalname,
            userId: file.userId,
            status: file.processingStatus,
          }
        : "Not found"
    );

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Verify file belongs to the authenticated user - allow legacy files
    const fileUserIdStr = file.userId ? file.userId.toString() : null;
    const isLegacyFile =
      !file.userId ||
      file.userId === "anonymous" ||
      typeof file.userId === "string";

    console.log("Authorization check:", {
      fileUserId: fileUserIdStr,
      requestUserId: req.userId,
      fileId: fileId,
      isLegacyFile: isLegacyFile,
      authorized: isLegacyFile || fileUserIdStr === req.userId,
    });

    if (!isLegacyFile && fileUserIdStr !== req.userId) {
      console.log("Authorization check failed in analyzeFile:", {
        fileUserId: fileUserIdStr,
        requestUserId: req.userId,
        fileId: fileId,
        isLegacyFile: isLegacyFile,
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this file",
      });
    }

    // For legacy files, update them with the current user's ID
    if (isLegacyFile) {
      console.log("Updating legacy file with current user ID in analyzeFile:", {
        fileId: fileId,
        oldUserId: file.userId,
        newUserId: req.userId,
      });
      file.userId = req.userId;
      await file.save();
    }

    // Update processing status
    console.log("Updating file status to processing");
    file.processingStatus = "processing";
    file.processingStarted = new Date();
    await file.save();
    console.log("File status updated successfully");

    try {
      // Prepare patient context
      const patientContext = {
        name: file.patientName,
        id: file.patientId,
      };

      // Analyze the document with enhanced clinical analysis
      console.log("Starting analysis for file:", file.originalname);
      const analysis = await analyzeDocument(
        file.path,
        file.mimetype,
        patientContext
      );
      console.log("Analysis completed successfully");

      // Update the file with comprehensive analysis results
      file.aiSummary = analysis.summary;

      // Store structured data
      if (analysis.clinicalInsights) {
        file.clinicalInsights = analysis.clinicalInsights;
      }

      if (analysis.extractedEntities) {
        file.extractedEntities = analysis.extractedEntities;
      }

      if (analysis.oasisScores) {
        const oasisMap = new Map();
        Object.entries(analysis.oasisScores).forEach(([key, value]) => {
          oasisMap.set(key, value);
        });
        file.oasisScores = oasisMap;
      }

      if (analysis.soapNote) {
        file.soapNote = {
          ...analysis.soapNote,
          generated: new Date(),
        };
      }

      // Store additional analysis data
      if (analysis.careGoals) {
        file.careGoals = analysis.careGoals;
      }

      if (analysis.interventions) {
        file.interventions = analysis.interventions;
      }

      if (analysis.riskFactors) {
        file.riskFactors = analysis.riskFactors;
      }

      if (analysis.providerCommunication) {
        file.providerCommunication = analysis.providerCommunication;
      }

      if (analysis.skilledNeedJustification) {
        file.skilledNeedJustification = analysis.skilledNeedJustification;
      }

      file.processingStatus = "completed";
      file.processingCompleted = new Date();
      await file.save();
      console.log(
        "Analysis completed successfully for file:",
        file.originalname
      );

      // Return the analysis results
      res.status(200).json({
        success: true,
        message: "File analyzed successfully",
        analysis: {
          summary: analysis.summary,
          clinicalInsights: analysis.clinicalInsights,
          extractedEntities: analysis.extractedEntities,
          careGoals: analysis.careGoals,
          interventions: analysis.interventions,
          riskFactors: analysis.riskFactors,
          providerCommunication: analysis.providerCommunication,
          skilledNeedJustification: analysis.skilledNeedJustification,
          oasisScores: analysis.oasisScores,
          soapNote: analysis.soapNote,
        },
      });
    } catch (error) {
      console.error("Error during analysis processing:", error);
      // Update processing status to failed
      file.processingStatus = "failed";
      file.processingError = error.message || "Unknown error during analysis";
      file.processingCompleted = new Date();
      await file.save();
      console.log("File status updated to failed");

      throw error;
    }
  } catch (error) {
    console.error("Error analyzing file:", error);
    res.status(500).json({
      success: false,
      message: "Error analyzing file",
      error: error.message,
    });
  }
};

/**
 * Get comprehensive analysis results for a file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAnalysis = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Find the file in the database
    const file = await File.findById(fileId);

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Debug logging
    console.log("File found:", {
      fileId: file._id,
      fileName: file.originalname,
      fileUserId: file.userId?.toString(),
      requestUserId: req.userId,
      userIdType: typeof file.userId,
      requestUserIdType: typeof req.userId,
    });

    // Verify file belongs to the authenticated user - allow legacy files without proper userId
    const fileUserIdStr = file.userId ? file.userId.toString() : null;
    const isLegacyFile =
      !file.userId ||
      file.userId === "anonymous" ||
      typeof file.userId === "string";

    if (!isLegacyFile && fileUserIdStr !== req.userId) {
      console.log("Authorization check failed in getAnalysis:", {
        fileUserId: fileUserIdStr,
        requestUserId: req.userId,
        fileId: fileId,
        isLegacyFile: isLegacyFile,
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this file",
      });
    }

    // For legacy files, update them with the current user's ID
    if (isLegacyFile) {
      console.log("Updating legacy file with current user ID:", {
        fileId: fileId,
        oldUserId: file.userId,
        newUserId: req.userId,
      });
      file.userId = req.userId;
      await file.save();
    }

    // Check if the file has been analyzed
    if (!file.aiSummary) {
      return res.status(200).json({
        success: true,
        fileId: file._id,
        fileName: file.originalname,
        patientName: file.patientName,
        patientId: file.patientId,
        processingStatus: file.processingStatus,
        summary: null,
        clinicalInsights: [],
        extractedEntities: {},
        oasisScores: {},
        soapNote: null,
        message: "File has not been analyzed yet",
      });
    }

    // Prepare comprehensive analysis response
    const analysisData = {
      summary: file.aiSummary,
      processingStatus: file.processingStatus,
      clinicalInsights: file.clinicalInsights || [],
      extractedEntities: file.extractedEntities || {},
      oasisScores: file.oasisScores ? Object.fromEntries(file.oasisScores) : {},
      soapNote: file.soapNote || null,
      careGoals: file.careGoals || [],
      interventions: file.interventions || [],
      riskFactors: file.riskFactors || [],
      providerCommunication: file.providerCommunication || [],
      skilledNeedJustification: file.skilledNeedJustification || null,
    };

    // Return the analysis results
    res.status(200).json({
      success: true,
      fileId: file._id,
      fileName: file.originalname,
      patientName: file.patientName,
      patientId: file.patientId,
      processingStatus: file.processingStatus,
      ...analysisData,
    });
  } catch (error) {
    console.error("Error getting analysis:", error);
    res.status(500).json({
      success: false,
      message: "Error getting analysis",
      error: error.message,
    });
  }
};

/**
 * Generate custom analysis (SOAP notes, OASIS scores, or custom prompts)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateCustomAnalysis = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = "analysis", prompt, items } = req.body;

    // Find the file in the database
    const file = await File.findById(fileId);

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Verify file belongs to the authenticated user - allow legacy files
    const fileUserIdStr = file.userId ? file.userId.toString() : null;
    const isLegacyFile =
      !file.userId ||
      file.userId === "anonymous" ||
      typeof file.userId === "string";

    if (!isLegacyFile && fileUserIdStr !== req.userId) {
      console.log("Authorization check failed in generateCustomAnalysis:", {
        fileUserId: fileUserIdStr,
        requestUserId: req.userId,
        fileId: fileId,
        isLegacyFile: isLegacyFile,
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this file",
      });
    }

    // For legacy files, update them with the current user's ID
    if (isLegacyFile) {
      console.log(
        "Updating legacy file with current user ID in generateCustomAnalysis:",
        {
          fileId: fileId,
          oldUserId: file.userId,
          newUserId: req.userId,
        }
      );
      file.userId = req.userId;
      await file.save();
    }

    let result;

    try {
      if (type === "soap") {
        // Generate SOAP note
        const patientContext = {
          name: file.patientName,
          id: file.patientId,
        };

        // Extract text from file first
        const { extractTextFromFile } = await import(
          "../services/geminiService.js"
        );

        console.log("Extracting text from file:", {
          filePath: file.path,
          mimetype: file.mimetype,
          fileName: file.originalname,
        });

        const text = await extractTextFromFile(file.path, file.mimetype);

        if (!text || text.trim().length === 0) {
          throw new Error(
            "No text could be extracted from the file. Please ensure the file contains readable text content."
          );
        }

        console.log("Extracted text length:", text.length);
        console.log("Text preview:", text.substring(0, 200));

        result = await generateSOAPNote(text, patientContext);

        console.log("SOAP note generation result:", result);

        // Ensure we have a valid result
        if (!result || typeof result !== "object") {
          throw new Error("Invalid SOAP note result from AI service");
        }

        // Save SOAP note to file
        file.soapNote = {
          ...result,
          generated: new Date(),
        };
        await file.save();
      } else if (type === "oasis") {
        // Generate OASIS scores
        const oasisItems = items || ["M1830", "M1840", "M1850", "M1860"];

        // Extract text from file first
        const { extractTextFromFile } = await import(
          "../services/geminiService.js"
        );
        const text = await extractTextFromFile(file.path, file.mimetype);

        result = await generateOASISScores(text, oasisItems);

        // Update OASIS scores in file
        const oasisMap = new Map();
        Object.entries(result).forEach(([key, value]) => {
          oasisMap.set(key, value);
        });

        // Merge with existing scores
        if (file.oasisScores) {
          for (const [key, value] of oasisMap.entries()) {
            file.oasisScores.set(key, value);
          }
        } else {
          file.oasisScores = oasisMap;
        }

        await file.save();
      } else {
        // Custom analysis with user prompt
        if (!prompt) {
          return res.status(400).json({
            success: false,
            message: "Prompt is required for custom analysis",
          });
        }

        // Import services dynamically
        const { extractTextFromFile, chatWithAI } = await import(
          "../services/geminiService.js"
        );

        // Extract text from file
        const text = await extractTextFromFile(file.path, file.mimetype);

        // Generate custom analysis using Gemini
        const customPrompt = `${prompt}\n\nPatient Documentation:\n${text.substring(
          0,
          8000
        )}`;

        result = await chatWithAI(customPrompt, {
          patientName: file.patientName,
          patientId: file.patientId,
        });
      }

      // Return the results
      res.status(200).json({
        success: true,
        fileId: file._id,
        fileName: file.originalname,
        type,
        result,
      });
    } catch (analysisError) {
      console.error(`Error generating ${type} analysis:`, analysisError);

      // Return a more detailed error response
      return res.status(500).json({
        success: false,
        message: `Error generating ${type} analysis`,
        error: analysisError.message,
        fileId: file._id,
        fileName: file.originalname,
        type,
        details: {
          step: analysisError.step || "unknown",
          originalError: analysisError.toString(),
        },
      });
    }
  } catch (error) {
    console.error("Error generating custom analysis:", error);
    res.status(500).json({
      success: false,
      message: "Error generating custom analysis",
      error: error.message,
    });
  }
};

/**
 * Chat with AI assistant for clinical insights
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const chatWithAI = async (req, res) => {
  try {
    const { message, patientId, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Build enhanced context
    let chatContext = {
      patientName: context?.patientName,
      recentDocuments: [],
    };

    // If patient ID is provided, get recent file data for context
    if (patientId) {
      try {
        const recentFiles = await File.find({
          userId: req.userId,
          patientId: patientId,
        })
          .sort({ createdAt: -1 })
          .limit(3);

        if (recentFiles.length > 0) {
          chatContext.recentDocuments = recentFiles.map(
            (file) => file.originalname
          );
        }
      } catch (error) {
        console.log(
          "Could not fetch patient files for context:",
          error.message
        );
      }
    }

    // Use the enhanced AI chat service
    const aiResponse = await aiChatService(message, chatContext);

    // Return the AI response
    res.status(200).json({
      success: true,
      response: aiResponse,
      context: {
        patientId,
        hasContext: !!context,
        documentsIncluded: chatContext.recentDocuments.length,
      },
    });
  } catch (error) {
    console.error("Error in AI chat:", error);
    res.status(500).json({
      success: false,
      message: "Error processing chat request",
      error: error.message,
    });
  }
};

/**
 * Test Gemini API connection and return status
 */
export const testGeminiConnection = async (req, res) => {
  try {
    const result = await testConnection();
    if (result.success) {
      res.json({
        success: true,
        message: "Gemini API connection successful",
        result,
      });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Gemini API error", result });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message, stack: error.stack });
  }
};
