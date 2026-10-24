const test = require("node:test");
const assert = require("node:assert/strict");

const { listFilter, cleanInvId, toPublic, escapeRegex, MAX_SEARCH } = require("../utils/invigilatorList");

function fails(fn, status, message) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, status);
    if (message instanceof RegExp) assert.match(err.message, message);
    else assert.equal(err.message, message);
    return true;
  });
}

// ---------- listFilter ----------

test("no search: only this university", () => {
  assert.deepEqual(listFilter("UNI-0001"), { university: "UNI-0001" });
  assert.deepEqual(listFilter("UNI-0001", undefined), { university: "UNI-0001" });
});

test("blank search gives the full list", () => {
  for (const q of ["", "   ", "\t"]) {
    assert.deepEqual(listFilter("UNI-0001", q), { university: "UNI-0001" });
  }
});

test("search looks at name, email, INV id and department, any case", () => {
  const filter = listFilter("UNI-0001", "  anjali ");
  assert.equal(filter.university, "UNI-0001");
  assert.deepEqual(filter.$or.map((c) => Object.keys(c)[0]), ["name", "email", "invId", "department"]);
  const match = filter.$or[0].name;
  assert.ok(match.test("Dr. Anjali Mehta"));
  assert.ok(match.test("ANJALI"));
  assert.ok(!match.test("Suresh"));
});

test("symbols are plain text: no crash, no match-everything", () => {
  const dot = listFilter("UNI-0001", "a.b").$or[0].name;
  assert.ok(dot.test("a.b"));
  assert.ok(!dot.test("axb"));
  assert.doesNotThrow(() => listFilter("UNI-0001", "("));
  assert.ok(!listFilter("UNI-0001", ".*").$or[0].name.test("anything"));
});

test("search can never widen to another university", () => {
  assert.equal(listFilter("UNI-0001", "UNI-0002").university, "UNI-0001");
});

test("non-text search is refused (?q=a&q=b, objects)", () => {
  fails(() => listFilter("UNI-0001", ["a", "b"]), 400, "Search must be text");
  fails(() => listFilter("UNI-0001", { $ne: "" }), 400, "Search must be text");
});

test("search over 50 characters refused, exactly 50 allowed", () => {
  fails(() => listFilter("UNI-0001", "a".repeat(MAX_SEARCH + 1)), 400, /at most 50/);
  assert.ok(listFilter("UNI-0001", "a".repeat(MAX_SEARCH)).$or);
});

test("a missing university is a programming error", () => {
  assert.throws(() => listFilter(undefined), /university is required/);
  assert.throws(() => listFilter("", "x"), /university is required/);
});

// ---------- cleanInvId ----------

test("INV id is trimmed and uppercased", () => {
  assert.equal(cleanInvId(" inv-0001-0007 "), "INV-0001-0007");
  assert.equal(cleanInvId("INV-0001-0007"), "INV-0001-0007");
});

test("badly formatted INV ids are 400", () => {
  for (const bad of ["hello", "me", "INV-1-7", "INV-0001-00071", "INV-0001-0007x", "", undefined, 1234, null]) {
    fails(() => cleanInvId(bad), 400, "Invigilator IDs look like INV-0001-0007");
  }
});

// ---------- toPublic ----------

test("only public fields leave the server", () => {
  const doc = {
    _id: "6718f0",
    __v: 0,
    university: "UNI-0001",
    password: "$2b$10$hash",
    invId: "INV-0001-0001",
    name: "Dr. Anjali Mehta",
    email: "anjali.mehta@demo-uni.edu",
    department: "Computer Science",
    subjects: ["CS301"],
    unavailable: ["2026-10-27"],
    createdAt: new Date()
  };
  assert.deepEqual(toPublic(doc), {
    invId: "INV-0001-0001",
    name: "Dr. Anjali Mehta",
    email: "anjali.mehta@demo-uni.edu",
    department: "Computer Science",
    subjects: ["CS301"],
    unavailable: ["2026-10-27"]
  });
});

test("old records without department or lists don't crash", () => {
  assert.deepEqual(toPublic({ invId: "INV-0001-0002", name: "A", email: "a@b.co" }), {
    invId: "INV-0001-0002", name: "A", email: "a@b.co", department: "", subjects: [], unavailable: []
  });
});

test("escapeRegex covers every special character", () => {
  const special = ".*+?^${}()|[]\\";
  assert.ok(new RegExp("^" + escapeRegex(special) + "$").test(special));
});