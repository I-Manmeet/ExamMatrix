/* =========================================================
   ExamMatrix — HALL DUTY ROUTES  (/api/exams/:examId/hall)
   ---------------------------------------------------------
   PUT  /attendance  { hall, marks: [{ roll, status }] }   save present/absent (marking again updates)
   POST /incidents   { hall, roll?, type, description }    report an incident

   Only the invigilator on duty in that hall (ownsDuty).
   Mounted in server.js ABOVE /api/exams (that router is admin-only).
   The logic lives in controllers/hallDutyController.js.
========================================================= */

const express = require("express");
const { requireLogin } = require("../middleware/auth");
const { ownsDuty } = require("../middleware/ownsDuty");
const hallDuty = require("../controllers/hallDutyController");

const router = express.Router({ mergeParams: true });

// ownsDuty: must be an invigilator AND on duty in that hall of this exam (sets req.exam)
router.use(requireLogin, ownsDuty);

router.put("/attendance", hallDuty.saveAttendance);
router.post("/incidents", hallDuty.reportIncident);

module.exports = router;