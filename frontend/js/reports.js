/* =========================================================
   ExamMatrix — REPORTS (admin)
   ---------------------------------------------------------
   Read-only view of what invigilators recorded for one exam:
   attendance per hall, absent students and incidents.

   Routes (admin only, via api.js):
     GET /api/exams             → exams for the picker
     GET /api/reports/:examId   → { exam, halls, absent, incidents }

   Report shape:
     { exam: { examId, examName, date, slot },
       halls: [ { hall, students, present, absent, invigilators: [ { invId, name } ] } ],
       absent: [ { roll, hall, code } ],
       incidents: [ { id, hall, roll, type, description, reportedBy: { invId, name }, createdAt } ] }

   Open as reports.html?examId=EXM-0001-0001 (old ?exam= links still work).
   ========================================================= */

/* ---------------- page state ---------------- */

let examsList = [];
let report = null;
let incidentFilter = "all";
let absentSearch = "";
let loadToken = 0;   // bumps on every exam switch; replies for an older exam are ignored

/* ---------------- helpers ---------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function formatDate(value) {
  const d = new Date(String(value || "") + "T00:00:00");
  if (isNaN(d)) return String(value || "");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(value) {
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function showMessage(text, isError) {
  const box = document.getElementById("report-msg");
  box.replaceChildren();
  if (text) box.appendChild(el("div", "form-msg " + (isError ? "err" : "ok"), text));
}

function emptyBox(iconClass, title, text, link) {
  const box = el("div", "no-exams");
  box.appendChild(el("i", iconClass));
  if (title) box.appendChild(el("strong", "", title));
  if (text) box.appendChild(el("span", "", text));
  if (link) {
    const a = el("a", "", link.text);
    a.href = link.href;
    box.appendChild(a);
  }
  return box;
}

function totals() {
  return report.halls.reduce(function (sum, h) {
    sum.students += h.students;
    sum.present += h.present;
    sum.absent += h.absent;
    return sum;
  }, { students: 0, present: 0, absent: 0 });
}

function setButtons() {
  document.getElementById("export-btn").disabled = !report;
  document.getElementById("print-btn").disabled = !report;
  document.getElementById("exam-picker").disabled = examsList.length === 0;
}

/* ---------------- render ---------------- */

function renderPicker(selectedId) {
  const picker = document.getElementById("exam-picker");
  picker.replaceChildren();
  examsList.forEach(function (e) {
    const option = el("option", "", e.examId + " · " + e.examName);
    option.value = e.examId;
    option.selected = e.examId === selectedId;
    picker.appendChild(option);
  });
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

  const absentEl = document.getElementById("stat-absent");
  absentEl.textContent = t.absent;
  absentEl.classList.toggle("danger-text", t.absent > 0);

  const incidentsEl = document.getElementById("stat-incidents");
  incidentsEl.textContent = report.incidents.length;
  incidentsEl.classList.toggle("danger-text", report.incidents.length > 0);
}

function attendanceCell(h) {
  const unmarked = Math.max(0, h.students - h.present - h.absent);
  const bar = el("div", "att-bar");
  const present = el("span", "bar-present");
  present.style.width = percent(h.present, h.students) + "%";
  const absent = el("span", "bar-absent");
  absent.style.width = percent(h.absent, h.students) + "%";
  bar.append(present, absent);

  const numbers = el("div", "att-numbers");
  numbers.append(el("b", "", h.present), document.createTextNode(" present · "),
    el("b", "", h.absent), document.createTextNode(" absent · "),
    el("b", "", unmarked), document.createTextNode(" unmarked"));

  const td = el("td");
  td.append(bar, numbers);
  return td;
}

