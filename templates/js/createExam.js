/* =========================================================
   ExamMatrix — CREATE EXAM LOGIC  (single file, 3 sections)
   ---------------------------------------------------------
   [MEMBER A] Load, render pickers, detect busy students,
              + anti-cheat neighbour-check (fits)  -> DONE
   [MEMBER B] Selection + apply clash prevention   -> TODO
   [MEMBER C] Validate + save                      -> TODO
========================================================= */

/* shared picked-state (all sections read/write these) */
let pickedCourses = [];
let pickedHalls = [];

/* -----------------------------------------------------------
   ALREADY-CONDUCTED COURSES
   Reads em_exams (saved exams) and returns the set of course
   codes already scheduled — so a course can't be conducted twice.
----------------------------------------------------------- */
function getUsedCourses() {
  let used = {};
  let emExams = [];
  try {
    emExams = JSON.parse(localStorage.getItem("em_exams")) || [];
    if (!Array.isArray(emExams)) { emExams = []; }
  } catch (e) { emExams = []; }

  for (let i = 0; i < emExams.length; i++) {
    let courses = emExams[i].pickedCourses || [];
    for (let c = 0; c < courses.length; c++) {
      used[courses[c]] = true;
    }
  }
  return used;
}

/* -----------------------------------------------------------
   LOCK already-scheduled courses in the picker.
   A course that appears in any saved exam (em_exams) cannot be
   scheduled again — grey it out and disable its checkbox.
----------------------------------------------------------- */
function lockUsedCourses() {
  let used = getUsedCourses();
  let rows = document.querySelectorAll('#subjectList .pickRow');

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let course = row.dataset.course;

    if (used[course]) {
      let box = row.querySelector('input');
      row.classList.add('locked');
      box.disabled = true;
      box.checked = false;

      let right = row.querySelector('.pickRight');
      if (right) {
        right.className = 'pickLock';
        right.textContent = '✓ already conducted';
      }
      row.setAttribute('aria-disabled', 'true');
      row.setAttribute('aria-label', course + ' has already been scheduled and cannot be conducted again.');
    }
  }
}



/* =========================================================
   ===========  [MEMBER A] LOAD + RENDER + DETECT  ========
   Status: DONE
========================================================= */

/* colour per course (simple palette) */
let COURSE_PALETTE = ["#0f7a5c", "#2b6cb0", "#b7791f", "#c026d3", "#0891b2", "#65a30d", "#c0392b", "#7c3aed", "#0e7490", "#a16207", "#be123c", "#4338ca"];
let courseColorMap = {};
function colorFor(code) {
  if (!(code in courseColorMap)) {
    courseColorMap[code] = COURSE_PALETTE[Object.keys(courseColorMap).length % COURSE_PALETTE.length];
  }
  return courseColorMap[code];
}

/* how many students take a given course */
function countStudentsForCourse(courseCode) {
  let n = 0;
  for (let i = 0; i < EM_DATA.students.length; i++) {
    if (EM_DATA.students[i].subjects.indexOf(courseCode) !== -1) { n++; }
  }
  return n;
}

/* render the subject checkboxes from subjects.json */
function renderSubjectPickers() {
  let list = document.getElementById("subjectList");
  let html = "";

  for (let i = 0; i < EM_DATA.subjects.length; i++) {
    let subj = EM_DATA.subjects[i];
    let count = countStudentsForCourse(subj.code);

    html +=
      '<label class="pickRow" data-course="' + subj.code + '">' +
      '<input type="checkbox" onchange="onPickChange()">' +
      '<span class="pickSwatch" style="background:' + colorFor(subj.code) + '"></span>' +
      '<span><span class="pickMain">' + subj.code + '</span> ' +
      '<span class="pickSub">' + subj.name + '</span></span>' +
      '<span class="pickRight">' + count + ' students</span>' +
      '</label>';
  }
  list.innerHTML = html;
}

/* render the hall checkboxes from halls.json */
function renderHallPickers() {
  let list = document.getElementById("hallList");
  let html = "";

  for (let i = 0; i < EM_DATA.halls.length; i++) {
    let hall = EM_DATA.halls[i];
    let seats = hall.rows * hall.cols;

    html +=
      '<label class="pickRow" data-hall="' + hall.hallNo + '">' +
      '<input type="checkbox" onchange="onPickChange()">' +
      '<span><span class="pickMain">' + hall.hallNo + '</span> ' +
      '<span class="pickSub">' + hall.rows + '×' + hall.cols + '</span></span>' +
      '<span class="pickRight">' + seats + ' seats</span>' +
      '</label>';
  }
  list.innerHTML = html;
}

