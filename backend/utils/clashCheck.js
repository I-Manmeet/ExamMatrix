/* =========================================================
   ExamMatrix — CLASH CHECKS
   ---------------------------------------------------------
   Pure functions (no database); routes/exams.js loads the data.
     students: [{ roll, subjects: ["CS301", ...] }]
     exams:    [{ examId, examName, slot, subjects, seatMap }]
========================================================= */

const { slotsOverlap } = require("./validateExam");
const { seatKey } = require("./seating");

// exams whose time overlaps this slot (the caller already picked the same day)
function overlappingExams(exams, slot) {
  return (exams || []).filter(function (e) { return slotsOverlap(e.slot, slot); });
}

// picked subjects that are already in an exam: Map("CS301" → { examId, examName })
function scheduledSubjects(exams, codes) {
  const out = new Map();
  for (const e of exams || []) {
    for (const code of e.subjects || []) {
      if (codes.includes(code) && !out.has(code)) out.set(code, { examId: e.examId, examName: e.examName });
    }
  }
  return out;
}

// students who take two or more of the picked subjects
function doubleBooked(students, codes) {
  const out = [];
  for (const s of students || []) {
    const mine = codes.filter(function (c) { return (s.subjects || []).includes(c); });
    if (mine.length > 1) out.push({ roll: s.roll, subjects: mine });
  }
  return out.sort(function (a, b) { return a.roll.localeCompare(b.roll); });
}

// every roll seated in these exams → the exam they sit
function seatedRolls(exams) {
  const out = new Map();
  for (const e of exams || []) {
    Object.values(e.seatMap || {}).forEach(function (grid) {
      (grid || []).forEach(function (row) {
        (row || []).forEach(function (cell) {
          if (cell && !out.has(cell.roll)) {
            out.set(cell.roll, { examId: e.examId, examName: e.examName, slot: e.slot });
          }
        });
      });
    });
  }
  return out;
}

// students of this exam who already sit another exam at the same time
function busyStudents(rolls, overlapping) {
  const seated = seatedRolls(overlapping);
  return rolls
    .filter(function (roll) { return seated.has(roll); })
    .sort()
    .map(function (roll) { return { roll: roll, ...seated.get(roll) }; });
}

// seats in these halls taken by overlapping exams: { "Hall A": { "0_3": "CS301" } }
function bookedSeats(overlapping, hallNos) {
  const reserved = {};
  for (const e of overlapping || []) {
    for (const hallNo of hallNos) {
      const grid = (e.seatMap || {})[hallNo];
      if (!grid) continue;
      reserved[hallNo] = reserved[hallNo] || {};
      grid.forEach(function (row, r) {
        (row || []).forEach(function (cell, c) {
          if (cell) reserved[hallNo][seatKey(r, c)] = cell.code;
        });
      });
    }
  }
  return reserved;
}

// "CS301|MA201" → rolls who take both (the Create Exam page greys these out)
function sharedStudents(students, codes) {
  const out = {};
  for (const s of students || []) {
    const mine = codes.filter(function (c) { return (s.subjects || []).includes(c); }).sort();
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const key = mine[i] + "|" + mine[j];
        (out[key] = out[key] || []).push(s.roll);
      }
    }
  }
  Object.values(out).forEach(function (list) { list.sort(); });
  return out;
}

// "a, b, c, d, e and 2 more", so error messages stay short
function listSome(items, format, max = 5) {
  const shown = items.slice(0, max).map(format).join(", ");
  return items.length > max ? shown + " and " + (items.length - max) + " more" : shown;
}

module.exports = {
  overlappingExams, scheduledSubjects, doubleBooked, seatedRolls,
  busyStudents, bookedSeats, sharedStudents, listSome
};