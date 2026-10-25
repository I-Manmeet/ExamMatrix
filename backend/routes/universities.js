const express = require("express");
const bcrypt = require("bcrypt");
const University = require("../models/University");
const PendingUniversity = require("../models/PendingUniversity");
const { nextId } = require("../utils/idCounter");
const { validateUniversity, checkPassword, cleanEmail } = require("../utils/validateUniversity");
const { makeToken, hashToken } = require("../utils/tokens");
const { sendVerificationEmail, sendResetEmail, sendWelcomeEmail } = require("../utils/mailer");
const { activity } = require("../utils/events");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;   // verification link: 24 hours
const RESET_TTL_MS = 30 * 60 * 1000;         // reset link: 30 minutes
const COOLDOWN_MS = 60 * 1000;               // at most one email per minute

const TOKEN_FORMAT = /^[a-f0-9]{64}$/;
const IGNORE_CASE = { locale: "en", strength: 2 };

function readToken(body) {
  const token = body && typeof body.token === "string" ? body.token.trim() : "";
  return TOKEN_FORMAT.test(token) ? token : "";
}

function sentRecently(date) {
  return date && Date.now() - date.getTime() < COOLDOWN_MS;
}

async function sameNameInCity(name, city) {
  return University.exists({ name, city }).collation(IGNORE_CASE);
}


// POST /api/universities  → start registration (public)
// Saves a pending sign-up and emails a link. No UNI- ID until the link is opened.
router.post("/", async (req, res, next) => {
  try {
    // 1. clean + check every field
    const { error, value } = validateUniversity(req.body);
    if (error) throw new AppError(400, error);

    // 2. already a real university with this email or name?
    if (await University.exists({ email: value.email })) {
      throw new AppError(409, "A university with this email is already registered");
    }
    if (await sameNameInCity(value.name, value.city)) {
      throw new AppError(409, "This university is already registered in " + value.city);
    }

    // 3. registering again too quickly? (stops email spam)
    const existing = await PendingUniversity.findOne({ email: value.email });
    if (existing && sentRecently(existing.verifySentAt)) {
      throw new AppError(429, "We just sent a link to this email. Please wait a minute before trying again.");
    }

    // 4. bcrypt the password + make the link code
    const hash = await bcrypt.hash(value.password, 10);
    const verify = makeToken();

    // 5. save as pending (replaces an older pending sign-up for the same email)
    await PendingUniversity.findOneAndUpdate(
      { email: value.email },
      {
        ...value,
        password: hash,
        verifyTokenHash: verify.hash,
        verifySentAt: new Date(),
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS)
      },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
    );

    // 6. send the email; without it they can't finish, so undo if it fails
    try {
      await sendVerificationEmail(value.email, value.name, verify.token);
    } catch (mailErr) {
      console.error("Verification email failed:", mailErr.message);
      await PendingUniversity.deleteOne({ email: value.email });
      throw new AppError(502, "We couldn't send the verification email. Please try again in a moment.");
    }

    res.status(202).json({
      data: {
        email: value.email,
        message: "Check your inbox. Open the link within 24 hours to finish registering."
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError(409, "A registration for this email is already in progress. Please try again."));
    }
    if (err.name === "ValidationError") {
      return next(new AppError(400, Object.values(err.errors)[0].message));
    }
    next(err);
  }
});


