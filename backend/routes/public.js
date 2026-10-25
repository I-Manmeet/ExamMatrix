/* =========================================================
   ExamMatrix — PUBLIC ROUTES  (/api/public)
   ---------------------------------------------------------
   GET /api/public/seat?uni=UNI-0001&roll=24AI1001   no login   Student Seat Finder

   The logic lives in controllers/publicController.js.
========================================================= */

const express = require("express");
const publicPages = require("../controllers/publicController");

const router = express.Router();

router.get("/seat", publicPages.seat);

module.exports = router;