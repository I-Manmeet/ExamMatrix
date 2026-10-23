const test = require("node:test");
const assert = require("node:assert");
const { makeOwnsDuty } = require("../middleware/ownsDuty");

const EXAM = { _id: "exam-db-id", examId: "EXM-0001-0001", university: "UNI-0001" };
const DUTY = { _id: "duty-db-id", hall: "Hall A", invigilator: "inv-db-id" };

// fake database: one exam, one duty (inv-db-id in Hall A)
function fakeFinders(seen) {
  return {
    findExam: async function (examId, university) {
      if (seen) seen.examQuery = { examId, university };
      return examId === EXAM.examId && university === EXAM.university ? EXAM : null;
    },
    findDuty: async function (query) {
      if (seen) seen.dutyQuery = query;
      const match = query.exam === EXAM._id && query.hall === DUTY.hall && query.invigilator === DUTY.invigilator;
      return match ? DUTY : null;
    }
  };
}

function makeReq(overrides) {
  return Object.assign({
    user: { id: "inv-db-id", role: "invigilator", university: "UNI-0001" },
    params: { examId: "EXM-0001-0001" },
    body: { hall: "Hall A" },
    query: {}
  }, overrides);
}

function hasStatus(status) {
  return function (err) { assert.strictEqual(err.status, status); return true; };
}

test("lets the invigilator on duty through and sets req.exam + req.duty", async () => {
  const req = makeReq();
  let called = false;
  await makeOwnsDuty(fakeFinders())(req, {}, function () { called = true; });
  assert.strictEqual(called, true);
  assert.strictEqual(req.exam, EXAM);
  assert.strictEqual(req.duty, DUTY);
});

test("reads the hall from the query string too (GET requests)", async () => {
  const req = makeReq({ body: undefined, query: { hall: "Hall A" } });
  let called = false;
  await makeOwnsDuty(fakeFinders())(req, {}, function () { called = true; });
  assert.strictEqual(called, true);
});

test("403 when they are on duty somewhere else", async () => {
  const req = makeReq({ body: { hall: "Hall C" } });
  await assert.rejects(makeOwnsDuty(fakeFinders())(req, {}, () => {}), hasStatus(403));
});

test("403 for admins and logged-out requests", async () => {
  const admin = makeReq({ user: { id: "admin-id", role: "admin", university: "UNI-0001" } });
  await assert.rejects(makeOwnsDuty(fakeFinders())(admin, {}, () => {}), hasStatus(403));
  await assert.rejects(makeOwnsDuty(fakeFinders())(makeReq({ user: undefined }), {}, () => {}), hasStatus(403));
});

test("400 when no hall is given", async () => {
  const req = makeReq({ body: {} });
  await assert.rejects(makeOwnsDuty(fakeFinders())(req, {}, () => {}), hasStatus(400));
});

test("404 when the exam belongs to another university", async () => {
  const req = makeReq({ user: { id: "inv-db-id", role: "invigilator", university: "UNI-0002" } });
  await assert.rejects(makeOwnsDuty(fakeFinders())(req, {}, () => {}), hasStatus(404));
});

test("always searches inside the user's own university", async () => {
  const seen = {};
  await makeOwnsDuty(fakeFinders(seen))(makeReq(), {}, () => {});
  assert.strictEqual(seen.examQuery.university, "UNI-0001");
  assert.strictEqual(seen.dutyQuery.university, "UNI-0001");
  assert.strictEqual(seen.dutyQuery.invigilator, "inv-db-id");
});