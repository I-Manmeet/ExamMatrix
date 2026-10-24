/* =========================================================
   ExamMatrix — EXAM INPUT CHECKS
   validateExam(body, today?) → { errors: [...], value: { examName, date, slot, subjects, halls } }
   slotsOverlap("09:00-12:00", "11:00-13:00") → true
========================================================= */

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_FORMAT = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;
const MAX_SUBJECTS = 20;
const MAX_HALLS = 50;

// today's date in India as YYYY-MM-DD (Render's server clock is UTC)
function todayInIndia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// "2026-02-30" looks right but isn't a real day
function isRealDate(s) {
  if (!DATE_FORMAT.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// "09:00–11:00" or "9:00 - 11:00" → "09:00-11:00"; "" if it isn't a real slot
function normalizeSlot(value) {
  if (typeof value !== "string") return "";
  const m = /^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return "";
  const [sh, sm, eh, em] = m.slice(1).map(Number);
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return "";
  if (eh * 60 + em <= sh * 60 + sm) return "";   // must end after it starts
  const pad = function (n) { return String(n).padStart(2, "0"); };
  return pad(sh) + ":" + pad(sm) + "-" + pad(eh) + ":" + pad(em);
}

function slotMinutes(slot) {
  const m = SLOT_FORMAT.exec(slot);
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

// 09:00-12:00 and 11:00-13:00 overlap · 09:00-11:00 and 11:00-13:00 don't
function slotsOverlap(a, b) {
  const [aStart, aEnd] = slotMinutes(a);
  const [bStart, bEnd] = slotMinutes(b);
  return aStart < bEnd && bStart < aEnd;
}

// a list of plain text items, trimmed and without repeats; null if it isn't one
function cleanList(value, upperCase) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") return null;   // blocks { "$gt": "" } and other tricks
    let v = item.trim();
    if (upperCase) v = v.toUpperCase();
    if (v && v.length <= 40 && !out.includes(v)) out.push(v);
  }
  return out;
}

function validateExam(body, today = todayInIndia()) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const errors = [];

  const examName = typeof b.examName === "string" ? b.examName.trim().replace(/\s+/g, " ") : "";
  if (examName.length < 3 || examName.length > 100) errors.push("Exam name must be 3 to 100 characters");

  const date = typeof b.date === "string" ? b.date.trim() : "";
  const latest = (Number(today.slice(0, 4)) + 2) + today.slice(4);
  if (!isRealDate(date)) errors.push("Pick a valid exam date");
  else if (date < today) errors.push("The exam date can't be in the past");
  else if (date > latest) errors.push("The exam date can be at most 2 years ahead");

  const slot = normalizeSlot(b.slot);
  if (!slot) errors.push("Pick a valid slot, like 09:00-12:00");

  const subjects = cleanList(b.subjects, true);
  if (!subjects || subjects.length === 0) errors.push("Pick at least one subject");
  else if (subjects.length > MAX_SUBJECTS) errors.push("Pick at most " + MAX_SUBJECTS + " subjects");

  const halls = cleanList(b.halls, false);
  if (!halls || halls.length === 0) errors.push("Pick at least one hall");
  else if (halls.length > MAX_HALLS) errors.push("Pick at most " + MAX_HALLS + " halls");

  return { errors: errors, value: { examName, date, slot, subjects: subjects || [], halls: halls || [] } };
}

module.exports = { validateExam, normalizeSlot, slotsOverlap, isRealDate, todayInIndia };