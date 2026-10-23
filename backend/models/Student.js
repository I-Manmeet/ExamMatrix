
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    university: {
      type: String,
      required: true,
      index: true // e.g. "UNI-0001"
    },
    roll: {
      type: String,
      required: [true, "Roll number is required"],
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true
    },
    subjects: {
      type: [
        {
          type: String,
          trim: true,
          uppercase: true
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

// Roll number unique within each university
studentSchema.index(
  { university: 1, roll: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Student ||
  mongoose.model("Student", studentSchema);
