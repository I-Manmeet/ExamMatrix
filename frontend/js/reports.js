/* =========================================================
   ExamMatrix — REPORTS (admin)
   ---------------------------------------------------------
   Read-only view of what invigilators recorded for one exam:
   attendance per hall, absent students and incidents.

   Routes (all admin only):
     GET /api/exams             → list of exams for the picker (Jiya)
     GET /api/reports/:examId   → report (shape below)

   Report shape:
     { exam: { examId, examName, date, slot },
       halls: [ { hall, students, present, absent,
                  invigilators: [ { invId, name } ] } ],
       absent: [ { roll, hall, code } ],
       incidents: [ { id, hall, roll, type, description,
                      reportedBy: { invId, name }, createdAt } ] }
   ========================================================= */

// TODO(after-jiya): remove these two and use Jiya's config.js + api.js
const API_BASE = "http://localhost:5000/api";
function getToken() { return localStorage.getItem("em_token"); }

// TODO(after-jiya): set to false once GET /api/reports/:examId exists
const USE_DUMMY_REPORT = true;

/* ---------------- dummy data (same shape the route returns) ---------------- */

const DUMMY_EXAMS = [
  { examId: "EXM-0001-0001", examName: "Mid Sem · Systems",   date: "2026-10-27", slot: "09:00-12:00" },
  { examId: "EXM-0001-0002", examName: "Mid Sem · Databases", date: "2026-10-28", slot: "09:00-12:00" }
];

const DUMMY_REPORTS = {
  "EXM-0001-0001": {
    exam: DUMMY_EXAMS[0],
    halls: [
      { hall: "Hall A", students: 40, present: 35, absent: 3,
        invigilators: [{ invId: "INV-0001-0001", name: "Dr. Anjali Mehta" }, { invId: "INV-0001-0004", name: "Prof. Suresh Iyer" }] },
      { hall: "Hall C", students: 10, present: 9, absent: 1,
        invigilators: [{ invId: "INV-0001-0005", name: "Dr. Arnab Bose" }] }
    ],
    absent: [
      { roll: "21CS014", hall: "Hall A", code: "CS302" },
      { roll: "21IT007", hall: "Hall A", code: "CS303" },
      { roll: "21IT019", hall: "Hall A", code: "CS303" },
      { roll: "21CS041", hall: "Hall C", code: "CS302" }
    ],
    incidents: [
      { id: "i1", hall: "Hall A", roll: "21CS022", type: "Unfair means suspected",
        description: "Phone found under the desk during the first hour.",
        reportedBy: { invId: "INV-0001-0001", name: "Dr. Anjali Mehta" }, createdAt: "2026-10-27T10:12:00+05:30" },
      { id: "i2", hall: "Hall A", roll: "21IT003", type: "Student unwell",
        description: "Felt dizzy, taken to the medical room at 10:40 and returned at 11:00.",
        reportedBy: { invId: "INV-0001-0004", name: "Prof. Suresh Iyer" }, createdAt: "2026-10-27T10:45:00+05:30" },
      { id: "i3", hall: "Hall C", roll: "", type: "Other",
        description: "Fan not working in the back row.",
        reportedBy: { invId: "INV-0001-0005", name: "Dr. Arnab Bose" }, createdAt: "2026-10-27T09:20:00+05:30" }
    ]
  },
  // nothing marked yet: shows the empty states
  "EXM-0001-0002": {
    exam: DUMMY_EXAMS[1],
    halls: [
      { hall: "Hall B", students: 24, present: 0, absent: 0,
        invigilators: [{ invId: "INV-0001-0002", name: "Prof. Rajiv Sharma" }] }
    ],
    absent: [],
    incidents: []
  }
};

/* ---------------- page state ---------------- */

