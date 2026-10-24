/* =========================================================
   DEV ONLY: fills one university with test subjects, halls
   and students so the exam routes can be tried.
   Run from the backend folder:
     node scripts/make-test-exam-data.js UNI-0001
   Safe to run again (updates instead of duplicating).
========================================================= */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const Subject = require("../models/Subject");
const Hall = require("../models/Hall");
const Student = require("../models/Student");

const SUBJECTS = [
  { code: "CS301", name: "Data Structures", dept: "CSE" },
  { code: "CS302", name: "Operating Systems", dept: "CSE" },
  { code: "MA201", name: "Discrete Mathematics", dept: "MATH" }
];

const HALLS = [
  { hallNo: "Hall A", rows: 5, cols: 6 },
  { hallNo: "Hall B", rows: 4, cols: 5 }
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Don't run test scripts in production");

  const university = String(process.argv[2] || "").trim().toUpperCase();
  if (!/^UNI-\d{4}$/.test(university)) {
    console.log("Usage: node scripts/make-test-exam-data.js UNI-0001");
    process.exit(1);
  }

  await connectDB();

  for (const s of SUBJECTS) {
    await Subject.updateOne({ university, code: s.code }, { $set: { ...s, university } }, { upsert: true });
  }
  for (const h of HALLS) {
    await Hall.updateOne({ university, hallNo: h.hallNo }, { $set: { ...h, university } }, { upsert: true });
  }

  // 40 students: each takes one subject in turn; the first 5 also take MA201 (for Task 6 clash tests)
  for (let i = 1; i <= 40; i++) {
    const roll = "21CS" + String(i).padStart(3, "0");
    const subjects = [SUBJECTS[(i - 1) % 3].code];
    if (i <= 5 && !subjects.includes("MA201")) subjects.push("MA201");
    await Student.updateOne(
      { university, roll },
      { $set: { university, roll, name: "Test Student " + i, subjects } },
      { upsert: true }
    );
  }

  console.log("Added to " + university + ": " + SUBJECTS.length + " subjects, " +
    HALLS.length + " halls (Hall A 30 seats, Hall B 20 seats), 40 students");
  await mongoose.disconnect();
}

main().catch(function (err) {
  console.error("Failed:", err.message);
  process.exit(1);
});