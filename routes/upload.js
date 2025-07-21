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

// File filter to only accept certain file types
const fileFilter = (req, file, cb) => {
  // Accept pdf, docx, doc, txt files
  if (
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimetype === "text/plain"
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files only."
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
