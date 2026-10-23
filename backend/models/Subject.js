const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
      index: true
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
  { universityId: 1, code: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Subject ||
  mongoose.model("Subject", subjectSchema);
