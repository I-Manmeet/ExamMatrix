const mongoose = require("mongoose");

// Only created after the admin email is verified (see PendingUniversity).
const universitySchema = new mongoose.Schema(
  {
    universityId: { type: String, required: true, unique: true },            // UNI-0001
    name:    { type: String, required: [true, "University name is required"], trim: true, maxlength: 100 },
    city:    { type: String, required: [true, "City is required"], trim: true, maxlength: 60 },
    contact: { type: String, required: [true, "Contact number is required"], trim: true, maxlength: 16 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email"]
    },
    password: { type: String, required: true, select: false },               // bcrypt hash
    emailVerifiedAt: { type: Date, required: true },

    // forgot password (only the sha256 hash of the link code is stored)
    resetTokenHash:    { type: String, select: false, index: true, sparse: true },
    resetTokenExpires: { type: Date, select: false },
    resetSentAt:       { type: Date, select: false },

    // Task 4 uses this to log out sessions from before a password change
    passwordChangedAt: { type: Date }
  },
  { timestamps: true }
);

// never send hashes back in a response
universitySchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpires;
    delete ret.resetSentAt;
    return ret;
  }
});

module.exports =
  mongoose.models.University ||
  mongoose.model("University", universitySchema);