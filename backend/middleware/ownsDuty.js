/* =========================================================
   ExamMatrix — ownsDuty middleware
   ---------------------------------------------------------
   An invigilator can only touch a hall they're on duty in.
   Use after Jiya's requireLogin:

     router.put("/:examId/attendance", requireLogin, ownsDuty, handler)

   Reads: req.params.examId ("EXM-0001-0001"), hall from body or query,
          req.user = { id, role, university }
   Sets:  req.exam, req.duty
   ========================================================= */

const mongoose = require("mongoose");
const { AppError } = require("./errorHandler");
require("../models/Duty");

// Real database lookups. "Exam" is Jiya's model, looked up only when a request comes in.
function databaseFinders() {
  return {
    findExam: function (examId, university) {
      return mongoose.model("Exam").findOne({ examId: examId, university: university });
    },
    findDuty: function (query) {
      return mongoose.model("Duty").findOne(query);
    }
  };
}

// Tests pass fake finders; the app uses the real ones
function makeOwnsDuty(finders) {
  return async function ownsDuty(req, res, next) {
    const find = finders || databaseFinders();

    if (!req.user || req.user.role !== "invigilator") {
      throw new AppError(403, "Only the invigilator on duty can do this");
    }

    const hall = String((req.body && req.body.hall) || (req.query && req.query.hall) || "").trim();
    if (!hall) throw new AppError(400, "hall is required");

    const exam = await find.findExam(req.params.examId, req.user.university);
    if (!exam) throw new AppError(404, "Exam not found");

    const duty = await find.findDuty({
      university: req.user.university,
      exam: exam._id,
      hall: hall,
      invigilator: req.user.id
    });
    if (!duty) throw new AppError(403, "You are not on duty in " + hall);

    req.exam = exam;
    req.duty = duty;
    next();
  };
}

const ownsDuty = makeOwnsDuty();

module.exports = { ownsDuty, makeOwnsDuty };