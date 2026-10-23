const { validateRows } = require("../utils/validators");

function runTest(title, rows, type) {
  console.log(`\n========== ${title} ==========`);

  try {
    const result = validateRows(rows, type);

    console.log("Total rows:", result.totalRows);
    console.log("Valid rows:", result.validCount);
    console.log("Invalid rows:", result.invalidCount);

    console.log("\nValid records:");
    console.table(result.validRows);

    console.log("\nInvalid records:");
    result.invalidRows.forEach((item) => {
      console.log(`Row ${item.row}:`, item.data);
      console.log("Errors:", item.errors);
    });
  } catch (error) {
    console.log("Error:", error.message);
  }
}

// 1. STUDENTS
runTest(
  "STUDENTS",
  [
    { roll: "24CSE001", name: "Aman", email: "aman@example.com", semester: 5 },
    { roll: "24CSE002", name: "Riya", email: "riya@example.com", semester: "3" },
    { roll: "", name: "Missing Roll", email: "test@example.com", semester: 2 },
    { roll: "24CSE004", name: "", email: "test@example.com", semester: 2 },
    { roll: "24CSE005", name: "Bad Email", email: "wrong-email", semester: 2 },
    { roll: "24CSE006", name: "Bad Semester", email: "test@example.com", semester: "abc" }
  ],
  "students"
);

// 2. HALLS
runTest(
  "HALLS",
  [
    { hallCode: "H001", capacity: 30 },
    { hallCode: "H002", capacity: "20" },
    { hallCode: "", capacity: 25 },
    { hallCode: "H004", capacity: 0 },
    { hallCode: "H005", capacity: -5 }
  ],
  "halls"
);

// 3. SUBJECTS
runTest(
  "SUBJECTS",
  [
    { subjectCode: "CSE301", subjectName: "Data Structures" },
    { subjectCode: "CSE302", subjectName: "Database Systems" },
    { subjectCode: "", subjectName: "Operating Systems" },
    { subjectCode: "CSE304", subjectName: "" }
  ],
  "subjects"
);

// 4. Error handling
console.log("\n========== ERROR HANDLING ==========");

try {
  validateRows({}, "students");
} catch (error) {
  console.log("Non-array input:", error.message);
}

try {
  validateRows([], "exams");
} catch (error) {
  console.log("Invalid type:", error.message);
}