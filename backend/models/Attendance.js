const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    university: { type: String, required: true, index: true },
    exam:       { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    hall:       { type: String, required: true },
    roll:       { type: String, required: true, uppercase: true, trim: true },
    status:     { type: String, enum: ["present", "absent"], required: true },
    markedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "Invigilator", required: true }
  },
  { timestamps: true }
);

// one record per student per exam (marking again updates it)
attendanceSchema.index({ exam: 1, roll: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);