const test = require("node:test");
const assert = require("node:assert");
const { DEFAULT_RULES } = require("../utils/autoAssign");
const { buildBoard, checkSwap } = require("../utils/dutyBoard");

/* ---------- fixture ---------- */

// a hall grid from a list of subject codes, 8 seats per row
function grid(codes) {
  const rows = [];
  codes.forEach(function (code, i) {
    if (i % 8 === 0) rows.push([]);
    rows[rows.length - 1].push({ roll: "R" + i, code: code });
  });
  return rows;
}
function many(code, n) { return Array(n).fill(code); }

const EXAM = {
  examId: "EXM-0001-0001",
  examName: "Mid Sem · Systems",
  date: "2026-10-27",
  slot: "09:00-12:00",
  // Hall C listed first on purpose: the board must sort halls
  seatMap: {
    "Hall C": grid(many("CS302", 10)),                              // 10 → 1 position
    "Hall A": grid(many("CS302", 20).concat(many("CS303", 20))),   // 40 → 2 positions
    "Hall Z": [[null, null]]                                        // empty → none
  }
};

const ANJALI = { invId: "INV-0001-0001", name: "Dr. Anjali Mehta",   department: "CSE",  subjects: [],        unavailable: [] };
const RAJIV  = { invId: "INV-0001-0002", name: "Prof. Rajiv Sharma", department: "CSE",  subjects: ["CS302"], unavailable: [] };
const NEHA   = { invId: "INV-0001-0003", name: "Dr. Neha Kapoor",    department: "Math", subjects: [],        unavailable: [] };
const ARNAB  = { invId: "INV-0001-0005", name: "Dr. Arnab Bose",     department: "CSE",  subjects: ["CS303"], unavailable: [] };
const DEEPA  = { invId: "INV-0001-0006", name: "Prof. Deepa Nair",   department: "Math", subjects: [],        unavailable: ["2026-10-27"] };
const PEOPLE = [ANJALI, RAJIV, NEHA, ARNAB, DEEPA];

function duty(person, examId, hall, position) {
  return { invigilator: person.invId, exam: examId, hall: hall, position: position, date: "2026-10-27", slot: "09:00-12:00" };
}

// Neha is busy in ANOTHER exam, same slot, and that hall happens to be called "Hall A" too
const NEHA_ELSEWHERE = duty(NEHA, "EXM-0001-0009", "Hall A", 1);
// Anjali is on duty in THIS exam, Hall C #1
const ANJALI_HERE = duty(ANJALI, EXAM.examId, "Hall C", 1);

function pos(board, hall, position) {
  return board.positions.find(function (p) { return p.hall === hall && p.position === position; });
}

/* ---------- buildBoard ---------- */

test("positions come from the seat map, sorted by hall, empty halls skipped", () => {
  const board = buildBoard(EXAM, PEOPLE, []);
  assert.deepStrictEqual(board.positions.map((p) => p.hall + "#" + p.position), ["Hall A#1", "Hall A#2", "Hall C#1"]);
  assert.strictEqual(pos(board, "Hall A", 1).students, 40);
  assert.deepStrictEqual(pos(board, "Hall A", 1).codes, ["CS302", "CS303"]);
  assert.strictEqual(pos(board, "Hall C", 1).students, 10);
});

test("exam summary has no seatMap, rules default to DEFAULT_RULES", () => {
  const board = buildBoard(EXAM, PEOPLE, []);
  assert.deepStrictEqual(board.exam, { examId: "EXM-0001-0001", examName: "Mid Sem · Systems", date: "2026-10-27", slot: "09:00-12:00" });
  assert.deepStrictEqual(board.rules, DEFAULT_RULES);
});

test("invigilators: 4 fields only, duty count across ALL exams, same order", () => {
  const board = buildBoard(EXAM, PEOPLE, [NEHA_ELSEWHERE, ANJALI_HERE]);
  assert.deepStrictEqual(board.invigilators[0], { invId: "INV-0001-0001", name: "Dr. Anjali Mehta", department: "CSE", duties: 1 });
  assert.deepStrictEqual(board.invigilators.map((i) => i.duties), [1, 0, 1, 0, 0]);
});

test("assigned comes only from THIS exam's duties", () => {
  const board = buildBoard(EXAM, PEOPLE, [NEHA_ELSEWHERE, ANJALI_HERE]);
  assert.strictEqual(pos(board, "Hall C", 1).assigned, "INV-0001-0001");
  assert.strictEqual(pos(board, "Hall A", 1).assigned, null); // Neha's "Hall A" is another exam
  assert.strictEqual(pos(board, "Hall A", 2).assigned, null);
});

test("options explain who can't take each position", () => {
  const board = buildBoard(EXAM, PEOPLE, [NEHA_ELSEWHERE, ANJALI_HERE]);
  const a1 = pos(board, "Hall A", 1).options;
  assert.deepStrictEqual(a1["INV-0001-0001"], { ok: false, reason: "Already in Hall C" });
  assert.deepStrictEqual(a1["INV-0001-0002"], { ok: false, reason: "Teaches CS302" });
  assert.deepStrictEqual(a1["INV-0001-0003"], { ok: false, reason: "On duty for EXM-0001-0009 in this slot" });
  assert.deepStrictEqual(a1["INV-0001-0005"], { ok: false, reason: "Teaches CS303" });
  assert.deepStrictEqual(a1["INV-0001-0006"], { ok: false, reason: "Unavailable on 2026-10-27" });

  const c1 = pos(board, "Hall C", 1).options;
  assert.deepStrictEqual(c1["INV-0001-0005"], { ok: true }); // Hall C only writes CS302
  assert.deepStrictEqual(c1["INV-0001-0002"], { ok: false, reason: "Teaches CS302" });
});

