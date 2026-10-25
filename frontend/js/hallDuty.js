/* =========================================================
   ExamMatrix — HALL DUTY (seat chart, attendance, incidents)
   ---------------------------------------------------------
   Opened from My Duties as hallDuty.html?duty=<dutyId>.
   Everything comes from MongoDB through the server (via api.js):
     GET  /api/invigilators/me/duties/:dutyId → { id, exam, hall, position, grid, marks, incidents }
     PUT  /api/exams/:examId/hall/attendance  → { hall, marks: [{ roll, status }] }
     POST /api/exams/:examId/hall/incidents   → { hall, roll?, type, description }
   The server only saves "present" or "absent"; a mark can be changed but not removed.
   Needs config.js, api.js and inv-shell.js loaded first (invReady).
   ========================================================= */

// true ONLY while testing on a day that isn't the exam day. Never commit it as true.
const ALWAYS_EDITABLE = false;

// same list as backend/models/Incident.js
const INCIDENT_TYPES = [
  "Unfair means suspected",
  "Unauthorised material found",
  "Student unwell",
  "Seat dispute",
  "Late arrival",
  "Other"
];

const COURSE_PALETTE = ["#0f7a5c", "#2b6cb0", "#b7791f", "#c026d3", "#0891b2", "#65a30d", "#c0392b", "#7c3aed"];

/* ---------------- page state ---------------- */

let duty = null;            // the server reply
let marks = {};             // roll → "present" | "absent"
let incidents = [];
let searchRoll = "";
let canEdit = false;
let bulkSaving = false;
const saving = new Set();   // rolls whose mark is on its way to the server

/* ---------------- helpers ---------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function todayString() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatLongDate(value) {
  const d = new Date(String(value || "") + "T00:00:00");
  if (isNaN(d)) return String(value || "");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(value) {
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function rollOf(cell) {
  return cell && cell.roll ? String(cell.roll).trim().toUpperCase() : "";
}

function colorFor(code) {
  const i = duty.exam.subjects.indexOf(code);
  return COURSE_PALETTE[(i < 0 ? 0 : i) % COURSE_PALETTE.length];
}

function gridCols() {
  return duty.grid.reduce(function (max, row) { return Math.max(max, Array.isArray(row) ? row.length : 0); }, 0);
}

function allRolls() {
  const rolls = [];
  duty.grid.forEach(function (row) {
    (Array.isArray(row) ? row : []).forEach(function (cell) {
      const roll = rollOf(cell);
      if (roll) rolls.push(roll);
    });
  });
  return rolls;
}

function showBox(id, text, isError) {
  const box = document.getElementById(id);
  box.replaceChildren();
  if (text) box.appendChild(el("div", "form-msg " + (isError ? "err" : "ok"), text));
}

function hallPath(rest) {
  return "/exams/" + encodeURIComponent(duty.exam.examId) + "/hall" + rest;
}

/* ---------------- data ---------------- */

function saveMarks(list) {
  return api("PUT", hallPath("/attendance"), { hall: duty.hall, marks: list });
}

function saveIncident(incident) {
  return api("POST", hallPath("/incidents"), Object.assign({ hall: duty.hall }, incident));
}

/* ---------------- render: header + stats ---------------- */

function renderHeader() {
  const e = duty.exam;
  document.getElementById("hall-title").textContent = duty.hall + " · " + e.examName;
  document.getElementById("hall-sub").textContent =
    formatLongDate(e.date) + " · " + e.slot + " · " + e.subjects.join(", ") + " · Position #" + duty.position;
  document.getElementById("exam-id-pill").textContent = e.examId;
}

function renderStats() {
  const rolls = allRolls();
  const present = rolls.filter(function (r) { return marks[r] === "present"; }).length;
  const absent = rolls.filter(function (r) { return marks[r] === "absent"; }).length;

  document.getElementById("stat-students").textContent = rolls.length;
  document.getElementById("stat-present").textContent = present;
  document.getElementById("stat-absent").textContent = absent;
  document.getElementById("stat-unmarked").textContent = rolls.length - present - absent;
}

/* ---------------- render: legend + seat chart ---------------- */

function renderLegend() {
  const swatches = el("div", "legendSwatches");
  duty.exam.subjects.forEach(function (code) {
    const item = el("span", "legendItem");
    const dot = el("span", "legendDot");
    dot.style.background = colorFor(code);
    item.append(dot, document.createTextNode(code));
    swatches.appendChild(item);
  });
  swatches.append(el("span", "legendItem", "✓ present"), el("span", "legendItem", "✕ absent"));
  document.getElementById("legend").replaceChildren(el("span", "legendLabel", "Subjects"), swatches);
}