// POST /api/universities/verify-email  { token }
// Turns the pending sign-up into a real University with a UNI- ID.
router.post("/verify-email", async (req, res, next) => {
  try {
    const token = readToken(req.body);
    if (!token) throw new AppError(400, "This verification link is invalid");

    const pending = await PendingUniversity.findOne({ verifyTokenHash: hashToken(token) });
    if (!pending) {
      throw new AppError(400, "This link is invalid, has expired, or has already been used");
    }
    if (pending.expiresAt < new Date()) {
      await PendingUniversity.deleteOne({ _id: pending._id });
      throw new AppError(400, "This verification link has expired. Please register again.");
    }

    // someone else may have finished registering in the meantime
    if (await University.exists({ email: pending.email })) {
      await PendingUniversity.deleteOne({ _id: pending._id });
      throw new AppError(409, "This email is already registered. Please log in.");
    }
    if (await sameNameInCity(pending.name, pending.city)) {
      await PendingUniversity.deleteOne({ _id: pending._id });
      throw new AppError(409, "This university is already registered in " + pending.city);
    }

    // only now: hand out the ID and create the real university
    const universityId = await nextId("UNI", 4);
    const university = await University.create({
      universityId,
      name: pending.name,
      city: pending.city,
      contact: pending.contact,
      email: pending.email,
      password: pending.password,          // already a bcrypt hash
      emailVerifiedAt: new Date()
    });

    await PendingUniversity.deleteOne({ _id: pending._id });

    // the ID is also emailed, in case they close this page
    sendWelcomeEmail(university.email, university.name, universityId)
      .catch((mailErr) => console.error("Welcome email failed:", mailErr.message));

    activity.emit("university:registered", { universityId, city: university.city });

    res.status(201).json({
      data: {
        universityId,
        name: university.name,
        city: university.city,
        email: university.email
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError(409, "This email is already registered. Please log in."));
    }
    next(err);
  }
});


// POST /api/universities/resend-verification  { email }
// Always gives the same reply, so nobody can find out which emails are signing up.
router.post("/resend-verification", async (req, res) => {
  const email = cleanEmail(req.body && req.body.email);
  if (!email) throw new AppError(400, "Please enter your email");

  const reply = { data: { message: "If a registration is waiting for that email, we've sent a new link." } };

  const pending = await PendingUniversity.findOne({ email });
  if (!pending || sentRecently(pending.verifySentAt)) {
    return res.json(reply);
  }

  const verify = makeToken();   // replaces the old code, so old links stop working
  await PendingUniversity.updateOne(
    { _id: pending._id },
    {
      $set: {
        verifyTokenHash: verify.hash,
        verifySentAt: new Date(),
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS)
      }
    }
  );

  try {
    await sendVerificationEmail(pending.email, pending.name, verify.token);
  } catch (mailErr) {
    console.error("Verification email failed:", mailErr.message);
  }

  res.json(reply);
});


// POST /api/universities/forgot-password  { email }
// Always gives the same reply, so nobody can find out which emails are registered.
router.post("/forgot-password", async (req, res) => {
  const email = cleanEmail(req.body && req.body.email);
  if (!email) throw new AppError(400, "Please enter your email");

  const reply = { data: { message: "If that email is registered, we've sent a link to reset your password." } };

  const uni = await University.findOne({ email }).select("+resetSentAt");
  if (!uni || sentRecently(uni.resetSentAt)) {
    return res.json(reply);
  }

  const reset = makeToken();
  await University.updateOne(
    { _id: uni._id },
    {
      $set: {
        resetTokenHash: reset.hash,
        resetTokenExpires: new Date(Date.now() + RESET_TTL_MS),
        resetSentAt: new Date()
      }
    }
  );

  try {
    await sendResetEmail(uni.email, uni.name, reset.token);
  } catch (mailErr) {
    console.error("Reset email failed:", mailErr.message);
  }

  res.json(reply);
});


// POST /api/universities/reset-password  { token, password }
router.post("/reset-password", async (req, res) => {
  const token = readToken(req.body);
  if (!token) throw new AppError(400, "This reset link is invalid");

  const password = req.body && req.body.password;
  const pwError = checkPassword(password);
  if (pwError) throw new AppError(400, pwError);

  const uni = await University.findOne({ resetTokenHash: hashToken(token) })
    .select("+resetTokenExpires +password");
  if (!uni) {
    throw new AppError(400, "This reset link is invalid or has already been used");
  }
  if (!uni.resetTokenExpires || uni.resetTokenExpires < new Date()) {
    throw new AppError(400, "This reset link has expired");
  }
  if (await bcrypt.compare(password, uni.password)) {
    throw new AppError(400, "Your new password must be different from the old one");
  }

  const hash = await bcrypt.hash(password, 10);

  await University.updateOne(
    { _id: uni._id },
    {
      $set: { password: hash, passwordChangedAt: new Date() },
      $unset: { resetTokenHash: 1, resetTokenExpires: 1, resetSentAt: 1 }
    }
  );

  activity.emit("password:reset", { universityId: uni.universityId });

  res.json({ data: { message: "Password updated. You can log in with your new password." } });
});

module.exports = router;