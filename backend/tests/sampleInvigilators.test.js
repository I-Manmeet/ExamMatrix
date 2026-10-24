const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { parseFile } = require("../utils/fileParser");
const { validateRows } = require("../utils/validators");
const { prepareInvigilators } = require("../utils/invigilatorImport");

const FILE = path.join(__dirname, "..", "sample-data", "invigilators.csv");

// parse + validate the real sample file
async function loadSample(existingKeys) {
  const rows = await parseFile(fs.readFileSync(FILE), "invigilators.csv");
  return validateRows("invigilators", rows, { existingKeys });
}

// parse + validate a CSV written inside the test
async function loadCsv(text, filename = "test.csv") {
  const rows = await parseFile(Buffer.from(text, "utf8"), filename);
  return validateRows("invigilators", rows);
}

// fake ids and hashing so no database is needed
function fakeDeps() {
  let n = 0;
  return {
    nextId: async (prefix) => prefix + "-" + String(++n).padStart(4, "0"),
    hash: async (plain) => "hashed:" + plain,
    makePassword: () => "test-pass"
  };
}

function rowNo(rows, n) {
  return rows.find((r) => r.rowNo === n);
}

// ---------- the sample file ----------

test("sample file: 7 valid rows, 3 error rows, blank line ignored", async () => {
  const { rows, counts } = await loadSample();
  assert.equal(rows.length, 10);
  assert.deepEqual(counts, { new: 7, update: 0, error: 3 });
});

test("bad email and DD-MM-YYYY date are both reported", async () => {
  const { rows } = await loadSample();
  const bad = rowNo(rows, 9);
  assert.equal(bad.status, "error");
  assert.equal(bad.errors.length, 2);
  assert.match(bad.errors.join(" | "), /valid email/);
  assert.match(bad.errors.join(" | "), /YYYY-MM-DD: 27-10-2026/);
});

test("blank name and space-only department are both reported", async () => {
  const { rows } = await loadSample();
  const bad = rowNo(rows, 10);
  assert.equal(bad.status, "error");
  assert.deepEqual(bad.errors, ["name is required", "department is required"]);
});

test("same email in a different case is a duplicate", async () => {
  const { rows } = await loadSample();
  const dup = rowNo(rows, 11);
  assert.equal(dup.status, "error");
  assert.deepEqual(dup.errors, ["Duplicate of row 2 in this file"]);
  assert.equal(rowNo(rows, 2).status, "new"); // the first one is still fine
});

test("values are trimmed, unquoted, uppercased and lowercased", async () => {
  const { rows } = await loadSample();
  assert.deepEqual(rowNo(rows, 2).data.subjects, ["CS301", "CS302"]);
  assert.deepEqual(rowNo(rows, 4).data.subjects, ["IT201"]); // "it201 ; "
  assert.deepEqual(rowNo(rows, 6).data.subjects, []);
  assert.deepEqual(rowNo(rows, 6).data.unavailable, []);
  assert.equal(rowNo(rows, 7).data.name, "Dr. Neha Gupta"); // quotes removed
  assert.equal(rowNo(rows, 8).data.email, "vikram.singh@demo-uni.edu");
  assert.deepEqual(rowNo(rows, 8).data.unavailable, ["2026-10-27", "2026-10-28"]);
});

// ---------- import ----------

test("import: 7 new invigilators with INV ids, error rows skipped", async () => {
  const { rows } = await loadSample();
  const result = await prepareInvigilators(rows, [], "UNI-0001", fakeDeps());

  assert.deepEqual(result.counts, { added: 7, updated: 0, skipped: 3 });
  assert.equal(result.creates[0].invId, "INV-0001-0001");
  assert.equal(result.creates[6].invId, "INV-0001-0007");
  assert.equal(new Set(result.creates.map((c) => c.invId)).size, 7); // no repeats
  assert.ok(result.creates.every((c) => c.university === "UNI-0001"));
  assert.equal(result.credentials.length, 7);
});

test("import: plain password is only in credentials, never saved", async () => {
  const { rows } = await loadSample();
  const result = await prepareInvigilators(rows, [], "UNI-0001", fakeDeps());

  assert.ok(result.creates.every((c) => c.password === "hashed:test-pass"));
  assert.ok(result.credentials.every((c) => c.password === "test-pass"));
});

test("import: someone already saved is updated, keeps their id, gets no new password", async () => {
  const existing = [{ invId: "INV-0001-0042", email: "Suresh.Iyer@demo-uni.edu" }];
  const { rows, counts } = await loadSample(new Set(["suresh.iyer@demo-uni.edu"]));
  assert.equal(counts.update, 1);

  const result = await prepareInvigilators(rows, existing, "UNI-0001", fakeDeps());

  assert.deepEqual(result.counts, { added: 6, updated: 1, skipped: 3 });
  assert.equal(result.updates[0].invId, "INV-0001-0042");
  assert.equal(result.updates[0].set.password, undefined);
  assert.deepEqual(result.updates[0].set.unavailable, ["2026-10-28"]);
  assert.ok(result.credentials.every((c) => c.email !== "suresh.iyer@demo-uni.edu"));
  assert.ok(result.creates.every((c) => c.email !== "suresh.iyer@demo-uni.edu"));
});

// ---------- file format ----------

test("Excel-style CSV: BOM, Windows line endings, capitalised headers", async () => {
  const csv = "\uFEFFName,Email,Department,Subjects,Unavailable\r\n" +
              "Dr. Test,test@demo-uni.edu,Physics,ph101,2026-10-27\r\n";
  const { rows, counts } = await loadCsv(csv);
  assert.deepEqual(counts, { new: 1, update: 0, error: 0 });
  assert.deepEqual(rows[0].data.subjects, ["PH101"]);
  assert.deepEqual(rows[0].data.unavailable, ["2026-10-27"]);
});

test("empty file is rejected", async () => {
  await assert.rejects(() => parseFile(Buffer.alloc(0), "invigilators.csv"), { message: "File is empty" });
});

test("file with only the header is rejected", async () => {
  await assert.rejects(() => loadCsv("name,email,department,subjects,unavailable\n"), { message: /no (data )?rows/ });
});

test(".txt file is rejected", async () => {
  await assert.rejects(() => loadCsv("name,email\nA,a@b.co\n", "invigilators.txt"), { message: /CSV/  });
});

test("a comma inside a name makes the row an error instead of saving wrong data", async () => {
  const csv = "name,email,department,subjects,unavailable\n" +
              "Iyer, Suresh,suresh@demo-uni.edu,Computer Science,,\n";
  const { rows } = await loadCsv(csv);
  assert.equal(rows[0].status, "error");
  assert.match(rows[0].errors.join(" | "), /valid email/);
});