function renderHalls() {
  const box = document.getElementById("hall-table");
  if (report.halls.length === 0) {
    box.replaceChildren(emptyBox("fa-solid fa-chair", "No seated halls", "Generate seating for this exam first."));
    return;
  }

  const tbody = el("tbody");
  report.halls.forEach(function (h) {
    const hallCell = el("td", "hall-cell");
    hallCell.append(el("strong", "", h.hall), el("span", "", h.students + " students"));

    const namesCell = el("td", "inv-names");
    if (h.invigilators.length) namesCell.textContent = h.invigilators.map(function (i) { return i.name; }).join(", ");
    else namesCell.appendChild(el("span", "unfilled-reason", "No invigilator assigned"));

    const tr = el("tr");
    tr.append(hallCell, namesCell, attendanceCell(h));
    tbody.appendChild(tr);
  });

  const headRow = el("tr");
  ["Hall", "Invigilators", "Attendance"].forEach(function (t) { headRow.appendChild(el("th", "", t)); });
  const thead = el("thead");
  thead.appendChild(headRow);

  const table = el("table", "assign-table");
  table.append(thead, tbody);
  box.replaceChildren(table);
}

function renderAbsent() {
  const box = document.getElementById("absent-list");
  const list = report.absent.filter(function (a) { return !absentSearch || a.roll.indexOf(absentSearch) !== -1; });

  document.getElementById("absent-sub").textContent = absentSearch
    ? list.length + " of " + report.absent.length + " absent students match"
    : report.absent.length + " student(s) marked absent in this exam.";

  if (report.absent.length === 0) {
    box.replaceChildren(emptyBox("fa-solid fa-user-check", "", "Nobody marked absent yet."));
    return;
  }
  if (list.length === 0) {
    box.replaceChildren(el("span", "section-subtitle", "No absent student with that roll number."));
    return;
  }

  box.replaceChildren.apply(box, list.map(function (a) {
    const chip = el("span", "absent-chip", a.roll);
    chip.appendChild(el("span", "", a.hall + " · " + a.code));
    return chip;
  }));
}

function filterChip(type, label, count) {
  const chip = el("button", "filter-chip" + (incidentFilter === type ? " active" : ""), label + " ");
  chip.type = "button";
  chip.dataset.type = type;
  chip.appendChild(el("b", "", count));
  return chip;
}

function renderIncidentFilters() {
  const box = document.getElementById("incident-filters");
  const counts = {};
  report.incidents.forEach(function (i) { counts[i.type] = (counts[i.type] || 0) + 1; });

  // the chosen type may not exist in a newly picked exam
  if (incidentFilter !== "all" && !counts[incidentFilter]) incidentFilter = "all";

  if (!report.incidents.length) { box.replaceChildren(); return; }
  const chips = [filterChip("all", "All", report.incidents.length)];
  Object.keys(counts).forEach(function (type) { chips.push(filterChip(type, type, counts[type])); });
  box.replaceChildren.apply(box, chips);
}

function renderIncidents() {
  const box = document.getElementById("incident-list");
  if (report.incidents.length === 0) {
    box.replaceChildren(emptyBox("fa-solid fa-shield-halved", "No incidents reported",
      "Invigilators report these from the Hall Duty page."));
    return;
  }

  const list = report.incidents.filter(function (i) { return incidentFilter === "all" || i.type === incidentFilter; });
  box.replaceChildren.apply(box, list.map(function (i) {
    const item = el("div", "incident-item");
    item.append(
      el("span", "incident-type", i.type),
      el("strong", "", i.hall + (i.roll ? " · " + i.roll : "")),
      document.createTextNode(i.description),
      el("div", "incident-meta", i.reportedBy.name + " · " + formatTime(i.createdAt))
    );
    return item;
  }));
}

function renderAll() {
  renderHeader();
  renderStats();
  renderHalls();
  renderAbsent();
  renderIncidentFilters();
  renderIncidents();
  setButtons();
}

/* ---------------- CSV export ---------------- */