/* CLASH DETECTION (A's half):
   given the currently picked courses, return the set of roll numbers
   of students who are ALREADY assigned to one of those courses.
   Member B uses this to grey out any OTHER course that shares a student. */
function getBusyStudents(coursesToCheck) {
  let busy = {};   // roll -> true
  for (let i = 0; i < EM_DATA.students.length; i++) {
    let student = EM_DATA.students[i];
    for (let c = 0; c < coursesToCheck.length; c++) {
      if (student.subjects.indexOf(coursesToCheck[c]) !== -1) {
        busy[student.roll] = true;
      }
    }
  }
  return busy;
}

/* -----------------------------------------------------------
   ANTI-CHEAT NEIGHBOUR CHECK  (my algorithm piece)
   -----------------------------------------------------------
   The core seating rule: a seat is only safe for a student if
   NONE of its 4 orthogonal neighbours (up/down/left/right)
   holds a student with the SAME exam code. Diagonals don't count.
   The seating placement stage calls this for every seat it tries.

     grid     = 2D array; each cell is { roll, name, examCode } or null
     row, col = the seat being tested
     student  = the student we want to place there
   Returns true if the seat is safe, false if a neighbour clashes.
----------------------------------------------------------- */
function fits(grid, row, col, student) {

  let rows = grid.length;
  let cols = grid[0].length;

  let neighbours = [
    [row - 1, col],  // front (up)
    [row + 1, col],  // back (down)
    [row, col - 1],  // left
    [row, col + 1]   // right
  ];

  for (let i = 0; i < neighbours.length; i++) {
    let r = neighbours[i][0];
    let c = neighbours[i][1];

    // skip neighbours outside the grid
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      continue;
    }

    let neighbour = grid[r][c];

    // same exam code next door -> not safe
    if (neighbour !== null && neighbour.examCode === student.examCode) {
      return false;
    }
  }

  return true;  // no neighbour clashed
}


/* =========================================================
   ========  [MEMBER B] SELECTION + CLASH PREVENTION  =====
   Status: TODO

   WRITE:
     onPickChange()          - runs whenever a checkbox changes.
                               Rebuild pickedCourses/pickedHalls from
                               the checked boxes, then call
                               getMatchedStudents(), refresh the table,
                               call applyClashPrevention(), and
                               updateStatusBar().
     getMatchedStudents()    - return students enrolled in pickedCourses.
     applyClashPrevention()  - use getBusyStudents(pickedCourses) from
                               Member A to disable/grey any UNpicked course
                               that shares a busy student (add .locked +
                               a "locked · students busy" label, disable its checkbox).

   HINT: read checked boxes like:
     document.querySelectorAll('#subjectList input:checked')
     and get the course from its parent's dataset.course
========================================================= */

/* runs whenever any subject/hall checkbox changes */
function onPickChange() {

  // rebuild pickedCourses from the checked subject boxes
  pickedCourses = [];
  let subjectBoxes = document.querySelectorAll('#subjectList input:checked');
  for (let i = 0; i < subjectBoxes.length; i++) {
    pickedCourses.push(subjectBoxes[i].parentElement.dataset.course);
  }

  // rebuild pickedHalls from the checked hall boxes
  pickedHalls = [];
  let hallBoxes = document.querySelectorAll('#hallList input:checked');
  for (let i = 0; i < hallBoxes.length; i++) {
    pickedHalls.push(hallBoxes[i].parentElement.dataset.hall);
  }

  // refresh everything
  refreshMatchedTable();
  applyClashPrevention();
  updateStatusBar();   // Member C's function
}

/* return the students enrolled in the picked courses */
function getMatchedStudents() {
  let matched = [];

  for (let i = 0; i < EM_DATA.students.length; i++) {
    let student = EM_DATA.students[i];

    // find which picked course this student is in
    for (let c = 0; c < pickedCourses.length; c++) {
      if (student.subjects.indexOf(pickedCourses[c]) !== -1) {
        matched.push({
          roll: student.roll,
          name: student.name,
          examCode: pickedCourses[c]
        });
        break;   // one exam per student in the table
      }
    }
  }
  return matched;
}

