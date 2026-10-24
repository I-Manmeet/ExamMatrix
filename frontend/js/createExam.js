/* =========================================================
   CREATE EXAM — js/createExam.js
   Needs config.js, api.js and app-shell.js loaded first.
   Subjects, halls and students come from the server
   (GET /api/exams/options) for the picked date + slot.
   The server runs every clash and seat check again when the
   exam is saved, so nothing on this page can be skipped.
========================================================= */

/* shared picked-state (all sections read/write these) */
let examOptions = null;   // last reply from /api/exams/options
let pickedCourses = [];
let pickedHalls = [];
let optionsRequest = 0;   // when the date/slot changes fast, only the newest reply is used


/* colour per course (simple palette) */
let COURSE_PALETTE = ["#0f7a5c", "#2b6cb0", "#b7791f", "#c026d3", "#0891b2", "#65a30d", "#c0392b", "#7c3aed", "#0e7490", "#a16207", "#be123c", "#4338ca"];
let courseColorMap = {};
function colorFor(code) {
  if (!(code in courseColorMap)) {
    courseColorMap[code] = COURSE_PALETTE[Object.keys(courseColorMap).length % COURSE_PALETTE.length];
  }
  return courseColorMap[code];
}

/* names come from uploads, so escape them before they go into HTML */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* today's date in India as YYYY-MM-DD (same rule as the server) */
function todayInIndia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function setLoadInfo(text) {
  document.getElementById("loadInfo").textContent = text;
}


/* -----------------------------------------------------------
   LOAD what's free for the picked date + slot
----------------------------------------------------------- */
function loadOptions() {
  let date = document.getElementById("examDate").value;
  let slot = document.getElementById("examSlot").value;
  if (!date) {
    setLoadInfo("Pick a date to see subjects and halls.");
    return;
  }

  let thisRequest = ++optionsRequest;
  setLoadInfo("Loading data…");

  api("GET", "/exams/options?date=" + encodeURIComponent(date) + "&slot=" + encodeURIComponent(slot))
    .then(function (data) {
      if (thisRequest !== optionsRequest) { return; }   // an older reply came back late
      examOptions = data;
      setLoadInfo("✓ " + data.subjects.length + " subjects · " + data.halls.length + " halls · " +
        data.students.length + " students loaded");
      renderSubjectPickers();
      renderHallPickers();
      onPickChange();
    })
    .catch(function (err) {
      if (thisRequest !== optionsRequest) { return; }
      setLoadInfo("⚠ " + err.message);
    });
}

/* when the date or slot changes, what's booked changes too */
function onDateTimeChange() {
  loadOptions();
}


/* -----------------------------------------------------------
   PICKERS (ticks are kept when the date/slot changes)
----------------------------------------------------------- */
function renderSubjectPickers() {
  let list = document.getElementById("subjectList");
  if (!examOptions.subjects.length) {
    list.innerHTML = '<p class="emptyHint">No subjects yet. Add subjects first.</p>';
    return;
  }

  let html = "";
  examOptions.subjects.forEach(function (subj) {
    let checked = pickedCourses.indexOf(subj.code) !== -1 ? " checked" : "";
    html +=
      '<label class="pickRow" data-course="' + escapeHtml(subj.code) + '">' +
      '<input type="checkbox" onchange="onPickChange()"' + checked + '>' +
      '<span class="pickSwatch" style="background:' + colorFor(subj.code) + '"></span>' +
      '<span><span class="pickMain">' + escapeHtml(subj.code) + '</span> ' +
      '<span class="pickSub">' + escapeHtml(subj.name) + '</span></span>' +
      '<span class="pickRight">' + subj.students + ' students</span>' +
      '</label>';
  });
  list.innerHTML = html;
}

function renderHallPickers() {
  let list = document.getElementById("hallList");
  if (!examOptions.halls.length) {
    list.innerHTML = '<p class="emptyHint">No halls yet. Add halls first.</p>';
    return;
  }

  let html = "";
  examOptions.halls.forEach(function (hall) {
    let isFull = hall.free <= 0;

    // right-hand label: plain seats if untouched, else booked/free split
    let rightText;
    if (hall.booked === 0) {
      rightText = hall.seats + " seats";
    } else if (isFull) {
      rightText = "🔒 full · " + hall.booked + "/" + hall.seats + " booked";
    } else {
      rightText = hall.booked + "/" + hall.seats + " booked · " + hall.free + " free";
    }

    let checked = !isFull && pickedHalls.indexOf(hall.hallNo) !== -1 ? " checked" : "";

    html +=
      '<label class="pickRow' + (isFull ? " locked" : "") + '" data-hall="' + escapeHtml(hall.hallNo) + '">' +
      '<input type="checkbox" onchange="onPickChange()"' + (isFull ? " disabled" : "") + checked + '>' +
      '<span><span class="pickMain">' + escapeHtml(hall.hallNo) + '</span> ' +
      '<span class="pickSub">' + hall.rows + '×' + hall.cols + '</span></span>' +
      '<span class="' + (isFull ? "pickLock" : "pickRight") + '">' + rightText + '</span>' +
      '</label>';
  });
  list.innerHTML = html;
}


/* -----------------------------------------------------------
   PICKS + MATCHED STUDENTS
----------------------------------------------------------- */
function readPicks() {
  pickedCourses = [];
  document.querySelectorAll("#subjectList input:checked").forEach(function (box) {
    pickedCourses.push(box.parentElement.dataset.course);
  });

  pickedHalls = [];
  document.querySelectorAll("#hallList input:checked").forEach(function (box) {
    pickedHalls.push(box.parentElement.dataset.hall);
  });
}

/* the students enrolled in the picked courses (one row each, like the server seats them) */
function getMatchedStudents() {
  let matched = [];
  if (!examOptions) { return matched; }

  examOptions.students.forEach(function (student) {
    for (let c = 0; c < pickedCourses.length; c++) {
      if (student.subjects.indexOf(pickedCourses[c]) !== -1) {
        matched.push({ roll: student.roll, name: student.name, examCode: pickedCourses[c] });
        break;   // one exam per student in the table
      }
    }
  });
  return matched;
}

function refreshMatchedTable() {
  let students = getMatchedStudents();
  let body = document.getElementById("matchBody");
  let count = document.getElementById("matchCount");

  count.textContent = pickedCourses.length ? (students.length + " students") : "";

  if (students.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="emptyHint">Tick one or more subjects to load students.</td></tr>';
    return;
  }

  let html = "";
  students.forEach(function (s) {
    html +=
      '<tr><td>' + escapeHtml(s.roll) + '</td>' +
      '<td>' + escapeHtml(s.name) + '</td>' +
      '<td>' + escapeHtml(s.examCode) + '</td></tr>';
  });
  body.innerHTML = html;
}

/* runs whenever any subject/hall checkbox changes */
function onPickChange() {
  readPicks();
  refreshAll();
}

function refreshAll() {
  refreshMatchedTable();
}

/* clear all picked subjects and halls, then reset the UI */
function clearAllPicks() {
  document.querySelectorAll("#subjectList input, #hallList input").forEach(function (box) {
    box.checked = false;
  });
  onPickChange();
}


/* =========================================================
   ==================  PAGE STARTUP  ======================
========================================================= */
adminReady
  .then(function () {
    let dateInput = document.getElementById("examDate");
    let today = todayInIndia();
    dateInput.min = today;   // no exams in the past
    if (!dateInput.value || dateInput.value < today) { dateInput.value = today; }
    loadOptions();
  })
  .catch(function () {
    setLoadInfo("⚠ Can't check your login. Make sure the backend is running.");
  });