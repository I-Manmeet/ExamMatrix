/* =========================================================
   ExamMatrix — DUTY BOARD (for the Assign Invigilators page)
   ---------------------------------------------------------
   Pure functions, no database. The duty routes load the data,
   call these, and send the result.

   buildBoard(exam, invigilators, duties, { rules, unfilled })
     → { exam, rules, invigilators, positions }   (the shape assign.js reads)

   checkSwap(exam, invigilators, duties, { hall, position, invId })
     → { ok: true, duty } | { ok: false, status, reason }
   ========================================================= */

const { DEFAULT_RULES, getPositions, canInvigilate, countDuties } = require("./autoAssign.js");

/* is this duty sitting in exactly this seat of this exam? */
function sameSeat(duty, examId, hall, position) {
  return duty.exam === examId && duty.hall === hall && duty.position === position;
}

/* every duty EXCEPT the one in this seat.
   Without this, the person already in Hall A #1 would be told
   "Already in Hall A" for their own seat. */
function othersDuties(duties, examId, hall, position) {
  return duties.filter(function (d) { return !sameSeat(d, examId, hall, position); });
}

/* canInvigilate gives { ok, code, reason }; the page only needs ok + reason */
function shortCheck(check) {
  return check.ok ? { ok: true } : { ok: false, reason: check.reason };
}

function sortedPositions(exam, rules) {
  return getPositions(exam, rules).sort(function (a, b) {
    return a.hall.localeCompare(b.hall) || a.position - b.position;
  });
}

function buildBoard(exam, invigilators, duties, options = {}) {
  const rules = { ...DEFAULT_RULES, ...(options.rules || {}) };
  const unfilled = options.unfilled || [];
  const allDuties = duties || [];

  const positions = sortedPositions(exam, rules).map(function (p) {
    // who is in this seat right now (this exam only)
    const current = allDuties.find(function (d) { return sameSeat(d, exam.examId, p.hall, p.position); });
    const assigned = current ? current.invigilator : null;

    // can each person take this seat? (checked without the seat's own duty)
    const others = othersDuties(allDuties, exam.examId, p.hall, p.position);
    const options = {};
    invigilators.forEach(function (person) {
      options[person.invId] = shortCheck(canInvigilate(person, exam, p, others, rules));
    });

    // reason from the last auto-assign, only if the seat is still empty
    const gap = unfilled.find(function (u) { return u.hall === p.hall && u.position === p.position; });

    return {
      hall: p.hall,
      position: p.position,
      students: p.students,
      codes: p.codes,
      assigned: assigned,
      unfilledReason: !assigned && gap ? gap.reason : "",
      options: options
    };
  });

  return {
    exam: { examId: exam.examId, examName: exam.examName, date: exam.date, slot: exam.slot },
    rules: rules,
    invigilators: invigilators.map(function (i) {
      return { invId: i.invId, name: i.name, department: i.department, duties: countDuties(i.invId, allDuties) };
    }),
    positions: positions
  };
}

function checkSwap(exam, invigilators, duties, change, options = {}) {
  const rules = { ...DEFAULT_RULES, ...(options.rules || {}) };
  const allDuties = duties || [];
  const hall = change.hall;
  const position = Number(change.position); // may arrive as a string from req.body

  // 1. the seat must exist
  const seat = getPositions(exam, rules).find(function (p) { return p.hall === hall && p.position === position; });
  if (!seat) {
    return { ok: false, status: 404, reason: hall + " #" + position + " doesn't exist for this exam" };
  }

  // 2. clearing a seat is always allowed
  if (!change.invId) return { ok: true, duty: null };

  // 3. the person must exist
  const person = invigilators.find(function (i) { return i.invId === change.invId; });
  if (!person) return { ok: false, status: 404, reason: "Invigilator not found" };

  // 4. same rules as auto-assign (never trust the dropdown)
  const check = canInvigilate(person, exam, seat, othersDuties(allDuties, exam.examId, hall, position), rules);
  if (!check.ok) return { ok: false, status: 409, reason: check.reason };

  // 5. allowed: this is the duty the route saves
  return {
    ok: true,
    duty: { invigilator: person.invId, exam: exam.examId, hall: hall, position: position, date: exam.date, slot: exam.slot }
  };
}

module.exports = { buildBoard, checkSwap };