/* =========================================================
   SEATING RESULT — js/seating.js
   Needs config.js, api.js and app-shell.js loaded first.
   Shows the seat map the server saved for one exam:
     seating.html?examId=EXM-0001-0001
   With no examId it opens the newest exam.
   Seats are worked out on the server (backend/utils/seating.js),
   so this page only draws them.
========================================================= */

let currentExam = null;
let hallResults = [];   // [ { hallNo, grid: [[{ roll, code } | null]] } ]


/* ---- colour: a distinct, readable colour generated PER course code ---- */
// golden-angle hues stay far apart for any number of subjects; fixed S/L keeps white text readable
let seatColorMap = {};
let GOLDEN_ANGLE = 137.508;

function colorForCourse(code) {
  if (!(code in seatColorMap)) {
    let hue = (Object.keys(seatColorMap).length * GOLDEN_ANGLE) % 360;
    seatColorMap[code] = "hsl(" + hue.toFixed(1) + ", 68%, 40%)";
  }
  return seatColorMap[code];
}


/* ---- utils ---- */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setText(id, v) {
  let el = document.getElementById(id);
  if (el) { el.textContent = v; }
}

// "2026-11-02" → "2 Nov 2026" (read as a local date so it never shifts a day)
function fmtDate(d) {
  let date = new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) { return d; }
  return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function examIdFromPage() {
  let id = (new URLSearchParams(window.location.search).get("examId") || "").trim().toUpperCase();
  return /^EXM-\d{4}-\d{4}$/.test(id) ? id : "";   // old browser ids like "exam_123" are ignored
}


/* ---- load one exam (or the newest one) from the server ---- */
function loadExam() {
  let id = examIdFromPage();
  if (id) { return api("GET", "/exams/" + encodeURIComponent(id)); }

  return api("GET", "/exams").then(function (list) {
    if (!list.length) { return null; }
    let newest = list.slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    })[0];
    return api("GET", "/exams/" + encodeURIComponent(newest.examId));
  });
}


/* ---- empty / error card (same look as before) ---- */
function showEmpty(title, text) {
  let container = document.getElementById("hallsContainer");
  if (container) {
    container.innerHTML =
      '<div class="hallCard" style="text-align:center;padding:56px 24px;border-style:dashed">' +
      '<div style="width:64px;height:64px;margin:0 auto 16px;border-radius:50%;' +
      'background:rgba(15,122,92,.10);display:flex;align-items:center;justify-content:center">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="17" rx="2"></rect>' +
      '<line x1="3" y1="9" x2="21" y2="9"></line>' +
      '<line x1="8" y1="2" x2="8" y2="6"></line>' +
      '<line x1="16" y1="2" x2="16" y2="6"></line>' +
      '</svg></div>' +
      '<h2 class="examTitle" style="margin:0 0 8px">' + escapeHtml(title) + '</h2>' +
      '<p class="examSub" style="max-width:380px;margin:0 auto 24px">' + escapeHtml(text) + '</p>' +
      '<a href="createExam.html" style="display:inline-flex;align-items:center;gap:8px;' +
      'background:var(--emerald);color:#fff;font-family:var(--ui);font-size:13.5px;' +
      'font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none;' +
      'box-shadow:0 4px 12px rgba(15,122,92,.2)">+ Create Exam</a>' +
      '</div>';
  }

  setText("examTitle", title);
  setText("examSub", "");
  let legend = document.getElementById("legendSwatches");
  if (legend) { legend.innerHTML = ""; }
  setText("metricConflicts", "0");
  setText("metricHalls", "0");
  setText("metricUtilization", "0%");
  setText("metricBacktracks", "0");
}


