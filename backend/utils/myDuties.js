/* =========================================================
   ExamMatrix — MY DUTIES (invigilator dashboard)
   ---------------------------------------------------------
   Pure function used by GET /api/invigilators/me/duties. No database.

   toMyDuties(duties, hallmates, myId)
     duties:    this invigilator's Duty docs, exam populated
                (examId, examName, subjects, seatMap)
     hallmates: every Duty doc of those exams, invigilator populated (name)
     myId:      the logged-in invigilator's _id
   → [{ id, exam: { examId, examName, subjects }, hall, position, date, slot,
        students, coInvigilators: [names] }]   soonest first
   ========================================================= */

// the seat grid of one hall; works for a plain object or a Mongoose Map
function hallGrid(seatMap, hall) {
  if (!seatMap) return [];
  if (seatMap instanceof Map) return seatMap.get(hall) || [];
  return Object.prototype.hasOwnProperty.call(seatMap, hall) ? seatMap[hall] || [] : [];
}

function countStudents(seatMap, hall) {
  let n = 0;
  for (const row of hallGrid(seatMap, hall)) {
    for (const cell of row || []) if (cell) n++;
  }
  return n;
}

function toMyDuties(duties, hallmates, myId) {
  const me = String(myId);
  // everyone else on duty in these exams (a deleted invigilator comes back as null)
  const others = (hallmates || []).filter((d) => d.invigilator && String(d.invigilator._id) !== me);

  return (duties || [])
    .filter((d) => d.exam)   // the exam was deleted
    .map((d) => ({
      id: String(d._id),
      exam: { examId: d.exam.examId, examName: d.exam.examName, subjects: d.exam.subjects || [] },
      hall: d.hall,
      position: Number(d.position),
      date: d.date,
      slot: d.slot,
      students: countStudents(d.exam.seatMap, d.hall),
      coInvigilators: others
        .filter((o) => String(o.exam) === String(d.exam._id) && o.hall === d.hall)
        .sort((a, b) => a.position - b.position)
        .map((o) => o.invigilator.name)
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) || a.hall.localeCompare(b.hall));
}

module.exports = { toMyDuties };