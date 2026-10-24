const express = require("express");
const Exam = require("../models/Exam");
const Duty = require("../models/Duty");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { activity } = require("../utils/events");

const router = express.Router();
const EXAM_ID = /^EXM-\d{4}-\d{4}$/;

// every exam route: logged-in university admin, only their own exams
router.use(requireLogin, requireRole("admin"));

// a bad id like "abc" is a 404, not a crash
function examIdFrom(req) {
  const id = String(req.params.examId || "").trim().toUpperCase();
  if (!EXAM_ID.test(id)) throw new AppError(404, "Exam not found");
  return id;
}


// GET /api/exams  → this university's exams, soonest first (without the big seat map)
router.get("/", async (req, res) => {
  const exams = await Exam.find({ university: req.user.university })
    .select("-seatMap")
    .sort({ date: 1, slot: 1, examId: 1 });
  res.json({ data: exams });
});


// GET /api/exams/EXM-0001-0001  → one exam with its seat map
router.get("/:examId", async (req, res) => {
  const exam = await Exam.findOne({ examId: examIdFrom(req), university: req.user.university });
  if (!exam) throw new AppError(404, "Exam not found");
  res.json({ data: exam });
});


// DELETE /api/exams/EXM-0001-0001  → frees its seats and removes its duties
router.delete("/:examId", async (req, res) => {
  const examId = examIdFrom(req);
  const exam = await Exam.findOneAndDelete({ examId: examId, university: req.user.university });
  if (!exam) throw new AppError(404, "Exam not found");

  // left behind, a duty would keep that invigilator "busy" in this slot forever
  const { deletedCount } = await Duty.deleteMany({ university: req.user.university, exam: exam._id });

  activity.emit("exam:deleted", { examId: examId, dutiesRemoved: deletedCount, by: req.user.id });
  res.json({ data: { examId: examId, dutiesRemoved: deletedCount } });
});

module.exports = router;