/* =========================================================
   ExamMatrix — DUTY MAPPER
   ---------------------------------------------------------
   The database stores duties with ObjectId refs:
     { university, invigilator: ObjectId, exam: ObjectId, hall, position, date, slot }
   autoAssign / dutyBoard work with readable ids:
     { invigilator: "INV-0001-0001", exam: "EXM-0001-0001", hall, position, date, slot }
   These convert between the two. Pure functions, no database.

   toPlainDuties(docs)  → plain duties (docs need invigilator + exam populated)
   toDutyDocs(duties, { university, invigilators, exams }) → docs for Duty.insertMany
   ========================================================= */

const { AppError } = require("../middleware/errorHandler");

/* a populated ref → its readable id
   null means it was populated but the document has been deleted */
function readId(ref, field, label) {
  if (ref === null || ref === undefined) return null;
  if (typeof ref[field] === "string") return ref[field];
  throw new Error(label + ' is not populated; call .populate("' + label + '", "' + field + '") first');
}

function toPlainDuties(docs) {
  const plain = [];
  for (const doc of docs || []) {
    const invId = readId(doc.invigilator, "invId", "invigilator");
    const examId = readId(doc.exam, "examId", "exam");
    if (!invId || !examId) continue; // leftover duty for a deleted person or exam
    plain.push({
      invigilator: invId,
      exam: examId,
      hall: doc.hall,
      position: Number(doc.position),
      date: doc.date,
      slot: doc.slot
    });
  }
  return plain;
}

/* [{ _id, invId }] → Map(invId → _id) */
function idMap(list, key) {
  const map = new Map();
  for (const item of list || []) map.set(item[key], item._id);
  return map;
}

function toDutyDocs(duties, { university, invigilators, exams } = {}) {
  if (!university) throw new Error("university is required");
  const invIds = idMap(invigilators, "invId");
  const examIds = idMap(exams, "examId");

  return (duties || []).map(function (d) {
    const invigilator = invIds.get(d.invigilator);
    if (!invigilator) throw new AppError(404, "Invigilator " + d.invigilator + " not found");
    const exam = examIds.get(d.exam);
    if (!exam) throw new AppError(404, "Exam " + d.exam + " not found");
    // university always comes from the logged-in user, never from the duty itself
    return { university, invigilator, exam, hall: d.hall, position: Number(d.position), date: d.date, slot: d.slot };
  });
}

module.exports = { toPlainDuties, toDutyDocs };