
const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema(
  {
    university: {
      type: String,
      required: true,
      index: true // e.g. "UNI-0001"
    },
    hallNo: {
      type: String,
      required: [true, "Hall number is required"],
      trim: true
    },
    rows: {
      type: Number,
      required: true,
      min: [1, "Rows must be at least 1"],
      max: [30, "Rows can be at most 30"]
    },
    cols: {
      type: Number,
      required: true,
      min: [1, "Columns must be at least 1"],
      max: [30, "Columns can be at most 30"]
    }
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// Hall number unique within each university
hallSchema.index(
  { university: 1, hallNo: 1 },
  { unique: true }
);

hallSchema.virtual("capacity").get(function () {
  return this.rows * this.cols;
});

module.exports =
  mongoose.models.Hall ||
  mongoose.model("Hall", hallSchema);
