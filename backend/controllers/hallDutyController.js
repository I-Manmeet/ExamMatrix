const { checkAttendance, toAttendanceOps, checkIncident } = require("../utils/hallDutyInput");
const { activity } = require("../utils/events");
const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");

// req.exam is set by middleware/ownsDuty.js (invigilator on duty in that hall)

// PUT /api/exams/:examId/hall/attendance  { hall, marks: [{ roll, status }] }
// save present/absent (marking again updates)
async function saveAttendance(req, res) {
  const { hall, marks } = checkAttendance(req.exam, req.body);   // one bad mark → nothing saved
  await Attendance.bulkWrite(toAttendanceOps(marks, {
    university: req.user.university, exam: req.exam._id, hall, markedBy: req.user.id
  }));
  res.json({ data: { hall, saved: marks.length } });
}

// POST /api/exams/:examId/hall/incidents  { hall, roll?, type, description }
async function reportIncident(req, res) {
  const incident = checkIncident(req.exam, req.body);
  const doc = await Incident.create({
    ...incident, university: req.user.university, exam: req.exam._id, reportedBy: req.user.id
  });

  activity.emit("incident:reported", { examId: req.exam.examId, hall: incident.hall, type: incident.type, by: req.user.id });

  res.status(201).json({
    data: { id: String(doc._id), type: doc.type, roll: doc.roll, description: doc.description, time: doc.createdAt }
  });
}

module.exports = { saveAttendance, reportIncident };