let report = null;
let incidentFilter = "all";
let absentSearch = "";

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function formatDate(isoDate) {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(isoDateTime) {
  return new Date(isoDateTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function showMessage(text, isError) {
  document.getElementById("report-msg").innerHTML = text
    ? '<div class="form-msg ' + (isError ? "err" : "ok") + '">' + escapeHtml(text) + "</div>"
    : "";
}

function totals() {
  return report.halls.reduce(function (sum, h) {
    sum.students += h.students;
    sum.present += h.present;
    sum.absent += h.absent;
    return sum;
  }, { students: 0, present: 0, absent: 0 });
}

// TODO(after-jiya): switch to Jiya's api.js helper
function request(method, path) {
  return fetch(API_BASE + path, {
    method: method,
    headers: { Authorization: "Bearer " + getToken() }
  }).then(function (res) {
    return res.json().then(function (json) {
      if (!res.ok) throw new Error(json.error || "Request failed: " + res.status);
      return json.data;
    });
  });
}

/* ---------------- data ---------------- */

function loadExams() {
  if (USE_DUMMY_REPORT) return Promise.resolve(DUMMY_EXAMS);
  return request("GET", "/exams");
}

function loadReport(examId) {
  if (USE_DUMMY_REPORT) return Promise.resolve(DUMMY_REPORTS[examId] || DUMMY_REPORTS[DUMMY_EXAMS[0].examId]);
  return request("GET", "/reports/" + encodeURIComponent(examId));
}

/* ---------------- render ---------------- */

function renderPicker(exams, selectedId) {
  document.getElementById("exam-picker").innerHTML = exams.map(function (e) {
    return '<option value="' + escapeHtml(e.examId) + '"' + (e.examId === selectedId ? " selected" : "") + ">" +
      escapeHtml(e.examId + " · " + e.examName) + "</option>";
  }).join("");
}

function renderHeader() {
  const e = report.exam;
  document.getElementById("exam-sub").textContent = e.examName + " · " + formatDate(e.date) + " · " + e.slot;
}

function renderStats() {
  const t = totals();
  const marked = t.present + t.absent;

  // % of the students who have been marked, so a half-marked exam isn't shown as "low attendance"
  document.getElementById("stat-rate").textContent = marked ? percent(t.present, marked) + "%" : "—";
  document.getElementById("stat-present").textContent = t.present;
  document.getElementById("stat-absent").textContent = t.absent;
    document.getElementById("stat-absent").classList.toggle("danger-text", t.absent > 0);

  const incidentsEl = document.getElementById("stat-incidents");
  incidentsEl.textContent = report.incidents.length;
  incidentsEl.classList.toggle("danger-text", report.incidents.length > 0);
}

function renderHalls() {
  const box = document.getElementById("hall-table");

  if (report.halls.length === 0) {
    box.innerHTML = '<div class="no-exams"><i class="fa-solid fa-chair"></i><strong>No seated halls</strong><span>Generate seating for this exam first.</span></div>';
    return;
  }

  const rows = report.halls.map(function (h) {
    const unmarked = Math.max(0, h.students - h.present - h.absent);
    const names = h.invigilators.length
      ? h.invigilators.map(function (i) { return escapeHtml(i.name); }).join(", ")
      : '<span class="unfilled-reason">No invigilator assigned</span>';

    return "<tr>" +
      '<td class="hall-cell"><strong>' + escapeHtml(h.hall) + "</strong><span>" + h.students + " students</span></td>" +
      '<td class="inv-names">' + names + "</td>" +
      "<td>" +
        '<div class="att-bar">' +
          '<span class="bar-present" style="width:' + percent(h.present, h.students) + '%"></span>' +
          '<span class="bar-absent" style="width:' + percent(h.absent, h.students) + '%"></span>' +
        "</div>" +
        '<div class="att-numbers"><b>' + h.present + "</b> present · <b>" + h.absent + "</b> absent · <b>" + unmarked + "</b> unmarked</div>" +
      "</td>" +
    "</tr>";
  }).join("");

  box.innerHTML =
    '<table class="assign-table"><thead><tr><th>Hall</th><th>Invigilators</th><th>Attendance</th></tr></thead>' +
    "<tbody>" + rows + "</tbody></table>";
}

function renderAbsent() {
  const box = document.getElementById("absent-list");
  const list = report.absent.filter(function (a) {
    return !absentSearch || a.roll.indexOf(absentSearch) !== -1;
  });

  document.getElementById("absent-sub").textContent = absentSearch
    ? list.length + " of " + report.absent.length + " absent students match"
    : report.absent.length + " student(s) marked absent in this exam.";

  if (report.absent.length === 0) {
    box.innerHTML = '<div class="no-exams" style="min-height:120px;width:100%"><i class="fa-solid fa-user-check"></i><span>Nobody marked absent yet.</span></div>';
    return;
  }
  if (list.length === 0) {
    box.innerHTML = '<span class="section-subtitle">No absent student with that roll number.</span>';
    return;
  }

  box.innerHTML = list.map(function (a) {
    return '<span class="absent-chip">' + escapeHtml(a.roll) + "<span>" + escapeHtml(a.hall + " · " + a.code) + "</span></span>";
  }).join("");
}

function renderIncidentFilters() {
  const counts = {};
  report.incidents.forEach(function (i) { counts[i.type] = (counts[i.type] || 0) + 1; });

  // the chosen type may not exist in a newly picked exam
  if (incidentFilter !== "all" && !counts[incidentFilter]) incidentFilter = "all";

  let html = '<button type="button" class="filter-chip' + (incidentFilter === "all" ? " active" : "") + '" data-type="all">All <b>' + report.incidents.length + "</b></button>";
  Object.keys(counts).forEach(function (type) {
    html += '<button type="button" class="filter-chip' + (incidentFilter === type ? " active" : "") + '" data-type="' + escapeHtml(type) + '">' +
      escapeHtml(type) + " <b>" + counts[type] + "</b></button>";
  });

  document.getElementById("incident-filters").innerHTML = report.incidents.length ? html : "";
}

function renderIncidents() {
  const box = document.getElementById("incident-list");

  if (report.incidents.length === 0) {
    box.innerHTML = '<div class="no-exams"><i class="fa-solid fa-shield-halved"></i><strong>No incidents reported</strong><span>Invigilators report these from the Hall Duty page.</span></div>';
    return;
  }

  const list = report.incidents
    .filter(function (i) { return incidentFilter === "all" || i.type === incidentFilter; })
    .slice()
    .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  box.innerHTML = list.map(function (i) {
    return '<div class="incident-item">' +
      '<span class="incident-type">' + escapeHtml(i.type) + "</span>" +
      "<strong>" + escapeHtml(i.hall) + (i.roll ? " · " + escapeHtml(i.roll) : "") + "</strong>" +
      escapeHtml(i.description) +
      '<div class="incident-meta">' + escapeHtml(i.reportedBy.name) + " · " + formatTime(i.createdAt) + "</div>" +
    "</div>";
  }).join("");
}

function renderAll() {
  renderHeader();
  renderStats();
  renderHalls();
  renderAbsent();
  renderIncidentFilters();
  renderIncidents();
}

/* ---------------- CSV export ---------------- */

function csvCell(value) {
  const s = String(value == null ? "" : value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvLine(cells) { return cells.map(csvCell).join(","); }

function buildCsv() {
  const e = report.exam;
  const lines = [];

  lines.push(csvLine(["Exam", e.examId, e.examName, e.date, e.slot]));
  lines.push("");
  lines.push(csvLine(["Hall", "Students", "Present", "Absent", "Unmarked", "Invigilators"]));
  report.halls.forEach(function (h) {
    lines.push(csvLine([h.hall, h.students, h.present, h.absent, Math.max(0, h.students - h.present - h.absent),
      h.invigilators.map(function (i) { return i.name + " (" + i.invId + ")"; }).join("; ")]));
  });

  lines.push("");
  lines.push(csvLine(["Absent roll", "Hall", "Subject"]));
  report.absent.forEach(function (a) { lines.push(csvLine([a.roll, a.hall, a.code])); });

  lines.push("");
  lines.push(csvLine(["Incident type", "Hall", "Roll", "Description", "Reported by", "Time"]));
  report.incidents.forEach(function (i) {
    lines.push(csvLine([i.type, i.hall, i.roll, i.description, i.reportedBy.name, formatTime(i.createdAt)]));
  });

  return lines.join("\n");
}

function onExport() {
  if (!report) return;
  const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = report.exam.examId + "-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- actions ---------------- */

function selectExam(examId) {
  showMessage("");
  return loadReport(examId)
    .then(function (r) {
      report = r;
      renderAll();
      history.replaceState(null, "", "?exam=" + encodeURIComponent(examId));
    })
    .catch(function (error) { showMessage("Could not load the report: " + error.message, true); });
}

function onFilterClick(event) {
  const chip = event.target.closest(".filter-chip");
  if (!chip || !report) return;
  incidentFilter = chip.dataset.type;
  renderIncidentFilters();
  renderIncidents();
}

function onAbsentSearch(event) {
  if (!report) return;
  absentSearch = event.target.value.trim().toUpperCase();
  renderAbsent();
}

/* ---------------- start ---------------- */

const requestedExam = new URLSearchParams(window.location.search).get("exam");

loadExams()
  .then(function (exams) {
    if (!exams.length) {
      document.getElementById("hall-table").innerHTML =
        '<div class="no-exams"><i class="fa-regular fa-calendar"></i><strong>No exams yet</strong><span>Create an exam first.</span></div>';
      return;
    }
    const selected = exams.some(function (e) { return e.examId === requestedExam; }) ? requestedExam : exams[0].examId;
    renderPicker(exams, selected);
    return selectExam(selected);
  })
  .catch(function (error) {
    console.log("Could not load exams:", error);
    showMessage("Could not load exams: " + error.message, true);
  });

document.getElementById("exam-picker").addEventListener("change", function (e) { selectExam(e.target.value); });
document.getElementById("incident-filters").addEventListener("click", onFilterClick);
document.getElementById("absent-search").addEventListener("input", onAbsentSearch);
document.getElementById("export-btn").addEventListener("click", onExport);
document.getElementById("print-btn").addEventListener("click", function () { window.print(); });