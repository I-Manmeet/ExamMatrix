/* =========================================================
   ExamMatrix — REPORT ROUTE  (/api/reports)
   ---------------------------------------------------------
   GET /api/reports/:examId   admin   attendance per hall, absent students, incidents
   Only inside the logged-in admin's university. The counting is done by
   buildReport() in utils/report.js (pure, tested); this route only loads data.
   ========================================================= */

const express = require("express");
const Exam = require("../models/Exam");
const Duty = require("../models/Duty");
const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { cleanExamId } = require("../utils/dutyRequest");
const { toPlainDuties } = require("../utils/dutyMapper");
const { buildReport } = require("../utils/report");

const router = express.Router();
router.use(requireLogin, requireRole("admin"));

// GET /api/reports/EXM-0001-0001
router.get("/:examId", async (req, res) => {
  const university = req.user.university;
  const examId = cleanExamId(req.params.examId);   // bad format → 404, same as a missing exam

  const exam = await Exam.findOne({ university, examId }).select("examId examName date slot seatMap").lean();
  if (!exam) throw new AppError(404, "Exam not found");

  const [dutyDocs, attendance, incidentDocs] = await Promise.all([
    Duty.find({ university, exam: exam._id }).populate("invigilator", "invId name").populate("exam", "examId").lean(),
    Attendance.find({ university, exam: exam._id }).select("hall roll status").lean(),
    Incident.find({ university, exam: exam._id }).populate("reportedBy", "invId name").lean()
  ]);

  // names for everyone on duty or who reported something
  const people = new Map();
  dutyDocs.forEach((d) => { if (d.invigilator) people.set(d.invigilator.invId, d.invigilator.name); });
  incidentDocs.forEach((i) => { if (i.reportedBy) people.set(i.reportedBy.invId, i.reportedBy.name); });

  const incidents = incidentDocs.map((i) => ({
    id: i._id,
    hall: i.hall,
    roll: i.roll,
    type: i.type,
    description: i.description,
    reportedBy: i.reportedBy ? i.reportedBy.invId : "Removed invigilator",   // person deleted later
    createdAt: i.createdAt
  }));

  res.json({
    data: buildReport(exam, {
      duties: toPlainDuties(dutyDocs),   // skips duties of deleted invigilators
      attendance,
      incidents,
      invigilators: [...people].map(([invId, name]) => ({ invId, name }))
    })
  });
});

module.exports = router;