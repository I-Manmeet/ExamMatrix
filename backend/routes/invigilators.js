/* =========================================================
   ExamMatrix — INVIGILATOR ROUTES  (/api/invigilators)
   ---------------------------------------------------------
   git status
git add backend/utils/myDuties.js
git commit -m "feat(invigilator): add my-duties builder for the invigilator dashboard"
git add backend/tests/myDuties.test.js
git commit -m "test(invigilator): cover my-duties shape, co-invigilators and edge cases"
   Always inside the logged-in admin's university.
   ========================================================= */

   const Duty = require("../models/Duty");
const { toMyDuties } = require("../utils/myDuties");
const express = require("express");
const Invigilator = require("../models/Invigilator");
const { requireLogin, requireRole } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { listFilter, cleanInvId, toPublic, PUBLIC_FIELDS } = require("../utils/invigilatorList");

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

module.exports = router;