const { AppError } = require("../middleware/errorHandler");
const { cleanExamId, readSwap } = require("../utils/dutyRequest");
const { autoAssign } = require("../utils/autoAssign");
const { buildBoard, checkSwap } = require("../utils/dutyBoard");
const { toPlainDuties, toDutyDocs } = require("../utils/dutyMapper");
const { activity } = require("../utils/events");
const Exam = require("../models/Exam");
const Invigilator = require("../models/Invigilator");
const Duty = require("../models/Duty");
const Attendance = require("../models/Attendance");

// the exam, only if it belongs to this university
async function loadExam(req) {
  const examId = cleanExamId(req.params.examId);
  const exam = await Exam.findOne({ university: req.user.university, examId }).lean();
  if (!exam) throw new AppError(404, "Exam not found");
  return exam;
}

// every invigilator + every duty of this university (other exams count for the "busy" rule)
async function loadPeople(university) {
  const [invigilators, dutyDocs] = await Promise.all([
    Invigilator.find({ university }).select("invId name department subjects unavailable").sort({ invId: 1 }).lean(),
    Duty.find({ university }).populate("invigilator", "invId").populate("exam", "examId").lean()
  ]);
  return { invigilators, duties: toPlainDuties(dutyDocs) };
}

async function board(exam, university, options) {
  const { invigilators, duties } = await loadPeople(university);
  return buildBoard(exam, invigilators, duties, options);
}

// after attendance starts, changing who was in the hall would make the report wrong
async function refuseIfStarted(exam) {
  if (await Attendance.exists({ exam: exam._id })) {
    throw new AppError(409, "Attendance has already been marked for this exam, so its duties are locked");
  }
}

// GET /api/exams/:examId/duties → duty board for the Assign page
async function getBoard(req, res) {
  const exam = await loadExam(req);
  res.json({ data: await board(exam, req.user.university) });
}

// POST /api/exams/:examId/duties/auto → auto-assign: replaces this exam's duties
async function autoAssignDuties(req, res) {
  const university = req.user.university;
  const exam = await loadExam(req);
  await refuseIfStarted(exam);

  const { invigilators, duties } = await loadPeople(university);
  if (invigilators.length === 0) throw new AppError(409, "Upload invigilators first");

  const result = autoAssign(exam, invigilators, duties);
  if (result.stats.positions === 0) throw new AppError(409, "This exam has no seated students");

  const docs = toDutyDocs(result.duties, { university, invigilators, exams: [exam] });

  // swap old for new; if saving fails, put the old ones back
  const old = await Duty.find({ university, exam: exam._id }).lean();
  await Duty.deleteMany({ university, exam: exam._id });
  try {
    if (docs.length) await Duty.insertMany(docs);
  } catch (err) {
    await Duty.deleteMany({ university, exam: exam._id });
    if (old.length) await Duty.insertMany(old).catch(() => {});
    if (err.code === 11000) throw new AppError(409, "Duties changed while auto-assign was running. Please try again");
    throw err;
  }

  activity.emit("duties:assigned", {
    examId: exam.examId, by: req.user.id, filled: result.stats.filled, unfilled: result.stats.unfilled
  });

  res.json({ data: await board(exam, university, { unfilled: result.unfilled }) });
}

// PUT /api/exams/:examId/duties  { hall, position, invId | null } → swap one position
async function swap(req, res) {
  const university = req.user.university;
  const change = readSwap(req.body);            // checked before anything is loaded
  const exam = await loadExam(req);
  await refuseIfStarted(exam);

  const { invigilators, duties } = await loadPeople(university);
  const check = checkSwap(exam, invigilators, duties, change);
  if (!check.ok) throw new AppError(check.status, check.reason);

  // empty the seat, then put the new person in (if any); restore on failure
  const seat = { university, exam: exam._id, hall: change.hall, position: change.position };
  const old = await Duty.findOne(seat).lean();
  await Duty.deleteOne(seat);
  if (check.duty) {
    try {
      await Duty.insertMany(toDutyDocs([check.duty], { university, invigilators, exams: [exam] }));
    } catch (err) {
      if (old) await Duty.insertMany([old]).catch(() => {});
      if (err.code === 11000) throw new AppError(409, "That changed while you were editing. Reload and try again");
      throw err;
    }
  }

  activity.emit("duty:changed", {
    examId: exam.examId, hall: change.hall, position: change.position, invId: change.invId, by: req.user.id
  });

  res.json({ data: await board(exam, university) });
}

// DELETE /api/exams/:examId/duties → clear every duty of this exam
async function clearAll(req, res) {
  const university = req.user.university;
  const exam = await loadExam(req);
  await refuseIfStarted(exam);

  await Duty.deleteMany({ university, exam: exam._id });

  activity.emit("duties:cleared", { examId: exam.examId, by: req.user.id });

  res.json({ data: await board(exam, university) });
}

module.exports = { getBoard, autoAssignDuties, swap, clearAll };