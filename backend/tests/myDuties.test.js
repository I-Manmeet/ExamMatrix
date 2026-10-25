const test = require("node:test");
const assert = require("node:assert/strict");
const { toMyDuties } = require("../utils/myDuties");

const seatMap = {
  "Hall A": [[{ roll: "R1", code: "CS301" }, null], [{ roll: "R2", code: "MA201" }, { roll: "R3", code: "CS301" }]],
  "Lab 1": [[{ roll: "R4", code: "MA201" }]]
};
const exam1 = { _id: "e1", examId: "EXM-0001-0001", examName: "Mid Sem", subjects: ["CS301", "MA201"], seatMap };
const exam2 = { _id: "e2", examId: "EXM-0001-0002", examName: "End Sem", subjects: ["MA201"], seatMap: { "Hall A": [[{ roll: "R9", code: "MA201" }]] } };

const me = { _id: "me", name: "Dr. Me" };
const asha = { _id: "p2", name: "Prof. Asha" };
const ravi = { _id: "p3", name: "Dr. Ravi" };

function duty(id, exam, hall, position, date, slot) { return { _id: id, exam, hall, position, date, slot }; }
function mate(exam, hall, position, person) { return { exam: exam._id, hall, position, invigilator: person }; }

test("one duty comes out in the exact shape the dashboard reads", () => {
  const out = toMyDuties(
    [duty("d1", exam1, "Hall A", 1, "2026-10-27", "09:00-12:00")],
    [mate(exam1, "Hall A", 1, me), mate(exam1, "Hall A", 2, asha)],
    "me"
  );
  assert.deepEqual(out, [{
    id: "d1",
    exam: { examId: "EXM-0001-0001", examName: "Mid Sem", subjects: ["CS301", "MA201"] },
    hall: "Hall A", position: 1, date: "2026-10-27", slot: "09:00-12:00",
    students: 3, coInvigilators: ["Prof. Asha"]
  }]);
});

test("students are counted for that hall only", () => {
  const out = toMyDuties([duty("d2", exam1, "Lab 1", 1, "2026-10-27", "09:00-12:00")], [], "me");
  assert.equal(out[0].students, 1);
});

test("co-invigilators: same exam and hall only, never me, by position", () => {
  const out = toMyDuties(
    [duty("d1", exam1, "Hall A", 1, "2026-10-27", "09:00-12:00")],
    [
      mate(exam1, "Hall A", 3, ravi),
      mate(exam1, "Hall A", 2, asha),
      mate(exam1, "Lab 1", 1, ravi),   // other hall
      mate(exam2, "Hall A", 1, ravi),  // other exam
      mate(exam1, "Hall A", 1, me)     // myself
    ],
    "me"
  );
  assert.deepEqual(out[0].coInvigilators, ["Prof. Asha", "Dr. Ravi"]);
});

test("a deleted exam or a deleted co-invigilator is skipped", () => {
  const out = toMyDuties(
    [duty("d1", null, "Hall A", 1, "2026-10-27", "09:00-12:00"), duty("d2", exam1, "Hall A", 1, "2026-10-28", "09:00-12:00")],
    [{ exam: "e1", hall: "Hall A", position: 2, invigilator: null }],
    "me"
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "d2");
  assert.deepEqual(out[0].coInvigilators, []);
});

test("soonest first: by date, then slot, then hall", () => {
  const out = toMyDuties([
    duty("late", exam2, "Hall A", 1, "2026-10-29", "09:00-12:00"),
    duty("pm", exam1, "Hall A", 1, "2026-10-27", "14:00-17:00"),
    duty("labAm", exam1, "Lab 1", 1, "2026-10-27", "09:00-12:00"),
    duty("hallAm", exam1, "Hall A", 1, "2026-10-27", "09:00-12:00")
  ], [], "me");
  assert.deepEqual(out.map((d) => d.id), ["hallAm", "labAm", "pm", "late"]);
});

test("no duties gives an empty list", () => {
  assert.deepEqual(toMyDuties([], [], "me"), []);
  assert.deepEqual(toMyDuties(undefined, undefined, "me"), []);
});

test("missing seat map, unknown hall and names like 'constructor' give 0 students, no crash", () => {
  const noMap = { ...exam1, seatMap: undefined };
  assert.equal(toMyDuties([duty("a", noMap, "Hall A", 1, "2026-10-27", "09:00-12:00")], [], "me")[0].students, 0);
  assert.equal(toMyDuties([duty("b", exam1, "Hall Z", 1, "2026-10-27", "09:00-12:00")], [], "me")[0].students, 0);
  assert.equal(toMyDuties([duty("c", exam1, "constructor", 1, "2026-10-27", "09:00-12:00")], [], "me")[0].students, 0);
});

test("a seat map stored as a Mongoose Map works", () => {
  const mapped = { ...exam1, seatMap: new Map(Object.entries(seatMap)) };
  assert.equal(toMyDuties([duty("m", mapped, "Hall A", 1, "2026-10-27", "09:00-12:00")], [], "me")[0].students, 3);
});

test("position saved as text becomes a number; missing subjects become []", () => {
  const bare = { _id: "e3", examId: "EXM-0001-0003", examName: "Quiz", seatMap };
  const out = toMyDuties([duty("p", bare, "Hall A", "2", "2026-10-27", "09:00-12:00")], [], "me");
  assert.equal(out[0].position, 2);
  assert.deepEqual(out[0].exam.subjects, []);
});