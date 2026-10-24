const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Incident = require("../models/Incident");
const { checkAttendance, toAttendanceOps, checkIncident } = require("../utils/hallDutyInput");

const oid = () => new mongoose.Types.ObjectId();

const exam = {
  examId: "EXM-0001-0001",
  seatMap: {
    "Hall A": [
      [{ roll: "21CS001", code: "CS302" }, null, { roll: "21cs002", code: "CS302" }],
      [{ roll: "21IT001", code: "CS303" }, null, null]
    ],
    "Hall C": [[{ roll: "21CS041", code: "CS302" }]],
    "Hall E": [[null, null]],                    // in the seat map, nobody seated
    "Hall N": [[{ roll: 1001, code: "CS302" }]]  // roll saved as a number
  }
};

// expects an AppError with this status and message (exact text or regex)
function fails(fn, status, message) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, status);
    if (message instanceof RegExp) assert.match(err.message, message);
    else assert.equal(err.message, message);
    return true;
  });
}

const mark = (roll, status) => ({ roll, status });

// ---------- attendance ----------

test("attendance: roll, status and hall are cleaned", () => {
  const result = checkAttendance(exam, {
    hall: " Hall A ",
    marks: [mark(" 21cs001 ", " Present "), mark("21CS002", "ABSENT")]
  });
  assert.deepEqual(result, {
    hall: "Hall A",
    marks: [{ roll: "21CS001", status: "present" }, { roll: "21CS002", status: "absent" }]
  });
});

test("attendance: same student twice → last tap wins, saved once", () => {
  const result = checkAttendance(exam, {
    hall: "Hall A",
    marks: [mark("21CS001", "present"), mark("21CS002", "absent"), mark("21CS001", "absent")]
  });
  assert.deepEqual(result.marks, [{ roll: "21CS001", status: "absent" }, { roll: "21CS002", status: "absent" }]);
});

test("attendance: a student from another hall is refused", () => {
  fails(() => checkAttendance(exam, { hall: "Hall A", marks: [mark("21CS041", "present")] }),
    400, "Mark 1: 21CS041 is not seated in Hall A");
});

test("attendance: bad or missing status is refused", () => {
  fails(() => checkAttendance(exam, { hall: "Hall A", marks: [mark("21CS001", "late"), { roll: "21CS002" }] }),
    400, "Mark 1: status must be present or absent; Mark 2: status must be present or absent");
});

test("attendance: missing roll, null and bare strings are refused", () => {
  fails(() => checkAttendance(exam, { hall: "Hall A", marks: [null, { status: "present" }, "21CS001"] }),
    400, "Mark 1: roll is required; Mark 2: roll is required; Mark 3: roll is required");
});

test("attendance: one bad mark rejects the whole batch", () => {
  fails(() => checkAttendance(exam, { hall: "Hall A", marks: [mark("21CS001", "present"), mark("21XX999", "present")] }),
    400, "Mark 2: 21XX999 is not seated in Hall A");
});

test("attendance: many errors → first 5, then 'and N more'", () => {
  const marks = Array.from({ length: 8 }, () => mark("21CS001", "late"));
  fails(() => checkAttendance(exam, { hall: "Hall A", marks }), 400, /Mark 5: .*; and 3 more$/);
  fails(() => checkAttendance(exam, { hall: "Hall A", marks }), 400, /^(?!.*Mark 6)/);
});

test("attendance: marks missing, empty or not a list", () => {
  for (const marks of [undefined, [], "21CS001", {}]) {
    fails(() => checkAttendance(exam, { hall: "Hall A", marks }), 400, "marks must be a non-empty list");
  }
});

test("attendance: more than 1000 marks refused, exactly 1000 allowed", () => {
  const many = (n) => Array.from({ length: n }, () => mark("21CS001", "present"));
  fails(() => checkAttendance(exam, { hall: "Hall A", marks: many(1001) }), 400, /max 1000/);
  assert.equal(checkAttendance(exam, { hall: "Hall A", marks: many(1000) }).marks.length, 1);
});

test("attendance: hall missing, blank, wrong case, unknown or empty", () => {
  const marks = [mark("21CS001", "present")];
  fails(() => checkAttendance(exam, { marks }), 400, "hall is required");
  fails(() => checkAttendance(exam, { hall: "   ", marks }), 400, "hall is required");
  fails(() => checkAttendance(exam, { hall: "hall a", marks }), 404, "hall a is not part of this exam");
  fails(() => checkAttendance(exam, { hall: "Hall Z", marks }), 404, "Hall Z is not part of this exam");
  fails(() => checkAttendance(exam, { hall: "Hall E", marks }), 404, "Hall E is not part of this exam");
});

test("attendance: built-in names like 'constructor' don't crash", () => {
  const marks = [mark("21CS001", "present")];
  fails(() => checkAttendance(exam, { hall: "constructor", marks }), 404, /not part of this exam/);
  fails(() => checkAttendance(exam, { hall: "__proto__", marks }), 404, /not part of this exam/);
});

