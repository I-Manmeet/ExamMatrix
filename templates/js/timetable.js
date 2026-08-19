/* =========================================================
   ExamMatrix — TIMETABLE
   ---------------------------------------------------------
   [YOU / MEMBER 1]  Page shell + Data & Fetch     -> DONE
   [ANUPAM]          Calendar render + CSV export   -> TODO
   [JIYA]            Clash detection + Print (CSS)  -> TODO
========================================================= */


/* =========================================================
   ===========  [MEMBER 1 - YOU] DATA & FETCH  ============
   Status: DONE
   Reads the saved exams and prepares helpers the calendar +
   clash detection use.
========================================================= */

/* the exams shown on the timetable */
var timetableExams = [];

/* read the saved exams from localStorage (em_exams list) */
function getTimetableExams() {
  var exams = [];
  try {
    var raw = localStorage.getItem("em_exams");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { exams = parsed; }
    }
  } catch (e) { exams = []; }
  return exams;
}

/* distinct exam dates (sorted) — calendar columns */
function getExamDates(exams) {
  var seen = {}, dates = [];
  for (var i = 0; i < exams.length; i++) {
    var d = exams[i].date;
    if (d && !seen[d]) { seen[d] = true; dates.push(d); }
  }
  dates.sort();
  return dates;
}

/* distinct time slots (sorted) — calendar rows */
function getExamSlots(exams) {
  var seen = {}, slots = [];
  for (var i = 0; i < exams.length; i++) {
    var s = exams[i].slot;
    if (s && !seen[s]) { seen[s] = true; slots.push(s); }
  }
  slots.sort();
  return slots;
}

/* which courses have already been conducted (consistent with Create Exam) */
function getConductedCourses(exams) {
  var used = {};
  for (var i = 0; i < exams.length; i++) {
    var courses = exams[i].pickedCourses || [];
    for (var c = 0; c < courses.length; c++) { used[courses[c]] = true; }
  }
  return used;
}

/* exams in a given date + slot cell */
function examsInCell(exams, date, slot) {
  var out = [];
  for (var i = 0; i < exams.length; i++) {
    if (exams[i].date === date && exams[i].slot === slot) { out.push(exams[i]); }
  }
  return out;
}


/* =========================================================
   ==============  [ANUPAM] CALENDAR RENDER  =============
   Status: TODO

   WRITE renderCalendar(exams):
     - columns = getExamDates(exams), rows = getExamSlots(exams)
     - build a grid inside #calendarContainer
     - for each (date, slot) cell, use examsInCell(exams, date, slot)
       and draw an .examBlock for each exam (show course codes + halls)
   Helpers you can use (from Member 1):
     getExamDates(), getExamSlots(), examsInCell()
========================================================= */

function renderCalendar(exams) {
  // TODO [ANUPAM]
}


/* =========================================================
   ==============  [JIYA] CLASH DETECTION  ===============
   Status: TODO

   WRITE detectClashes(exams):
     - group exams by (date + slot)
     - in any slot with 2+ exams, check if a STUDENT roll or a HALL
       appears in more than one exam -> that's a clash
     - render results into #clashPanel:
         .clashItem.bad  for a clash (list who/what)
         .clashItem.good for "no clashes"
   Helper you can use (from Member 1): examsInCell()
========================================================= */

function detectClashes(exams) {
  var panel = document.getElementById("clashPanel");
  if (!panel) { return; }
  panel.innerHTML = "";

  var dates = getExamDates(exams);
  var slots = getExamSlots(exams);
  var clashes = [];

  for (var d = 0; d < dates.length; d++) {
    for (var s = 0; s < slots.length; s++) {
      var cellExams = examsInCell(exams, dates[d], slots[s]);
      if (cellExams.length < 2) { continue; }

      var rollSeen = {}, hallSeen = {};
      var when = dates[d] + " (" + slots[s] + ")";

      for (var e = 0; e < cellExams.length; e++) {
        var ex = cellExams[e];

        // student clash: same roll in two exams, same date+slot
        var studs = ex.students || [];
        for (var r = 0; r < studs.length; r++) {
          var roll = studs[r].roll;
          if (rollSeen[roll]) {
            clashes.push("Student " + roll + " has two exams on " + when);
          } else { rollSeen[roll] = true; }
        }

        // hall clash: same hall used by two exams, same date+slot
        var halls = ex.pickedHalls || [];
        for (var h = 0; h < halls.length; h++) {
          var hall = halls[h];
          if (hallSeen[hall]) {
            clashes.push("Hall \"" + hall + "\" is double-booked on " + when);
          } else { hallSeen[hall] = true; }
        }
      }
    }
  }

  if (clashes.length === 0) {
    var good = document.createElement("div");
    good.className = "clashItem good";
    good.textContent = "No clashes found.";
    panel.appendChild(good);
    return;
  }
  for (var i = 0; i < clashes.length; i++) {
    var bad = document.createElement("div");
    bad.className = "clashItem bad";
    bad.textContent = clashes[i];
    panel.appendChild(bad);
  }
}


/* =========================================================
   ============  PRINT (JIYA) + EXPORT (ANUPAM)  =========
========================================================= */

/* ---- [JIYA — PRINT] ----
   The Print button already calls window.print().
   Your job is the @media print block in timetable.css:
   hide navbar/footer/buttons, keep the calendar + clash panel,
   keep exam-block colours (print-color-adjust: exact).
   (No JS needed here unless you want a custom print handler.)
*/




/* ---- [ANUPAM — EXPORT] ----
   WRITE setupExport(): wire #exportBtn to download the timetable
   as CSV (columns: Exam, Date, Slot, Courses, Halls). Loop
   timetableExams, build the CSV string, trigger a Blob download.
*/
function setupExport() {
  // TODO [ANUPAM]
}


/* =========================================================
   ==================  PAGE STARTUP  ======================
   [MEMBER 1 - YOU] loads data, then hands off to the others.
========================================================= */
function loadTimetable() {
  timetableExams = getTimetableExams();

  var info = document.getElementById("ttInfo");
  if (info) {
    info.textContent = timetableExams.length
      ? (timetableExams.length + " exam(s) scheduled")
      : "No exams scheduled yet.";
  }

  if (timetableExams.length === 0) {
    var cal = document.getElementById("calendarContainer");
    if (cal) {
      cal.innerHTML = '<div class="ttEmpty">No exams scheduled yet. ' +
        'Create one from <a href="createExam.html">Create Exam</a>.</div>';
    }
    return;
  }

  // hand off to teammates' functions (safe if not written yet)
  if (typeof renderCalendar === "function") { renderCalendar(timetableExams); }  // Anupam
  if (typeof detectClashes === "function") { detectClashes(timetableExams); }    // Jiya
  if (typeof setupExport === "function") { setupExport(); }                       // Anupam
}

/* EM_DATA (halls/subjects) comes from data.js; load then build */
if (typeof loadExamData === "function") {
  loadExamData(loadTimetable);
} else {
  loadTimetable();
}