// quotes commas/newlines, and stops Excel from running a cell that starts with = + - @
function csvCell(value) {
  let s = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvLine(cells) { return cells.map(csvCell).join(","); }

function buildCsv() {
  const e = report.exam;
  const lines = [csvLine(["Exam", e.examId, e.examName, e.date, e.slot]), ""];

  lines.push(csvLine(["Hall", "Students", "Present", "Absent", "Unmarked", "Invigilators"]));
  report.halls.forEach(function (h) {
    lines.push(csvLine([h.hall, h.students, h.present, h.absent, Math.max(0, h.students - h.present - h.absent),
      h.invigilators.map(function (i) { return i.name + " (" + i.invId + ")"; }).join("; ")]));
  });

  lines.push("", csvLine(["Absent roll", "Hall", "Subject"]));
  report.absent.forEach(function (a) { lines.push(csvLine([a.roll, a.hall, a.code])); });

  lines.push("", csvLine(["Incident type", "Hall", "Roll", "Description", "Reported by", "Time"]));
  report.incidents.forEach(function (i) {
    lines.push(csvLine([i.type, i.hall, i.roll, i.description, i.reportedBy.name, formatTime(i.createdAt)]));
  });

  return lines.join("\n");
}

function onExport() {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([buildCsv()], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = report.exam.examId + "-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);   // Safari needs a moment before revoking
}

/* ---------------- actions ---------------- */

function selectExam(examId) {
  const mine = ++loadToken;
  report = null;
  setButtons();
  showMessage("");
  document.getElementById("hall-table").replaceChildren(emptyBox("fa-solid fa-spinner fa-spin", "Loading…", ""));
  document.getElementById("absent-list").replaceChildren();
  document.getElementById("incident-filters").replaceChildren();
  document.getElementById("incident-list").replaceChildren();

  return api("GET", "/reports/" + encodeURIComponent(examId))
    .then(function (r) {
      if (mine !== loadToken) return;
      report = r;
      renderAll();
      history.replaceState(null, "", "?examId=" + encodeURIComponent(examId));
    })
    .catch(function (error) {
      if (mine !== loadToken) return;
      document.getElementById("hall-table").replaceChildren(
        emptyBox("fa-solid fa-triangle-exclamation", "Could not load the report", error.message));
    });
}

function onFilterClick(event) {
  const chip = event.target.closest(".filter-chip");
  if (!chip || !report) return;
  incidentFilter = chip.dataset.type;
  renderIncidentFilters();
  renderIncidents();
}

function onAbsentSearch(event) {
  absentSearch = event.target.value.trim().toUpperCase();
  if (report) renderAbsent();
}

/* ---------------- start ---------------- */

const params = new URLSearchParams(window.location.search);
const requestedExam = String(params.get("examId") || params.get("exam") || "").trim().toUpperCase();

setButtons();

api("GET", "/exams")
  .then(function (exams) {
    examsList = Array.isArray(exams) ? exams : [];
    setButtons();
    if (!examsList.length) {
      document.getElementById("hall-table").replaceChildren(emptyBox("fa-regular fa-calendar", "No exams yet",
        "Create an exam first.", { href: "createExam.html", text: "Create exam" }));
      return;
    }
    const found = examsList.some(function (e) { return e.examId === requestedExam; });
    const selected = found ? requestedExam : examsList[0].examId;
    renderPicker(selected);
    return selectExam(selected).then(function () {
      if (requestedExam && !found) showMessage("Exam " + requestedExam + " was not found, so the first exam is shown.", true);
    });
  })
  .catch(function (error) {
    document.getElementById("hall-table").replaceChildren(
      emptyBox("fa-solid fa-triangle-exclamation", "Could not load exams", error.message));
  });

document.getElementById("exam-picker").addEventListener("change", function (e) { selectExam(e.target.value); });
document.getElementById("incident-filters").addEventListener("click", onFilterClick);
document.getElementById("absent-search").addEventListener("input", onAbsentSearch);
document.getElementById("export-btn").addEventListener("click", onExport);
document.getElementById("print-btn").addEventListener("click", function () { if (report) window.print(); });