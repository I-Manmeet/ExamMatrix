const Counter = require("../models/Counter");

// nextId("UNI", 4)       -> "UNI-0001", then "UNI-0002", ...
// nextId("INV-0001", 4)  -> "INV-0001-0001"  (invigilators of university UNI-0001)
// nextId("EXM-0001", 4)  -> "EXM-0001-0001"  (exams of university UNI-0001)
// 


// $inc adds 1 inside MongoDB in a single step, so two requests
// at the same moment can never get the same number.
async function nextId(prefix, pad = 4) {
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }   // return the updated value, create if missing
  );
  return `${prefix}-${String(counter.seq).padStart(pad, "0")}`;
}

module.exports = { nextId };