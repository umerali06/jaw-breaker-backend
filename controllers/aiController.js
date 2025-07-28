import File from "../models/File.js";
import ChatSession from "../models/ChatSession.js";
import PatientDataService from "../services/patientDataService.js";
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

      // Check if analysis contains critical errors (complete failure)
      if (analysis.error && analysis.errorType === "QUOTA_EXCEEDED") {
        console.log("API quota exceeded, marking file as failed");
        file.processingStatus = "failed";
        file.processingError =
          "API quota exceeded. Please upgrade your Gemini API plan or try again tomorrow.";
        await file.save();

        return res.status(429).json({
          success: false,
          message:
            "API quota exceeded. Please upgrade your Gemini API plan or try again tomorrow.",
          errorType: "QUOTA_EXCEEDED",
          retryAfter: "24 hours",
        });
      }

      // For partial errors, continue processing but log warnings
      if (analysis.hasErrors) {
        console.log(
          "Analysis completed with some errors, but proceeding with available data"
        );
      }

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

      try {
        await file.save();
        console.log("File saved successfully with completed status");
      } catch (saveError) {
        console.error("Error saving file with completed status:", saveError);

        // If there's a validation error but we have analysis data,
        // still mark it as completed in the response
        if (saveError.name === "ValidationError") {
          console.log("Validation error occurred, but analysis was successful");
          file.processingError = saveError.message;

          // Try to save without the problematic fields
          try {
            if (saveError.message.includes("skilledNeedJustification")) {
              console.log("Fixing skilledNeedJustification field");
              if (typeof file.skilledNeedJustification === "object") {
                file.skilledNeedJustification = JSON.stringify(
                  file.skilledNeedJustification
                );
              }
            }
            await file.save();
            console.log(
              "File saved successfully after fixing validation issues"
            );
          } catch (secondSaveError) {
            console.error("Still couldn't save file:", secondSaveError);
          }
        }
      }
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

        const insightsPrompt = `Analyze the following patient documentation and provide clinical insights in JSON format. 

Each insight should have these fields:
- priority: (critical/high/medium/low)
- type: (risk/improvement/alert/recommendation/safety/medication/wound/nutrition)
- message: A clear description of the insight, can use markdown formatting for emphasis
- evidence: Supporting evidence from the document
- recommendation: (optional) Suggested action or intervention

Format the message field with proper markdown where appropriate (e.g., use **bold** for emphasis, lists with * for bullets, etc.)

Return ONLY a valid JSON array of insight objects without any explanation text or code blocks:

${text.substring(0, 8000)}`;

        const insightsResponse = await chatWithAI(
          insightsPrompt,
          patientContext
        );

        // Try to parse the response as JSON, fallback to creating insights from text
        try {
          // Clean up the response to handle common JSON formatting issues
          let cleanedResponse = insightsResponse.trim();

          // If response starts with markdown code block, extract just the JSON
          if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse
              .replace(/^```json\s*/, "")
              .replace(/\s*```$/, "");
          } else if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse
              .replace(/^```\s*/, "")
              .replace(/\s*```$/, "");
          }

          result = JSON.parse(cleanedResponse);

          // Ensure each insight has proper formatting
          result = result.map((insight) => ({
            ...insight,
            priority: insight.priority || "medium",
            type: insight.type || "general",
            message: insight.message || "No details provided",
            evidence: insight.evidence || null,
          }));
        } catch (parseError) {
          console.error("Error parsing insights JSON:", parseError);
          // If parsing fails, create a basic insight structure
          result = [
            {
              priority: "medium",
              type: "recommendation",
              message: insightsResponse.substring(0, 500),
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
    const { message, patientId, context, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log("Chat request received:", {
      message,
      patientId,
      sessionId,
      hasContext: !!context,
    });

    // Find or create chat session for conversation saving
    let chatSession = null;
    if (patientId) {
      try {
        // Try to find existing active session
        chatSession = await ChatSession.findActiveSession(
          patientId,
          req.userId
        );

        if (!chatSession) {
          // Create new session
          const patient = await PatientDataService.getPatient(
            patientId,
            req.userId
          );
          chatSession = await ChatSession.createSession({
            patientId,
            userId: req.userId,
            patientName: patient.name,
            documents: patient.documents || [],
            latestSummary: context?.latestSummary,
            documentContext: context?.documentContext || {},
          });
        }
      } catch (error) {
        console.log("Could not create/find chat session:", error.message);
      }
    }

    // Build enhanced context with NLP-ready structure
    let chatContext = {
      patientName: context?.patientName,
      patientId: context?.patientId,
      medicalRecordNumber: context?.medicalRecordNumber,
      primaryDiagnosis: context?.primaryDiagnosis,
      recentDocuments: [],
      documentContent: [],
      latestSummary: context?.latestSummary || null,
      clinicalInsights: [],
      patientData: {},
      focusedDocument: context?.focusedDocument || null,
      recentVisits: context?.recentVisits || [],
      clinicalTimeline: context?.clinicalTimeline || [],
      hasDocuments: false,
      isManualEntry: !context?.documentContext && !context?.focusedDocument,
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

    // Save conversation to chat session
    if (chatSession) {
      try {
        // Add user message
        chatSession.addMessage({
          type: "user",
          content: message,
          contextInfo: {
            hasDocumentContent: chatContext.documentContent.length > 0,
            focusedDocument: chatContext.focusedDocument,
            insightsIncluded: chatContext.clinicalInsights.length,
            hasOasisScores: !!chatContext.patientData.oasisScores,
            hasSoapNote: !!chatContext.patientData.soapNote,
          },
        });

        // Add AI response
        chatSession.addMessage({
          type: "ai",
          content: aiResponse,
          contextInfo: {
            hasDocumentContent: chatContext.documentContent.length > 0,
            focusedDocument: chatContext.focusedDocument,
            insightsIncluded: chatContext.clinicalInsights.length,
            hasOasisScores: !!chatContext.patientData.oasisScores,
            hasSoapNote: !!chatContext.patientData.soapNote,
          },
        });

        // Update context with latest information
        chatSession.updateContext({
          latestSummary: chatContext.latestSummary,
          documentContext: context?.documentContext || {},
        });

        await chatSession.save();
        console.log("Conversation saved to chat session");
      } catch (error) {
        console.log("Could not save conversation:", error.message);
      }
    }

    // Return the AI response with context metadata
    res.status(200).json({
      success: true,
      response: aiResponse,
      sessionId: chatSession?.sessionId,
      context: {
        patientId,
        hasContext: !!context,
        documentsIncluded: chatContext.recentDocuments.length,
        insightsIncluded: chatContext.clinicalInsights.length,
        hasDocumentContent: chatContext.documentContent.length > 0,
        hasOasisScores: !!chatContext.patientData.oasisScores,
        hasSoapNote: !!chatContext.patientData.soapNote,
        isManualEntry: chatContext.isManualEntry,
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
 * Get conversation history for a patient
 */
export const getConversationHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 5 } = req.query;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    const conversations = await ChatSession.getConversationHistory(
      patientId,
      req.userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      conversations: conversations.map((session) => ({
        sessionId: session.sessionId,
        patientName: session.context.patientName,
        messageCount: session.messages.length,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        recentMessages: session.messages.slice(-3).map((msg) => ({
          type: msg.type,
          content:
            msg.content.substring(0, 100) +
            (msg.content.length > 100 ? "..." : ""),
          timestamp: msg.timestamp,
        })),
      })),
    });
  } catch (error) {
    console.error("Error getting conversation history:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving conversation history",
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
