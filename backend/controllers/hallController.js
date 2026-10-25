const mongoose = require("mongoose");
const Hall = require("../models/Hall");
const { AppError } = require("../middleware/errorHandler");

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

// GET /api/halls  → this university's halls, by hall number
async function list(req, res) {
  const halls = await Hall.find({ university: req.user.university }).sort({ hallNo: 1 });
  res.json({ data: halls });
}

// GET /api/halls/:id
async function getOne(req, res) {
  checkId(req.params.id);
  const hall = await Hall.findOne({ _id: req.params.id, university: req.user.university });
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
}

// POST /api/halls  { hallNo, rows, cols }
async function create(req, res) {
  const hall = await Hall.create({ ...pick(req.body), university: req.user.university });
  res.status(201).json({ data: hall });
}

// PUT /api/halls/:id  { hallNo?, rows?, cols? }
async function update(req, res) {
  checkId(req.params.id);
  const hall = await Hall.findOneAndUpdate(
    { _id: req.params.id, university: req.user.university },
    { $set: pick(req.body) },
    { returnDocument: "after", runValidators: true }
  );
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
}

// DELETE /api/halls/:id
async function remove(req, res) {
  checkId(req.params.id);
  const hall = await Hall.findOneAndDelete({ _id: req.params.id, university: req.user.university });
  if (!hall) throw new AppError(404, "Hall not found");
  res.json({ data: hall });
}

module.exports = { list, getOne, create, update, remove };