const express = require("express");
const bcrypt = require("bcrypt");
const University = require("../models/University");
const PendingUniversity = require("../models/PendingUniversity");
const Invigilator = require("../models/Invigilator");
const { requireLogin, signToken } = require("../middleware/auth");
const limiter = require("../utils/loginLimiter");
const { activity } = require("../utils/events");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();

// compared against when the account doesn't exist, so a wrong email
// takes as long as a wrong password (nobody can time which emails exist)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const INV_FORMAT = /^INV-\d{4}-\d{4}$/;

const WRONG = {
  admin: "Wrong email or password",
  invigilator: "Wrong Invigilator ID or password"
};

function readLogin(body) {
  const b = body && typeof body === "object" ? body : {};
  const role = b.role === "admin" || b.role === "invigilator" ? b.role : "";
  const raw = typeof b.identifier === "string" ? b.identifier.trim() : "";
  return {
    role,
    identifier: role === "admin" ? raw.toLowerCase() : raw.toUpperCase(),
    password: typeof b.password === "string" ? b.password : ""   // never trim a password
  };
}

// what the frontend gets: same shape inv-shell.js expects
function profileOf(account, role) {
  if (role === "admin") {
    return {
      role,
      name: account.name,
      email: account.email,
      city: account.city,
      university: account.universityId,
      universityId: account.universityId
    };
  }
  return {
    role,
    name: account.name,
    email: account.email,
    invId: account.invId,
    department: account.department,
    university: account.university
  };
}


// POST /api/auth/login  { role: "admin" | "invigilator", identifier, password }
// admin: identifier = email · invigilator: identifier = INV ID
router.post("/login", async (req, res) => {
  const { role, identifier, password } = readLogin(req.body);

  if (!role) throw new AppError(400, "Choose University admin or Invigilator");
  if (!identifier || !password) {
    throw new AppError(400, role === "admin"
      ? "Please enter your email and password"
      : "Please enter your Invigilator ID and password");
  }
  if (role === "invigilator" && !INV_FORMAT.test(identifier)) {
    throw new AppError(400, "Invigilator IDs look like INV-0001-0007");
  }
  if (password.length > 128) throw new AppError(401, WRONG[role]);

  // too many wrong tries?
  const k = limiter.key(role, identifier);
  const minutes = limiter.isLocked(k);
  if (minutes) {
    throw new AppError(429, "Too many wrong tries. Try again in " + minutes +
      (minutes === 1 ? " minute." : " minutes."));
  }

  const account = role === "admin"
    ? await University.findOne({ email: identifier }).select("+password")
    : await Invigilator.findOne({ invId: identifier }).select("+password");

  // bcrypt checks the typed password against the saved hash
  const ok = await bcrypt.compare(password, account ? account.password : DUMMY_HASH);

  if (!account || !ok) {
    // right password for a sign-up that isn't verified yet → tell them (nobody else learns anything)
    if (!account && role === "admin") {
      const pending = await PendingUniversity.findOne({ email: identifier });
      if (pending && await bcrypt.compare(password, pending.password)) {
        throw new AppError(403, "Please verify your email first. Open the link we sent to " + identifier);
      }
    }
    limiter.recordFail(k);
    throw new AppError(401, WRONG[role]);
  }

  limiter.clearFails(k);

  const university = role === "admin" ? account.universityId : account.university;
  const token = signToken({ id: account._id, role, university });

  // IDs only: never passwords, tokens or emails
  activity.emit("auth:login", {
    role,
    university,
    by: role === "admin" ? account.universityId : account.invId
  });

  res.json({ data: { token, expiresIn: 8 * 60 * 60, user: profileOf(account, role) } });
});


// GET /api/auth/me  → who is this token? (fresh from MongoDB)
router.get("/me", requireLogin, async (req, res) => {
  const account = req.user.role === "admin"
    ? await University.findById(req.user.id)
    : await Invigilator.findById(req.user.id);
  if (!account) throw new AppError(401, "This account no longer exists. Please log in again");

  res.json({ data: profileOf(account, req.user.role) });
});


// POST /api/auth/logout  → the token lives in the browser, so the page deletes it.
// This route exists so every page logs out the same way.
router.post("/logout", (req, res) => {
  res.json({ data: { message: "Logged out" } });
});

module.exports = router;