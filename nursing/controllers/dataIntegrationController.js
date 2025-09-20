import dataIntegrationService from '../services/dataIntegrationService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'data-integration');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, CSV, Excel, JSON, TXT, and image files are allowed.'), false);
    }
  }
});

class DataIntegrationController {
  // File Upload
  async uploadFiles(req, res) {
    try {
      console.log('Upload request received:', {
        body: req.body,
        files: req.files,
        user: req.user
      });

      const userId = String(req.user._id || req.user.id);
      const metadata = JSON.parse(req.body.metadata || '{}');
      
      // Get patientId from either req.body or metadata
      const patientId = req.body.patientId || metadata.patientId;

      console.log('Extracted data:', { userId, patientId, metadata });

      if (!patientId || patientId === 'undefined' || patientId === 'null') {
        console.log('Missing or invalid patientId:', patientId);
        return res.status(400).json({
          success: false,
          message: 'Valid Patient ID is required'
        });
      }

      if (!req.files || req.files.length === 0) {
        console.log('No files provided');
        return res.status(400).json({
          success: false,
          message: 'No files provided'
        });
      }

      console.log('Files received:', req.files.map(f => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      })));

      // Check for duplicate files in the uploads for the given patientId
      const uploadedFiles = await dataIntegrationService.getFiles(patientId, userId);
      const existingFiles = uploadedFiles.data.files || [];

      const newFiles = req.files.filter(file => {
        return !existingFiles.some(existingFile => existingFile.originalName === file.originalname);
      });

      if (newFiles.length === 0) {
        console.log('All files are duplicates, skipping upload...');
        return res.status(400).json({
          success: false,
          message: 'No new files to upload (files already exist)'
        });
      }

      console.log('New files to upload:', newFiles);

      const result = await dataIntegrationService.uploadFiles(
        patientId, 
        userId, 
        newFiles, 
        metadata
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Files uploaded successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in uploadFiles controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get Files
  async getFiles(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.getFiles(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getFiles controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // AI Analysis
  async analyzeData(req, res) {
    try {
      const { patientId } = req.body;
      const userId = String(req.user._id || req.user.id);
      const { fileIds, analysisType, aiModel } = req.body;

      const result = await dataIntegrationService.analyzeData(
        patientId, 
        userId, 
        fileIds, 
        analysisType, 
        aiModel
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Analysis completed successfully',
          data: result.data,
          insights: result.insights
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in analyzeData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get Analysis Results
  async getAnalysisResults(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.getAnalysisResults(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getAnalysisResults controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get AI Insights
  async getAIInsights(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.getAIInsights(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getAIInsights controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Export Data
  async exportData(req, res) {
    try {
      const { patientId } = req.body;
      const userId = String(req.user._id || req.user.id);
      const exportOptions = req.body;

      const result = await dataIntegrationService.exportData(
        patientId, 
        userId, 
        exportOptions
      );

      if (result.success) {
        // Set appropriate headers based on format
        const format = exportOptions.format || 'json';
        const filename = `patient-data-${patientId}-${new Date().toISOString().split('T')[0]}.${format}`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        switch (format) {
          case 'json':
            res.setHeader('Content-Type', 'application/json');
            res.json(result.data);
            break;
          case 'csv':
            res.setHeader('Content-Type', 'text/csv');
            res.send(this.convertToCSV(result.data));
            break;
          case 'xml':
            res.setHeader('Content-Type', 'application/xml');
            res.send(this.convertToXML(result.data));
            break;
          case 'pdf':
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result.data);
            break;
          case 'excel':
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(result.data);
            break;
          default:
            res.setHeader('Content-Type', 'application/json');
            res.json(result.data);
        }
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in exportData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get Settings
  async getSettings(req, res) {
    try {
      const { patientId } = req.query;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.getSettings(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          settings: result.settings
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getSettings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update Settings
  async updateSettings(req, res) {
    try {
      const { patientId, settings } = req.body;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.updateSettings(
        patientId, 
        userId, 
        settings
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Settings updated successfully',
          settings: result.settings
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in updateSettings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get Integration Data
  async getIntegrationData(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.getIntegrationData(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in getIntegrationData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Clean up old analysis results
  async cleanupOldAnalysisResults(req, res) {
    try {
      const { patientId } = req.params;
      const userId = String(req.user._id || req.user.id);

      const result = await dataIntegrationService.cleanupOldAnalysisResults(patientId, userId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          removedCount: result.removedCount
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error in cleanupOldAnalysisResults controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Helper Methods
  convertToCSV(data) {
    try {
      // Simple CSV conversion - in production, use a proper CSV library
      const csvRows = [];
      
      // Add headers
      csvRows.push('Type,Field,Value');
      
      // Add data
      if (data && data.data && data.data.files) {
        data.data.files.forEach(file => {
          csvRows.push(`File,Name,"${file.originalName || 'Unknown'}"`);
          csvRows.push(`File,Category,"${file.category || 'Unknown'}"`);
          csvRows.push(`File,Size,"${file.fileSize || 'Unknown'}"`);
          csvRows.push(`File,Status,"${file.status || 'Unknown'}"`);
        });
      }
      
      if (data && data.data && data.data.analysisResults) {
        data.data.analysisResults.forEach(result => {
          csvRows.push(`Analysis,Type,"${result.analysisType || 'Unknown'}"`);
          csvRows.push(`Analysis,Confidence,"${result.confidence || 'Unknown'}"`);
          csvRows.push(`Analysis,Status,"${result.status || 'Unknown'}"`);
        });
      }
      
      return csvRows.join('\n');
    } catch (error) {
      console.error('Error converting to CSV:', error);
      return 'Error,Error,Conversion failed';
    }
  }

  convertToXML(data) {
    try {
      // Simple XML conversion - in production, use a proper XML library
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<dataIntegration>\n';
      xml += `  <patientId>${data.patientId || 'Unknown'}</patientId>\n`;
      xml += `  <exportDate>${data.exportDate || new Date()}</exportDate>\n`;
      xml += `  <format>${data.format || 'Unknown'}</format>\n`;
      
      if (data && data.data && data.data.files) {
        xml += '  <files>\n';
        data.data.files.forEach(file => {
          xml += '    <file>\n';
          xml += `      <name>${file.originalName || 'Unknown'}</name>\n`;
          xml += `      <category>${file.category || 'Unknown'}</category>\n`;
          xml += `      <size>${file.fileSize || 'Unknown'}</size>\n`;
          xml += `      <status>${file.status || 'Unknown'}</status>\n`;
          xml += '    </file>\n';
        });
        xml += '  </files>\n';
      }
      
      xml += '</dataIntegration>';
      return xml;
    } catch (error) {
      console.error('Error converting to XML:', error);
      return '<?xml version="1.0" encoding="UTF-8"?>\n<error>Conversion failed</error>';
    }
  }
}

// Create multer middleware with error handling
const uploadMiddleware = (req, res, next) => {
  console.log('Multer middleware called with:', {
    body: req.body,
    files: req.files,
    headers: req.headers
  });
  
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    console.log('Multer success, files:', req.files);
    next();
  });
};

export default new DataIntegrationController();
export { uploadMiddleware };
