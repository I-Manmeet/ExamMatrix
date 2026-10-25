/* =========================================================
   ExamMatrix — REPORT ROUTE  (/api/reports)
   ---------------------------------------------------------
   GET /api/reports/:examId   admin   attendance per hall, absent students, incidents

   Only inside the logged-in admin's university.
   The logic lives in controllers/reportController.js.
========================================================= */

const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const reports = require("../controllers/reportController");

const router = express.Router();

router.use(requireLogin, requireRole("admin"));

router.get("/:examId", reports.examReport);

module.exports = router;