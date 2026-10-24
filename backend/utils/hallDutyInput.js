/* =========================================================
   ExamMatrix — HALL DUTY INPUT CHECKS
   ---------------------------------------------------------
   Checks what an invigilator sends before anything is saved.
   Pure functions, no database. Throws AppError (400 / 404),
   which Express 5 passes to the error handler.

   checkAttendance(exam, body)  body = { hall, marks: [{ roll, status }] }
     → { hall, marks: [{ roll, status }] }      (cleaned, last mark wins)
   toAttendanceOps(marks, { university, exam, hall, markedBy })
     → operations for Attendance.bulkWrite (marking again updates)
   checkIncident(exam, body)    body = { hall, roll?, type, description }
     → { hall, roll, type, description }
   ========================================================= */

const { AppError } = require("../middleware/errorHandler");
const { INCIDENT_TYPES } = require("../models/Incident");

const STATUSES = ["present", "absent"];
const MAX_MARKS = 1000;        // biggest hall is 30 x 30 = 900 seats
const MAX_DESCRIPTION = 1000;  // same limit as the Incident model
const MAX_SHOWN_ERRORS = 5;

/* strings and numbers → trimmed text, anything else → "" */
function text(v) {
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
}

/* list every problem in one message, but keep it short */
function fail(errors) {
  const shown = errors.slice(0, MAX_SHOWN_ERRORS);
  if (errors.length > MAX_SHOWN_ERRORS) shown.push("and " + (errors.length - MAX_SHOWN_ERRORS) + " more");
  throw new AppError(400, shown.join("; "));
}

/* the seat grid for one hall; works for a plain object or a Mongoose Map.
   hasOwn stops names like "constructor" from reading built-in properties. */
function hallGrid(exam, hall) {
  const seatMap = exam && exam.seatMap;
  if (!seatMap) return null;
  const grid = seatMap instanceof Map ? seatMap.get(hall) : (Object.hasOwn(seatMap, hall) ? seatMap[hall] : null);
  return Array.isArray(grid) ? grid : null;
}

/* every roll seated in the hall, uppercased; null if nobody sits there */
function hallRolls(exam, hall) {
  const grid = hallGrid(exam, hall);
  if (!grid) return null;
  const rolls = new Set();
  for (const row of grid) {
    for (const cell of Array.isArray(row) ? row : []) {
      const roll = text(cell && cell.roll).toUpperCase();
      if (roll) rolls.add(roll);
    }
  }
  return rolls.size ? rolls : null;
}

function requireHall(exam, value) {
  const hall = text(value);
  if (!hall) throw new AppError(400, "hall is required");
  const rolls = hallRolls(exam, hall);
  if (!rolls) throw new AppError(404, hall + " is not part of this exam");
  return { hall, rolls };
}

function checkAttendance(exam, body) {
  const input = body && typeof body === "object" ? body : {};
  const { hall, rolls } = requireHall(exam, input.hall);

  const marks = input.marks;
  if (!Array.isArray(marks) || marks.length === 0) throw new AppError(400, "marks must be a non-empty list");
  if (marks.length > MAX_MARKS) throw new AppError(400, "Too many marks in one request (max " + MAX_MARKS + ")");

  const errors = [];
  const final = new Map(); // roll → status; a later mark for the same roll replaces the earlier one

  for (let i = 0; i < marks.length; i++) {
    const label = "Mark " + (i + 1);
    const mark = marks[i] && typeof marks[i] === "object" ? marks[i] : {};
    const roll = text(mark.roll).toUpperCase();
    const status = text(mark.status).toLowerCase();

    if (!roll) errors.push(label + ": roll is required");
    else if (!STATUSES.includes(status)) errors.push(label + ": status must be present or absent");
    else if (!rolls.has(roll)) errors.push(label + ": " + roll + " is not seated in " + hall);
    else final.set(roll, status);
  }

  if (errors.length) fail(errors); // one bad mark → nothing is saved
  return { hall, marks: [...final].map(([roll, status]) => ({ roll, status })) };
}

function toAttendanceOps(marks, { university, exam, hall, markedBy } = {}) {
  if (!university || !exam || !hall || !markedBy) {
    throw new Error("university, exam, hall and markedBy are required");
  }
  return (marks || []).map(function (m) {
    return {
      updateOne: {
        filter: { university, exam, roll: m.roll },
        update: { $set: { hall, status: m.status, markedBy } },
        upsert: true
      }
    };
  });
}

function checkIncident(exam, body) {
  const input = body && typeof body === "object" ? body : {};
  const { hall, rolls } = requireHall(exam, input.hall);
  const errors = [];

  // accept any capitalisation, save the exact name from the model
  const wanted = text(input.type).toLowerCase();
  const type = INCIDENT_TYPES.find((t) => t.toLowerCase() === wanted);
  if (!type) errors.push("type must be one of: " + INCIDENT_TYPES.join(", "));

  const description = text(input.description);
  if (!description) errors.push("description is required");
  else if (description.length > MAX_DESCRIPTION) errors.push("description can be at most " + MAX_DESCRIPTION + " characters");

  // roll is optional (e.g. "fan not working"), but if given it must be in this hall
  const roll = text(input.roll).toUpperCase();
  if (roll && !rolls.has(roll)) errors.push(roll + " is not seated in " + hall);

  if (errors.length) fail(errors);
  return { hall, roll, type, description };
}

module.exports = { checkAttendance, toAttendanceOps, checkIncident, hallRolls, STATUSES, MAX_MARKS };