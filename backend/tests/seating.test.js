const test = require("node:test");
const assert = require("node:assert");
const { fits, buildQueue, freeSeats, countConflicts, solveSeating } = require("../utils/seating");

// n students for one subject: A-001, A-002, ...
function make(code, n) {
  return Array.from({ length: n }, function (_, i) {
    return { roll: code + "-" + String(i + 1).padStart(3, "0"), code: code };
  });
}

function seatsOf(seatMap, hallNo) {
  const out = [];
  seatMap[hallNo].forEach(function (row, r) {
    row.forEach(function (cell, c) { if (cell) out.push(r + "_" + c); });
  });
  return out;
}

test("fits: same subject in front/back/left/right is not safe", function () {
  const grid = [
    [null, { code: "A" }, null],
    [null, null, null]
  ];
  assert.strictEqual(fits(grid, 0, 0, "A"), false);   // right neighbour is A
  assert.strictEqual(fits(grid, 0, 0, "B"), true);    // different subject is fine
  assert.strictEqual(fits(grid, 1, 1, "A"), false);   // A in front
  assert.strictEqual(fits(grid, 1, 0, "A"), true);    // diagonal doesn't count
});

test("buildQueue: biggest subject first, then subjects take turns", function () {
  const queue = buildQueue([...make("C", 1), ...make("B", 2), ...make("A", 3)]);
  assert.deepStrictEqual(queue.map(function (s) { return s.code; }), ["A", "B", "C", "A", "B", "A"]);
});

test("buildQueue: same students in a different order give the same queue", function () {
  const students = [...make("A", 3), ...make("B", 3)];
  assert.deepStrictEqual(buildQueue(students), buildQueue([...students].reverse()));
});

test("solveSeating: one subject sits like a chessboard", function () {
  const result = solveSeating([{ hallNo: "H1", rows: 3, cols: 3 }], make("A", 5));
  assert.strictEqual(result.unplaced.length, 0);
  assert.deepStrictEqual(seatsOf(result.seatMap, "H1"), ["0_0", "0_2", "1_1", "2_0", "2_2"]);
  assert.strictEqual(result.stats.conflicts, 0);
});

test("solveSeating: two subjects can fill every seat", function () {
  const result = solveSeating([{ hallNo: "H1", rows: 2, cols: 2 }], [...make("A", 2), ...make("B", 2)]);
  assert.strictEqual(result.unplaced.length, 0);
  assert.strictEqual(result.stats.utilization, 100);
  assert.strictEqual(result.stats.conflicts, 0);
});

test("solveSeating: students who can't sit safely are returned as unplaced", function () {
  const result = solveSeating([{ hallNo: "H1", rows: 2, cols: 2 }], make("A", 3));
  assert.strictEqual(result.unplaced.length, 1);
  assert.strictEqual(result.stats.seated, 2);
});

test("solveSeating: overflows into the next hall", function () {
  const halls = [{ hallNo: "H1", rows: 1, cols: 1 }, { hallNo: "H2", rows: 1, cols: 1 }];
  const result = solveSeating(halls, make("A", 2));
  assert.strictEqual(result.unplaced.length, 0);
  assert.deepStrictEqual(Object.keys(result.seatMap), ["H1", "H2"]);
});

test("solveSeating: seats held by another exam are never used", function () {
  const reserved = { H1: { "0_1": "X" } };
  const result = solveSeating([{ hallNo: "H1", rows: 1, cols: 3 }], make("A", 2), reserved);
  assert.strictEqual(result.unplaced.length, 0);
  assert.strictEqual(result.seatMap.H1[0][1], null);
  assert.deepStrictEqual(seatsOf(result.seatMap, "H1"), ["0_0", "0_2"]);
});

test("solveSeating: halls nobody sits in are left out of the seat map", function () {
  const halls = [{ hallNo: "H1", rows: 2, cols: 2 }, { hallNo: "H2", rows: 2, cols: 2 }];
  const result = solveSeating(halls, [...make("A", 1), ...make("B", 1)]);
  assert.deepStrictEqual(Object.keys(result.seatMap), ["H1"]);
  assert.strictEqual(result.stats.hallsUsed, 1);
});

test("solveSeating: each seat is { roll, code } or null", function () {
  const result = solveSeating([{ hallNo: "H1", rows: 1, cols: 2 }], make("A", 1));
  assert.deepStrictEqual(result.seatMap.H1, [[{ roll: "A-001", code: "A" }, null]]);
});

test("freeSeats: takes out reserved seats", function () {
  const halls = [{ hallNo: "H1", rows: 2, cols: 3 }, { hallNo: "H2", rows: 1, cols: 2 }];
  assert.strictEqual(freeSeats(halls), 8);
  assert.strictEqual(freeSeats(halls, { H1: { "0_0": "X", "1_2": "Y" } }), 6);
});

test("countConflicts: finds same-subject neighbours", function () {
  const seatMap = { H1: [[{ roll: "1", code: "A" }, { roll: "2", code: "A" }], [null, { roll: "3", code: "B" }]] };
  assert.strictEqual(countConflicts(seatMap), 1);
});