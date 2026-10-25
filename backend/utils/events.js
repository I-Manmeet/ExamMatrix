/* =========================================================
   ExamMatrix — ACTIVITY EVENTS
   ---------------------------------------------------------
   Routes fire events; one listener appends a line per event
   to backend/logs/activity.log through a write stream.

   Usage in a route:
     const { activity } = require("../utils/events");
     activity.emit("incident:reported", { examId, hall, type, by: req.user.id });

   Start once in server.js:
     require("./utils/events").startActivityLog();
   ========================================================= */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "logs", "activity.log");

// Only these events are written to the log
const ACTIVITY_EVENTS = [
  "duties:assigned",       // { examId, by, filled, unfilled }
  "duties:cleared",        // { examId, by }
  "duty:changed",          // { examId, hall, position, invId, by }
  "incident:reported",     // { examId, hall, type, by }
  "invigilators:uploaded", // { added, updated, by }
  "invigilator:password-reset", // { university, invId, by }
  "auth:login",            // { role, university, by }
  "university:registered", // { universityId, city }
  "password:reset",        // { universityId }
  "exam:created",          // { examId, students, halls, by }
  "exam:deleted"           // { examId, dutiesRemoved, by }
];

class ActivityEmitter extends EventEmitter { }
const activity = new ActivityEmitter();

// 2026-10-27T04:42:00.000Z  incident:reported     {"examId":"EXM-0001-0001",...}
function formatLine(event, details) {
  return new Date().toISOString() + "  " + event.padEnd(22) + JSON.stringify(details || {}) + "\n";
}

/*
  Starts listening and returns stop(), which removes the listeners
  and closes the file (stop returns a Promise).
  "activity:logged" fires after each line is written (used by tests).
*/
function startActivityLog(file = LOG_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });       // creates logs/ if it's missing
  const stream = fs.createWriteStream(file, { flags: "a" });    // "a" = append, never overwrite
  stream.on("error", function (err) { console.error("Activity log error:", err.message); });

  const handlers = {};
  ACTIVITY_EVENTS.forEach(function (event) {
    handlers[event] = function (details) {
      stream.write(formatLine(event, details), function () {
        activity.emit("activity:logged", event);
      });
    };
    activity.on(event, handlers[event]);
  });

  return function stop() {
    ACTIVITY_EVENTS.forEach(function (event) { activity.off(event, handlers[event]); });
    return new Promise(function (resolve) { stream.end(resolve); });
  };
}

module.exports = { activity, startActivityLog, formatLine, ACTIVITY_EVENTS, LOG_FILE };