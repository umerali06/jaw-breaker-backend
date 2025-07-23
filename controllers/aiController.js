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
      } else if (type === "summary") {
        // Generate summary for the document
        console.log("Generating summary for document:", file.originalname);

        // Extract text from file first
        const { extractTextFromFile, analyzeDocument } = await import(
          "../services/geminiService.js"
        );

        const text = await extractTextFromFile(file.path, file.mimetype);

        if (!text || text.trim().length === 0) {
          throw new Error(
            "No text could be extracted from the file. Please ensure the file contains readable text content."
          );
        }

        // Prepare patient context
        const patientContext = {
          name: file.patientName,
          id: file.patientId,
        };

        // Generate summary using AI chat
        const { chatWithAI } = await import("../services/geminiService.js");

        const summaryPrompt = `Please provide a comprehensive clinical summary of the following patient documentation. Focus on key findings, patient status, and important clinical information:\n\n${text.substring(
          0,
          8000
        )}`;

        result = await chatWithAI(summaryPrompt, patientContext);

        // Save the summary to the file
        file.aiSummary = result;
        await file.save();
      } else if (type === "insights") {
        // Generate clinical insights for the document
        console.log(
          "Generating clinical insights for document:",
          file.originalname
        );

        // Extract text from file first
        const { extractTextFromFile, analyzeDocument } = await import(
          "../services/geminiService.js"
        );

        const text = await extractTextFromFile(file.path, file.mimetype);

        if (!text || text.trim().length === 0) {
          throw new Error(
            "No text could be extracted from the file. Please ensure the file contains readable text content."
          );
        }

        // Prepare patient context
        const patientContext = {
          name: file.patientName,
          id: file.patientId,
        };

        // Generate clinical insights using AI
        const { chatWithAI } = await import("../services/geminiService.js");

        const insightsPrompt = `Analyze the following patient documentation and provide clinical insights in JSON format. Each insight should have: priority (critical/high/medium/low), type (risk/improvement/alert/recommendation/safety/medication/wound/nutrition), message, and evidence. Return as an array of insight objects:\n\n${text.substring(
          0,
          8000
        )}`;

        const insightsResponse = await chatWithAI(
          insightsPrompt,
          patientContext
        );

        // Try to parse the response as JSON, fallback to creating insights from text
        try {
          result = JSON.parse(insightsResponse);
        } catch (parseError) {
          // If parsing fails, create a basic insight structure
          result = [
            {
              priority: "medium",
              type: "recommendation",
              message: insightsResponse,
              evidence: "AI analysis of patient documentation",
            },
          ];
        }

        // Save the insights to the file
        file.clinicalInsights = result;
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
 * Chat with AI assistant for clinical insights with enhanced context awareness
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

    console.log("Chat request received:", {
      message,
      patientId,
      hasContext: !!context,
    });

    // Build enhanced context with NLP-ready structure
    let chatContext = {
      patientName: context?.patientName,
      recentDocuments: [],
      documentContent: [],
      latestSummary: context?.latestSummary || null,
      clinicalInsights: [],
      patientData: {},
      focusedDocument: context?.focusedDocument || null,
    };

    // Track if we're focusing on a specific document
    let specificFileRequested = false;

    // If patient ID is provided, get comprehensive patient data for context
    if (patientId) {
      try {
        // Get recent files with full content for context
        const recentFiles = await File.find({
          userId: req.userId,
          patientId: patientId,
        })
          .sort({ createdAt: -1 })
          .limit(3);

        if (recentFiles.length > 0) {
          console.log(`Found ${recentFiles.length} recent files for context`);

          // Add file names
          chatContext.recentDocuments = recentFiles.map(
            (file) => file.originalname
          );

          // Extract clinical insights from files
          const allInsights = [];
          recentFiles.forEach((file) => {
            if (file.clinicalInsights && file.clinicalInsights.length > 0) {
              allInsights.push(...file.clinicalInsights);
            }
          });

          if (allInsights.length > 0) {
            // Sort insights by priority (high to low)
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            allInsights.sort(
              (a, b) =>
                (priorityOrder[b.priority] || 0) -
                (priorityOrder[a.priority] || 0)
            );

            // Limit to most important insights
            chatContext.clinicalInsights = allInsights.slice(0, 5);
            console.log(
              `Added ${chatContext.clinicalInsights.length} clinical insights to context`
            );
          }

          // Check if we should focus on a specific document mentioned in the context
          let focusedFile = null;

          if (context?.focusedDocument) {
            console.log(
              "User is asking about a specific document:",
              context.focusedDocument
            );
            specificFileRequested = true;

            // Find the specific file the user is asking about
            focusedFile = recentFiles.find(
              (file) =>
                file.originalname === context.focusedDocument ||
                file._id.toString() === context.focusedDocument
            );

            if (focusedFile) {
              console.log(`Found focused file: ${focusedFile.originalname}`);
            } else {
              console.log(`Focused file not found: ${context.focusedDocument}`);
            }
          }

          // If we have a specific file to focus on, prioritize that one
          const filesToProcess =
            specificFileRequested && focusedFile
              ? [focusedFile]
              : // Otherwise use the most recent file
                [recentFiles[0]];

          // Extract content from the file(s)
          for (const file of filesToProcess) {
            if (file.path) {
              try {
                const { extractTextFromFile } = await import(
                  "../services/geminiService.js"
                );
                const fileContent = await extractTextFromFile(
                  file.path,
                  file.mimetype
                );

                // Add the content with more context if it's the focused file
                if (fileContent && fileContent.length > 0) {
                  // Use more content (up to 4000 chars) if it's the specific file requested
                  const contentLimit = specificFileRequested ? 4000 : 2000;

                  chatContext.documentContent.push({
                    filename: file.originalname,
                    fileId: file._id.toString(),
                    content:
                      fileContent.substring(0, contentLimit) +
                      (fileContent.length > contentLimit ? "..." : ""),
                    isFocused:
                      specificFileRequested &&
                      focusedFile &&
                      file._id.toString() === focusedFile._id.toString(),
                  });

                  console.log(
                    `Added document content to context from ${file.originalname}`
                  );
                }
              } catch (extractError) {
                console.log(
                  `Could not extract file content from ${file.originalname}:`,
                  extractError.message
                );
              }
            }
          }

          // Add OASIS scores if available
          const latestFileWithScores = recentFiles.find(
            (file) => file.oasisScores && file.oasisScores.size > 0
          );
          if (latestFileWithScores) {
            chatContext.patientData.oasisScores = Object.fromEntries(
              latestFileWithScores.oasisScores
            );
            console.log("Added OASIS scores to context");
          }

          // Add SOAP note if available
          const latestFileWithSoap = recentFiles.find((file) => file.soapNote);
          if (latestFileWithSoap && latestFileWithSoap.soapNote) {
            chatContext.patientData.soapNote = latestFileWithSoap.soapNote;
            console.log("Added SOAP note to context");
          }
        }
      } catch (error) {
        console.log(
          "Could not fetch patient files for context:",
          error.message
        );
      }
    }

    // Use the enhanced AI chat service with rich context
    console.log("Sending chat request to AI service with enhanced context");
    const aiResponse = await aiChatService(message, chatContext);

    // Return the AI response with context metadata
    res.status(200).json({
      success: true,
      response: aiResponse,
      context: {
        patientId,
        hasContext: !!context,
        documentsIncluded: chatContext.recentDocuments.length,
        insightsIncluded: chatContext.clinicalInsights.length,
        hasDocumentContent: chatContext.documentContent.length > 0,
        hasOasisScores: !!chatContext.patientData.oasisScores,
        hasSoapNote: !!chatContext.patientData.soapNote,
        focusedDocument:
          specificFileRequested && chatContext.documentContent.length > 0
            ? chatContext.documentContent.find((doc) => doc.isFocused)?.fileId
            : null,
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
