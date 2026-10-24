const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { once } = require("events");
const { activity, startActivityLog, formatLine } = require("../utils/events");

function tempFile(name) {
  return path.join(os.tmpdir(), "em-test-" + Date.now() + "-" + Math.random().toString(36).slice(2), name);
}

test("formatLine: time, event name and details as JSON", () => {
  const line = formatLine("incident:reported", { hall: "Hall A" });
  assert.match(line, /^\d{4}-\d{2}-\d{2}T.*Z  incident:reported +\{"hall":"Hall A"\}\n$/);
});

test("writes one line per event and creates the folder", async () => {
  const file = tempFile(path.join("logs", "activity.log"));
  const stop = startActivityLog(file);

  const written = once(activity, "activity:logged");
  activity.emit("incident:reported", { examId: "EXM-0001-0001", hall: "Hall A", type: "Other", by: "INV-0001-0004" });
  await written;
  await stop();

  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /incident:reported/);
  assert.match(lines[0], /"hall":"Hall A"/);
});

test("appends instead of overwriting", async () => {
  const file = tempFile("activity.log");

  let stop = startActivityLog(file);
  let written = once(activity, "activity:logged");
  activity.emit("duties:assigned", { examId: "EXM-0001-0001", filled: 3, unfilled: 0 });
  await written;
  await stop();

  stop = startActivityLog(file);
  written = once(activity, "activity:logged");
  activity.emit("duties:cleared", { examId: "EXM-0001-0001" });
  await written;
  await stop();

  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.strictEqual(lines.length, 2);
  assert.match(lines[0], /duties:assigned/);
  assert.match(lines[1], /duties:cleared/);
});

test("events that aren't in the list are ignored", async () => {
  const file = tempFile("activity.log");
  const stop = startActivityLog(file);
  activity.emit("something:random", { a: 1 });
  await stop();
  assert.strictEqual(fs.readFileSync(file, "utf8"), "");
});

test("stop() removes the listeners", async () => {
  const stop = startActivityLog(tempFile("activity.log"));
  assert.strictEqual(activity.listenerCount("incident:reported"), 1);
  await stop();
  assert.strictEqual(activity.listenerCount("incident:reported"), 0);
});