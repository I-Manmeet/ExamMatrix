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
const { validateExam } = require("../utils/validateExam");
const { solveSeating, freeSeats } = require("../utils/seating");
const clash = require("../utils/clashCheck");

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


// Works out the whole exam without saving: input, clashes, seats.
// POST /api/exams saves the result; POST /api/exams/check only reports it.
async function planExam(university, body) {
  const { errors, value } = validateExam(body);
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

  // 2. students who take a picked subject
  const studentDocs = await Student.find({ university: university, subjects: { $in: value.subjects } })
    .select("roll subjects")
    .lean();
  if (studentDocs.length === 0) throw new AppError(422, "No students take the picked subjects");

  // exams on the same day whose time overlaps this one
  const sameDay = await Exam.find({ university: university, date: value.date })
    .select("examId examName slot seatMap")
    .lean();
  const overlapping = clash.overlappingExams(sameDay, value.slot);

  // ---- clash checks (Task 6) ----


  // a subject can only be examined once (deleting its exam frees it again)
  const alreadyIn = await Exam.find({ university: university, subjects: { $in: value.subjects } })
    .select("examId examName subjects")
    .lean();
  const scheduled = clash.scheduledSubjects(alreadyIn, value.subjects);
  if (scheduled.size) {
    throw new AppError(409, clash.listSome([...scheduled], function ([code, e]) {
      return code + " is already in " + e.examName + " (" + e.examId + ")";
    }) + ". A subject can only be examined once.");
  }


  // the same student can't sit two picked subjects at once
  const twice = clash.doubleBooked(studentDocs, value.subjects);
  if (twice.length) {
    throw new AppError(409, twice.length + " student(s) take more than one of the picked subjects, " +
      "so these subjects can't share a slot: " +
      clash.listSome(twice, function (s) { return s.roll + " (" + s.subjects.join(", ") + ")"; }));
  }


  // a student can't be in two exams whose times overlap
  const busy = clash.busyStudents(studentDocs.map(function (s) { return s.roll; }), overlapping);
  if (busy.length) {
    throw new AppError(409, busy.length + " student(s) already have an exam at this time: " +
      clash.listSome(busy, function (b) { return b.roll + " in " + b.examName + " (" + b.slot + ")"; }));
  }

  // each student sits once, for the picked subject they take
  const students = studentDocs.map(function (s) {
    return { roll: s.roll, code: value.subjects.find(function (code) { return s.subjects.includes(code); }) };
  });

  // 3. enough free seats once other exams at this time are taken out?
  const reserved = clash.bookedSeats(overlapping, value.halls);
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

  return { value: value, students: students, free: free, result: result };
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
// → checks everything, seats everyone, saves the exam, returns it with the seat map
router.post("/", async (req, res) => {
  const university = req.user.university;
  const { value, students, result } = await planExam(university, req.body);

  // the EXM id is only taken once every check has passed
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


// DELETE /api/exams/EXM-0001-0001  → frees its seats and subjects, removes its duties
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