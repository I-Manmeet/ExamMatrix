const mongoose = require("mongoose");

const INCIDENT_TYPES = [
  "Unfair means suspected",
  "Unauthorised material found",
  "Student unwell",
  "Seat dispute",
  "Late arrival",
  "Other"
];

const incidentSchema = new mongoose.Schema(
  {
    university:  { type: String, required: true, index: true },
    exam:        { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    hall:        { type: String, required: true },
    roll:        { type: String, uppercase: true, trim: true, default: "" },   // optional
    type:        { type: String, enum: INCIDENT_TYPES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    reportedBy:  { type: mongoose.Schema.Types. ObjectId, ref: "Invigilator", required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Incident", incidentSchema);
module.exports.INCIDENT_TYPES = INCIDENT_TYPES;