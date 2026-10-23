const mongoose = require("mongoose");

// One record per ID type, e.g. { _id: "UNI-2026", seq: 3 }
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },   // the prefix, e.g. "UNI-2026"
  seq: { type: Number, default: 0 },       // last number handed out
});

module.exports = mongoose.model("Counter", counterSchema);