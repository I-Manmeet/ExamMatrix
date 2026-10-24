/* =========================================================
   ExamMatrix — INVIGILATOR ROUTES  (/api/invigilators)
   ---------------------------------------------------------
   GET /api/invigilators           admin   list, search with ?q=
   GET /api/invigilators/:invId    admin   one invigilator
   Always inside the logged-in admin's university.
   ========================================================= */

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

// TODO(after-exam-model): put GET /me/duties ABOVE this route, otherwise "me" is read as an INV ID
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