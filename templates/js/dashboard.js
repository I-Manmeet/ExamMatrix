/* ============================================================
   ExamMatrix — Dashboard JS  (Team Member 1)
   Dynamic stat cards, recent-exams table, hall matrix,
   View links, New Exam button. Session gate is handled by
   app-shell.js (do not re-gate here).
   ============================================================ */

(function () {
  "use strict";

  var EXAMS_KEY   = "em_exams";        // list of saved exams
  var CURRENT_KEY = "em_currentExam";  // single exam createExam.js writes
  var SESSION_KEY = "em_session";      // sessionStorage, set by login.html
  var SEATING_PAGE = "seating.html";

  /* ---- Data access ---- */
  function getExams() {
    var list = [];
    try {
      var raw = localStorage.getItem(EXAMS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      }
    } catch (e) {}

    if (!list.length) {
      try {
        var cur = localStorage.getItem(CURRENT_KEY);
        if (cur) {
          var one = JSON.parse(cur);
          if (one && one.examName) {
            if (one.id == null) one.id = "current";
            list = [one];
          }
        }
      } catch (e) {}
    }
    return list;
  }

  function getUsername() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && s.username ? s.username : "";
    } catch (e) { return ""; }
  }

  /* ---- Helpers ---- */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function studentCount(ex) { return Array.isArray(ex.students) ? ex.students.length : 0; }
  function examHalls(ex) { return Array.isArray(ex.pickedHalls) ? ex.pickedHalls : []; }
  function examConflicts(ex) {
    if (Array.isArray(ex.conflicts)) return ex.conflicts.length;
    return num(ex.conflicts);
  }

  /* ---- Occupancy: spread each exam's students across its halls ---- */
  function computeOccupancy(exams) {
    var occ = {};
    exams.forEach(function (ex) {
      var halls = examHalls(ex);
      if (!halls.length) return;
      var per = studentCount(ex) / halls.length;
      halls.forEach(function (h) {
        var key = String(h).trim();
        occ[key] = (occ[key] || 0) + per;
      });
    });
    return occ;
  }

  /* ---- Stat cards ---- */
  function renderStats(exams, occ) {
    var numbers = document.querySelectorAll("#stats .stat-number");
    if (!numbers.length) return;

    var examsScheduled = exams.length;
    var studentsSeated = exams.reduce(function (s, ex) { return s + studentCount(ex); }, 0);

    var allHalls = (typeof EM_DATA !== "undefined" && EM_DATA.halls) || [];
    var hallsAvailable = allHalls.length
      ? allHalls.filter(function (h) { return num(occ[h.hallNo]) <= 0; }).length
      : 0;

    var totalConflicts = exams.reduce(function (s, ex) { return s + examConflicts(ex); }, 0);

    setStat(numbers[0], examsScheduled);
    setStat(numbers[1], studentsSeated);
    setStat(numbers[2], hallsAvailable);
    setStat(numbers[3], totalConflicts, true);
  }

  function setStat(el, value, keepIcon) {
    if (!el) return;
    if (keepIcon) {
      var icon = el.querySelector("i");
      el.textContent = "";
      if (icon) el.appendChild(icon);
      el.appendChild(document.createTextNode(" " + value));
    } else {
      el.textContent = String(value);
    }
  }

  /* ---- Recent exams table ---- */
  function renderExamsTable(exams) {
    var tbody = document.querySelector("#exam-table tbody");
    if (!tbody) return;

    if (!exams.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">' +
        'No exams yet. Click <strong>+ New exam</strong> to create one.</td></tr>';
      return;
    }

    var rows = exams.slice().sort(function (a, b) {
      return num(b.createdAt) - num(a.createdAt);
    }).slice(0, 5);

    tbody.innerHTML = rows.map(function (ex, i) {
      var id       = ex.id != null ? ex.id : i;
      var name     = escapeHtml(ex.examName || "Untitled Exam");
      var courses  = Array.isArray(ex.pickedCourses) ? ex.pickedCourses : [];
      var subLine  = escapeHtml(courses.length ? courses.join(", ") : "—");
      var slot     = escapeHtml(ex.slot || "");
      var date     = escapeHtml(ex.date || "TBD");
      var dateTime = slot ? (date + " · " + slot) : date;

      return (
        '<tr>' +
          '<td><strong>' + name + '</strong><span class="sub-code">' + subLine + '</span></td>' +
          '<td>' + dateTime + '</td>' +
          '<td><span class="status-badge ready"><i class="fa-solid fa-circle"></i> Seating Ready</span></td>' +
          '<td class="text-right"><a href="#" class="action-link" data-exam-id="' +
            escapeHtml(id) + '">View Details &rarr;</a></td>' +
        '</tr>'
      );
    }).join("");
  }

  /* ---- Hall Capacity live matrix ---- */
  function hallState(pct) {
    if (pct >= 100) return { badge: "status-full",      bar: "bar-full",  label: "Filled" };
    if (pct >= 50)  return { badge: "status-occupied",  bar: "bar-blue",  label: "Occupied" };
    if (pct >  0)   return { badge: "status-available", bar: "bar-gold",  label: "Available" };
    return          { badge: "status-empty",     bar: "bar-empty", label: "Empty" };
  }

  function renderHallMatrix(occ) {
    var grid = document.querySelector(".capacity-grid");
    if (!grid) return;

    var halls = (typeof EM_DATA !== "undefined" && EM_DATA.halls) || [];
    if (!halls.length) {
      grid.innerHTML =
        '<div class="hall-card"><div class="hall-info-row">' +
        '<span class="hall-title">No halls loaded</span></div>' +
        '<div class="progress-bar-wrapper"><span class="empty-text">' +
        'Check that ../data/halls.json is reachable.</span></div></div>';
      return;
    }

    grid.innerHTML = halls.map(function (h) {
      var name     = escapeHtml(h.hallNo || "Hall");
      var capacity = num(h.rows) * num(h.cols);
      var seated   = Math.round(num(occ[h.hallNo]));
      if (seated > capacity) seated = capacity;
      var pct = capacity > 0 ? Math.round((seated / capacity) * 100) : 0;
      var s   = hallState(pct);
      var barInner = (pct === 0)
        ? '<span class="hall-percent empty-text">0%</span>'
        : '<span class="hall-percent">' + pct + '%</span>';

      return (
        '<div class="hall-card">' +
          '<div class="hall-info-row">' +
            '<span class="hall-title">' + name + '</span>' +
            '<div class="hall-meta">' +
              '<span class="capacity-count">' + seated + ' / ' + capacity + ' Seats</span>' +
              '<span class="hall-status-badge ' + s.badge + '"><i class="fa-solid fa-circle"></i> ' + s.label + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="progress-bar-wrapper">' +
            '<div class="progress-bar ' + s.bar + '" style="width: ' + pct + '%;">' + barInner + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  /* ---- View links (seating.html reads em_currentExam) ---- */
  function wireViewLinks(exams) {
    var table = document.getElementById("exam-table");
    if (!table) return;

    var byId = {};
    exams.forEach(function (ex, i) { byId[String(ex.id != null ? ex.id : i)] = ex; });

    table.addEventListener("click", function (e) {
      var link = e.target.closest(".action-link");
      if (!link) return;
      e.preventDefault();
      var id = link.getAttribute("data-exam-id");
      if (id == null || id === "") return;
      var exam = byId[id];
      if (exam) {
        try { localStorage.setItem(CURRENT_KEY, JSON.stringify(exam)); } catch (err) {}
      }
      window.location.href = SEATING_PAGE + "?examId=" + encodeURIComponent(id);
    });
  }

  /* ---- New Exam button (inline onclick already exists; fallback) ---- */
  function wireNewExam() {
    var btn = document.getElementById("new-exam-btn");
    if (!btn || btn.getAttribute("onclick")) return;
    btn.addEventListener("click", function () { window.location.href = "createExam.html"; });
  }

  /* ---- Render + init ---- */
  function renderAll() {
    var exams = getExams();
    var occ   = computeOccupancy(exams);
    renderStats(exams, occ);
    renderExamsTable(exams);
    renderHallMatrix(occ);
    wireViewLinks(exams);
    wireNewExam();
  }

  function init() {
    if (typeof loadExamData === "function") {
      loadExamData(renderAll);   // load halls.json first, then render
    } else {
      renderAll();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