test("the person sitting in a position is allowed in that same position", () => {
  const board = buildBoard(EXAM, PEOPLE, [ANJALI_HERE]);
  assert.deepStrictEqual(pos(board, "Hall C", 1).options["INV-0001-0001"], { ok: true });
});

test("unfilledReason comes from options.unfilled, only for empty positions", () => {
  const board = buildBoard(EXAM, PEOPLE, [ANJALI_HERE], {
    unfilled: [
      { hall: "Hall A", position: 2, reason: "No eligible invigilator: 2 teach this subject" },
      { hall: "Hall C", position: 1, reason: "should be ignored, Hall C is assigned" }
    ]
  });
  assert.strictEqual(pos(board, "Hall A", 2).unfilledReason, "No eligible invigilator: 2 teach this subject");
  assert.strictEqual(pos(board, "Hall A", 1).unfilledReason, "");
  assert.strictEqual(pos(board, "Hall C", 1).unfilledReason, "");
});

test("duties for positions that no longer exist are ignored", () => {
  const stale = duty(ARNAB, EXAM.examId, "Hall A", 3); // Hall A only has #1 and #2
  const board = buildBoard(EXAM, PEOPLE, [stale]);
  assert.strictEqual(board.positions.length, 3);
  assert.strictEqual(pos(board, "Hall A", 1).assigned, null);
});

test("custom rules are merged over the defaults", () => {
  const board = buildBoard(EXAM, PEOPLE, [], { rules: { studentsPerInvigilator: 50 } });
  assert.strictEqual(board.rules.studentsPerInvigilator, 50);
  assert.strictEqual(board.rules.maxDutiesPerDay, 2);
  assert.strictEqual(board.positions.filter((p) => p.hall === "Hall A").length, 1);
});

test("an exam with no seat map gives no positions and doesn't crash", () => {
  const board = buildBoard({ examId: "EXM-0001-0002", examName: "X", date: "2026-10-28", slot: "09:00-12:00" }, PEOPLE, []);
  assert.deepStrictEqual(board.positions, []);
  assert.strictEqual(board.invigilators.length, 5);
});

/* ---------- checkSwap ---------- */

test("checkSwap: an allowed pick returns the duty to save", () => {
  const out = checkSwap(EXAM, PEOPLE, [], { hall: "Hall C", position: 1, invId: "INV-0001-0005" });
  assert.deepStrictEqual(out, {
    ok: true,
    duty: { invigilator: "INV-0001-0005", exam: "EXM-0001-0001", hall: "Hall C", position: 1, date: "2026-10-27", slot: "09:00-12:00" }
  });
});

test("checkSwap: breaking a rule gives 409 with the reason", () => {
  const out = checkSwap(EXAM, PEOPLE, [], { hall: "Hall C", position: 1, invId: "INV-0001-0002" });
  assert.deepStrictEqual(out, { ok: false, status: 409, reason: "Teaches CS302" });
});

test("checkSwap: someone already in another hall of this exam gives 409", () => {
  const out = checkSwap(EXAM, PEOPLE, [duty(ANJALI, EXAM.examId, "Hall A", 1)], { hall: "Hall C", position: 1, invId: "INV-0001-0001" });
  assert.deepStrictEqual(out, { ok: false, status: 409, reason: "Already in Hall A" });
});

test("checkSwap: picking the person who is already in that position is fine", () => {
  const out = checkSwap(EXAM, PEOPLE, [ANJALI_HERE], { hall: "Hall C", position: 1, invId: "INV-0001-0001" });
  assert.strictEqual(out.ok, true);
});

test("checkSwap: a position that doesn't exist gives 404", () => {
  const out = checkSwap(EXAM, PEOPLE, [], { hall: "Hall C", position: 2, invId: "INV-0001-0005" });
  assert.deepStrictEqual(out, { ok: false, status: 404, reason: "Hall C #2 doesn't exist for this exam" });
});

test("checkSwap: an unknown invigilator gives 404", () => {
  const out = checkSwap(EXAM, PEOPLE, [], { hall: "Hall C", position: 1, invId: "INV-9999-9999" });
  assert.deepStrictEqual(out, { ok: false, status: 404, reason: "Invigilator not found" });
});

test("checkSwap: clearing a position (no invId) is always allowed", () => {
  assert.deepStrictEqual(checkSwap(EXAM, PEOPLE, [ANJALI_HERE], { hall: "Hall C", position: 1, invId: null }), { ok: true, duty: null });
  assert.deepStrictEqual(checkSwap(EXAM, PEOPLE, [ANJALI_HERE], { hall: "Hall C", position: 1, invId: "" }), { ok: true, duty: null });
});