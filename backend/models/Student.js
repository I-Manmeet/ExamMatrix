const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
      index: true
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
  { universityId: 1, roll: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Student ||
  mongoose.model("Student", studentSchema);