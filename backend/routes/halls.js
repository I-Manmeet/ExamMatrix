const express = require("express");
const mongoose = require("mongoose");
const Hall = require("../models/Hall");
const { AppError } = require("../middleware/errorHandler");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireLogin, requireRole("admin"));
// TODO(after-jiya): delete uni() and add:
//   router.use(requireLogin, requireRole("admin"));
// then use req.user.university everywhere instead of uni(req)

// only these fields can be set from the request
const FIELDS = ["hallNo", "rows", "cols"];
function pick(body) {
  const out = {};
  FIELDS.forEach(function (f) { if (body && body[f] !== undefined) out[f] = body[f]; });
  return out;
}

// a bad id like "abc" should be a 404, not a crash
function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Hall not found");
}

router.get("/", async (req, res) => {
  const halls = await Hall.find({ university: req.user.university }).sort({ hallNo: 1 });
  res.json({ data: halls });
});

router.get("/:id", async (req, res) => {
  checkId(req.params.id);
  const hall = await Hall.findOne({ _id: req.params.id, university: req.user.university });
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
});

router.post("/", async (req, res) => {
  const hall = await Hall.create({ ...pick(req.body), university: req.user.university });
  res.status(201).json({ data: hall });
});

router.put("/:id", async (req, res) => {
  checkId(req.params.id);
  const hall = await Hall.findOneAndUpdate(
    { _id: req.params.id, university: req.user.university},
    { $set: pick(req.body) },
    { new: true, runValidators: true }
  );
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
});

router.delete("/:id", async (req, res) => {
  checkId(req.params.id);
  const hall = await Hall.findOneAndDelete({ _id: req.params.id, university: req.user.university });
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
});

module.exports = router;

