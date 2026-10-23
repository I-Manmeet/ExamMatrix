const test = require("node:test");
const assert = require("node:assert");
const { parseFile } = require("../utils/fileParser");
const { validateRows } = require("../utils/validators");

test("CSV headers in any style map to model fields", async () => {
  const csv = Buffer.from("Hall No,Rows,Cols\nHall A,5,8\nHall B,4,6\n");
  const rows = await parseFile(csv, "halls.csv");
  assert.deepStrictEqual(rows[0], { hallNo: "Hall A", rows: "5", cols: "8" });
});

test("halls: bad numbers and duplicates are errors, existing ones are updates", () => {
  const out = validateRows("halls", [
    { hallNo: "Hall A", rows: "5", cols: "8" },
    { hallNo: "Hall B", rows: "0", cols: "8" },
    { hallNo: "Hall A", rows: "5", cols: "8" }
  ], { existingKeys: new Set(["Hall A"]) });
  assert.deepStrictEqual(out.counts, { new: 0, update: 1, error: 2 });
});

test("students: unknown subject codes are errors", () => {
  const out = validateRows("students", [{ roll: "21cs001", name: "Asha", subjects: "CS301;XX999" }],
    { knownSubjects: new Set(["CS301"]) });
  assert.strictEqual(out.rows[0].status, "error");
  assert.strictEqual(out.rows[0].data.roll, "21CS001");
});

test("invigilators: email + dates are checked", () => {
  const out = validateRows("invigilators", [{ name: "Dr. A", email: "bad", department: "CSE", unavailable: "27-10-2026" }]);
  assert.strictEqual(out.rows[0].errors.length, 2);
});

test("JSON upload works", async () => {
  const json = Buffer.from(JSON.stringify([{ code: "cs301", name: "DBMS", dept: "CSE" }]));
  const rows = await parseFile(json, "subjects.json");
  assert.strictEqual(validateRows("subjects", rows).counts.new, 1);
});
