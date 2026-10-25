const mongoose = require("mongoose");

const invigilatorSchema = new mongoose.Schema(
  {
    invId: { type: String, required: true, unique: true, trim: true },   // INV-0001-0007
    university: { type: String, required: true, index: true },                // UNI-2026-0001
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true, select: false },               // bcrypt hash, hidden by default
    department: { type: String, trim: true, default: "" },
    subjects: { type: [String], default: [] },                               // subject codes they teach
    passwordChangedAt: { type: Date },                                          // set on reset; older logins stop working
    unavailable: {
      type: [String],
      default: [],
      validate: {
        validator: dates => dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)),
        message: "Unavailable dates must be YYYY-MM-DD"
      }
    }
  },
  { timestamps: true }
);

// one email per university
invigilatorSchema.index({ university: 1, email: 1 }, { unique: true });

// never send the password hash back in a response
invigilatorSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model("Invigilator", invigilatorSchema);