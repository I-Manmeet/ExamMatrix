/* =========================================================
   ExamMatrix — SEATING (reads Create Exam, seats by course code)
   ---------------------------------------------------------
   Reads the exam saved by createExam.js (localStorage "em_currentExam"):
     { examName, date, slot, pickedCourses, pickedHalls,
       students: [ { roll, name, examCode }, ... ] }

   Seats students across the picked halls so no two students with the
   SAME examCode sit orthogonally adjacent (front/back/left/right).
   Overflows across halls, renders to the page, fills metrics + legend,
   wires find-my-seat + CSV export.

   Run via Live Server (data.js fetch needs a server).
========================================================= */

var currentExam = null;   // loaded from localStorage
var hallResults = [];     // [ { hall, grid:[[cell|null,...],...] }, ... ]
var stats = { conflicts: 0, hallsUsed: 0, utilization: 0, backtracks: 0, unplaced: [] };


/* ---- colour: use Anupam's branch classes, fallback inline for others ---- */
/* ---- colour: a distinct, readable colour generated PER course code ---- */
// No fixed list — colours are generated with the golden-angle so any number
// of subjects stay far apart on the colour wheel. Fixed S/L keeps white text readable.
var courseColorMap = {};
var GOLDEN_ANGLE = 137.508;   // degrees — spreads hues maximally

function styleForCourse(courseCode) {
  if (!(courseCode in courseColorMap)) {
    var index = Object.keys(courseColorMap).length;      // 0, 1, 2, ...
    var hue = (index * GOLDEN_ANGLE) % 360;              // next well-spaced hue
    // saturation 68%, lightness 40% -> rich + dark enough for white text
    courseColorMap[courseCode] = "hsl(" + hue.toFixed(1) + ", 68%, 40%)";
  }
  return { cls: "", color: courseColorMap[courseCode] };
}


/* ---- anti-cheat neighbour check (no same course code adjacent) ---- */
function fits(grid, row, col, student) {
  var rows = grid.length, cols = grid[0].length;
  var nb = [[row-1,col],[row+1,col],[row,col-1],[row,col+1]];
  for (var i = 0; i < nb.length; i++) {
    var r = nb[i][0], c = nb[i][1];
    if (r < 0 || r >= rows || c < 0 || c >= cols) { continue; }
    var neighbour = grid[r][c];
    if (neighbour !== null && neighbour.examCode === student.examCode) { return false; }
  }
  return true;
}


/* ---- order students: biggest course first, interleaved ---- */
function buildQueue(students) {
  var groups = {};
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (!groups[s.examCode]) { groups[s.examCode] = []; }
    groups[s.examCode].push(s);
  }
  var groupList = Object.keys(groups).map(function (k) { return groups[k]; });
  groupList.sort(function (a, b) { return b.length - a.length; });

  var queue = [], more = true;
  while (more) {
    more = false;
    for (var g = 0; g < groupList.length; g++) {
      if (groupList[g].length > 0) { queue.push(groupList[g].shift()); more = true; }
    }
  }
  return queue;
}


