/* =========================================================
   ExamMatrix — DUTY ROUTES  (/api/exams/:examId/duties)
   ---------------------------------------------------------
   GET    /         duty board for the Assign page
   POST   /auto     auto-assign: replaces this exam's duties
   PUT    /         swap one position  { hall, position, invId | null }
   DELETE /         clear every duty of this exam

   Admin only, this university only.
   Once attendance is marked, the duties are locked.
   Mounted in server.js ABOVE /api/exams (that router is admin-only for everything).
   The logic lives in controllers/dutyController.js.
========================================================= */

const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const duties = require("../controllers/dutyController");

const router = express.Router({ mergeParams: true });   // lets us read :examId from the mount path

router.use(requireLogin, requireRole("admin"));

router.get("/", duties.getBoard);
router.post("/auto", duties.autoAssignDuties);
router.put("/", duties.swap);
router.delete("/", duties.clearAll);

module.exports = router;