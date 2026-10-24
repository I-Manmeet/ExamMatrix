
const multer = require("multer");
const path = require("path");

// Maximum upload size: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file extensions
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".json"];

// Store uploaded files temporarily in memory.
// This avoids creating temporary files that need cleanup.
const storage = multer.memoryStorage();

// Validate uploaded file type
const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return callback(
      new Error("Invalid file type. Upload CSV, Excel, or JSON files only.")
    );
  }

  callback(null, true);
};

// Configure Multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 4
  }
});

// Export middleware for use in upload routes
module.exports = upload;
