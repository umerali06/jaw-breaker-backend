import express from "express";
import multer from "multer";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import {
  uploadFile,
  getAllFiles,
  getFileById,
  downloadFile,
  updateFile,
  deleteFile,
} from "../controllers/uploadController.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, join(__dirname, "../uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// File filter to accept various document types
const fileFilter = (req, file, cb) => {
  // Get file extension
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  
  // Accept multiple document formats for comprehensive analysis
  const allowedMimeTypes = [
    // PDF files
    "application/pdf",
    
    // Word documents
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    
    // Text files
    "text/plain",
    "text/csv",
    
    // Excel files
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    
    // HTML files
    "text/html",
    
    // JSON files
    "application/json",
    
    // Generic binary type (for files that browsers can't properly detect)
    "application/octet-stream"
  ];
  
  // Define allowed file extensions for when MIME type detection fails
  const allowedExtensions = [
    'pdf', 'doc', 'docx', 'txt', 'csv', 'xls', 'xlsx', 'html', 'htm', 'json'
  ];
  
  // Check if file is allowed by MIME type or extension
  const isAllowedMimeType = allowedMimeTypes.includes(file.mimetype);
  const isAllowedExtension = allowedExtensions.includes(fileExtension);
  
  if (isAllowedMimeType || isAllowedExtension) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype} (.${fileExtension}). Please upload PDF, DOCX, DOC, TXT, CSV, XLSX, XLS, HTML, or JSON files only.`
      ),
      false
    );
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.post("/", upload.single("file"), uploadFile);
router.get("/", getAllFiles);
router.get("/:id", getFileById);
router.get("/download/:id", downloadFile);
router.get("/view/:id", downloadFile); // Uses same function but serves files inline for viewing
router.patch("/:id", updateFile);
router.delete("/:id", deleteFile);

export default router;
