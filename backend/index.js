const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs").promises;
const app = express();

// Create directories if they don't exist
const TEMP_DIR = path.join(__dirname, "temp");
const FINAL_DIR = path.join(__dirname, "uploads");

// CORS setup
app.use(
  cors({
    origin: "http://localhost:4200", // Allow requests from your frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Ensure OPTIONS is included
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
    credentials: true, // Optional: Allow credentials (cookies, authorization headers)
  })
);

// Handle preflight requests (OPTIONS)
app.options("*", cors()); // This will handle the preflight OPTIONS request


// Configure multer for temporary uploads
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: tempStorage });

// Helper function to convert full path to relative path
function getRelativePath(fullPath) {
  return path.relative(__dirname, fullPath);
}

// Helper function to convert relative path to full path
function getFullPath(relativePath) {
  return path.join(__dirname, relativePath);
}

// Temporary upload endpoint
app.post("/temp-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Convert full path to relative path before sending
    const relativePath = getRelativePath(req.file.path);

    res.json({
      success: true,
      tempPath: relativePath,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Final upload endpoint
app.post("/final-upload", express.json(), async (req, res) => {
  try {
    const { tempPaths } = req.body;

    if (!Array.isArray(tempPaths) || tempPaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of temporary file paths",
      });
    }

    const finalPaths = [];

    for (const relativeTempPath of tempPaths) {
      const fullTempPath = getFullPath(relativeTempPath);

      // Verify file exists
      const exists = await fs
        .access(fullTempPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        throw new Error(`Temporary file not found: ${relativeTempPath}`);
      }

      // Generate final path
      const filename = path.basename(fullTempPath);
      const fullFinalPath = path.join(FINAL_DIR, filename);

      // Move file from temp to final directory
      await fs.rename(fullTempPath, fullFinalPath);

      finalPaths.push(getRelativePath(fullFinalPath));
    }

    res.json({
      success: true,
      finalPaths,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
