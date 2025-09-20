import DataIntegration from '../models/DataIntegration.js';
import azureOpenAIService from '../../services/azureOpenAIService.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class DataIntegrationService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
  }

  // File Upload Methods
  async uploadFiles(patientId, userId, files, metadata) {
    try {
      let integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        integration = new DataIntegration({
          patientId,
          userId,
          files: [],
          analysisResults: [],
          aiInsights: {},
          settings: {},
          statistics: {}
        });
      }

      const uploadedFiles = [];
      
      for (const file of files) {
        const fileData = {
          originalName: file.originalname,
          fileName: `${uuidv4()}_${file.originalname}`,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          category: metadata.category || 'other',
          priority: metadata.priority || 'normal',
          description: metadata.description || '',
          tags: metadata.tags || [],
          status: 'uploaded'
        };
        
        await integration.addFile(fileData);
        uploadedFiles.push(fileData);
      }

      return {
        success: true,
        data: uploadedFiles
      };
    } catch (error) {
      console.error('Error uploading files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // AI Analysis Methods
  async analyzeData(patientId, userId, fileIds, analysisType = 'comprehensive', aiModel = 'gpt-4') {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: false,
          error: 'Integration record not found'
        };
      }

      const filesToAnalyze = integration.files.filter(file => 
        fileIds.includes(file._id.toString())
      );

      const analysisResults = [];

      for (const file of filesToAnalyze) {
        try {
          // Read file content
          const fileContent = await this.readFileContent(file);
          
          // Perform AI analysis
          const analysisResult = await this.performAIAnalysis(fileContent, file, aiModel);
          
          // Add analysis result
          const analysisData = {
            fileId: file._id,
            analysisType,
            aiModel,
            status: 'completed',
            confidence: analysisResult.confidence,
            summary: analysisResult.summary,
            insights: analysisResult.insights,
            recommendations: analysisResult.recommendations,
            alerts: analysisResult.alerts,
            extractedData: analysisResult.extractedData,
            metadata: analysisResult.metadata,
            completedAt: new Date()
          };

          await integration.addAnalysisResult(analysisData);
          analysisResults.push(analysisData);
          
          // Update file status
          await integration.updateFileStatus(file._id, 'analyzed');
          
        } catch (fileError) {
          console.error(`Error analyzing file ${file.originalName}:`, fileError);
          
          const errorAnalysis = {
            fileId: file._id,
            analysisType,
            aiModel,
            status: 'failed',
            confidence: 0,
            summary: 'Analysis failed',
            insights: [],
            recommendations: [],
            alerts: [`Analysis failed: ${fileError.message}`],
            extractedData: {},
            metadata: { error: fileError.message },
            completedAt: new Date()
          };

          await integration.addAnalysisResult(errorAnalysis);
          analysisResults.push(errorAnalysis);
        }
      }

      // Generate overall AI insights
      const overallInsights = await this.generateOverallInsights(integration);
      integration.aiInsights = overallInsights;
      await integration.save();

      return {
        success: true,
        data: analysisResults,
        insights: overallInsights
      };
    } catch (error) {
      console.error('Error analyzing data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Data Retrieval Methods
  async getIntegrationData(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: false,
          error: 'Integration data not found'
        };
      }

      return {
        success: true,
        data: integration
      };
    } catch (error) {
      console.error('Error getting integration data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getFiles(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: true,
          data: []
        };
      }

      return {
        success: true,
        data: integration.files
      };
    } catch (error) {
      console.error('Error getting files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAnalysisResults(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: true,
          data: []
        };
      }

      return {
        success: true,
        data: integration.analysisResults
      };
    } catch (error) {
      console.error('Error getting analysis results:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAIInsights(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: integration.aiInsights
      };
    } catch (error) {
      console.error('Error getting AI insights:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export Methods
  async exportData(patientId, userId, exportOptions) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return {
          success: false,
          error: 'No data found to export'
        };
      }

      const exportData = {
        patientId,
        userId,
        exportDate: new Date(),
        format: exportOptions.format,
        data: {}
      };

      if (exportOptions.includeFiles) {
        exportData.data.files = integration.files.filter(file => 
          exportOptions.categories.length === 0 || 
          exportOptions.categories.includes(file.category)
        );
      }

      if (exportOptions.includeAnalysis) {
        exportData.data.analysisResults = integration.analysisResults.filter(result => 
          exportOptions.categories.length === 0 || 
          exportOptions.categories.includes(result.category)
        );
      }

      if (exportOptions.includeInsights) {
        exportData.data.aiInsights = integration.aiInsights;
      }

      // Apply date range filter
      if (exportOptions.dateRange !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (exportOptions.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (startDate) {
          exportData.data.files = exportData.data.files?.filter(file => 
            new Date(file.uploadedAt) >= startDate
          );
          exportData.data.analysisResults = exportData.data.analysisResults?.filter(result => 
            new Date(result.processedAt) >= startDate
          );
        }
      }

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Settings Methods
  async getSettings(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        // Return default settings if no integration found
        const defaultSettings = {
          autoAnalysis: false,
          realTimeProcessing: false,
          dataRetention: 30,
          exportFormat: 'json',
          aiModel: 'gpt-5-chat',
          dataEncryption: false,
          auditLogging: false,
          accessLevel: 'restricted',
          processingPriority: 'normal',
          batchSize: 10,
          backgroundProcessing: false,
          notifyAnalysisComplete: false,
          notifyErrors: true,
          notifyExportComplete: false
        };
        
        return {
          success: true,
          settings: defaultSettings
        };
      }

      return {
        success: true,
        settings: integration.settings || {}
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateSettings(patientId, userId, settings) {
    try {
      let integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        integration = new DataIntegration({
          patientId,
          userId,
          settings: settings
        });
      } else {
        integration.settings = { ...integration.settings, ...settings };
      }

      await integration.save();

      return {
        success: true,
        settings: integration.settings
      };
    } catch (error) {
      console.error('Error updating settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper Methods
  async readFileContent(file) {
    try {
      const filePath = file.filePath; // filePath already contains the full path
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // For text-based files, read as UTF-8
      if (file.mimeType.startsWith('text/') || 
          file.mimeType === 'application/json' ||
          file.mimeType === 'application/csv') {
        const content = fs.readFileSync(filePath, 'utf8');
        return {
          content,
          mimeType: file.mimeType,
          fileName: file.originalName
        };
      } else {
        // For binary files (PDF, images, etc.), read as buffer and convert to base64
        const buffer = fs.readFileSync(filePath);
        const content = buffer.toString('base64');
        return {
          content,
          mimeType: file.mimeType,
          fileName: file.originalName,
          isBinary: true
        };
      }
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async performAIAnalysis(fileContent, file, aiModel) {
    try {
      let analysis;
      
      // Handle different file types
      if (fileContent.isBinary) {
        // For binary files, provide a basic analysis based on metadata
        analysis = {
          confidence: 0.7,
          summary: `Binary file analysis for ${file.originalName}`,
          insights: [
            `File type: ${file.mimeType}`,
            `File size: ${file.fileSize} bytes`,
            `Category: ${file.category}`,
            `Priority: ${file.priority}`,
            'This is a binary file that requires specialized processing'
          ],
          recommendations: [
            'Consider using specialized tools for PDF text extraction',
            'Review file metadata for additional insights',
            'Ensure proper file handling for this type'
          ],
          alerts: [
            'Binary file detected - limited text analysis available'
          ],
          extractedData: {
            fileName: file.originalName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            category: file.category,
            priority: file.priority
          }
        };
      } else {
        // For text files, use Azure OpenAI analysis
        try {
          const azureAnalysis = await this.azureOpenAI.analyzeDocument(file.filePath, file.mimeType, {
            analysisType: 'comprehensive',
            includeRecommendations: true,
            includeRiskAssessment: true,
            model: aiModel
          });
          
          // Truncate summary to fit database limits while preserving key information
          const fullSummary = azureAnalysis.summary || `Analysis of ${file.originalName}`;
          const truncatedSummary = fullSummary.length > 10000 
            ? fullSummary.substring(0, 9997) + '...' 
            : fullSummary;

          // Truncate arrays to fit database limits
          const truncateArray = (arr, maxLength) => {
            if (!Array.isArray(arr)) return [];
            return arr.map(item => 
              typeof item === 'string' && item.length > maxLength 
                ? item.substring(0, maxLength - 3) + '...' 
                : item
            );
          };

          analysis = {
            confidence: azureAnalysis.confidence || 0.8,
            summary: truncatedSummary,
            insights: truncateArray(azureAnalysis.keyFindings || azureAnalysis.insights || [
              `File type: ${file.mimeType}`,
              `Category: ${file.category}`,
              `Priority: ${file.priority}`
            ], 2000),
            recommendations: truncateArray(azureAnalysis.recommendations || [
              'Review the extracted data for accuracy',
              'Consider additional analysis if needed'
            ], 2000),
            alerts: truncateArray(azureAnalysis.riskFactors || azureAnalysis.alerts || [], 2000),
            extractedData: azureAnalysis.extractedData || {
              fileName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              category: file.category,
              priority: file.priority
            },
            metadata: {
              analysisType: 'azure_openai',
              model: aiModel,
              timestamp: new Date().toISOString(),
              processingTime: azureAnalysis.processingTime || 0
            }
          };
        } catch (azureError) {
          console.error('Azure OpenAI analysis failed, using basic analysis:', azureError);
          // Use basic analysis if Azure OpenAI fails
          analysis = {
            confidence: 0.6,
            summary: `Basic analysis of ${file.originalName}`,
            insights: [
              `File type: ${file.mimeType}`,
              `File size: ${file.fileSize} bytes`,
              `Category: ${file.category}`,
              `Priority: ${file.priority}`,
              'Analysis completed with basic processing'
            ],
            recommendations: [
              'Review the file content manually',
              'Consider re-uploading for full AI analysis',
              'Contact support if issues persist'
            ],
            alerts: [
              'Full AI analysis unavailable - using basic processing'
            ],
            extractedData: {
              fileName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              category: file.category,
              priority: file.priority
            },
            metadata: {
              analysisType: 'basic_fallback',
              reason: 'azure_openai_failed',
              timestamp: new Date().toISOString()
            }
          };
        }
      }
      
      return {
        confidence: analysis.confidence || 0.8,
        summary: analysis.summary || `Analysis of ${file.originalName}`,
        insights: analysis.insights || [
          `File type: ${file.mimeType}`,
          `Category: ${file.category}`,
          `Priority: ${file.priority}`
        ],
        recommendations: analysis.recommendations || [
          'Review the extracted data for accuracy',
          'Consider additional analysis if needed'
        ],
        alerts: analysis.alerts || [],
        extractedData: analysis.extractedData || {},
        metadata: {
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          category: file.category,
          priority: file.priority,
          aiModel: aiModel
        }
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        confidence: 0.1,
        summary: `Analysis failed for ${file.originalName}`,
        insights: [],
        recommendations: ['Manual review required'],
        alerts: [`Analysis error: ${error.message}`],
        extractedData: {},
        metadata: { error: error.message }
      };
    }
  }

  // Clean up old analysis results with errors
  async cleanupOldAnalysisResults(patientId, userId) {
    try {
      const integration = await DataIntegration.findOne({ patientId, userId });
      
      if (!integration) {
        return { success: true, message: 'No integration record found', removedCount: 0 };
      }

      // Count original results
      const originalCount = integration.analysisResults.length;

      // Filter out problematic results
      integration.analysisResults = integration.analysisResults.filter(result => {
        // Keep only completed results without error alerts
        if (result.status !== 'completed') {
          return false;
        }

        // Remove results with repetitive binary file alerts
        if (result.alerts && result.alerts.length > 0) {
          // Count binary file alerts
          const binaryFileAlerts = result.alerts.filter(alert => 
            alert.includes('Binary file detected - limited text analysis available')
          );
          
          // Remove if more than 1 binary file alert
          if (binaryFileAlerts.length > 1) {
            return false;
          }

          // Remove results with error messages
          const hasErrors = result.alerts.some(alert => 
            alert.includes('Analysis error') || 
            alert.includes('OpenAI API error')
          );
          
          if (hasErrors) {
            return false;
          }
        }

        return true;
      });

      const removedCount = originalCount - integration.analysisResults.length;
      
      if (removedCount > 0) {
        await integration.save();
        console.log(`🧹 [DataIntegration] Cleaned up ${removedCount} old analysis results for patient ${patientId}`);
      }
      
      return {
        success: true,
        message: `Cleaned up ${removedCount} old analysis results`,
        removedCount
      };
    } catch (error) {
      console.error('Error cleaning up old analysis results:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Deduplicate alerts to avoid repetitive messages
  deduplicateAlerts(alerts) {
    const uniqueAlerts = [];
    const seenAlerts = new Set();
    
    for (const alert of alerts) {
      // Skip if we've already seen this exact alert
      if (seenAlerts.has(alert)) {
        continue;
      }
      
      // Skip repetitive binary file alerts
      if (alert.includes('Binary file detected - limited text analysis available')) {
        // Only add one binary file alert
        if (!seenAlerts.has('Binary file detected - limited text analysis available')) {
          uniqueAlerts.push(alert);
          seenAlerts.add('Binary file detected - limited text analysis available');
        }
        continue;
      }
      
      // Add other unique alerts
      uniqueAlerts.push(alert);
      seenAlerts.add(alert);
    }
    
    return uniqueAlerts;
  }

  async generateOverallInsights(integration) {
    try {
      const completedAnalysis = integration.analysisResults.filter(r => r.status === 'completed');
      
      if (completedAnalysis.length === 0) {
        return {
          overallAssessment: 'No completed analysis available',
          trends: [],
          alerts: [],
          predictions: [],
          riskFactors: [],
          recommendations: [],
          lastUpdated: new Date()
        };
      }

      // Generate insights based on analysis results
      const insights = {
        overallAssessment: `Analysis completed for ${completedAnalysis.length} files with average confidence of ${integration.statistics.averageConfidence.toFixed(2)}`,
        trends: [
          `High confidence analysis: ${completedAnalysis.filter(r => r.confidence > 0.8).length} files`,
          `Medium confidence analysis: ${completedAnalysis.filter(r => r.confidence > 0.5 && r.confidence <= 0.8).length} files`,
          `Low confidence analysis: ${completedAnalysis.filter(r => r.confidence <= 0.5).length} files`
        ],
        alerts: this.deduplicateAlerts(completedAnalysis.flatMap(r => r.alerts || [])),
        predictions: [
          'Continue monitoring patient data trends',
          'Schedule regular analysis updates'
        ],
        riskFactors: this.deduplicateAlerts(completedAnalysis.flatMap(r => r.alerts || [])).filter(alert => 
          alert.toLowerCase().includes('risk') || alert.toLowerCase().includes('concern')
        ),
        recommendations: [
          'Review all analysis results for consistency',
          'Update patient care plan based on insights',
          'Schedule follow-up analysis as needed'
        ],
        lastUpdated: new Date()
      };

      return insights;
    } catch (error) {
      console.error('Error generating overall insights:', error);
      return {
        overallAssessment: 'Error generating insights',
        trends: [],
        alerts: [`Insight generation error: ${error.message}`],
        predictions: [],
        riskFactors: [],
        recommendations: [],
        lastUpdated: new Date()
      };
    }
  }
}

export default new DataIntegrationService();


