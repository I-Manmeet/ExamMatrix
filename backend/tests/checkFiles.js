
const path = require("path");

const files = [
  "../utils/fileParser.js",
  "../utils/validators.js",
  "../utils/autoAssign.js",
  "../models/halls.js",
  "../models/Student.js",
  "../models/Subject.js",
];

for (const file of files) {
  console.log("\n------------------------------");
  console.log("Testing:", file);

  try {
    const result = require(path.resolve(__dirname, file));

    console.log("PASS: File loaded successfully");
    console.log(
      "Exports:",
      Object.keys(result || {})
    );
  } catch (error) {
    console.log("FAIL:", error.message);
  }
}
