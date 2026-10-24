const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const { parseFile } = require("../utils/fileParser");
const { validateRows } = require("../utils/validators");

const Student = require("../models/Student");
const Subject = require("../models/Subject");
const Hall = require("../models/Hall");

const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

// Temporary previews: no separate MongoDB model needed.
const previews = new Map();

const MODEL_MAP = {
  students: Student,
  subjects: Subject,
  halls: Hall
};

// STEP 1: Preview uploaded file
router.post("/preview", upload.single("file"), async (req, res) => {
  let tempPath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file to upload."
      });
    }

    const { university, type } = req.body;

    if (!university || !university.trim()) {
      return res.status(400).json({
        success: false,
        message: "University ID is required."
      });
    }

    if (!MODEL_MAP[type]) {
      return res.status(400).json({
        success: false,
        message: "Invalid dataset type. Choose students, subjects or halls."
      });
    }

    // fileParser expects a file path, so create a temporary file.
    tempPath = path.join(
      os.tmpdir(),
      `${crypto.randomUUID()}${path.extname(req.file.originalname)}`
    );

    await fs.writeFile(tempPath, req.file.buffer);

    const rows = await parseFile(
      req.file.buffer,
      req.file.originalname
    );

    // Expected validator signature: validateRows(rows, type)
    const validation = validateRows(type, rows);

    const validRows =
      validation.validRows ||
      validation.valid ||
      validation.rows ||
      [];

    const errors =
      validation.errors ||
      validation.invalidRows ||
      [];

    const token = crypto.randomUUID();

    previews.set(token, {
      university: university.trim(),
      type,
      validRows,
      errors,
      createdAt: Date.now()
    });

    return res.json({
      success: true,
      message: "Preview generated successfully.",
      previewToken: token,
      rows: validRows,
      errors
    });
  } catch (error) {
    console.error("Upload preview error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Could not preview the uploaded file."
    });
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
});

// STEP 2: Confirm and save records
router.post("/confirm", async (req, res) => {
  try {
    const { previewToken, university, type } = req.body;
    const preview = previews.get(previewToken);

    if (!preview) {
      return res.status(400).json({
        success: false,
        message: "Preview expired or invalid. Upload the file again."
      });
    }

    // Expire previews after 15 minutes.
    if (Date.now() - preview.createdAt > 15 * 60 * 1000) {
      previews.delete(previewToken);

      return res.status(410).json({
        success: false,
        message: "Preview expired. Please upload the file again."
      });
    }

    if (
      preview.university !== String(university || "").trim() ||
      preview.type !== type
    ) {
      return res.status(400).json({
        success: false,
        message: "University or dataset type changed. Preview again."
      });
    }

    if (preview.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Fix validation errors before importing.",
        errors: preview.errors
      });
    }

    const Model = MODEL_MAP[type];

    if (!Model) {
      return res.status(400).json({
        success: false,
        message: "Unsupported dataset type."
      });
    }

    if (preview.validRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "There are no valid records to import."
      });
    }

    // IMPORTANT: Match this field to your actual schemas.
    const records = preview.validRows.map(row => ({
      ...row,
      university: preview.university
    }));

    const result = await Model.insertMany(records, {
      ordered: false
    });

    previews.delete(previewToken);

    return res.json({
      success: true,
      message: `${result.length} record(s) imported successfully.`,
      imported: result.length
    });
  } catch (error) {
    console.error("Upload confirm error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Could not save imported records."
    });
  }
});

// STEP 3: Download a CSV template
router.get("/template", (req, res) => {
  const templates = {
    students: "roll,name,subjects",
    subjects: "code,name,dept",
    halls: "hallNo,rows,cols"
  };

  const type = String(req.query.type || "students").toLowerCase();
  const template = templates[type];

  if (!template) {
    return res.status(400).json({
      success: false,
      message: "Invalid template type."
    });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${type}-template.csv"`
  );

  return res.send(template + "\n");
});

module.exports = router;