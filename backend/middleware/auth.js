const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const University = require("../models/University");
const Invigilator = require("../models/Invigilator");
const { AppError } = require("./errorHandler");

const TOKEN_TTL = "8h";   // one exam day

function secret() {
  if (!process.env. JWT_SECRET) throw new Error("JWT_SECRET is missing in backend/.env");
  return process.env.JWT_SECRET;
}

// token payload: { id, role, university }
function signToken(user) {
  return jwt.sign(
    { id: String(user.id), role: user.role, university: user.university },
    secret(),
    { expiresIn: TOKEN_TTL, algorithm: "HS256" }
  );
}

// the account must still exist, inside the same university
function findAccount(payload) {
  if (!mongoose.isValidObjectId(payload.id)) return null;
  if (payload.role === "admin") {
    return University.findOne({ _id: payload.id, universityId: payload.university })
      .select("passwordChangedAt").lean();
  }
  if (payload.role === "invigilator") {
    return Invigilator.findOne({ _id: payload.id, university: payload.university })
      .select("passwordChangedAt").lean();
  }
  return null;
}

// "must be logged in": checks the token and sets req.user = { id, role, university }
async function requireLogin(req, res, next) {
  const key = secret();
  const [type, token] = (req.headers.authorization || "").split(" ");
  if (type !== "Bearer" || !token) {
    return next(new AppError(401, "Please log in"));
  }

  let payload;
  try {
    payload = jwt.verify(token, key, { algorithms: ["HS256"] });
  } catch (err) {
    const msg = err.name === "TokenExpiredError"
      ? "Your session has expired. Please log in again"
      : "Please log in";
    return next(new AppError(401, msg));
  }

  const account = await findAccount(payload);
  if (!account) {
    return next(new AppError(401, "This account no longer exists. Please log in again"));
  }

  // password changed after this token was made → old sessions stop working
  if (account.passwordChangedAt &&
      payload.iat < Math.floor(new Date(account.passwordChangedAt).getTime() / 1000)) {
    return next(new AppError(401, "Your password was changed. Please log in again"));
  }

  req.user = { id: payload.id, role: payload.role, university: payload.university };
  next();
}

// "must be admin" / "must be invigilator": use after requireLogin
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) return next(new AppError(401, "Please log in"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "You don't have access to this"));
    }
    next();
  };
}

module.exports = { requireLogin, requireRole, signToken };