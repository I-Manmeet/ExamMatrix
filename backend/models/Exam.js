const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    examId:       { type: String, required: true, unique: true, trim: true },   // EXM-0001-0001
    university:   { type: String, required: true, index: true },                // UNI-0001
    examName:     { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    date:         { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },        // YYYY-MM-DD
    slot:         { type: String, required: true, match: /^\d{2}:\d{2}-\d{2}:\d{2}$/ },  // 09:00-12:00
    subjects:     { type: [String], default: [] },   // subject codes, e.g. ["CS301", "CS302"]
    halls:        { type: [String], default: [] },   // halls that got students, in fill order
    studentCount: { type: Number, default: 0, min: 0 },

    // { "Hall A": [[{ roll, code } | null, ...], ...] }  (Manmeet's reports read this)
    seatMap:      { type: mongoose.Schema.Types.Mixed, default: {} },

    stats: {
      hallsUsed:   { type: Number, default: 0 },
      utilization: { type: Number, default: 0 },   // average % of free seats used
      conflicts:   { type: Number, default: 0 }    // same subject side by side (should always be 0)
    }
  },
  { timestamps: true, minimize: false }
);

// "exams on this day" and the seat booking check use these together
examSchema.index({ university: 1, date: 1, slot: 1 });

module.exports = mongoose.models. Exam || mongoose.model("Exam", examSchema);