/* ---- solve: place queue across picked halls, overflow allowed ---- */
/* ---- solve: place queue across picked halls, fits() is a HARD rule ---- */
function solveSeating(exam) {
  var grids = [];
  for (var i = 0; i < exam.pickedHalls.length; i++) {
    var hall = null;
    for (var h = 0; h < EM_DATA.halls.length; h++) {
      if (EM_DATA.halls[h].hallNo === exam.pickedHalls[i]) { hall = EM_DATA.halls[h]; break; }
    }
    if (!hall) { continue; }
    var cells = [];
    for (var r = 0; r < hall.rows; r++) {
      var rowArr = [];
      for (var c = 0; c < hall.cols; c++) { rowArr.push(null); }
      cells.push(rowArr);
    }
    grids.push({ hall: hall, grid: cells });
  }

  var queue = buildQueue(exam.students);
  var backtracks = 0, unplaced = [];

  // place each student ONLY in a seat that passes fits(); never force a clash
  for (var qi = 0; qi < queue.length; qi++) {
    var student = queue[qi], placed = false;

    for (var g = 0; g < grids.length && !placed; g++) {
      var gr = grids[g].grid;
      for (var r = 0; r < gr.length && !placed; r++) {
        for (var c = 0; c < gr[0].length && !placed; c++) {
          if (gr[r][c] === null && fits(gr, r, c, student)) {
            gr[r][c] = student;
            placed = true;
          }
        }
      }
    }

    // no safe seat anywhere -> leave unplaced (prompts "add another hall")
    if (!placed) { unplaced.push(student); }
  }

  // verify + measure
  var conflicts = 0, totalSeats = 0, filled = 0, hallsUsed = 0;
  for (var gi = 0; gi < grids.length; gi++) {
    var g2 = grids[gi].grid, used = false;
    for (var r = 0; r < g2.length; r++)
      for (var c = 0; c < g2[0].length; c++) {
        totalSeats++;
        var cell = g2[r][c];
        if (cell) {
          filled++; used = true;
          var nb2 = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
          for (var n2 = 0; n2 < nb2.length; n2++) {
            var r4 = nb2[n2][0], c4 = nb2[n2][1];
            if (r4>=0 && r4<g2.length && c4>=0 && c4<g2[0].length) {
              var other = g2[r4][c4];
              if (other && other.examCode === cell.examCode) { conflicts++; }
            }
          }
        }
      }
    if (used) { hallsUsed++; }
  }
  conflicts = Math.floor(conflicts / 2);

  hallResults = grids;
  stats = {
    conflicts: conflicts,
    hallsUsed: hallsUsed,
    utilization: totalSeats ? Math.round((filled / totalSeats) * 100) : 0,
    backtracks: backtracks,
    unplaced: unplaced
  };
}


/* ---- render everything into the page ---- */
function renderSeating() {
  var titleEl = document.getElementById("examTitle");
  var subEl = document.getElementById("examSub");
  if (titleEl) { titleEl.textContent = currentExam.examName; }
  if (subEl) {
    subEl.textContent = fmtDate(currentExam.date) + " · " + currentExam.slot + " · " +
      currentExam.pickedCourses.join(", ");
  }

  var legendEl = document.getElementById("legendSwatches");
  if (legendEl) {
    var lh = "";
    for (var i = 0; i < currentExam.pickedCourses.length; i++) {
      var code = currentExam.pickedCourses[i], st = styleForCourse(code);
      var dot = st.cls ? '<span class="legendDot ' + st.cls + '"></span>'
                       : '<span class="legendDot" style="background:' + st.color + '"></span>';
      lh += '<span class="legendItem">' + dot + code + '</span>';
    }
    legendEl.innerHTML = lh;
  }

  setText("metricConflicts", stats.conflicts);
  setText("metricHalls", stats.hallsUsed);
  setText("metricUtilization", stats.utilization + "%");
  setText("metricBacktracks", stats.backtracks);

  var container = document.getElementById("hallsContainer");
  if (!container) { return; }

  var hallsHtml = "";
  for (var g = 0; g < hallResults.length; g++) {
    var hall = hallResults[g].hall, grid = hallResults[g].grid, hasStudents = false;
    for (var r = 0; r < grid.length; r++)
      for (var c = 0; c < grid[0].length; c++) if (grid[r][c]) { hasStudents = true; }
    if (!hasStudents) { continue; }

    var seatsHtml = "";
    for (var r2 = 0; r2 < hall.rows; r2++)
      for (var c2 = 0; c2 < hall.cols; c2++) {
        var s = grid[r2][c2];
        if (s) {
          var st2 = styleForCourse(s.examCode);
          var clsAttr = st2.cls ? (" " + st2.cls) : "";
          var styleAttr = st2.color ? (' style="background:' + st2.color + '"') : "";
          seatsHtml += '<div class="seat' + clsAttr + '"' + styleAttr + ' data-roll="' + s.roll + '">' +
            '<strong>' + s.roll + '</strong><span>' + s.examCode + '</span></div>';
        } else {
          seatsHtml += '<div class="seat empty"></div>';
        }
      }

    hallsHtml +=
      '<div class="hallCard"><div class="hallHeader">' +
        '<h3 class="hallTitle">' + hall.hallNo + '</h3>' +
        '<span class="hallInfo">' + hall.rows + 'x' + hall.cols + ' · ' + (hall.rows*hall.cols) + ' seats</span>' +
      '</div><div class="hallDirection">↑ FRONT ↑</div>' +
      '<div class="seatingGrid" style="grid-template-columns:repeat(' + hall.cols + ',minmax(65px,1fr))">' +
        seatsHtml + '</div></div>';
  }
  container.innerHTML = hallsHtml;

    if (stats.unplaced && stats.unplaced.length > 0) {
    var rolls = stats.unplaced.map(function (s) { return s.roll; }).join(", ");
    container.innerHTML +=
      '<div class="hallCard" style="border-color:#dc2626;background:#fef2f2;color:#b91c1c">' +
      '⚠ ' + stats.unplaced.length + ' student(s) could not be seated safely. ' +
      'Please go back to <a href="createExam.html">Create Exam</a> and select more halls.' +
      '<br><span style="opacity:.8">Unseated: ' + rolls + '</span></div>';
  }

}


