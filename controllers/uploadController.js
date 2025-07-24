import File from "../models/File.js";
import fs from "fs";

// Controller for handling file uploads
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // Create a new file record in the database
    const newFile = new File({
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.userId, // From authentication middleware
      patientName: req.body.patientName || null,
      patientId: req.body.patientId || null,
    });

    await newFile.save();

    // Check if auto-analysis is requested
    const shouldAutoAnalyze =
      req.body.analyze === "true" || req.body.analyze === true;

    if (shouldAutoAnalyze) {
      // Start analysis asynchronously
      console.log(`Starting auto-analysis for file: ${newFile.originalname}`);

      // Update status to processing
      newFile.processingStatus = "processing";
      newFile.processingStarted = new Date();
      await newFile.save();

      // Start analysis in background without blocking the response
      setImmediate(async () => {
        try {
          // Import AI controller
          const aiController = await import("./aiController.js");

          // Create a mock request object for the analysis
          const analysisReq = {
            params: { fileId: newFile._id.toString() },
            userId: req.userId,
          };

          // Create a mock response object that properly handles the response
          const analysisRes = {
            status: (code) => ({
              json: async (data) => {
                console.log(
                  `Analysis completed for ${newFile.originalname}:`,
                  data.success ? "Success" : "Failed"
                );

                if (!data.success) {
                  console.error("Analysis error:", data.error);

                  // Update file status to failed
                  try {
                    const failedFile = await File.findById(newFile._id);
                    if (failedFile) {
                      failedFile.processingStatus = "failed";
                      failedFile.processingError =
                        data.error || "Auto-analysis failed";
                      failedFile.processingCompleted = new Date();
                      await failedFile.save();
                      console.log(
                        `File ${newFile.originalname} marked as failed`
                      );
                    }
                  } catch (updateError) {
                    console.error(
                      "Error updating failed file status:",
                      updateError
                    );
                  }
                } else {
                  console.log(
                    `File ${newFile.originalname} analysis completed successfully`
                  );
                }
              },
            }),
          };

          // Call the analysis function
          await aiController.analyzeFile(analysisReq, analysisRes);
        } catch (error) {
          console.error(`Auto-analysis failed for file ${newFile._id}:`, error);

          // Update file status to failed
          try {
            const failedFile = await File.findById(newFile._id);
            if (failedFile) {
              failedFile.processingStatus = "failed";
              failedFile.processingError =
                error.message || "Auto-analysis failed";
              failedFile.processingCompleted = new Date();
              await failedFile.save();
              console.log(
                `File ${newFile.originalname} marked as failed due to error`
              );
            }
          } catch (updateError) {
            console.error("Error updating failed file status:", updateError);
          }
        }
      });
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: {
        id: newFile._id,
        filename: newFile.filename,
        originalname: newFile.originalname,
        mimetype: newFile.mimetype,
        size: newFile.size,
        processingStatus: newFile.processingStatus,
        createdAt: newFile.createdAt,
      },
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error.message,
    });
  }
};

// Controller for getting all files
export const getAllFiles = async (req, res) => {
  try {
    const files = await File.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      count: files.length,
      files: files.map((file) => ({
        id: file._id,
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        processingStatus: file.processingStatus,
        processingStarted: file.processingStarted,
        processingCompleted: file.processingCompleted,
        processingError: file.processingError,
        patientName: file.patientName,
        patientId: file.patientId,
        // Include all AI analysis fields
        aiSummary: file.aiSummary,
        clinicalInsights: file.clinicalInsights,
        extractedEntities: file.extractedEntities,
        oasisScores: file.oasisScores
          ? Object.fromEntries(file.oasisScores)
          : {},
        soapNote: file.soapNote,
        careGoals: file.careGoals,
        interventions: file.interventions,
        riskFactors: file.riskFactors,
        providerCommunication: file.providerCommunication,
        skilledNeedJustification: file.skilledNeedJustification,
        createdAt: file.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching files",
      error: error.message,
    });
  }
};

// Controller for getting a specific file by ID
export const getFileById = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.userId });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    res.status(200).json({
      success: true,
      file: {
        id: file._id,
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        processingStatus: file.processingStatus,
        processingStarted: file.processingStarted,
        processingCompleted: file.processingCompleted,
        processingError: file.processingError,
        patientName: file.patientName,
        patientId: file.patientId,
        // Include all AI analysis fields
        aiSummary: file.aiSummary,
        clinicalInsights: file.clinicalInsights,
        extractedEntities: file.extractedEntities,
        oasisScores: file.oasisScores
          ? Object.fromEntries(file.oasisScores)
          : {},
        soapNote: file.soapNote,
        careGoals: file.careGoals,
        interventions: file.interventions,
        riskFactors: file.riskFactors,
        providerCommunication: file.providerCommunication,
        skilledNeedJustification: file.skilledNeedJustification,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching file",
      error: error.message,
    });
  }
};

// Controller for downloading a file
export const downloadFile = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.userId });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Check if file exists on disk
    const fs = await import("fs");
    if (!fs.existsSync(file.path)) {
      return res
        .status(404)
        .json({ success: false, message: "File not found on disk" });
    }

    // Set appropriate headers
    // For PDFs and images, allow inline viewing; for others, force download
    const inlineTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
    ];
    const disposition = inlineTypes.includes(file.mimetype)
      ? "inline"
      : "attachment";

    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${file.originalname}"`
    );
    res.setHeader("Content-Type", file.mimetype);

    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading file",
      error: error.message,
    });
  }
};

// Controller for updating file metadata
export const updateFile = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.userId });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Update patient information
    if (req.body.patientName !== undefined) {
      file.patientName = req.body.patientName;
    }
    if (req.body.patientId !== undefined) {
      file.patientId = req.body.patientId;
    }

    await file.save();

    res.status(200).json({
      success: true,
      message: "File updated successfully",
      file: {
        id: file._id,
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        processingStatus: file.processingStatus,
        patientName: file.patientName,
        patientId: file.patientId,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error("Error updating file:", error);
    res.status(500).json({
      success: false,
      message: "Error updating file",
      error: error.message,
    });
  }
};

// Controller for deleting a file
export const deleteFile = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.userId });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Delete the file from the filesystem
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Delete the file record from the database
    await File.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting file",
      error: error.message,
    });
  }
};
