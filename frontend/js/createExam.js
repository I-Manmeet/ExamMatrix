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
  lockUnavailableSubjects();   // unticks subjects that can't be picked at all
  readPicks();
  refreshMatchedTable();
  applyClashLocks();
  updateStatusBar();
}

/* clear all picked subjects and halls, then reset the UI */
function clearAllPicks() {
  document.querySelectorAll("#subjectList input, #hallList input").forEach(function (box) {
    box.checked = false;
  });
  onPickChange();
}


/* -----------------------------------------------------------
   LOCKS
   Fixed locks (don't depend on what's ticked):
     · already examined → "✓ already conducted"
     · some of its students already sit an exam at this time
   Clash locks: a subject that shares students with a ticked one.
----------------------------------------------------------- */
function lockRow(row, text, label) {
  let box = row.querySelector("input");
  row.classList.add("locked");
  box.disabled = true;
  box.checked = false;

  let right = row.querySelector(".pickRight, .pickLock");
  if (right) {
    right.className = "pickLock";
    right.textContent = text;
  }
  row.setAttribute("aria-disabled", "true");
  row.setAttribute("aria-label", label);
}

function unlockRow(row, text) {
  let box = row.querySelector("input");
  row.classList.remove("locked");
  box.disabled = false;

  let right = row.querySelector(".pickRight, .pickLock");
  if (right) {
    right.className = "pickRight";
    right.textContent = text;
  }
  row.removeAttribute("aria-disabled");
  row.removeAttribute("aria-label");
  row.onmouseenter = null;
  row.onmouseleave = null;
}

function findSubject(code) {
  return examOptions.subjects.find(function (s) { return s.code === code; });
}

function lockUnavailableSubjects() {
  if (!examOptions) { return; }
  document.querySelectorAll("#subjectList .pickRow").forEach(function (row) {
    let subj = findSubject(row.dataset.course);
    if (!subj) { return; }

    if (subj.scheduledIn) {
      row.dataset.fixed = "1";
      row.title = "Already in " + subj.scheduledIn.examName + " (" + subj.scheduledIn.examId + ")";
      lockRow(row, "✓ already conducted",
        subj.code + " is already in " + subj.scheduledIn.examName + " and cannot be conducted again.");
    } else if (subj.busyNow.length) {
      let rolls = subj.busyNow;
      row.dataset.fixed = "1";
      lockRow(row, "🔒 " + rolls.length + " busy now",
        subj.code + " is locked — " + rolls.length + " of its students already have an exam at this time.");
      row.onmouseenter = function () {
        showClashInfo(rolls, "<b>" + escapeHtml(subj.code) + "</b> has " + rolls.length +
          " students who already have an exam at this time, so it is locked.");
      };
      row.onmouseleave = clearClashInfo;
    }
  });
}

