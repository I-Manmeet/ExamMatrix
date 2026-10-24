const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Duty = require("../models/Duty");
const { toPlainDuties, toDutyDocs } = require("../utils/dutyMapper");
const { autoAssign } = require("../utils/autoAssign");

const oid = () => new mongoose.Types.ObjectId();

// what the database would hold
const anjali = { _id: oid(), invId: "INV-0001-0001", name: "Dr. Anjali Mehta", subjects: [], unavailable: [] };
const suresh = { _id: oid(), invId: "INV-0001-0002", name: "Prof. Suresh Iyer", subjects: [], unavailable: [] };
const exam = {
  _id: oid(),
  examId: "EXM-0001-0001",
  date: "2026-10-27",
  slot: "09:00-12:00",
  seatMap: { "Hall A": [[{ roll: "21CS001", code: "CS302" }, null]] }
};

// a duty as it comes back from Duty.find().populate(...)
function populatedDuty(inv, ex, hall, position) {
  return { _id: oid(), university: "UNI-0001", invigilator: inv, exam: ex, hall, position, date: "2026-10-27", slot: "09:00-12:00" };
}

const ctx = { university: "UNI-0001", invigilators: [anjali, suresh], exams: [exam] };

// ---------- database → plain ----------

test("populated duties become readable ids", () => {
  const plain = toPlainDuties([populatedDuty(anjali, exam, "Hall A", 1)]);
  assert.deepEqual(plain, [{
    invigilator: "INV-0001-0001", exam: "EXM-0001-0001",
    hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00"
  }]);
});

test("position stored as text becomes a number", () => {
  const plain = toPlainDuties([populatedDuty(anjali, exam, "Hall A", "2")]);
  assert.equal(plain[0].position, 2);
});

test("duties for a deleted invigilator or exam are dropped", () => {
  const plain = toPlainDuties([
    populatedDuty(null, exam, "Hall A", 1),     // invigilator deleted
    populatedDuty(anjali, null, "Hall A", 1),   // exam deleted
    populatedDuty(suresh, exam, "Hall A", 2)
  ]);
  assert.equal(plain.length, 1);
  assert.equal(plain[0].invigilator, "INV-0001-0002");
});

test("forgetting populate gives a clear error", () => {
  assert.throws(() => toPlainDuties([populatedDuty(oid(), exam, "Hall A", 1)]), /invigilator is not populated/);
  assert.throws(() => toPlainDuties([populatedDuty(anjali, oid(), "Hall A", 1)]), /exam is not populated/);
});

test("no duties gives an empty list", () => {
  assert.deepEqual(toPlainDuties([]), []);
  assert.deepEqual(toPlainDuties(undefined), []);
});

// ---------- plain → database ----------

test("plain duties become documents with ObjectIds and the university", () => {
  const docs = toDutyDocs([{ invigilator: "INV-0001-0002", exam: "EXM-0001-0001", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" }], ctx);
  assert.equal(docs[0].university, "UNI-0001");
  assert.equal(docs[0].invigilator, suresh._id);
  assert.equal(docs[0].exam, exam._id);
  assert.equal(docs[0].position, 1);
});

test("the university always comes from the logged-in user", () => {
  const sneaky = { university: "UNI-9999", invigilator: "INV-0001-0001", exam: "EXM-0001-0001", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" };
  assert.equal(toDutyDocs([sneaky], ctx)[0].university, "UNI-0001");
});

test("an invigilator not in this university's list is a 404", () => {
  const duty = { invigilator: "INV-0002-0001", exam: "EXM-0001-0001", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" };
  assert.throws(() => toDutyDocs([duty], ctx), { message: "Invigilator INV-0002-0001 not found" });
});

test("an unknown exam is a 404", () => {
  const duty = { invigilator: "INV-0001-0001", exam: "EXM-0001-0999", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" };
  assert.throws(() => toDutyDocs([duty], ctx), { message: "Exam EXM-0001-0999 not found" });
});

test("a missing university is refused", () => {
  assert.throws(() => toDutyDocs([], { invigilators: [], exams: [] }), /university is required/);
  assert.throws(() => toDutyDocs([]), /university is required/);
});

test("no duties gives no documents", () => {
  assert.deepEqual(toDutyDocs([], ctx), []);
  assert.deepEqual(toDutyDocs(undefined, ctx), []);
});

test("documents pass the real Duty model validation", () => {
  const docs = toDutyDocs([{ invigilator: "INV-0001-0001", exam: "EXM-0001-0001", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" }], ctx);
  assert.equal(new Duty(docs[0]).validateSync(), undefined);
});

test("round trip gives back the same plain duties, input untouched", () => {
  const original = [
    { invigilator: "INV-0001-0001", exam: "EXM-0001-0001", hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00" },
    { invigilator: "INV-0001-0002", exam: "EXM-0001-0001", hall: "Hall A", position: 2, date: "2026-10-27", slot: "09:00-12:00" }
  ];
  const copy = structuredClone(original);

  const docs = toDutyDocs(original, ctx);
  // pretend the database populated them
  const byId = new Map([[String(anjali._id), anjali], [String(suresh._id), suresh]]);
  const back = toPlainDuties(docs.map((d) => ({ ...d, invigilator: byId.get(String(d.invigilator)), exam })));

  assert.deepEqual(back, original);
  assert.deepEqual(original, copy);
});

test("autoAssign output can be saved directly", () => {
  const { duties } = autoAssign(exam, [anjali, suresh], [], { random: () => 0 });
  const docs = toDutyDocs(duties, ctx);
  assert.equal(docs.length, 1);
  assert.equal(new Duty(docs[0]).validateSync(), undefined);
});