function renderChart() {
  const chart = document.getElementById("hall-chart");
  const rolls = allRolls();

  if (rolls.length === 0) {
    const box = el("div", "no-exams");
    box.append(el("i", "fa-solid fa-chair"), el("strong", "", "Nobody is seated in this hall"),
      el("span", "", "Ask the exam cell to check the seating."));
    chart.replaceChildren(box);
    return;
  }

  const rows = duty.grid.length;
  const cols = gridCols();
  const seats = el("div", "seatingGrid");
  seats.style.gridTemplateColumns = "repeat(" + cols + ",minmax(64px,1fr))";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = Array.isArray(duty.grid[r]) ? duty.grid[r][c] : null;
      const roll = rollOf(cell);
      if (!roll) { seats.appendChild(el("div", "seat empty")); continue; }

      const isMatch = searchRoll && roll.indexOf(searchRoll) !== -1;
      const classes = ["seat", marks[roll] || "", canEdit ? "tap" : "locked",
        saving.has(roll) ? "saving" : "", isMatch ? "hl" : "", searchRoll && !isMatch ? "dim" : ""];

      const seat = el("div", classes.filter(Boolean).join(" "));
      seat.style.background = colorFor(cell.code);
      seat.dataset.roll = roll;
      seat.title = roll + " · seat " + (r * cols + c + 1);
      seat.append(el("strong", "", roll), el("span", "", cell.code || ""));
      seats.appendChild(seat);
    }
  }

  const header = el("div", "hallHeader");
  header.append(el("h3", "hallTitle", duty.hall),
    el("span", "hallInfo", rows + "×" + cols + " · " + rolls.length + " students"));

  const card = el("div", "hallCard");
  card.append(header, el("div", "hallDirection", "↑ FRONT ↑"), seats);
  chart.replaceChildren(card);
}

function renderAll() {
  renderStats();
  renderChart();
  document.getElementById("mark-all-btn").disabled = !canEdit || bulkSaving;
}

/* ---------------- attendance actions ---------------- */

/* unmarked → present → absent → present (the server can't un-mark) */
function nextStatus(current) {
  return current === "present" ? "absent" : "present";
}

function onSeatClick(event) {
  const seat = event.target.closest(".seat[data-roll]");
  if (!seat || !canEdit || bulkSaving) return;

  const roll = seat.dataset.roll;
  if (saving.has(roll)) return;          // still saving the last tap on this seat

  const before = marks[roll];
  marks[roll] = nextStatus(before);       // show it straight away, undo if the server says no
  saving.add(roll);
  renderAll();

  saveMarks([{ roll: roll, status: marks[roll] }])
    .then(function () { showBox("att-msg", ""); })
    .catch(function (error) {
      if (before) marks[roll] = before; else delete marks[roll];
      showBox("att-msg", "Could not save " + roll + ": " + error.message, true);
    })
    .then(function () { saving.delete(roll); renderAll(); });
}

function onMarkRest() {
  if (!canEdit || bulkSaving) return;
  if (saving.size) { showBox("att-msg", "Wait a moment, a mark is still saving.", true); return; }

  const rest = allRolls().filter(function (r) { return !marks[r]; });
  if (rest.length === 0) { showBox("att-msg", "Everyone is already marked."); return; }
  if (!confirm("Mark " + rest.length + " unmarked student(s) present?")) return;

  bulkSaving = true;
  rest.forEach(function (r) { marks[r] = "present"; });
  renderAll();

  saveMarks(rest.map(function (r) { return { roll: r, status: "present" }; }))
    .then(function () { showBox("att-msg", rest.length + " student(s) marked present."); })
    .catch(function (error) {
      rest.forEach(function (r) { delete marks[r]; });
      showBox("att-msg", "Could not save: " + error.message, true);
    })
    .then(function () { bulkSaving = false; renderAll(); });
}

