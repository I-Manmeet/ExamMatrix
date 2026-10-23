const mongoose = require("mongoose");

const dutySchema = new mongoose.Schema(
  {
    university:  { type: String, required: true, index: true },
    invigilator: { type: mongoose.Schema.Types.ObjectId, ref: "Invigilator", required: true },
    exam:        { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    hall:        { type: String, required: true },
    position:    { type: Number, required: true, min: 1 },
    date:        { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },  // YYYY-MM-DD
    slot:        { type: String, required: true }                                 // 09:00-12:00
  },
  { timestamps: true }
);

// an invigilator can't be in two places in the same slot
dutySchema.index({ invigilator: 1, date: 1, slot: 1 }, { unique: true });

// each hall position in an exam has only one person
dutySchema.index({ exam: 1, hall: 1, position: 1 }, { unique: true });

module.exports = mongoose.model("Duty", dutySchema);