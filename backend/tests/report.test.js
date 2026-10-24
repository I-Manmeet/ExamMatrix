const test = require("node:test");
const assert = require("node:assert");
const { buildReport } = require("../utils/report");

function s(roll, code) { return { roll: roll, code: code }; }

const EXAM = {
  examId: "EXM-0001-0001",
  examName: "Mid Sem · Systems",
  date: "2026-10-27",
  slot: "09:00-12:00",
  seatMap: {
    "Hall C": [[s("21CS010", "CS302"), s("21CS011", "CS302")]],                       // 2 students
    "Hall A": [[s("21CS001", "CS302"), s("21IT001", "CS303")], [s("21CS002", "CS302"), null]], // 3 students
    "Hall Z": [[null]]                                                                // empty
  }
};

const PEOPLE = [
  { invId: "INV-0001-0001", name: "Dr. Anjali Mehta" },
  { invId: "INV-0001-0004", name: "Prof. Suresh Iyer" },
  { invId: "INV-0001-0005", name: "Dr. Arnab Bose" }
];

const DUTIES = [
  { invigilator: "INV-0001-0004", exam: EXAM.examId, hall: "Hall A", position: 2 },
  { invigilator: "INV-0001-0001", exam: EXAM.examId, hall: "Hall A", position: 1 },
  { invigilator: "INV-0001-0005", exam: EXAM.examId, hall: "Hall C", position: 1 }
];

const ATTENDANCE = [
  { hall: "Hall A", roll: "21CS001", status: "present" },
  { hall: "Hall A", roll: "21IT001", status: "absent" },
  { hall: "Hall A", roll: "21cs002", status: "present" },   // lowercase on purpose
  { hall: "Hall C", roll: "21CS010", status: "absent" },
  { hall: "Hall C", roll: "21CS011", status: "present" },
  { hall: "Hall A", roll: "99XX999", status: "present" }    // not seated → ignored
];

const INCIDENTS = [
  { id: "i1", hall: "Hall A", roll: "21CS001", type: "Unfair means suspected", description: "Phone under the desk",
    reportedBy: "INV-0001-0001", createdAt: "2026-10-27T10:12:00+05:30" },
  { id: "i2", hall: "Hall C", type: "Other", description: "Fan not working",
    reportedBy: "INV-0001-0005", createdAt: new Date("2026-10-27T09:20:00+05:30") },
  { id: "i3", hall: "Hall A", roll: "21IT001", type: "Student unwell", description: "Felt dizzy",
    reportedBy: "INV-0001-0004", createdAt: "2026-10-27T10:45:00+05:30" }
];

const FULL = { duties: DUTIES, attendance: ATTENDANCE, incidents: INCIDENTS, invigilators: PEOPLE };

function hall(report, name) { return report.halls.find(function (h) { return h.hall === name; }); }

test("exam summary has no seatMap", () => {
  const r = buildReport(EXAM, FULL);
  assert.deepStrictEqual(r.exam, { examId: "EXM-0001-0001", examName: "Mid Sem · Systems", date: "2026-10-27", slot: "09:00-12:00" });
});

test("halls come from the seat map, sorted, empty halls skipped", () => {
  const r = buildReport(EXAM, FULL);
  assert.deepStrictEqual(r.halls.map((h) => h.hall), ["Hall A", "Hall C"]);
  assert.deepStrictEqual(r.halls.map((h) => h.students), [3, 2]);
});

test("present / absent per hall (any letter case, unknown rolls ignored)", () => {
  const r = buildReport(EXAM, FULL);
  assert.strictEqual(hall(r, "Hall A").present, 2);
  assert.strictEqual(hall(r, "Hall A").absent, 1);
  assert.strictEqual(hall(r, "Hall C").present, 1);
  assert.strictEqual(hall(r, "Hall C").absent, 1);
});

test("the seat map decides the hall, not the attendance record", () => {
  const r = buildReport(EXAM, { attendance: [{ hall: "Hall C", roll: "21CS001", status: "absent" }] });
  assert.strictEqual(hall(r, "Hall A").absent, 1);
  assert.strictEqual(hall(r, "Hall C").absent, 0);
});

test("the last mark for a student wins", () => {
  const r = buildReport(EXAM, { attendance: [
    { hall: "Hall A", roll: "21CS001", status: "present" },
    { hall: "Hall A", roll: "21CS001", status: "absent" }
  ] });
  assert.strictEqual(hall(r, "Hall A").present, 0);
  assert.strictEqual(hall(r, "Hall A").absent, 1);
});

test("invigilators per hall, sorted by position, with names", () => {
  const r = buildReport(EXAM, FULL);
  assert.deepStrictEqual(hall(r, "Hall A").invigilators, [
    { invId: "INV-0001-0001", name: "Dr. Anjali Mehta" },
    { invId: "INV-0001-0004", name: "Prof. Suresh Iyer" }
  ]);
  assert.deepStrictEqual(hall(r, "Hall C").invigilators, [{ invId: "INV-0001-0005", name: "Dr. Arnab Bose" }]);
});

test("unknown names fall back to the INV ID; other exams' duties are ignored", () => {
  const r = buildReport(EXAM, { invigilators: PEOPLE, duties: [
    { invigilator: "INV-0001-0099", exam: EXAM.examId, hall: "Hall C", position: 1 },
    { invigilator: "INV-0001-0001", exam: "EXM-0001-0009", hall: "Hall A", position: 1 }
  ] });
  assert.deepStrictEqual(hall(r, "Hall C").invigilators, [{ invId: "INV-0001-0099", name: "INV-0001-0099" }]);
  assert.deepStrictEqual(hall(r, "Hall A").invigilators, []);
});

test("absent list has the subject code, sorted by hall then roll", () => {
  const r = buildReport(EXAM, FULL);
  assert.deepStrictEqual(r.absent, [
    { roll: "21IT001", hall: "Hall A", code: "CS303" },
    { roll: "21CS010", hall: "Hall C", code: "CS302" }
  ]);
});

test("incidents: newest first, reporter name, ISO time, empty roll when missing", () => {
  const r = buildReport(EXAM, FULL);
  assert.deepStrictEqual(r.incidents.map((i) => i.id), ["i3", "i1", "i2"]);
  assert.deepStrictEqual(r.incidents[0].reportedBy, { invId: "INV-0001-0004", name: "Prof. Suresh Iyer" });
  assert.strictEqual(r.incidents[0].createdAt, "2026-10-27T05:15:00.000Z");
  assert.strictEqual(r.incidents[2].roll, "");
});

test("nothing recorded yet: zero counts and empty lists", () => {
  const r = buildReport(EXAM, {});
  assert.deepStrictEqual(r.halls.map((h) => [h.present, h.absent, h.invigilators.length]), [[0, 0, 0], [0, 0, 0]]);
  assert.deepStrictEqual(r.absent, []);
  assert.deepStrictEqual(r.incidents, []);
});

test("no seat map: no halls and nobody counted", () => {
  const r = buildReport({ examId: "EXM-0001-0002", examName: "X", date: "2026-10-28", slot: "09:00-12:00" }, FULL);
  assert.deepStrictEqual(r.halls, []);
  assert.deepStrictEqual(r.absent, []);
  assert.strictEqual(r.incidents.length, 3);
});