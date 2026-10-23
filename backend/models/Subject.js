
const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    university: {
      type: String,
      required: true,
      index: true // e.g. "UNI-0001"
    },
    code: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true
    },
    dept: {
      type: String,
      required: [true, "Department is required"],
      trim: true
    }
  },
  { timestamps: true }
);

// Subject code unique within each university
subjectSchema.index(
  { university: 1, code: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Subject ||
  mongoose.model("Subject", subjectSchema);