/* ---- render everything into the page ---- */
function renderSeating() {
  let exam = currentExam;
  let seatMap = exam.seatMap || {};
  let stats = exam.stats || {};

  setText("examTitle", exam.examName);
  setText("examSub", fmtDate(exam.date) + " · " + exam.slot + " · " + (exam.subjects || []).join(", "));
  document.title = exam.examName + " — Seating - ExamMatrix";

  let legendEl = document.getElementById("legendSwatches");
  if (legendEl) {
    legendEl.innerHTML = (exam.subjects || []).map(function (code) {
      return '<span class="legendItem" role="listitem"><span class="legendDot" style="background:' +
        colorForCourse(code) + '"></span>' + escapeHtml(code) + '</span>';
    }).join("");
  }

  setText("metricConflicts", stats.conflicts || 0);
  setText("metricHalls", stats.hallsUsed || Object.keys(seatMap).length);
  setText("metricUtilization", (stats.utilization || 0) + "%");
  setText("metricBacktracks", 0);   // the server's solver never backtracks

  // halls in the order they were filled
  let order = (exam.halls || []).filter(function (h) { return seatMap[h]; });
  Object.keys(seatMap).forEach(function (h) { if (order.indexOf(h) === -1) { order.push(h); } });
  hallResults = order.map(function (hallNo) { return { hallNo: hallNo, grid: seatMap[hallNo] || [] }; });

  let container = document.getElementById("hallsContainer");
  if (!container) { return; }

  if (!hallResults.length) {
    showEmpty("No seats in this exam", "This exam has no seated students.");
    return;
  }

  let hallsHtml = "";
  hallResults.forEach(function (h) {
    let rows = h.grid.length;
    let cols = rows ? h.grid[0].length : 0;
    let filled = 0;
    let seatsHtml = "";

    h.grid.forEach(function (row) {
      row.forEach(function (cell) {
        if (cell) {
          filled++;
          seatsHtml += '<div class="seat" style="background:' + colorForCourse(cell.code) + '" data-roll="' +
            escapeHtml(cell.roll) + '"><strong>' + escapeHtml(cell.roll) + '</strong><span>' +
            escapeHtml(cell.code) + '</span></div>';
        } else {
          seatsHtml += '<div class="seat empty"></div>';
        }
      });
    });

    let seats = rows * cols;
    let util = seats ? Math.round((filled / seats) * 100) : 0;

    hallsHtml +=
      '<div class="hallCard"><div class="hallHeader">' +
      '<h3 class="hallTitle">' + escapeHtml(h.hallNo) + '</h3>' +
      '<span class="hallInfo">' + rows + 'x' + cols + ' · ' + seats + ' seats</span>' +
      '<span class="hallUtil">' + util + '% used</span>' +
      '</div>' +
      '<div class="hallUtilBar"><span style="width:' + util + '%"></span></div>' +
      '<div class="hallDirection">↑ FRONT ↑</div>' +
      '<div class="seatingGrid" style="grid-template-columns:repeat(' + cols + ',minmax(65px,1fr))">' +
      seatsHtml + '</div></div>';
  });
  container.innerHTML = hallsHtml;
}


/* ---- startup ---- */
adminReady
  .then(loadExam)
  .then(function (exam) {
    if (!exam) {
      showEmpty("No exams scheduled yet", "Create an exam to generate its seating plan and view hall allocation here.");
      return;
    }
    currentExam = exam;
    renderSeating();
  })
  .catch(function (err) {
    if (err.status === 404) {
      showEmpty("Exam not found", "It may have been deleted. Pick another exam from the dashboard.");
    } else if (!err.expired && err.message !== "Not an admin") {
      showEmpty("Couldn't load the seating", err.message);
    }
  });



/* ---- find my seat ---- */
function setupSearch() {
  let input = document.getElementById("seatSearchInput");
  if (!input) { return; }
  input.addEventListener("input", function () {
    let q = input.value.trim().toLowerCase();
    document.querySelectorAll("#hallsContainer .seat").forEach(function (seat) {
      let roll = (seat.getAttribute("data-roll") || "").toLowerCase();
      if (!q) {
        seat.style.outline = "";
        seat.style.opacity = "";
      } else if (roll === q) {
        seat.style.outline = "3px solid #111827";
        seat.style.opacity = "1";
        seat.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        seat.style.outline = "";
        seat.style.opacity = "0.25";
      }
    });
  });
}


/* ---- export CSV ---- */
// quotes are doubled, and values starting with = + - @ get a ' so Excel can't run them as formulas
function csvCell(value) {
  let text = String(value == null ? "" : value);
  if (/^[=+\-@]/.test(text)) { text = "'" + text; }
  return '"' + text.replace(/"/g, '""') + '"';
}

function setupExport() {
  let btn = document.getElementById("exportBtn");
  if (!btn) { return; }
  btn.addEventListener("click", function () {
    if (!currentExam) {
      alert("No exam is open yet.");
      return;
    }
    let rows = [["Hall", "Row", "Col", "Roll", "ExamCode"]];
    hallResults.forEach(function (h) {
      h.grid.forEach(function (row, r) {
        row.forEach(function (cell, c) {
          if (cell) { rows.push([h.hallNo, r + 1, c + 1, cell.roll, cell.code]); }
        });
      });
    });

    let csv = rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n");
    let a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = (currentExam.examId + " " + currentExam.examName).replace(/[^\w\- ]+/g, "") + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
}

setupSearch();
setupExport();