/* fill the matched-students preview table */
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
  for (let i = 0; i < students.length; i++) {
    let s = students[i];
    html +=
      '<tr><td>' + s.roll + '</td>' +
      '<td>' + s.name + '</td>' +
      '<td>' + s.examCode + '</td></tr>';
  }
  body.innerHTML = html;
}

/* grey out courses/halls that would clash with the current picks.
   Uses Member A's getBusyStudents(). */
/* grey out courses that clash + wire the clash info bar (Member B) */
/* grey out courses that clash + wire the clash info bar (Member B) */
function applyClashPrevention() {
  var busy = getBusyStudents(pickedCourses);      // Member A's function
  var rows = document.querySelectorAll('#subjectList .pickRow');

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let course = row.dataset.course;
    let box = row.querySelector('input');

    // collect the actual rolls this course shares with the picked set
    let sharedRolls = [];
    if (pickedCourses.indexOf(course) === -1) {
      for (let s = 0; s < EM_DATA.students.length; s++) {
        let student = EM_DATA.students[s];
        if (student.subjects.indexOf(course) !== -1 && busy[student.roll]) {
          sharedRolls.push(student.roll);
        }
      }
    }

    if (sharedRolls.length > 0) {
      // LOCK this course (clash)
      row.classList.add('locked');
      box.disabled = true;

      let right = row.querySelector('.pickRight');
      if (right && !row.querySelector('.pickLock')) {
        right.className = 'pickLock';
      }
      let lock = row.querySelector('.pickLock');
      if (lock) lock.textContent = '🔒 locked · ' + sharedRolls.length + ' shared';

      // store the rolls on the row so hover can read them
      row.dataset.sharedRolls = sharedRolls.join(',');

      row.setAttribute('aria-disabled', 'true');
      row.setAttribute('aria-label',
        course + ' locked — shares ' + sharedRolls.length +
        ' students with a picked subject, so it cannot be scheduled in the same slot.');

      // hover → update the info bar below the list
      row.onmouseenter = function () { showClashInfo(course, sharedRolls); };
      row.onmouseleave = clearClashInfo;

    } else {
      // keep already-conducted courses locked — don't unlock them
      let usedCourses = getUsedCourses();
      if (usedCourses[course]) {
        continue;
      }

      // UNLOCK this course
      row.classList.remove('locked');
      box.disabled = false;
      row.onmouseenter = null;
      row.onmouseleave = null;
      delete row.dataset.sharedRolls;

      let lock = row.querySelector('.pickLock');
      if (lock) {
        lock.className = 'pickRight';
        lock.textContent = countStudentsForCourse(course) + ' students';
      }
    }
  }
}


/* show the clash detail in the info bar (first 3 rolls + "+N more") */
function showClashInfo(course, rolls) {
  let infoEl = document.getElementById('clashInfo');
  if (!infoEl) return;

  let shown = rolls.slice(0, 3).join(', ');
  let extra = rolls.length - 3;
  let moreText = extra > 0 ? ' <span class="clashMore">+' + extra + ' more</span>' : '';

  infoEl.className = 'clashInfo';
  infoEl.innerHTML =
    '<span><b>' + course + '</b> shares ' + rolls.length +
    ' students with your picked subjects, so it is locked.</span> ' +
    '<span class="clashRolls">' + shown + '</span>' + moreText;
}

/* reset the info bar */
function clearClashInfo() {
  let infoEl = document.getElementById('clashInfo');
  if (!infoEl) return;
  infoEl.className = 'clashInfo clashInfo--idle';
  infoEl.innerHTML = '<span>Hover a locked subject to see which students clash.</span>';
}

/* clear all picked subjects and halls, then reset the UI (Member B) */
function clearAllPicks() {
  // uncheck every subject and hall checkbox
  let allBoxes = document.querySelectorAll('#subjectList input, #hallList input');
  for (let i = 0; i < allBoxes.length; i++) {
    allBoxes[i].checked = false;
  }
  // rebuild state + refresh everything (reuses the existing onPickChange)
  onPickChange();
}


/* =========================================================
   ============  [MEMBER C] VALIDATE + SAVE  ==============
   Status: DONE
========================================================= */

