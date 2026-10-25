/* =========================================================
   ExamMatrix — EXAM ROUTES  (/api/exams)
   ---------------------------------------------------------
   GET    /api/exams             admin   this university's exams, soonest first
   GET    /api/exams/options     admin   ?date=&slot= → what Create Exam can pick
   GET    /api/exams/:examId     admin   one exam with its seat map
   POST   /api/exams/check       admin   every check, nothing saved
   POST   /api/exams             admin   check, seat everyone, save
   DELETE /api/exams/:examId     admin   remove the exam and its duties

   Only inside the logged-in admin's university.
   The logic lives in controllers/examController.js.
========================================================= */

const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const exams = require("../controllers/examController");

const router = express.Router();

// every exam route: logged-in university admin, only their own exams
router.use(requireLogin, requireRole("admin"));

router.get("/", exams.list);
router.get("/options", exams.options);   // must stay ABOVE /:examId, or "options" is read as an exam ID
router.get("/:examId", exams.getOne);
router.post("/check", exams.check);
router.post("/", exams.create);
router.delete("/:examId", exams.remove);

module.exports = router;