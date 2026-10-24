const test = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const { prepareInvigilators, makePassword, invPrefix } = require("../utils/invigilatorImport");

/* fakes: counter starts at 7, hash just tags the text, passwords are predictable */
function fakeDeps() {
  const calls = [];
  let n = 7;
  let p = 1;
  return {
    calls: calls,
    nextId: async function (prefix, pad) { calls.push([prefix, pad]); return prefix + "-" + String(n++).padStart(pad, "0"); },
    hash: async function (plain) { return "hashed:" + plain; },
    makePassword: function () { return "pw-" + p++; }
  };
}

function row(status, data) {
  return { rowNo: 2, status: status, errors: status === "error" ? ["bad"] : [], data: data };
}

const NEHA = { name: "Dr. Neha Kapoor", email: "neha@uni.edu", department: "CSE", subjects: ["CS301"], unavailable: ["2026-10-28"] };
const RAJIV = { name: "Prof. Rajiv Sharma", email: "rajiv@uni.edu", department: "CSE", subjects: ["CS302"], unavailable: [] };
const ARNAB = { name: "Dr. Arnab Bose", email: "arnab@uni.edu", department: "CSE", subjects: [], unavailable: [] };

test("invPrefix turns UNI-0001 into INV-0001 and rejects bad ids", () => {
  assert.strictEqual(invPrefix("UNI-0001"), "INV-0001");
  assert.strictEqual(invPrefix("UNI-0042"), "INV-0042");
  assert.throws(() => invPrefix("bad"));
  assert.throws(() => invPrefix(undefined));
});

test("a new person gets an INV id, a hashed password and a credentials line", async () => {
  const deps = fakeDeps();
  const out = await prepareInvigilators([row("new", NEHA)], [], "UNI-0001", deps);

  assert.deepStrictEqual(out.creates, [{
    invId: "INV-0001-0007", university: "UNI-0001", email: "neha@uni.edu", password: "hashed:pw-1",
    name: "Dr. Neha Kapoor", department: "CSE", subjects: ["CS301"], unavailable: ["2026-10-28"]
  }]);
  assert.deepStrictEqual(out.credentials, [{ invId: "INV-0001-0007", name: "Dr. Neha Kapoor", email: "neha@uni.edu", password: "pw-1" }]);
  assert.deepStrictEqual(deps.calls, [["INV-0001", 4]]);
});

test("an existing email is updated: same INV id, no new password", async () => {
  const deps = fakeDeps();
  const out = await prepareInvigilators([row("update", RAJIV)], [{ invId: "INV-0001-0002", email: "rajiv@uni.edu" }], "UNI-0001", deps);

  assert.deepStrictEqual(out.updates, [{
    invId: "INV-0001-0002", email: "rajiv@uni.edu",
    set: { name: "Prof. Rajiv Sharma", department: "CSE", subjects: ["CS302"], unavailable: [] }
  }]);
  assert.deepStrictEqual(out.creates, []);
  assert.deepStrictEqual(out.credentials, []);
  assert.deepStrictEqual(deps.calls, []); // no INV id used up
});

test("matching existing emails ignores capital letters", async () => {
  const out = await prepareInvigilators([row("update", RAJIV)], [{ invId: "INV-0001-0002", email: "Rajiv@Uni.EDU" }], "UNI-0001", fakeDeps());
  assert.strictEqual(out.updates.length, 1);
  assert.strictEqual(out.creates.length, 0);
});

test("error rows are skipped and counted", async () => {
  const out = await prepareInvigilators([row("error", { name: "", email: "bad" }), row("new", NEHA)], [], "UNI-0001", fakeDeps());
  assert.deepStrictEqual(out.counts, { added: 1, updated: 0, skipped: 1 });
});

test("ids follow the order of the file", async () => {
  const out = await prepareInvigilators([row("new", NEHA), row("new", ARNAB)], [], "UNI-0001", fakeDeps());
  assert.deepStrictEqual(out.creates.map((c) => c.invId), ["INV-0001-0007", "INV-0001-0008"]);
  assert.deepStrictEqual(out.credentials.map((c) => c.email), ["neha@uni.edu", "arnab@uni.edu"]);
});

test("the plain password never ends up in what gets saved", async () => {
  const out = await prepareInvigilators([row("new", NEHA), row("update", RAJIV)], [{ invId: "INV-0001-0002", email: "rajiv@uni.edu" }], "UNI-0001", fakeDeps());
  assert.notStrictEqual(out.creates[0].password, out.credentials[0].password);
  assert.strictEqual("password" in out.updates[0].set, false);
});

test("makePassword: readable format, no look-alike characters, random", () => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const pw = makePassword();
    assert.match(pw, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    assert.doesNotMatch(pw, /[0O1lI]/);
    seen.add(pw);
  }
  assert.strictEqual(seen.size, 20);
});

test("with the real hash, bcrypt.compare accepts the temporary password", async () => {
  const deps = fakeDeps();
  const out = await prepareInvigilators([row("new", NEHA)], [], "UNI-0001", { nextId: deps.nextId, makePassword: () => "Test-Pass" });
  assert.notStrictEqual(out.creates[0].password, "Test-Pass");
  assert.strictEqual(await bcrypt.compare("Test-Pass", out.creates[0].password), true);
  assert.strictEqual(await bcrypt.compare("wrong", out.creates[0].password), false);
});

test("no rows: nothing to do", async () => {
  const out = await prepareInvigilators([], [], "UNI-0001", fakeDeps());
  assert.deepStrictEqual(out, { creates: [], updates: [], credentials: [], counts: { added: 0, updated: 0, skipped: 0 } });
});