/* =========================================================
   ExamMatrix — INVIGILATOR IMPORT
   ---------------------------------------------------------
   Turns validated upload rows into what the upload route saves.
   No database here: the route does the saving.

   prepareInvigilators(rows, existing, university, deps?)
     rows:      validateRows("invigilators", ...).rows
                [{ status: "new" | "update" | "error", data: { name, email, department, subjects, unavailable } }]
     existing:  invigilators already in this university: [{ invId, email }]
     deps:      optional { nextId, hash, makePassword } (tests pass fakes)

   → { creates:     [{ invId, university, email, password: <bcrypt hash>, name, department, subjects, unavailable }],
       updates:     [{ invId, email, set: { name, department, subjects, unavailable } }],
       credentials: [{ invId, name, email, password: <plain, shown to the admin once> }],
       counts:      { added, updated, skipped } }
   ========================================================= */

const crypto = require("crypto");

// no 0/O, 1/l/I: easy to read out or type from a printout
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// e.g. "k7Qm-29Px"
function makePassword() {
  let out = "";
  for (let i = 0; i < 8; i++) out += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
  return out.slice(0, 4) + "-" + out.slice(4);
}

// "UNI-0001" → "INV-0001", so nextId gives INV-0001-0001, INV-0001-0002, ...
function invPrefix(university) {
  const match = /^UNI-(\d+)$/.exec(String(university || ""));
  if (!match) throw new Error("Bad university id: " + university);
  return "INV-" + match[1];
}

async function prepareInvigilators(rows, existing, university, deps = {}) {
  // real helpers unless a test passes fakes
  const nextId = deps.nextId || require("./idCounter").nextId;
  const hash = deps.hash || function (plain) { return require("bcrypt").hash(plain, 10); };
  const newPassword = deps.makePassword || makePassword;

  const prefix = invPrefix(university);
  const byEmail = new Map((existing || []).map(function (e) { return [String(e.email).toLowerCase(), e]; }));

  const creates = [];
  const updates = [];
  const credentials = [];
  let skipped = 0;

  // for...of + await keeps the IDs in the same order as the file
  for (const row of rows || []) {
    if (row.status === "error") { skipped++; continue; }

    const email = String(row.data.email).toLowerCase();
    const fields = {
      name: row.data.name,
      department: row.data.department,
      subjects: row.data.subjects || [],
      unavailable: row.data.unavailable || []
    };

    // already in this university → update details, keep INV ID + password
    const found = byEmail.get(email);
    if (found) {
      updates.push({ invId: found.invId, email: email, set: fields });
      continue;
    }

    // new → INV ID + temporary password (only the hash is saved)
    const invId = await nextId(prefix, 4);
    const plain = newPassword();
    creates.push({ invId: invId, university: university, email: email, password: await hash(plain), ...fields });
    credentials.push({ invId: invId, name: fields.name, email: email, password: plain });
    byEmail.set(email, { invId: invId, email: email });
  }

  return {
    creates: creates,
    updates: updates,
    credentials: credentials,
    counts: { added: creates.length, updated: updates.length, skipped: skipped }
  };
}

module.exports = { prepareInvigilators, makePassword, invPrefix, PASSWORD_CHARS };