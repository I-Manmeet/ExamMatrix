const test = require("node:test");
const assert = require("node:assert");
const { getPositions, canInvigilate, autoAssign } = require("../utils/autoAssign.js");

/* helper: a hall grid with `count` students writing `code` */
function hall(rows, cols, count, code) {
  const grid = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(n++ < count ? { roll: "R" + n, code } : null);
    }
    grid.push(row);
  }
  return grid;
}

const exam = {
  examId: "EXM-0001-0001",
  date: "2026-10-27",
  slot: "09:00-12:00",
  seatMap: {
    "Hall A": hall(5, 8, 40, "CS302"),  // 40 students → 2 positions
    "Hall C": hall(4, 6, 10, "CS303")   // 10 students → 1 position
  }
};

const invigilators = [
  { invId: "INV-0001-0001", subjects: ["CS302"], unavailable: [] },             // can't take Hall A
  { invId: "INV-0001-0002", subjects: ["CS303"], unavailable: [] },             // can't take Hall C
  { invId: "INV-0001-0003", subjects: [],        unavailable: ["2026-10-27"] }, // off that day
  { invId: "INV-0001-0004", subjects: [],        unavailable: [] },
  { invId: "INV-0001-0005", subjects: [],        unavailable: [] }
];

/* ---------------- main behaviour ---------------- */

test("positions: 1 per 30 students, at least 1 per hall", () => {
  const p = getPositions(exam);
  assert.strictEqual(p.filter(x => x.hall === "Hall A").length, 2);
  assert.strictEqual(p.filter(x => x.hall === "Hall C").length, 1);
});

test("canInvigilate: blocks unavailable, own subject and same-slot clash", () => {
  const posA = getPositions(exam).find(x => x.hall === "Hall A");

  assert.strictEqual(canInvigilate(invigilators[2], exam, posA, []).code, "unavailable");
  assert.strictEqual(canInvigilate(invigilators[0], exam, posA, []).code, "ownSubject");

  const busy = [{ invigilator: "INV-0001-0004", exam: "EXM-0001-0009", hall: "LT-1", position: 1, date: exam.date, slot: exam.slot }];
  assert.strictEqual(canInvigilate(invigilators[3], exam, posA, busy).code, "busy");

  assert.strictEqual(canInvigilate(invigilators[4], exam, posA, []).ok, true);
});

test("autoAssign: fills every position without breaking a rule", () => {
  const { duties, unfilled, stats } = autoAssign(exam, invigilators);

  assert.strictEqual(duties.length, 3);
  assert.strictEqual(unfilled.length, 0);
  assert.deepStrictEqual(stats, { positions: 3, filled: 3, unfilled: 0 });

  // nobody twice in the same slot
  assert.strictEqual(new Set(duties.map(d => d.invigilator)).size, duties.length);
  // CS302 teacher never in Hall A, CS303 teacher never in Hall C, unavailable person never used
  assert.ok(!duties.some(d => d.hall === "Hall A" && d.invigilator === "INV-0001-0001"));
  assert.ok(!duties.some(d => d.hall === "Hall C" && d.invigilator === "INV-0001-0002"));
  assert.ok(!duties.some(d => d.invigilator === "INV-0001-0003"));
});

test("autoAssign: reports unfilled positions with a reason", () => {
  const { unfilled } = autoAssign(exam, invigilators.slice(0, 3));  // too few people
  assert.ok(unfilled.length > 0);
  assert.match(unfilled[0].reason, /No eligible invigilator/);
});

test("autoAssign: prefers the person with fewer duties", () => {
  const history = [
    { invigilator: "INV-0001-0004", exam: "EXM-0001-0002", hall: "Hall B", position: 1, date: "2026-10-20", slot: "09:00-12:00" },
    { invigilator: "INV-0001-0004", exam: "EXM-0001-0003", hall: "Hall B", position: 1, date: "2026-10-21", slot: "09:00-12:00" }
  ];
  const small = { ...exam, seatMap: { "Hall C": exam.seatMap["Hall C"] } };  // 1 position

  const { duties } = autoAssign(small, [invigilators[3], invigilators[4]], history);
  assert.strictEqual(duties[0].invigilator, "INV-0001-0005");
});

/* ---------------- edge cases ---------------- */

test("edge: dynamic order fills a case static ordering can miss", () => {
  // H1 can take a/b, H2 can take b/c, H3 can take a/c (through own-subject rules)
  const tri = {
    examId: "EXM-T",
    date: "2026-11-01",
    slot: "09:00-12:00",
    seatMap: { H1: hall(1, 1, 1, "S3"), H2: hall(1, 1, 1, "S1"), H3: hall(1, 1, 1, "S2") }
  };
  const people = [
    { invId: "a", subjects: ["S1"] },  // can't take H2
    { invId: "b", subjects: ["S2"] },  // can't take H3
    { invId: "c", subjects: ["S3"] }   // can't take H1
  ];

  for (let i = 0; i < 20; i++) {       // ties are random, so try many times
    const { unfilled } = autoAssign(tri, people);
    assert.strictEqual(unfilled.length, 0);
  }
});

test("edge: empty hall and empty seat map give no positions", () => {
  assert.strictEqual(getPositions({ seatMap: { X: hall(3, 3, 0, "S") } }).length, 0);
  assert.strictEqual(getPositions({ seatMap: {} }).length, 0);
  assert.strictEqual(getPositions({}).length, 0);
});

test("edge: no invigilators at all → everything unfilled, no crash", () => {
  const { duties, unfilled } = autoAssign(exam, []);
  assert.strictEqual(duties.length, 0);
  assert.strictEqual(unfilled.length, 3);
});

test("edge: daily limit counts duties from other exams the same day", () => {
  const sameDay = [
    { invigilator: "INV-0001-0004", exam: "EXM-X", hall: "H", position: 1, date: exam.date, slot: "14:00-17:00" },
    { invigilator: "INV-0001-0004", exam: "EXM-Y", hall: "H", position: 1, date: exam.date, slot: "17:00-19:00" }
  ];
  const posA = getPositions(exam)[0];
  assert.strictEqual(canInvigilate(invigilators[3], exam, posA, sameDay).code, "dailyLimit");
});

test("edge: re-running replaces this exam's old duties instead of stacking", () => {
  const first = autoAssign(exam, invigilators).duties;
  const second = autoAssign(exam, invigilators, first).duties;
  assert.strictEqual(second.length, 3);  // not blocked by its own earlier duties
});

test("edge: missing subjects/unavailable fields don't crash", () => {
  const bare = [{ invId: "x" }, { invId: "y" }, { invId: "z" }];
  const { duties } = autoAssign(exam, bare);
  assert.strictEqual(duties.length, 3);
});