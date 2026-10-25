const express = require("express");

const Student = require("../models/Student");

const Exam = require("../models/Exam");

const { AppError } = require("../middleware/errorHandler");

const router = express.Router();

const UNI_ID = /^UNI-\d{4}$/;

// where does this roll sit in one exam's seat map? → { hall, row, seat, code } or null

function findSeat(seatMap, roll) {

  for (const hallNo of Object.keys(seatMap || {})) {

    const grid = seatMap[hallNo] || [];

    for (let r = 0; r < grid.length; r++) {

      for (let c = 0; c < grid[r].length; c++) {

        const cell = grid[r][c];

        if (cell && cell.roll === roll) return { hall: hallNo, row: r + 1, seat: c + 1, code: cell.code };

      }

    }

  }

  return null;

}

// GET /api/public/seat?uni=UNI-0001&roll=24AI1001  (public, no login)

// → only hall, seat, subject, date and slot for each exam, soonest first

router.get("/seat", async (req, res) => {

  const uni = String(req.query.uni || "").trim().toUpperCase();

  const roll = String(req.query.roll || "").trim().toUpperCase();

  if (!UNI_ID.test(uni)) throw new AppError(400, "Enter your university ID, e.g. UNI-0001");

  if (!roll || roll.length > 30) throw new AppError(400, "Enter a valid roll number");

  // same message either way, so nobody can test which universities exist

  const student = await Student.findOne({ university: uni, roll: roll }).select("subjects").lean();

  if (!student) throw new AppError(404, "No student with roll " + roll + " in " + uni);

  // only exams for a subject this student takes can have them in the seat map

  const exams = await Exam.find({ university: uni, subjects: { $in: student.subjects } })

    .select("date slot seatMap")

    .sort({ date: 1, slot: 1 })

    .lean();

  const seats = [];

  for (const exam of exams) {

    const seat = findSeat(exam.seatMap, roll);

    if (!seat) continue;

    seats.push({ date: exam.date, slot: exam.slot, subject: seat.code, hall: seat.hall, row: seat.row, seat: seat.seat });

  }

  res.json({ data: { roll: roll, seats: seats } });

});

module.exports = router;

module.exports.findSeat = findSeat;

backend/tests/publicSeat.test.js (new)

const test = require("node:test");

const assert = require("node:assert");

const { findSeat } = require("../routes/public.js");

const seatMap = {

  "Hall A": [

    [{ roll: "24AI1001", code: "AI302" }, null],

    [null, { roll: "24CS2001", code: "CS301" }]

  ],

  "Hall B": [

    [{ roll: "24EC3001", code: "EC301" }]

  ]

};

test("findSeat: gives hall, row and seat counted from 1", () => {

  assert.deepStrictEqual(findSeat(seatMap, "24CS2001"), { hall: "Hall A", row: 2, seat: 2, code: "CS301" });

  assert.deepStrictEqual(findSeat(seatMap, "24EC3001"), { hall: "Hall B", row: 1, seat: 1, code: "EC301" });

});

test("findSeat: unknown roll or empty seat map gives null", () => {

  assert.strictEqual(findSeat(seatMap, "NOPE"), null);

  assert.strictEqual(findSeat({}, "24AI1001"), null);

  assert.strictEqual(findSeat(undefined, "24AI1001"), null);

});
