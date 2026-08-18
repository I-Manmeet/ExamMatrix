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


/* =========================================================
   ===========  [MEMBER A] LOAD + RENDER + DETECT  ========
   Status: DONE
========================================================= */

/* colour per course (simple palette) */
let COURSE_PALETTE = ["#0f7a5c","#2b6cb0","#b7791f","#c026d3","#0891b2","#65a30d","#c0392b","#7c3aed","#0e7490","#a16207","#be123c","#4338ca"];
let courseColorMap = {};
function colorFor(code){
  if (!(code in courseColorMap)) {
    courseColorMap[code] = COURSE_PALETTE[Object.keys(courseColorMap).length % COURSE_PALETTE.length];
  }
  return courseColorMap[code];
}

/* how many students take a given course */
function countStudentsForCourse(courseCode){
  let n = 0;
  for (let i = 0; i < EM_DATA.students.length; i++) {
    if (EM_DATA.students[i].subjects.indexOf(courseCode) !== -1) { n++; }
  }
  return n;
}

/* render the subject checkboxes from subjects.json */
function renderSubjectPickers(){
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
function renderHallPickers(){
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
function getBusyStudents(coursesToCheck){
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
function fits(grid, row, col, student){

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

function onPickChange(){
  // TODO [MEMBER B]
}

function getMatchedStudents(){
  // TODO [MEMBER B]
  return [];
}

function applyClashPrevention(){
  // TODO [MEMBER B]  (use getBusyStudents(pickedCourses) from Member A)
}


/* =========================================================
   ============  [MEMBER C] VALIDATE + SAVE  ==============
   Status: TODO

   WRITE:
     updateStatusBar()   - total seats (sum of picked halls' rows*cols)
                           vs matched student count. If enough -> green,
                           enable #generateBtn; else -> red/neutral, disable.
     generateAndSave()   - collect { examName, date, slot, pickedCourses,
                           pickedHalls, students } and save to localStorage
                           key "em_currentExam", then redirect to seating.html.

   HINT: localStorage.setItem("em_currentExam", JSON.stringify(exam));
         window.location.href = "seating.html";
========================================================= */

function updateStatusBar(){
  // TODO [MEMBER C]
}

function generateAndSave(){
  // TODO [MEMBER C]
}


/* =========================================================
   ==================  PAGE STARTUP  ======================
   Runs once data is loaded. (This wiring can stay as-is.)
========================================================= */
loadExamData(function(){
  document.getElementById("loadInfo").textContent =
    "✓ " + EM_DATA.subjects.length + " subjects · " +
    EM_DATA.halls.length + " halls · " +
    EM_DATA.students.length + " students loaded";

  renderSubjectPickers();   // Member A
  renderHallPickers();      // Member A

  let genBtn = document.getElementById("generateBtn");
  if (genBtn) { genBtn.addEventListener("click", generateAndSave); }  // Member C's function
});
