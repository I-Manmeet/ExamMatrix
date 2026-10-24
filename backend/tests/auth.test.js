process.env.JWT_SECRET = "test-secret";

const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const University = require("../models/University");
const Invigilator = require("../models/Invigilator");
const { requireLogin, requireRole, signToken } = require("../middleware/auth.js");
const limiter = require("../utils/loginLimiter.js");

const adminId = new mongoose.Types.ObjectId().toString();
const invId = new mongoose.Types.ObjectId().toString();

// pretend MongoDB returns `doc` for findOne(...).select(...).lean()
function stubFind(Model, doc) {
  Model.findOne = function () {
    return { select: function () { return { lean: async function () { return doc; } }; } };
  };
}

async function runLogin(header) {
  const req = { headers: header ? { authorization: header } : {} };
  let error;
  await requireLogin(req, {}, function (err) { error = err; });
  return { req, error };
}

function runRole(role, user) {
  let error;
  requireRole(role)({ user }, {}, function (err) { error = err; });
  return error;
}

test("no token → 401", async () => {
  const { error } = await runLogin();
  assert.strictEqual(error.status, 401);
});

test("broken token → 401", async () => {
  const { error } = await runLogin("Bearer not.a.token");
  assert.strictEqual(error.status, 401);
});

test("token signed with another secret → 401", async () => {
  const fake = jwt.sign({ id: adminId, role: "admin", university: "UNI-0001" }, "hacker-secret");
  const { error } = await runLogin("Bearer " + fake);
  assert.strictEqual(error.status, 401);
});

test("expired token → 401 with 'expired'", async () => {
  const old = jwt.sign(
    { id: adminId, role: "admin", university: "UNI-0001", exp: Math.floor(Date.now() / 1000) - 10 },
    process.env.JWT_SECRET
  );
  const { error } = await runLogin("Bearer " + old);
  assert.strictEqual(error.status, 401);
  assert.match(error.message, /expired/);
});

test("valid admin token sets req.user = { id, role, university }", async () => {
  stubFind(University, { _id: adminId });
  const token = signToken({ id: adminId, role: "admin", university: "UNI-0001" });
  const { req, error } = await runLogin("Bearer " + token);
  assert.strictEqual(error, undefined);
  assert.deepStrictEqual(req.user, { id: adminId, role: "admin", university: "UNI-0001" });
});

test("valid invigilator token works too", async () => {
  stubFind(Invigilator, { _id: invId });
  const token = signToken({ id: invId, role: "invigilator", university: "UNI-0001" });
  const { req, error } = await runLogin("Bearer " + token);
  assert.strictEqual(error, undefined);
  assert.strictEqual(req.user.role, "invigilator");
});

test("deleted account → 401", async () => {
  stubFind(University, null);
  const token = signToken({ id: adminId, role: "admin", university: "UNI-0001" });
  const { error } = await runLogin("Bearer " + token);
  assert.strictEqual(error.status, 401);
});

test("password changed after login → old token stops working", async () => {
  stubFind(University, { _id: adminId, passwordChangedAt: new Date(Date.now() + 5000) });
  const token = signToken({ id: adminId, role: "admin", university: "UNI-0001" });
  const { error } = await runLogin("Bearer " + token);
  assert.strictEqual(error.status, 401);
  assert.match(error.message, /password was changed/);
});

test("unknown role in token → 401", async () => {
  const token = signToken({ id: adminId, role: "student", university: "UNI-0001" });
  const { error } = await runLogin("Bearer " + token);
  assert.strictEqual(error.status, 401);
});

test("requireRole: right role passes, wrong role → 403, no user → 401", () => {
  assert.strictEqual(runRole("admin", { role: "admin" }), undefined);
  assert.strictEqual(runRole("admin", { role: "invigilator" }).status, 403);
  assert.strictEqual(runRole("admin", undefined).status, 401);
});

test("login limiter: locks after 5 wrong tries, clears on success", () => {
  const k = limiter.key("admin", "test@uni.edu");
  for (let i = 0; i < limiter.MAX_FAILS - 1; i++) limiter.recordFail(k);
  assert.strictEqual(limiter.isLocked(k), 0);
  limiter.recordFail(k);
  assert.ok(limiter.isLocked(k) > 0);
  limiter.clearFails(k);
  assert.strictEqual(limiter.isLocked(k), 0);
});