const mongoose = require("mongoose");

// A sign-up waiting for email verification. It becomes a real
// University (with a UNI- ID) only when the link is opened.
// MongoDB deletes it automatically once expiresAt has passed.
const pendingSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 100 },
    city:     { type: String, required: true, trim: true, maxlength: 60 },
    contact:  { type: String, required: true, trim: true, maxlength: 16 },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true },                 // bcrypt hash

    verifyTokenHash: { type: String, required: true, index: true },   // sha256 of the link code
    verifySentAt:    { type: Date, required: true },
    expiresAt:       { type: Date, required: true, expires: 0 }       // auto-delete at this time
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PendingUniversity ||
  mongoose.model("PendingUniversity", pendingSchema);