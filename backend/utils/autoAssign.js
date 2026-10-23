/* =========================================================
   ExamMatrix — INVIGILATOR AUTO-ASSIGN
   ---------------------------------------------------------
   Built the same way as the seating algorithm:
     hall positions  ~ students
     invigilators    ~ seats
     canInvigilate() ~ fits()
     hardest first   ~ buildQueue() (biggest subject first)

   Pure functions: no database, no Express.
   The route loads the data, calls autoAssign(), then saves
   the returned duties.

   Data shapes
     exam:         { examId, date: "YYYY-MM-DD", slot: "09:00-12:00",
                     seatMap: { hallNo: [[ { roll, code } | null ]] } }
     invigilator:  { invId, subjects: [codes], unavailable: ["YYYY-MM-DD"] }
     duty:         { invigilator: invId, exam: examId, hall, position, date, slot }
   ========================================================= */

const DEFAULT_RULES = {
  studentsPerInvigilator: 30,  // 1 invigilator per 30 students, at least 1 per hall
  noOwnSubject: true,          // can't invigilate a hall writing a subject you teach
  maxDutiesPerDay: 2
};

/* ---- how many students sit in a hall, and which subject codes they write ---- */
function hallSummary(seatMap, hallNo) {
  const grid = seatMap[hallNo] || [];
  const codes = new Set();
  let students = 0;

  for (const row of grid) {
    for (const cell of row || []) {
      if (cell) {
        students++;
        codes.add(cell.code);
      }
    }
  }
  return { students, codes: [...codes] };
}

/* ---- STEP 1: every invigilator position the exam needs ----
   e.g. Hall A (40 students) → Hall A #1, Hall A #2
        Hall C (10 students) → Hall C #1                     */
function getPositions(exam, rules = DEFAULT_RULES) {
  const positions = [];
  const seatMap = (exam && exam.seatMap) || {};

  for (const hallNo of Object.keys(seatMap)) {
    const { students, codes } = hallSummary(seatMap, hallNo);
    if (students === 0) continue;

    const need = Math.max(1, Math.ceil(students / rules.studentsPerInvigilator));
    for (let p = 1; p <= need; p++) {
      positions.push({ hall: hallNo, position: p, students, codes });
    }
  }
  return positions;
}

/* ---- how many duties a person already has (used for fairness) ---- */
function countDuties(invId, duties) {
  return duties.filter(d => d.invigilator === invId).length;
}

/* ---- STEP 2: the rule check, like fits() in seating ----
   returns { ok: true }  or  { ok: false, code, reason }     */
function canInvigilate(person, exam, position, duties, rules = DEFAULT_RULES) {
  // 1. unavailable that day
  if ((person.unavailable || []).includes(exam.date)) {
    return { ok: false, code: "unavailable", reason: "Unavailable on " + exam.date };
  }

  const theirs = duties.filter(d => d.invigilator === person.invId);

  // 2. already on duty in the same date + slot (any exam)
  const sameSlot = theirs.find(d => d.date === exam.date && d.slot === exam.slot);
  if (sameSlot) {
    const reason = sameSlot.exam === exam.examId
      ? "Already in " + sameSlot.hall
      : "On duty for " + sameSlot.exam + " in this slot";
    return { ok: false, code: "busy", reason };
  }

  // 3. teaches a subject being written in this hall
  if (rules.noOwnSubject) {
    const taught = (person.subjects || []).find(c => position.codes.includes(c));
    if (taught) {
      return { ok: false, code: "ownSubject", reason: "Teaches " + taught };
    }
  }

  // 4. daily limit reached
  const thatDay = theirs.filter(d => d.date === exam.date).length;
  if (thatDay >= rules.maxDutiesPerDay) {
    return { ok: false, code: "dailyLimit", reason: "Already has " + thatDay + " duties that day" };
  }

  return { ok: true };
}

/* ---- why nobody could take a position ----
   e.g. "No eligible invigilator: 2 teach this subject, 3 already on duty" */
function explainUnfilled(invigilators, exam, position, duties, rules) {
  const labels = {
    unavailable: "unavailable",
    busy: "already on duty",
    ownSubject: "teach this subject",
    dailyLimit: "at daily limit"
  };
  const counts = {};

  for (const person of invigilators) {
    const check = canInvigilate(person, exam, position, duties, rules);
    if (!check.ok) counts[check.code] = (counts[check.code] || 0) + 1;
  }

  const parts = Object.keys(counts).map(code => counts[code] + " " + labels[code]);
  return "No eligible invigilator" + (parts.length ? ": " + parts.join(", ") : "");
}

/* ---- STEPS 3–5: assign invigilators to every position ----
   options.rules  → override any DEFAULT_RULES
   options.random → custom random function (handy for tests)
   returns { duties, unfilled, stats }                        */
function autoAssign(exam, invigilators, existingDuties = [], options = {}) {
  const rules = { ...DEFAULT_RULES, ...(options.rules || {}) };
  const random = options.random || Math.random;

  // re-running auto-assign replaces this exam's old duties
  const working = existingDuties.filter(d => d.exam !== exam.examId);

  const remaining = getPositions(exam, rules);
  const duties = [];
  const unfilled = [];

  // STEP 3 + 4: after EVERY assignment, pick the position with the fewest
  // eligible people right now (ties → bigger hall), then fill it
  while (remaining.length > 0) {
    let hardestIndex = 0;
    let hardestCandidates = null;

    remaining.forEach((pos, i) => {
      const candidates = invigilators.filter(p => canInvigilate(p, exam, pos, working, rules).ok);
      const isHarder =
        hardestCandidates === null ||
        candidates.length < hardestCandidates.length ||
        (candidates.length === hardestCandidates.length && pos.students > remaining[hardestIndex].students);

      if (isHarder) {
        hardestIndex = i;
        hardestCandidates = candidates;
      }
    });

    const pos = remaining.splice(hardestIndex, 1)[0];

    // nobody can take it → report it, never break a rule
    if (hardestCandidates.length === 0) {
      unfilled.push({
        hall: pos.hall,
        position: pos.position,
        reason: explainUnfilled(invigilators, exam, pos, working, rules)
      });
      continue;
    }

    // least-busy eligible person; random on a tie
    const fewest = Math.min(...hardestCandidates.map(p => countDuties(p.invId, working)));
    const tied = hardestCandidates.filter(p => countDuties(p.invId, working) === fewest);
    const pick = tied[Math.floor(random() * tied.length)];

    const duty = {
      invigilator: pick.invId,
      exam: exam.examId,
      hall: pos.hall,
      position: pos.position,
      date: exam.date,
      slot: exam.slot
    };
    duties.push(duty);
    working.push(duty);  // they're now busy for the next positions
  }

  // STEP 5: return in a readable order
  const byHall = (a, b) => a.hall.localeCompare(b.hall) || a.position - b.position;
  duties.sort(byHall);
  unfilled.sort(byHall);

  return {
    duties,
    unfilled,
    stats: {
      positions: duties.length + unfilled.length,
      filled: duties.length,
      unfilled: unfilled.length
    }
  };
}

module.exports = { DEFAULT_RULES, getPositions, canInvigilate, countDuties, autoAssign };