/* ---- find my seat ---- */
function setupSearch() {
  var input = document.getElementById("seatSearchInput");
  if (!input) { return; }
  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    var seats = document.querySelectorAll("#hallsContainer .seat");
    for (var i = 0; i < seats.length; i++) {
      var roll = (seats[i].getAttribute("data-roll") || "").toLowerCase();
      if (!q) { seats[i].style.outline = ""; seats[i].style.opacity = ""; }
      else if (roll === q) { seats[i].style.outline = "3px solid #111827"; seats[i].style.opacity = "1"; }
      else { seats[i].style.outline = ""; seats[i].style.opacity = "0.25"; }
    }
  });
}


/* ---- export CSV ---- */
function setupExport() {
  var btn = document.getElementById("exportBtn");
  if (!btn) { return; }
  btn.addEventListener("click", function () {
    var rows = [["Hall", "Row", "Col", "Roll", "ExamCode"]];
    for (var g = 0; g < hallResults.length; g++) {
      var hall = hallResults[g].hall, grid = hallResults[g].grid;
      for (var r = 0; r < grid.length; r++)
        for (var c = 0; c < grid[0].length; c++) {
          var s = grid[r][c];
          if (s) { rows.push([hall.hallNo, r+1, c+1, s.roll, s.examCode]); }
        }
    }
    var csv = rows.map(function (row) {
      return row.map(function (x) { return '"' + x + '"'; }).join(",");
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = (currentExam.examName || "seating") + ".csv";
    a.click();
  });
}


/* ---- utils ---- */
function setText(id, v) { var el = document.getElementById(id); if (el) { el.textContent = v; } }
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("en", { day:"numeric", month:"short", year:"numeric" }); }
  catch (e) { return d; }
}


/* ---- startup ---- */
(function init() {
  try { currentExam = JSON.parse(localStorage.getItem("em_currentExam")); }
  catch (e) { currentExam = null; }

  if (!currentExam) {
    var container = document.getElementById("hallsContainer");
    if (container) {
      container.innerHTML = '<div class="hallCard">No exam has been generated yet. ' +
        'Go to <a href="createExam.html">Create Exam</a> to build one.</div>';
    }
    return;
  }

  loadExamData(function () {
    solveSeating(currentExam);
    renderSeating();
    setupSearch();
    setupExport();
  });
})();
