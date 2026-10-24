const express = require("express");
const Exam = require("../models/Exam");
const Duty = require("../models/Duty");
const Hall = require("../models/Hall");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { activity } = require("../utils/events");
const { nextId } = require("../utils/idCounter");
const { validateExam, slotsOverlap } = require("../utils/validateExam");
const { solveSeating, freeSeats, seatKey } = require("../utils/seating");

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

// seats in these halls already taken by exams on the same day whose time overlaps
async function reservedSeats(university, date, slot, hallNos) {
  const others = await Exam.find({ university: university, date: date, halls: { $in: hallNos } })
    .select("slot seatMap")
    .lean();

  const reserved = {};
  for (const other of others) {
    if (!slotsOverlap(other.slot, slot)) continue;
    for (const hallNo of hallNos) {
      const grid = (other.seatMap || {})[hallNo];
      if (!grid) continue;
      reserved[hallNo] = reserved[hallNo] || {};
      grid.forEach(function (row, r) {
        (row || []).forEach(function (cell, c) {
          if (cell) reserved[hallNo][seatKey(r, c)] = cell.code;
        });
      });
    }
  }
  return reserved;
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

// POST /api/exams  { examName, date, slot, subjects: ["CS301"], halls: ["Hall A"] }
// → seats everyone, saves the exam, returns it with the seat map
router.post("/", async (req, res) => {
  const university = req.user.university;

  const { errors, value } = validateExam(req.body);
  if (errors.length) throw new AppError(400, errors.join(". "));

  // 1. subjects and halls must exist in THIS university
  const [subjectDocs, hallDocs] = await Promise.all([
    Subject.find({ university: university, code: { $in: value.subjects } }).select("code").lean(),
    Hall.find({ university: university, hallNo: { $in: value.halls } }).select("hallNo rows cols").lean()
  ]);

  const missingSubjects = value.subjects.filter(function (code) {
    return !subjectDocs.some(function (s) { return s.code === code; });
  });
  if (missingSubjects.length) throw new AppError(400, "Unknown subject: " + missingSubjects.join(", "));

  const missingHalls = value.halls.filter(function (no) {
    return !hallDocs.some(function (h) { return h.hallNo === no; });
  });
  if (missingHalls.length) throw new AppError(400, "Unknown hall: " + missingHalls.join(", "));

  const halls = value.halls.map(function (no) {   // keep the order the admin picked
    return hallDocs.find(function (h) { return h.hallNo === no; });
  });

  // 2. students who take a picked subject; each sits once, for the first picked subject they take
  //    (Task 6 will refuse students who have two picked subjects in the same slot)
  const studentDocs = await Student.find({ university: university, subjects: { $in: value.subjects } })
    .select("roll subjects")
    .lean();
  const students = studentDocs.map(function (s) {
    return { roll: s.roll, code: value.subjects.find(function (code) { return s.subjects.includes(code); }) };
  });
  if (students.length === 0) throw new AppError(422, "No students take the picked subjects");

  // 3. enough free seats once other exams at this time are taken out?
  const reserved = await reservedSeats(university, value.date, value.slot, value.halls);
  const free = freeSeats(halls, reserved);
  if (free < students.length) {
    throw new AppError(422, "Not enough seats: " + students.length + " students but only " + free +
      " free seats in the picked halls at this time. Add more halls.");
  }

  // 4. seat everyone with no same subject in front/back/left/right
  const result = solveSeating(halls, students, reserved);
  if (result.unplaced.length) {
    throw new AppError(422, result.unplaced.length + " student(s) can't be seated without sitting next to " +
      "someone with the same subject. Add more halls.");
  }

  // 5. save (the EXM id is only taken once seating worked)
  const examId = await nextId("EXM-" + university.replace("UNI-", ""), 4);
  const exam = await Exam.create({
    examId: examId,
    university: university,
    examName: value.examName,
    date: value.date,
    slot: value.slot,
    subjects: value.subjects,
    halls: Object.keys(result.seatMap),
    studentCount: students.length,
    seatMap: result.seatMap,
    stats: {
      hallsUsed: result.stats.hallsUsed,
      utilization: result.stats.utilization,
      conflicts: result.stats.conflicts
    }
  });

  activity.emit("exam:created", { examId: examId, students: students.length, halls: exam.halls, by: req.user.id });
  res.status(201).json({ data: exam });
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