const test = require("node:test");
const assert = require("node:assert");
const { validateExam, normalizeSlot, slotsOverlap, isRealDate } = require("../utils/validateExam");

const TODAY = "2026-10-24";
const good = {
  examName: "  Mid-Semester   Exam ",
  date: "2026-11-02",
  slot: "09:00–11:00",
  subjects: ["cs301", "CS302", "cs301"],
  halls: ["Hall A", " Hall B ", "Hall A"]
};

test("validateExam: cleans good input", function () {
  const { errors, value } = validateExam(good, TODAY);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(value, {
    examName: "Mid-Semester Exam",
    date: "2026-11-02",
    slot: "09:00-11:00",
    subjects: ["CS301", "CS302"],
    halls: ["Hall A", "Hall B"]
  });
});

test("validateExam: today is allowed, yesterday is not", function () {
  assert.deepStrictEqual(validateExam({ ...good, date: TODAY }, TODAY).errors, []);
  assert.match(validateExam({ ...good, date: "2026-10-23" }, TODAY).errors[0], /past/);
});

test("validateExam: date more than 2 years ahead is refused", function () {
  assert.match(validateExam({ ...good, date: "2028-10-25" }, TODAY).errors[0], /2 years/);
});

test("validateExam: fake and badly written dates are refused", function () {
  ["2026-02-30", "02-11-2026", "", 20261102].forEach(function (date) {
    assert.match(validateExam({ ...good, date: date }, TODAY).errors[0], /valid exam date/);
  });
});

test("validateExam: name too short or missing", function () {
  assert.match(validateExam({ ...good, examName: "ab" }, TODAY).errors[0], /3 to 100/);
  assert.match(validateExam({ ...good, examName: undefined }, TODAY).errors[0], /3 to 100/);
});

test("validateExam: subjects and halls must be lists of text", function () {
  assert.match(validateExam({ ...good, subjects: "CS301" }, TODAY).errors[0], /subject/);
  assert.match(validateExam({ ...good, subjects: [{ $gt: "" }] }, TODAY).errors[0], /subject/);
  assert.match(validateExam({ ...good, halls: [] }, TODAY).errors[0], /hall/);
});

test("validateExam: too many subjects", function () {
  const many = Array.from({ length: 21 }, function (_, i) { return "S" + i; });
  assert.match(validateExam({ ...good, subjects: many }, TODAY).errors[0], /at most 20/);
});

test("validateExam: no body at all gives every error", function () {
  assert.strictEqual(validateExam(undefined, TODAY).errors.length, 5);
});

test("normalizeSlot: accepts dashes and single-digit hours", function () {
  assert.strictEqual(normalizeSlot("09:00–11:00"), "09:00-11:00");
  assert.strictEqual(normalizeSlot("9:00 - 11:30"), "09:00-11:30");
});

test("normalizeSlot: refuses impossible slots", function () {
  ["11:00-09:00", "10:00-10:00", "25:00-26:00", "09:60-10:00", "morning", 9].forEach(function (slot) {
    assert.strictEqual(normalizeSlot(slot), "");
  });
});

test("slotsOverlap: touching slots don't overlap", function () {
  assert.strictEqual(slotsOverlap("09:00-12:00", "11:00-13:00"), true);
  assert.strictEqual(slotsOverlap("09:00-11:00", "11:00-13:00"), false);
  assert.strictEqual(slotsOverlap("10:00-11:00", "09:00-12:00"), true);
});

test("isRealDate: leap years", function () {
  assert.strictEqual(isRealDate("2028-02-29"), true);
  assert.strictEqual(isRealDate("2027-02-29"), false);
});