function updateStatusBar() {

  let totalSeats = 0;
  for (let i = 0; i < pickedHalls.length; i++) {
    for (let h = 0; h < EM_DATA.halls.length; h++) {
      let hall = EM_DATA.halls[h];
      if (hall.hallNo === pickedHalls[i]) {
        totalSeats += hall.rows * hall.cols;
        break;
      }
    }
  }

  let students = getMatchedStudents();
  let studentCount = students.length;

  let statusMsg = document.getElementById("statusMsg");
  let statusText = document.getElementById("statusText");
  let generateBtn = document.getElementById("generateBtn");

  if (!statusMsg || !statusText || !generateBtn) {
    return;
  }

  if (pickedCourses.length === 0 && pickedHalls.length === 0) {
    statusMsg.className = "statusMsg neutral";
    statusText.textContent =
      "Pick subjects and halls to begin.";
    generateBtn.disabled = true;
    return;
  }

  if (pickedCourses.length === 0) {
    statusMsg.className = "statusMsg neutral";
    statusText.textContent =
      "Pick at least one subject.";
    generateBtn.disabled = true;
    return;
  }

  if (pickedHalls.length === 0) {
    statusMsg.className = "statusMsg neutral";
    statusText.textContent =
      studentCount + " students selected · Pick at least one hall.";
    generateBtn.disabled = true;
    return;
  }

  if (totalSeats >= studentCount) {
    statusMsg.className = "statusMsg good";
    statusText.textContent =
      totalSeats + " seats available · " +
      studentCount + " students selected · " +
      "Ready to generate.";
    generateBtn.disabled = false;
  }

  else {
    let shortage = studentCount - totalSeats;
    statusMsg.className = "statusMsg bad";
    statusText.textContent =
      totalSeats + " seats available · " +
      studentCount + " students selected · " +
      shortage + " more seat" +
      (shortage === 1 ? "" : "s") +
      " required.";
    generateBtn.disabled = true;
  }
}

function generateAndSave() {

  let examName = document.getElementById("examName").value.trim();
  let date = document.getElementById("examDate").value;
  let slot = document.getElementById("examSlot").value;

  if (examName === "") {
    alert("Please enter an exam name.");
    document.getElementById("examName").focus();
    return;
  }

  if (date === "") {
    alert("Please select an exam date.");
    document.getElementById("examDate").focus();
    return;
  }

  if (slot === "") {
    alert("Please select an exam slot.");
    document.getElementById("examSlot").focus();
    return;
  }

  if (pickedCourses.length === 0) {
    alert("Please select at least one subject.");
    return;
  }

  if (pickedHalls.length === 0) {
    alert("Please select at least one hall.");
    return;
  }

  let students = getMatchedStudents();
  if (students.length === 0) {
    alert("No students found for the selected subjects.");
    return;
  }

  let totalSeats = 0;
  for (let i = 0; i < pickedHalls.length; i++) {
    for (let h = 0; h < EM_DATA.halls.length; h++) {
      let hall = EM_DATA.halls[h];
      if (hall.hallNo === pickedHalls[i]) {
        totalSeats += hall.rows * hall.cols;
        break;
      }
    }
  }

  if (totalSeats < students.length) {
    alert(
      "Not enough seats.\n\n" +
      "Students: " + students.length + "\n" +
      "Available seats: " + totalSeats
    );
    return;
  }

  let exam = {
    examName: examName,
    date: date,
    slot: slot,
    pickedCourses: pickedCourses,
    pickedHalls: pickedHalls,
    students: students
  };

  // give each exam a stable id + timestamp (dashboard uses these)
  exam.id = "exam_" + Date.now();
  exam.createdAt = Date.now();

  // keep the single "current exam" seating.html relies on
  localStorage.setItem("em_currentExam", JSON.stringify(exam));

  // append to the exam list the dashboard reads
  let emExams = [];
  try {
    emExams = JSON.parse(localStorage.getItem("em_exams")) || [];
    if (!Array.isArray(emExams)) emExams = [];
  } catch (e) {
    emExams = [];
  }
  emExams.push(exam);
  localStorage.setItem("em_exams", JSON.stringify(emExams));

  window.location.href = "seating.html";

}


/* =========================================================
   ==================  PAGE STARTUP  ======================
   Runs once data is loaded. (This wiring can stay as-is.)
========================================================= */
loadExamData(function () {
  document.getElementById("loadInfo").textContent =
    "✓ " + EM_DATA.subjects.length + " subjects · " +
    EM_DATA.halls.length + " halls · " +
    EM_DATA.students.length + " students loaded";

  renderSubjectPickers();   // Member A
  lockUsedCourses();        
  renderHallPickers();      // Member A

  let genBtn = document.getElementById("generateBtn");
  if (genBtn) { genBtn.addEventListener("click", generateAndSave); }  // Member C's function
});
