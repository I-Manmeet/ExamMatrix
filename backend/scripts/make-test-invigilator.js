// DEV ONLY: creates one test invigilator so the Invigilator login can be tried
// before the invigilator upload is ready.
// Usage (inside backend):  node scripts/make-test-invigilator.js UNI-0001
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { connectDB } = require("../config/db");
const { nextId } = require("../utils/idCounter");
const University = require("../models/University");
const Invigilator = require("../models/Invigilator");

const PASSWORD = "Invig@123";

async function main() {
  const universityId = String(process.argv[2] || "").trim().toUpperCase();
  if (!/^UNI-\d{4}$/.test(universityId)) {
    throw new Error("Give a university ID, e.g. node scripts/make-test-invigilator.js UNI-0001");
  }

  await connectDB();

  const uni = await University.findOne({ universityId });
  if (!uni) throw new Error("No university " + universityId + ". Register and verify one first.");

  const invId = await nextId("INV-" + universityId.replace("UNI-", ""), 4);
  await Invigilator.create({
    invId,
    university: universityId,
    name: "Test Invigilator",
    email: "test." + invId.toLowerCase() + "@example.com",
    password: await bcrypt.hash(PASSWORD, 10),
    department: "Testing"
  });

  console.log("\nCreated test invigilator");
  console.log("  Invigilator ID: " + invId);
  console.log("  Password:       " + PASSWORD + "\n");
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());