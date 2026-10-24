/* =========================================================
   ExamMatrix — UPLOADS  (/api/uploads)
   ---------------------------------------------------------
   GET  /api/uploads/:type/template   public  CSV with the right headers
   GET  /api/uploads/status           admin   saved count per dataset
   POST /api/uploads/all/preview      admin   up to 4 files (fields halls, subjects,
                                              students, invigilators) → rows per file
   POST /api/uploads/all/confirm      admin   same files → saved in order, error rows skipped
   POST /api/uploads/:type/preview    admin   one file (field "file")
   POST /api/uploads/:type/confirm    admin   one file (field "file")
   Every file is checked before anything is saved.
   Subjects in the same batch count as known for students and invigilators.
   New invigilators get an INV id + a temporary password, returned ONCE.
   ========================================================= */

const express = require("express");
const upload = require("../middleware/upload");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { parseFile } = require("../utils/fileParser");
const { validateRows } = require("../utils/validators");
const { prepareInvigilators } = require("../utils/invigilatorImport");
const { activity } = require("../utils/events");
const Hall = require("../models/Hall");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const Invigilator = require("../models/Invigilator");

const router = express.Router();

// save order: subjects must be saved before students and invigilators
const ORDER = ["halls", "subjects", "students", "invigilators"];

const TYPES = {
  halls:        { label: "Halls",        Model: Hall,        key: "hallNo", headers: "hallNo,rows,cols" },
  subjects:     { label: "Subjects",     Model: Subject,     key: "code",   headers: "code,name,dept" },
  students:     { label: "Students",     Model: Student,     key: "roll",   headers: "roll,name,subjects", needsSubjects: true },
  invigilators: { label: "Invigilators", Model: Invigilator, key: "email",  headers: "name,email,department,subjects,unavailable", needsSubjects: true }
};

function getType(req) {
  const type = String(req.params.type || "").toLowerCase();
  if (!Object.hasOwn(TYPES, type)) {
    throw new AppError(400, "type must be halls, subjects, students or invigilators");
  }
  return type;
}

// only column names, so it's public and a plain download link works
router.get("/:type/template", (req, res) => {
  const type = getType(req);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="' + type + '-template.csv"');
  res.send(TYPES[type].headers + "\n");
});

// everything below needs an admin login
router.use(requireLogin, requireRole("admin"));

// how much of each dataset this university has saved (dashboard + upload page)
router.get("/status", async (req, res) => {
  const university = req.user.university;
  const [halls, subjects, students, invigilators] = await Promise.all([
    Hall.countDocuments({ university }),
    Subject.countDocuments({ university }),
    Student.countDocuments({ university }),
    Invigilator.countDocuments({ university })
  ]);
  res.json({ data: { halls, subjects, students, invigilators } });
});

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
  upload.fields(ORDER.map((name) => ({ name, maxCount: 1 })))(req, res, (err) => next(err ? multerError(err) : undefined));
}

// no matching column names at all (missing header row, or a file for another dataset)
function checkHeaders(type, rows) {
  const expected = TYPES[type].headers.split(",");
  const found = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!expected.some((field) => found.includes(field))) {
    throw new AppError(400, `The first line must be the column names: ${expected.join(",")}. Found: ${found.join(", ") || "nothing"}`);
  }
}

// parse + validate one file; nothing is saved here
async function checkFile(type, file, university, batchSubjects = []) {
  const { Model, key, needsSubjects } = TYPES[type];

  let knownSubjects = null;
  if (needsSubjects) {
    knownSubjects = new Set([...(await Subject.distinct("code", { university })), ...batchSubjects]);
    if (knownSubjects.size === 0) throw new AppError(409, "Upload subjects first, or add a subjects file");
  }

  const rows = await parseFile(file.buffer, file.originalname);
  checkHeaders(type, rows);

  const options = { existingKeys: new Set(await Model.distinct(key, { university })) };
  if (knownSubjects) options.knownSubjects = knownSubjects;
  return validateRows(type, rows, options);
}

