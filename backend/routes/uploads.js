/* =========================================================
   ExamMatrix — UPLOADS  (/api/uploads)
   ---------------------------------------------------------
   GET  /api/uploads/:type/template   public  CSV with the right headers
   GET  /api/uploads/status           admin   saved count per dataset
   GET  /api/uploads/:type/export     admin   saved records as CSV
   POST /api/uploads/all/preview      admin   up to 4 files (fields halls, subjects,
                                              students, invigilators) → rows per file
   POST /api/uploads/all/confirm      admin   same files → saved in order, error rows skipped
   POST /api/uploads/:type/preview    admin   one file (field "file")
   POST /api/uploads/:type/confirm    admin   one file (field "file")

   Every file is checked before anything is saved.
   New invigilators get an INV id + a temporary password, returned ONCE.
   The logic lives in controllers/uploadController.js.
========================================================= */

const express = require("express");
const upload = require("../middleware/upload");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const uploads = require("../controllers/uploadController");

const router = express.Router();

// multer errors (too big, wrong type, wrong field) → a clear 400 instead of a 500
function multerError(err) {
  if (err.code === "LIMIT_FILE_SIZE") return new AppError(400, "File is too big (max 5 MB)");
  if (err.code === "LIMIT_UNEXPECTED_FILE") return new AppError(400, "Unexpected file. Send at most one file each for halls, subjects, students and invigilators");
  if (err.code === "LIMIT_FILE_COUNT") return new AppError(400, "Too many files");
  return new AppError(400, err.message);
}

function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => next(err ? multerError(err) : undefined));
}

function receiveAll(req, res, next) {
  upload.fields(uploads.ORDER.map((name) => ({ name, maxCount: 1 })))(req, res, (err) => next(err ? multerError(err) : undefined));
}

// only column names, so it's public and a plain download link works
router.get("/:type/template", uploads.template);

// everything below needs an admin login
router.use(requireLogin, requireRole("admin"));

router.get("/status", uploads.status);
router.get("/:type/export", uploads.exportSaved);

// these two must stay ABOVE the /:type routes, or "all" is read as a type
router.post("/all/preview", receiveAll, uploads.previewAll);
router.post("/all/confirm", receiveAll, uploads.confirmAll);

router.post("/:type/preview", receiveFile, uploads.previewOne);
router.post("/:type/confirm", receiveFile, uploads.confirmOne);

module.exports = router;