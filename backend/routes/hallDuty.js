/* =========================================================
   ExamMatrix — HALL DUTY ROUTES  (/api/exams/:examId/hall)
   ---------------------------------------------------------
   PUT  /attendance  { hall, marks: [{ roll, status }] }   save present/absent (marking again updates)
   POST /incidents   { hall, roll?, type, description }    report an incident
   Only the invigilator on duty in that hall (ownsDuty).
   Mounted in server.js ABOVE /api/exams (that router is admin-only).
   ========================================================= */

const express = require("express");
const { requireLogin } = require("../middleware/auth");
const { ownsDuty } = require("../middleware/ownsDuty");
const { checkAttendance, toAttendanceOps, checkIncident } = require("../utils/hallDutyInput");
const { activity } = require("../utils/events");
const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");

const router = express.Router({ mergeParams: true });

// ownsDuty: must be an invigilator AND on duty in that hall of this exam (sets req.exam)
router.use(requireLogin, ownsDuty);

router.put("/attendance", async (req, res) => {
  const { hall, marks } = checkAttendance(req.exam, req.body);   // one bad mark → nothing saved
  await Attendance.bulkWrite(toAttendanceOps(marks, {
    university: req.user.university, exam: req.exam._id, hall, markedBy: req.user.id
  }));
  res.json({ data: { hall, saved: marks.length } });
});

router.post("/incidents", async (req, res) => {
  const incident = checkIncident(req.exam, req.body);
  const doc = await Incident.create({
    ...incident, university: req.user.university, exam: req.exam._id, reportedBy: req.user.id
  });
  activity.emit("incident:reported", { examId: req.exam.examId, hall: incident.hall, type: incident.type, by: req.user.id });
  res.status(201).json({
    data: { id: String(doc._id), type: doc.type, roll: doc.roll, description: doc.description, time: doc.createdAt }
  });
});

module.exports = router;