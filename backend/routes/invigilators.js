/* =========================================================
   ExamMatrix — INVIGILATOR ROUTES  (/api/invigilators)
   ---------------------------------------------------------
   GET  /api/invigilators                         admin        list (search with ?q=)
   GET  /api/invigilators/me/duties               invigilator  my duties, soonest first
   GET  /api/invigilators/me/duties/:dutyId       invigilator  one duty: hall seats, marks, incidents
   GET  /api/invigilators/:invId                  admin        one invigilator
   POST /api/invigilators/:invId/reset-password   admin        new temporary password, shown ONCE

   Always inside the logged-in user's university.
   The logic lives in controllers/invigilatorController.js.
========================================================= */

const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const invigilators = require("../controllers/invigilatorController");

const router = express.Router();
const adminOnly = requireRole("admin");
const invigilatorOnly = requireRole("invigilator");

router.use(requireLogin);

router.get("/", adminOnly, invigilators.list);

// the "me" routes MUST stay above /:invId, or "me" is read as an INV ID
router.get("/me/duties", invigilatorOnly, invigilators.myDuties);
router.get("/me/duties/:dutyId", invigilatorOnly, invigilators.myDuty);

router.get("/:invId", adminOnly, invigilators.getOne);
router.post("/:invId/reset-password", adminOnly, invigilators.resetPassword);

module.exports = router;