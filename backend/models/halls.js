const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
      index: true
    },
    hallNo: {
      type: String,
      required: [true, "Hall number is required"],
      trim: true
    },
    rows: {
      type: Number,
      required: true,
      min: [1, "Rows must be at least 1"]
    },
    cols: {
      type: Number,
      required: true,
      min: [1, "Columns must be at least 1"]
    }
  },
  { timestamps: true }
);

// Hall number unique within each university
hallSchema.index(
  { universityId: 1, hallNo: 1 },
  { unique: true }
);

hallSchema.virtual("capacity").get(function () {
  return this.rows * this.cols;
});

module.exports =
  mongoose.models.Hall ||
  mongoose.model("Hall", hallSchema);
