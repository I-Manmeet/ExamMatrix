/* =========================================================
   ExamMatrix — DUTY REQUEST CHECKS
   ---------------------------------------------------------
   Pure functions used by routes/duties.js. No database.

   cleanExamId(value) → "EXM-0001-0003" or 404
   readSwap(body)     → { hall, position, invId | null } or 400
                        invId null = leave that seat empty
   ========================================================= */

const { AppError } = require("../middleware/errorHandler");
const { cleanInvId } = require("./invigilatorList");

const EXAM_ID = /^EXM-\d{4}-\d{4}$/;
const MAX_HALL = 60;

// a badly written ID can't belong to any exam, so it's a 404 like a missing one
function cleanExamId(value) {
  const id = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!EXAM_ID.test(id)) throw new AppError(404, "Exam not found");
  return id;
}

function readSwap(body) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const hall = typeof b.hall === "string" ? b.hall.trim() : "";
  if (!hall) throw new AppError(400, "hall is required");
  if (hall.length > MAX_HALL) throw new AppError(400, "hall name is too long");

  // "2" from a form is fine; 1.5, 0, "abc" and true are not
  const position = typeof b.position === "string" && b.position.trim() !== "" ? Number(b.position) : b.position;
  if (! Number.isInteger(position) || position < 1) throw new AppError(400, "position must be a whole number from 1");

  const empty = b.invId === null || b.invId === undefined || (typeof b.invId === "string" && b.invId.trim() === "");
  return { hall, position, invId: empty ? null : cleanInvId(b.invId) };
}

module.exports = { cleanExamId, readSwap };