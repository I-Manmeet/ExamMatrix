/* =========================================================
   ExamMatrix — INVIGILATOR ROUTES  (/api/invigilators)
   ---------------------------------------------------------
   git status
git add backend/utils/myDuties.js
git commit -m "feat(invigilator): add my-duties builder for the invigilator dashboard"
git add backend/tests/myDuties.test.js
git commit -m "test(invigilator): cover my-duties shape, co-invigilators and edge cases"
   GET /api/invigilators/me/duties/:dutyId  invigilator  one duty: hall seats, marks, incidents
   Always inside the logged-in admin's university.
   ========================================================= */

   const Duty = require("../models/Duty");
const { toMyDuties } = require("../utils/myDuties");
const express = require("express");
const Invigilator = require("../models/Invigilator");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { listFilter, cleanInvId, toPublic, PUBLIC_FIELDS } = require("../utils/invigilatorList");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");

const router = express.Router();
const adminOnly = requireRole("admin");

router.use(requireLogin);

router.get("/", adminOnly, async (req, res) => {
  const filter = listFilter(req.user.university, req.query.q);
  const list = await Invigilator.find(filter).select(PUBLIC_FIELDS).sort({ invId: 1 }).lean();
  res.json({ data: list.map(toPublic) });
});

// the logged-in invigilator's own duties. MUST stay above /:invId, or "me" is read as an INV ID
router.get("/me/duties", requireRole("invigilator"), async (req, res) => {
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
});
router.get("/:invId", adminOnly, async (req, res) => {
  const invId = cleanInvId(req.params.invId);
  const person = await Invigilator.findOne({ university: req.user.university, invId })
    .select(PUBLIC_FIELDS)
    .lean();
  // another university's invigilator also gets 404, so nobody learns it exists
  if (!person) throw new AppError(404, "Invigilator " + invId + " not found");
  res.json({ data: toPublic(person) });
});

// one of my duties, with everything the Hall Duty page needs
router.get("/me/duties/:dutyId", requireRole("invigilator"), async (req, res) => {
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
});

module.exports = router;