/* "CS301|MA201": the same key the server uses (codes in A-Z order) */
function pairKey(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

function applyClashLocks() {
  if (!examOptions) { return; }
  document.querySelectorAll("#subjectList .pickRow").forEach(function (row) {
    if (row.dataset.fixed) { return; }   // fixed locks never unlock here

    let course = row.dataset.course;
    let shared = [];
    if (pickedCourses.indexOf(course) === -1) {
      pickedCourses.forEach(function (picked) {
        (examOptions.shared[pairKey(course, picked)] || []).forEach(function (roll) {
          if (shared.indexOf(roll) === -1) { shared.push(roll); }
        });
      });
    }

    if (shared.length) {
      lockRow(row, "🔒 locked · " + shared.length + " shared",
        course + " locked — shares " + shared.length +
        " students with a picked subject, so it cannot be scheduled in the same slot.");
      row.onmouseenter = function () {
        showClashInfo(shared, "<b>" + escapeHtml(course) + "</b> shares " + shared.length +
          " students with your picked subjects, so it is locked.");
      };
      row.onmouseleave = clearClashInfo;
    } else {
      unlockRow(row, findSubject(course).students + " students");
    }
  });
}

/* show the clash detail in the info bar (first 3 rolls + "+N more") */
function showClashInfo(rolls, sentenceHtml) {
  let infoEl = document.getElementById("clashInfo");
  if (!infoEl) { return; }

  let shown = rolls.slice(0, 3).map(escapeHtml).join(", ");
  let extra = rolls.length - 3;
  let moreText = extra > 0 ? ' <span class="clashMore">+' + extra + ' more</span>' : "";

  infoEl.className = "clashInfo";
  infoEl.innerHTML = "<span>" + sentenceHtml + "</span> " +
    '<span class="clashRolls">' + shown + "</span>" + moreText;
}

function clearClashInfo() {
  let infoEl = document.getElementById("clashInfo");
  if (!infoEl) { return; }
  infoEl.className = "clashInfo clashInfo--idle";
  infoEl.innerHTML = "<span>Hover a locked subject to see which students clash.</span>";
}

/* -----------------------------------------------------------
   STATUS BAR
   Quick seat count here; when seats are enough, the server
   runs every real check (POST /api/exams/check, nothing saved)
   and only then the Generate button turns on.
----------------------------------------------------------- */
let checkTimer = null;
let checkRequest = 0;

function setStatus(kind, text, canGenerate) {
  document.getElementById("statusMsg").className = "statusMsg " + kind;
  document.getElementById("statusText").textContent = text;
  document.getElementById("generateBtn").disabled = !canGenerate;
}

function freeSeatsInPickedHalls() {
  return examOptions.halls
    .filter(function (h) { return pickedHalls.indexOf(h.hallNo) !== -1; })
    .reduce(function (sum, h) { return sum + h.free; }, 0);
}

function examBody() {
  return {
    examName: document.getElementById("examName").value,
    date: document.getElementById("examDate").value,
    slot: document.getElementById("examSlot").value,
    subjects: pickedCourses,
    halls: pickedHalls
  };
}

function updateStatusBar() {
  clearTimeout(checkTimer);
  checkRequest++;   // forget any check that is still running

  if (!examOptions) {
    setStatus("neutral", "Loading data…", false);
    return;
  }

  let studentCount = getMatchedStudents().length;

  if (pickedCourses.length === 0 && pickedHalls.length === 0) {
    setStatus("neutral", "Pick subjects and halls to begin.", false);
    return;
  }
  if (pickedCourses.length === 0) {
    setStatus("neutral", "Pick at least one subject.", false);
    return;
  }
  if (pickedHalls.length === 0) {
    setStatus("neutral", studentCount + " students selected · Pick at least one hall.", false);
    return;
  }

  let totalSeats = freeSeatsInPickedHalls();
  if (totalSeats < studentCount) {
    let shortage = studentCount - totalSeats;
    setStatus("bad", totalSeats + " seats available · " + studentCount + " students selected · " +
      shortage + " more seat" + (shortage === 1 ? "" : "s") + " required.", false);
    return;
  }

  // seats are enough on paper: ask the server (waits 0.4 s so fast clicking sends one request)
  setStatus("neutral", totalSeats + " seats available · " + studentCount + " students selected · Checking…", false);
  let thisCheck = checkRequest;
  checkTimer = setTimeout(function () {
    api("POST", "/exams/check", examBody())
      .then(function (data) {
        if (thisCheck !== checkRequest) { return; }
        setStatus("good", data.freeSeats + " seats available · " + data.students + " students selected · " +
          data.halls.length + " hall(s) needed · Ready to generate.", true);
      })
      .catch(function (err) {
        if (thisCheck !== checkRequest) { return; }
        setStatus("bad", err.message, false);
      });
  }, 400);
}

// a changed exam name can make the check pass or fail
document.getElementById("examName").addEventListener("input", updateStatusBar);




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