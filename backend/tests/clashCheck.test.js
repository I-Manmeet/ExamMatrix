const test = require("node:test");
const assert = require("node:assert");
const clash = require("../utils/clashCheck");

const EXAMS = [
  {
    examId: "EXM-0001-0001", examName: "Mid-Sem", slot: "09:00-11:00", subjects: ["CS301", "CS302"],
    seatMap: { "Hall A": [[{ roll: "R1", code: "CS301" }, null], [null, { roll: "R2", code: "CS302" }]] }
  },
  {
    examId: "EXM-0001-0002", examName: "Evening", slot: "14:00-16:00", subjects: ["MA201"],
    seatMap: { "Hall A": [[{ roll: "R3", code: "MA201" }, null]] }
  }
];

test("overlappingExams: only exams whose time overlaps", function () {
  assert.deepStrictEqual(clash.overlappingExams(EXAMS, "10:00-12:00").map(function (e) { return e.examId; }), ["EXM-0001-0001"]);
  assert.deepStrictEqual(clash.overlappingExams(EXAMS, "11:00-13:00"), []);   // touching isn't overlapping
});

test("scheduledSubjects: finds picked subjects already in an exam", function () {
  const found = clash.scheduledSubjects(EXAMS, ["CS301", "PH101"]);
  assert.strictEqual(found.size, 1);
  assert.deepStrictEqual(found.get("CS301"), { examId: "EXM-0001-0001", examName: "Mid-Sem" });
});

test("doubleBooked: students taking two picked subjects", function () {
  const students = [
    { roll: "R2", subjects: ["CS301", "MA201", "PH101"] },
    { roll: "R1", subjects: ["CS301"] }
  ];
  assert.deepStrictEqual(clash.doubleBooked(students, ["CS301", "MA201"]), [{ roll: "R2", subjects: ["CS301", "MA201"] }]);
});

test("busyStudents: students already seated at the same time", function () {
  const busy = clash.busyStudents(["R9", "R2", "R1"], [EXAMS[0]]);
  assert.deepStrictEqual(busy.map(function (b) { return b.roll; }), ["R1", "R2"]);
  assert.strictEqual(busy[0].examName, "Mid-Sem");
});

test("bookedSeats: seats taken in the asked halls only", function () {
  assert.deepStrictEqual(clash.bookedSeats([EXAMS[0]], ["Hall A", "Hall B"]), { "Hall A": { "0_0": "CS301", "1_1": "CS302" } });
  assert.deepStrictEqual(clash.bookedSeats([EXAMS[0]], ["Hall B"]), {});
});

test("sharedStudents: pairs of subjects with the same students", function () {
  const students = [
    { roll: "R2", subjects: ["MA201", "CS301"] },
    { roll: "R1", subjects: ["CS301", "MA201", "CS302"] },
    { roll: "R3", subjects: ["CS302"] }
  ];
  assert.deepStrictEqual(clash.sharedStudents(students, ["CS301", "CS302", "MA201"]), {
    "CS301|MA201": ["R1", "R2"],
    "CS301|CS302": ["R1"],
    "CS302|MA201": ["R1"]
  });
});

test("listSome: shows at most 5 then 'and N more'", function () {
  const out = clash.listSome(["a", "b", "c", "d", "e", "f", "g"], function (x) { return x; });
  assert.strictEqual(out, "a, b, c, d, e and 2 more");
  assert.strictEqual(clash.listSome(["a"], function (x) { return x; }), "a");
});

test("empty input gives empty results", function () {
  assert.deepStrictEqual(clash.overlappingExams(undefined, "09:00-10:00"), []);
  assert.strictEqual(clash.scheduledSubjects([], ["CS301"]).size, 0);
  assert.deepStrictEqual(clash.doubleBooked([], ["CS301"]), []);
  assert.deepStrictEqual(clash.busyStudents([], EXAMS), []);
});