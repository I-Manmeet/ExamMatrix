/* =========================================================
   ExamMatrix — INVIGILATOR LIST HELPERS
   ---------------------------------------------------------
   Pure functions used by routes/invigilators.js. No database.

   listFilter(university, q) → MongoDB filter (search with ?q=)
   cleanInvId(value)         → "INV-0001-0007" or 400
   toPublic(doc)             → only the fields the pages may see
   ========================================================= */

const { AppError } = require("../middleware/errorHandler");

const INV_FORMAT = /^INV-\d{4}-\d{4}$/;
const MAX_SEARCH = 50;

// asked from MongoDB; the password hash is never selected
const PUBLIC_FIELDS = "-_id invId name email department subjects unavailable";

/* "a.b" should search for the text a.b, not "a, any character, b" */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listFilter(university, q) {
  if (!university) throw new Error("university is required");
  const filter = { university };

  if (q === undefined) return filter;
  if (typeof q !== "string") throw new AppError(400, "Search must be text"); // ?q=a&q=b gives a list

  const text = q.trim();
  if (!text) return filter;
  if (text.length > MAX_SEARCH) throw new AppError(400, "Search can be at most " + MAX_SEARCH + " characters");

  const match = new RegExp(escapeRegex(text), "i");
  filter.$or = [{ name: match }, { email: match }, { invId: match }, { department: match }];
  return filter;
}

function cleanInvId(value) {
  const invId = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!INV_FORMAT.test(invId)) throw new AppError(400, "Invigilator IDs look like INV-0001-0007");
  return invId;
}

/* builds a fresh object, so a password or _id can never slip through */
function toPublic(doc) {
  return {
    invId: doc.invId,
    name: doc.name,
    email: doc.email,
    department: doc.department || "",
    subjects: doc.subjects || [],
    unavailable: doc.unavailable || []
  };
}

module.exports = { listFilter, cleanInvId, toPublic, escapeRegex, PUBLIC_FIELDS, MAX_SEARCH };