const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanExamId, readSwap } = require("../utils/dutyRequest");

test("exam ID is trimmed and uppercased", () => {
  assert.equal(cleanExamId("  exm-0001-0003 "), "EXM-0001-0003");
});

test("badly written or missing exam IDs are 404", () => {
  ["", "EXM-1-3", "EXM-0001-003", "exam_123", "EXM-0001-0003-1", null, undefined, 42, ["EXM-0001-0003"], {}].forEach((bad) => {
    assert.throws(() => cleanExamId(bad), { status: 404, message: "Exam not found" });
  });
});

test("a normal swap is cleaned", () => {
  assert.deepEqual(readSwap({ hall: "  Hall A ", position: 2, invId: " inv-0001-0007 " }),
    { hall: "Hall A", position: 2, invId: "INV-0001-0007" });
});

test("position sent as text is accepted", () => {
  assert.equal(readSwap({ hall: "Hall A", position: "3", invId: null }).position, 3);
});

test("bad positions are 400", () => {
  [0, -1, 1.5, "abc", "", "  ", null, undefined, true, [1], {}].forEach((bad) => {
    assert.throws(() => readSwap({ hall: "Hall A", position: bad }), {
      status: 400, message: "position must be a whole number from 1"
    });
  });
});

test("hall missing, blank, not text or too long", () => {
  [undefined, "", "   ", 5, ["Hall A"], {}].forEach((bad) => {
    assert.throws(() => readSwap({ hall: bad, position: 1 }), { status: 400, message: "hall is required" });
  });
  assert.throws(() => readSwap({ hall: "x".repeat(61), position: 1 }), { status: 400, message: "hall name is too long" });
  assert.equal(readSwap({ hall: "x".repeat(60), position: 1 }).hall.length, 60);
});

test("no invigilator means leave the seat empty", () => {
  [null, undefined, "", "   "].forEach((empty) => {
    assert.equal(readSwap({ hall: "Hall A", position: 1, invId: empty }).invId, null);
  });
});

test("a badly written invigilator ID is 400", () => {
  ["INV-1-7", "abc", 7, ["INV-0001-0007"], {}].forEach((bad) => {
    assert.throws(() => readSwap({ hall: "Hall A", position: 1, invId: bad }), {
      status: 400, message: "Invigilator IDs look like INV-0001-0007"
    });
  });
});

test("no body, or a body that isn't an object", () => {
  [null, undefined, "Hall A", ["Hall A", 1]].forEach((bad) => {
    assert.throws(() => readSwap(bad), { status: 400, message: "hall is required" });
  });
});

test("extra fields are dropped", () => {
  const out = readSwap({ hall: "Hall A", position: 1, invId: null, university: "UNI-0002", $where: "1" });
  assert.deepEqual(Object.keys(out).sort(), ["hall", "invId", "position"]);
});