function onSearch(event) {
  searchRoll = event.target.value.trim().toUpperCase();
  renderChart();

  const result = document.getElementById("search-result");
  if (!searchRoll) { result.textContent = ""; return; }

  const hits = document.querySelectorAll(".seat.hl");
  result.textContent = hits.length ? hits.length + " found" : "No seat found";
  if (hits.length) hits[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ---------------- incidents ---------------- */

function option(value, label) {
  const o = el("option", "", label);
  o.value = value;
  return o;
}

function renderIncidentForm() {
  const type = document.getElementById("incident-type");
  type.replaceChildren.apply(type, INCIDENT_TYPES.map(function (t) { return option(t, t); }));

  const roll = document.getElementById("incident-roll");
  roll.replaceChildren(option("", "— Not about one student —"));
  allRolls().slice().sort().forEach(function (r) { roll.appendChild(option(r, r)); });
}

function renderIncidents() {
  const list = incidents.slice().sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
  document.getElementById("incident-count").textContent = list.length + " reported";
  const box = document.getElementById("incident-list");

  if (list.length === 0) {
    const empty = el("div", "no-exams");
    empty.append(el("i", "fa-regular fa-circle-check"), el("span", "", "Nothing reported yet."));
    box.replaceChildren(empty);
    return;
  }

  box.replaceChildren.apply(box, list.map(function (i) {
    const item = el("div", "incident-item");
    item.append(
      el("strong", "", i.type + (i.roll ? " · " + i.roll : "")),
      document.createTextNode(i.description),
      el("div", "incident-meta", formatTime(i.time))
    );
    return item;
  }));
}

function onIncidentSubmit(event) {
  event.preventDefault();
  if (!canEdit) return;

  const form = document.getElementById("incident-form");
  const button = form.querySelector("button[type=submit]");
  const description = document.getElementById("incident-desc").value.trim();

  if (!description) { showBox("incident-msg", "Add a short description first.", true); return; }
  if (description.length > 1000) { showBox("incident-msg", "Keep the description under 1000 characters.", true); return; }
  if (button.disabled) return;           // already sending

  button.disabled = true;
  saveIncident({
    roll: document.getElementById("incident-roll").value,
    type: document.getElementById("incident-type").value,
    description: description
  })
    .then(function (saved) {
      incidents.unshift(saved);
      renderIncidents();
      form.reset();
      showBox("incident-msg", "Report sent to the exam cell.");
    })
    .catch(function (error) { showBox("incident-msg", "Could not send report: " + error.message, true); })
    .then(function () { button.disabled = false; });
}

/* ---------------- lock outside the exam day ---------------- */

function setupLock() {
  const day = String(duty.exam.date || "").slice(0, 10);
  const today = todayString();
  canEdit = ALWAYS_EDITABLE || day === today;
  if (canEdit) return;

  let text = "Attendance and incidents can only be recorded on the exam day.";
  if (isDateString(day) && day > today) text = "Attendance opens on " + formatLongDate(day) + ".";
  if (isDateString(day) && day < today) text = "This exam was on " + formatLongDate(day) + ". Attendance is closed.";

  const note = document.getElementById("lock-note");
  note.textContent = text;
  note.style.display = "block";
  document.querySelectorAll("#incident-form select, #incident-form textarea, #incident-form button")
    .forEach(function (field) { field.disabled = true; });
}

/* ---------------- start ---------------- */

function showLoadError(message) {
  document.getElementById("hall-sub").textContent = "Could not load this hall";
  const box = el("div", "no-exams");
  const back = el("a", "matrix-btn", "Back to My Duties");
  back.href = "invigilatorDashboard.html";
  box.append(el("i", "fa-solid fa-triangle-exclamation"), el("strong", "", "Could not load this hall"),
    el("span", "", message), back);
  document.getElementById("hall-chart").replaceChildren(box);
  document.getElementById("mark-all-btn").disabled = true;
}

const dutyId = String(new URLSearchParams(window.location.search).get("duty") || "").trim();

invReady
  .then(function (profile) {
    if (!profile) return null;                       // inv-shell is already sending them to login
    if (!dutyId) throw new Error("No duty was picked. Open a hall from My Duties.");
    return api("GET", "/invigilators/me/duties/" + encodeURIComponent(dutyId));
  })
  .then(function (data) {
    if (!data) return;
    duty = data;
    duty.grid = Array.isArray(data.grid) ? data.grid : [];
    duty.exam.subjects = Array.isArray(data.exam.subjects) ? data.exam.subjects : [];
    marks = data.marks || {};
    incidents = Array.isArray(data.incidents) ? data.incidents : [];

    setupLock();
    renderHeader();
    renderLegend();
    renderAll();
    renderIncidentForm();
    renderIncidents();

    document.getElementById("hall-chart").addEventListener("click", onSeatClick);
    document.getElementById("mark-all-btn").addEventListener("click", onMarkRest);
    document.getElementById("roll-search").addEventListener("input", onSearch);
    document.getElementById("incident-form").addEventListener("submit", onIncidentSubmit);
  })
  .catch(function (error) {
    console.log("Could not load hall:", error);
    showLoadError(error.message);
  });