async function saveInvigilators(rows, university, by) {
  const existing = await Invigilator.find({ university }).select("invId email").lean();
  const plan = await prepareInvigilators(rows, existing, university);

  try {
    if (plan.creates.length) await Invigilator.insertMany(plan.creates);
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, "Someone else uploaded invigilators at the same time. Please upload again");
    throw err;
  }
  if (plan.updates.length) {
    await Invigilator.bulkWrite(plan.updates.map((u) => ({
      updateOne: { filter: { university, invId: u.invId }, update: { $set: u.set } }
    })));
  }

  activity.emit("invigilators:uploaded", { university, added: plan.counts.added, updated: plan.counts.updated, by });
  // the only time the plain passwords leave the server
  return {
    added: plan.counts.added,
    updated: plan.counts.updated,
    skipped: plan.counts.skipped,
    credentials: plan.credentials
  };
}

// save the good rows of one checked file; update if it exists in this university, otherwise add
async function saveRows(type, result, university, by) {
  const valid = result.rows.filter((r) => r.status !== "error");
  if (valid.length === 0) return { added: 0, updated: 0, skipped: result.counts.error };
  if (type === "invigilators") return saveInvigilators(result.rows, university, by);

  const { Model, key } = TYPES[type];
  await Model.bulkWrite(valid.map((r) => ({
    updateOne: {
      filter: { university, [key]: r.data[key] },
      update: { $set: { ...r.data, university } },
      upsert: true
    }
  })));
  return { added: result.counts.new, updated: result.counts.update, skipped: result.counts.error };
}

/* ---------- all files at once (the upload page uses these) ---------- */

async function checkAll(req) {
  const university = req.user.university;
  const files = req.files || {};
  const chosen = ORDER.filter((type) => files[type] && files[type][0]);
  if (chosen.length === 0) throw new AppError(400, "Please choose at least one file");

  const results = {};
  for (const type of chosen) {
    // good subject codes from this same batch count as known
    const batchSubjects = results.subjects
      ? results.subjects.rows.filter((r) => r.status !== "error").map((r) => r.data.code)
      : [];
    try {
      results[type] = await checkFile(type, files[type][0], university, batchSubjects);
    } catch (err) {
      if (err.status) throw new AppError(err.status, TYPES[type].label + " file: " + err.message);
      throw err;
    }
  }
  return { university, chosen, results };
}

// these two must stay ABOVE the /:type routes, or "all" is read as a type
router.post("/all/preview", receiveAll, async (req, res) => {
  const { results } = await checkAll(req);
  const files = {};
  Object.keys(results).forEach((type) => {
    files[type] = { rows: results[type].rows, counts: results[type].counts };
  });
  res.json({ data: { files } });
});

router.post("/all/confirm", receiveAll, async (req, res) => {
  const { university, chosen, results } = await checkAll(req);
  const usable = chosen.filter((type) => results[type].counts.new + results[type].counts.update > 0);
  if (usable.length === 0) throw new AppError(400, "No valid rows to import");

  const saved = {};
  for (const type of chosen) {
    saved[type] = await saveRows(type, results[type], university, req.user.id);
  }
  res.json({ data: { saved } });
});

/* ---------- one file (kept for Postman and scripts) ---------- */

router.post("/:type/preview", receiveFile, async (req, res) => {
  const type = getType(req);
  if (!req.file) throw new AppError(400, "Please choose a file");
  const result = await checkFile(type, req.file, req.user.university);
  res.json({ data: { type, rows: result.rows, counts: result.counts } });
});

router.post("/:type/confirm", receiveFile, async (req, res) => {
  const type = getType(req);
  if (!req.file) throw new AppError(400, "Please choose a file");
  const result = await checkFile(type, req.file, req.user.university);
  if (result.counts.new + result.counts.update === 0) throw new AppError(400, "No valid rows to import");
  res.json({ data: { type, ...(await saveRows(type, result, req.user.university, req.user.id)) } });
});

module.exports = router;