test("attendance: no body at all", () => {
  for (const body of [null, undefined, "Hall A"]) {
    fails(() => checkAttendance(exam, body), 400, "hall is required");
  }
});

test("attendance: exam without a seat map", () => {
  fails(() => checkAttendance({ examId: "EXM-0001-0002" }, { hall: "Hall A", marks: [mark("21CS001", "present")] }),
    404, "Hall A is not part of this exam");
});

test("attendance: roll saved as a number still matches", () => {
  const result = checkAttendance(exam, { hall: "Hall N", marks: [mark(1001, "present")] });
  assert.deepEqual(result.marks, [{ roll: "1001", status: "present" }]);
});

test("attendance: seat map stored as a Mongoose Map works", () => {
  const mapExam = { examId: "EXM-0001-0001", seatMap: new Map(Object.entries(exam.seatMap)) };
  const result = checkAttendance(mapExam, { hall: "Hall C", marks: [mark("21cs041", "absent")] });
  assert.deepEqual(result.marks, [{ roll: "21CS041", status: "absent" }]);
});

// ---------- saving attendance ----------

const saveCtx = () => ({ university: "UNI-0001", exam: oid(), hall: "Hall A", markedBy: oid() });

test("attendance ops: upsert per student, marking again updates", () => {
  const ctx = saveCtx();
  const ops = toAttendanceOps([{ roll: "21CS001", status: "present" }], ctx);
  assert.deepEqual(ops, [{
    updateOne: {
      filter: { university: "UNI-0001", exam: ctx.exam, roll: "21CS001" },
      update: { $set: { hall: "Hall A", status: "present", markedBy: ctx.markedBy } },
      upsert: true
    }
  }]);
});

test("attendance ops: result passes the real Attendance model", () => {
  const [op] = toAttendanceOps([{ roll: "21CS001", status: "absent" }], saveCtx());
  const doc = new Attendance({ ...op.updateOne.filter, ...op.updateOne.update.$set });
  assert.equal(doc.validateSync(), undefined);
});

test("attendance ops: missing context refused, no marks → no ops", () => {
  assert.throws(() => toAttendanceOps([], {}), /required/);
  assert.throws(() => toAttendanceOps([]), /required/);
  assert.deepEqual(toAttendanceOps([], saveCtx()), []);
});

// ---------- incidents ----------

test("incident: type in any case, description trimmed, roll optional", () => {
  const result = checkIncident(exam, { hall: "Hall A", type: "student UNWELL", description: "  Felt dizzy  " });
  assert.deepEqual(result, { hall: "Hall A", roll: "", type: "Student unwell", description: "Felt dizzy" });
});

test("incident: roll is cleaned and must be in that hall", () => {
  const ok = checkIncident(exam, { hall: "Hall A", roll: " 21cs001 ", type: "Other", description: "x" });
  assert.equal(ok.roll, "21CS001");
  fails(() => checkIncident(exam, { hall: "Hall A", roll: "21CS041", type: "Other", description: "x" }),
    400, "21CS041 is not seated in Hall A");
});

test("incident: unknown or missing type lists the allowed ones", () => {
  for (const type of ["fire", "", undefined]) {
    fails(() => checkIncident(exam, { hall: "Hall A", type, description: "x" }),
      400, /^type must be one of: Unfair means suspected, .*Other$/);
  }
});

test("incident: description blank, spaces only or too long; 1000 is fine", () => {
  for (const description of [undefined, "", "    "]) {
    fails(() => checkIncident(exam, { hall: "Hall A", type: "Other", description }), 400, "description is required");
  }
  fails(() => checkIncident(exam, { hall: "Hall A", type: "Other", description: "a".repeat(1001) }),
    400, "description can be at most 1000 characters");
  assert.equal(checkIncident(exam, { hall: "Hall A", type: "Other", description: "a".repeat(1000) }).description.length, 1000);
});

test("incident: several problems in one message", () => {
  fails(() => checkIncident(exam, { hall: "Hall A", type: "fire", description: "", roll: "x1" }),
    400, /^type must be one of: .*; description is required; X1 is not seated in Hall A$/);
});

test("incident: bad hall", () => {
  fails(() => checkIncident(exam, { type: "Other", description: "x" }), 400, "hall is required");
  fails(() => checkIncident(exam, { hall: "Hall Z", type: "Other", description: "x" }), 404, "Hall Z is not part of this exam");
});

test("incident: result passes the real Incident model", () => {
  const result = checkIncident(exam, { hall: "Hall C", roll: "21CS041", type: "unfair means suspected", description: "Phone under desk" });
  const doc = new Incident({ ...result, university: "UNI-0001", exam: oid(), reportedBy: oid() });
  assert.equal(doc.validateSync(), undefined);
});