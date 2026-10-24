/* =========================================================
   ExamMatrix — EXAM REPORT (for the Reports page)
   ---------------------------------------------------------
   Pure function, no database. The reports route loads the data,
   calls buildReport(), and sends the result.

   buildReport(exam, { duties, attendance, incidents, invigilators })
     exam:         { examId, examName, date, slot, seatMap }
     duties:       [ { invigilator: invId, exam: examId, hall, position } ]
     attendance:   [ { hall, roll, status: "present" | "absent" } ]
     incidents:    [ { id, hall, roll, type, description, reportedBy: invId, createdAt } ]
     invigilators: [ { invId, name } ]   (just to look up names)

   → { exam, halls, absent, incidents }   (the shape reports.js reads)
   ========================================================= */

function buildReport(exam, data = {}) {
  const duties = (data.duties || []).filter(function (d) { return !d.exam || d.exam === exam.examId; });
  const attendance = data.attendance || [];
  const incidents = data.incidents || [];
  const names = new Map((data.invigilators || []).map(function (i) { return [i.invId, i.name]; }));

  function person(invId) {
    return { invId: invId, name: names.get(invId) || invId };
  }

  /* 1. read the seat map once: who sits where, and how many per hall */
  const seatMap = exam.seatMap || {};
  const seats = new Map();      // "21CS001" → { hall, code }
  const studentsIn = {};        // "Hall A" → 40
  Object.keys(seatMap).forEach(function (hall) {
    studentsIn[hall] = 0;
    (seatMap[hall] || []).forEach(function (row) {
      (row || []).forEach(function (cell) {
        if (!cell) return;
        studentsIn[hall]++;
        seats.set(String(cell.roll).toUpperCase(), { hall: hall, code: cell.code });
      });
    });
  });

  /* 2. latest mark per seated student (others are ignored) */
  const status = new Map();     // "21CS001" → "present"
  attendance.forEach(function (a) {
    const roll = String(a.roll || "").toUpperCase();
    if (seats.has(roll)) status.set(roll, a.status);
  });

  /* 3. one row per non-empty hall */
  const halls = Object.keys(studentsIn)
    .filter(function (hall) { return studentsIn[hall] > 0; })
    .sort(function (a, b) { return a.localeCompare(b); })
    .map(function (hall) {
      let present = 0;
      let absent = 0;
      status.forEach(function (s, roll) {
        if (seats.get(roll).hall !== hall) return;
        if (s === "present") present++;
        else if (s === "absent") absent++;
      });

      const onDuty = duties
        .filter(function (d) { return d.hall === hall; })
        .sort(function (a, b) { return a.position - b.position; })
        .map(function (d) { return person(d.invigilator); });

      return { hall: hall, students: studentsIn[hall], present: present, absent: absent, invigilators: onDuty };
    });

  /* 4. absent students, by hall then roll */
  const absentList = [];
  status.forEach(function (s, roll) {
    if (s !== "absent") return;
    const seat = seats.get(roll);
    absentList.push({ roll: roll, hall: seat.hall, code: seat.code });
  });
  absentList.sort(function (a, b) { return a.hall.localeCompare(b.hall) || a.roll.localeCompare(b.roll); });

  /* 5. incidents, newest first */
  const incidentList = incidents
    .map(function (i) {
      return {
        id: String(i.id),
        hall: i.hall,
        roll: i.roll || "",
        type: i.type,
        description: i.description || "",
        reportedBy: person(i.reportedBy),
        createdAt: new Date(i.createdAt).toISOString()
      };
    })
    .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });

  return {
    exam: { examId: exam.examId, examName: exam.examName, date: exam.date, slot: exam.slot },
    halls: halls,
    absent: absentList,
    incidents: incidentList
  };
}

module.exports = { buildReport };