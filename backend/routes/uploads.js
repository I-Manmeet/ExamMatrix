/* =========================================================
   ExamMatrix — UPLOADS  (/api/uploads)
   ---------------------------------------------------------
   GET  /api/uploads/:type/template   public  CSV with the right headers
   POST /api/uploads/:type/preview    admin   file → rows with status, saves nothing
   POST /api/uploads/:type/confirm    admin   same file → saves valid rows, skips errors
   type = halls | subjects | students | invigilators
   Subjects must exist before students and invigilators.
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

const TYPES = {
  halls:        { Model: Hall,        key: "hallNo", headers: "hallNo,rows,cols" },
  subjects:     { Model: Subject,     key: "code",   headers: "code,name,dept" },
  students:     { Model: Student,     key: "roll",   headers: "roll,name,subjects", needsSubjects: true },
  invigilators: { Model: Invigilator, key: "email",  headers: "name,email,department,subjects,unavailable", needsSubjects: true }
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

// multer errors (too big, wrong file type) → a clear 400 instead of a 500
function receiveFile(req, res, next) {
  upload.single("file")(req, res, function (err) {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, "File is too big (max 5 MB)"));
    next(new AppError(400, err.message));
  });
}

// parse + validate; used by both preview and confirm
async function prepare(req) {
  const type = getType(req);
  const university = req.user.university;            // never from the form
  if (!req.file) throw new AppError(400, "Please choose a file");

  const { Model, key, needsSubjects } = TYPES[type];
  const subjectCodes = needsSubjects ? await Subject.distinct("code", { university }) : null;
  if (needsSubjects && subjectCodes.length === 0) throw new AppError(409, "Upload subjects first");

  const rows = await parseFile(req.file.buffer, req.file.originalname);
  const options = { existingKeys: new Set(await Model.distinct(key, { university })) };
  if (needsSubjects) options.knownSubjects = new Set(subjectCodes);

  return { type, university, result: validateRows(type, rows, options) };
}

router.post("/:type/preview", receiveFile, async (req, res) => {
  const { type, result } = await prepare(req);
  res.json({ data: { type, rows: result.rows, counts: result.counts } });
});

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
    type: "invigilators",
    added: plan.counts.added,
    updated: plan.counts.updated,
    skipped: plan.counts.skipped,
    credentials: plan.credentials
  };
}

router.post("/:type/confirm", receiveFile, async (req, res) => {
  const { type, university, result } = await prepare(req);
  const valid = result.rows.filter((r) => r.status !== "error");
  if (valid.length === 0) throw new AppError(400, "No valid rows to import");

  if (type === "invigilators") {
    return res.json({ data: await saveInvigilators(result.rows, university, req.user.id) });
  }

  // update if it already exists in this university, otherwise add
  const { Model, key } = TYPES[type];
  await Model.bulkWrite(valid.map((r) => ({
    updateOne: {
      filter: { university, [key]: r.data[key] },
      update: { $set: { ...r.data, university } },
      upsert: true
    }
  })));

  res.json({
    data: { type, added: result.counts.new, updated: result.counts.update, skipped: result.counts.error }
  });
});

module.exports = router;