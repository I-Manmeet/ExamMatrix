const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Invigilator = require("../models/Invigilator");
const Duty = require("../models/Duty");
const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");
const { AppError } = require("../middleware/errorHandler");
const { makePassword } = require("../utils/invigilatorImport");
const { activity } = require("../utils/events");
const limiter = require("../utils/loginLimiter");
const { toMyDuties } = require("../utils/myDuties");
const { listFilter, cleanInvId, toPublic, PUBLIC_FIELDS } = require("../utils/invigilatorList");

// GET /api/invigilators?q=  (admin) → this university's invigilators, optional search
async function list(req, res) {
  const filter = listFilter(req.user.university, req.query.q);
  const people = await Invigilator.find(filter).select(PUBLIC_FIELDS).sort({ invId: 1 }).lean();
  res.json({ data: people.map(toPublic) });
}

// GET /api/invigilators/me/duties  (invigilator) → my duties, soonest first
async function myDuties(req, res) {
  const university = req.user.university;
  const duties = await Duty.find({ university, invigilator: req.user.id })
    .populate("exam", "examId examName subjects seatMap")
    .lean();

  // everyone on duty in those exams, so we can show who shares the hall
  const examIds = duties.filter((d) => d.exam).map((d) => d.exam._id);
  const hallmates = examIds.length
    ? await Duty.find({ university, exam: { $in: examIds } }).populate("invigilator", "name").lean()
    : [];

  res.json({ data: toMyDuties(duties, hallmates, req.user.id) });
}

// GET /api/invigilators/me/duties/:dutyId  (invigilator) → one duty: hall seats, marks, incidents
async function myDuty(req, res) {
  const university = req.user.university;

  // a badly written id can't be anyone's duty, so it's a 404 like a missing one
  if (!mongoose.isValidObjectId(req.params.dutyId)) throw new AppError(404, "Duty not found");

  // only MY duty: someone else's duty ID gets 404, so nobody learns it exists
  const duty = await Duty.findOne({ _id: req.params.dutyId, university, invigilator: req.user.id })
    .populate("exam", "examId examName date slot subjects seatMap")
    .lean();
  if (!duty || !duty.exam) throw new AppError(404, "Duty not found");

  const [marks, incidents] = await Promise.all([
    Attendance.find({ university, exam: duty.exam._id, hall: duty.hall }).select("roll status").lean(),
    Incident.find({ university, exam: duty.exam._id, hall: duty.hall }).sort({ createdAt: -1 })
      .select("type roll description createdAt").lean()
  ]);

  const seatMap = duty.exam.seatMap || {};
  res.json({
    data: {
      id: String(duty._id),
      exam: { examId: duty.exam.examId, examName: duty.exam.examName, date: duty.exam.date, slot: duty.exam.slot, subjects: duty.exam.subjects || [] },
      hall: duty.hall,
      position: duty.position,
      grid: Object.hasOwn(seatMap, duty.hall) ? seatMap[duty.hall] : [],   // [[{ roll, code } | null]]
      marks: Object.fromEntries(marks.map((m) => [m.roll, m.status])),     // { "24CS1001": "present" }
      incidents: incidents.map((i) => ({ id: String(i._id), type: i.type, roll: i.roll, description: i.description, time: i.createdAt }))
    }
  });
}

// GET /api/invigilators/:invId  (admin) → one invigilator
async function getOne(req, res) {
  const invId = cleanInvId(req.params.invId);
  const person = await Invigilator.findOne({ university: req.user.university, invId })
    .select(PUBLIC_FIELDS)
    .lean();

  // another university's invigilator also gets 404, so nobody learns it exists
  if (!person) throw new AppError(404, "Invigilator " + invId + " not found");
  res.json({ data: toPublic(person) });
}

// POST /api/invigilators/INV-0001-0007/reset-password  (admin) → a new temporary password, shown ONCE
// for when someone loses theirs: the old one stops working straight away
async function resetPassword(req, res) {
  const invId = cleanInvId(req.params.invId);
  const plain = makePassword();

  // only this university's invigilator; another university's ID is a 404, like a missing one
  const person = await Invigilator.findOneAndUpdate(
    { university: req.user.university, invId },
    // passwordChangedAt: anyone still logged in with the old password is logged out (middleware/auth.js)
    { $set: { password: await bcrypt.hash(plain, 10), passwordChangedAt: new Date() } },
    { returnDocument: "after" }
  ).select("invId name email").lean();

  if (!person) throw new AppError(404, "Invigilator " + invId + " not found");

  // wrong tries before the reset shouldn't keep them locked out
  limiter.clearFails(limiter.key("invigilator", invId));

  activity.emit("invigilator:password-reset", { university: req.user.university, invId, by: req.user.id });

  res.json({ data: { invId: person.invId, name: person.name, email: person.email, password: plain } });
}

module.exports = { list, myDuties, myDuty, getOne, resetPassword };