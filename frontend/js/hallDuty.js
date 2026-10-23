/* =========================================================
   ExamMatrix — HALL DUTY (seat chart, attendance, incidents)
   ---------------------------------------------------------
   Opened from My Duties as hallDuty.html?duty=<dutyId>.
   Everything comes from MongoDB through the server:
     GET  /api/duties/:dutyId                → duty + hall + seat map + attendance + incidents
     PUT  /api/exams/:examId/attendance      → { hall, roll, status }  (status null = unmark)
     PUT  /api/exams/:examId/attendance/bulk → { hall, status }        (status null = reset)
     POST /api/exams/:examId/incidents       → { hall, roll, type, description }
   Needs inv-shell.js loaded first (invReady, API_BASE, getToken).
   ========================================================= */

// TODO(after-jiya): set to false once the duty / attendance / incident routes exist
const USE_DUMMY_HALL = true;

// TODO(after-jiya): set to false to lock attendance outside the exam day
const ALWAYS_EDITABLE = true;

const INCIDENT_TYPES = [
  "Unfair means suspected",
  "Unauthorised material found",
  "Student unwell",
  "Seat dispute",
  "Late arrival",
  "Other"
];

const COURSE_PALETTE = ["#0f7a5c", "#2b6cb0", "#b7791f", "#c026d3", "#0891b2", "#65a30d", "#c0392b", "#7c3aed"];

/* ---------------- dummy data (same shape the route will return) ---------------- */

function buildDummySeatMap(rows, cols) {
  const grid = [];
  let cs = 51, it = 1;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const isCS = (r + c) % 2 === 0;     // checkerboard, like the real seating result
      row.push(isCS
        ? { roll: "21CS" + String(cs++).padStart(3, "0"), code: "CS302" }
        : { roll: "21IT" + String(it++).padStart(3, "0"), code: "CS303" });
    }
    grid.push(row);
  }
  return grid;
}

const DUMMY_HALL = {
  duty: { id: "DTY-1", hall: "Hall A", position: 1, date: "2026-10-23", slot: "09:00-12:00" },
  exam: { examId: "EXM-0001-0001", examName: "Mid Sem · Systems", subjects: ["CS302", "CS303"] },
  hall: { hallNo: "Hall A", rows: 5, cols: 8 },
  seatMap: buildDummySeatMap(5, 8),
  attendance: { "21CS051": "present", "21IT001": "present", "21CS052": "absent" },
  incidents: [
    {
      id: "INC-0001", roll: "21IT004", type: "Unauthorised material found",
      description: "Formula sheet under the desk. Sheet taken, student allowed to continue.",
      reportedBy: "Prof. Suresh Iyer", createdAt: "2026-10-23T10:12:00"
    }
  ]
};

/* ---------------- page state ---------------- */

let hallData = null;     // { duty, exam, hall, seatMap, attendance, incidents }
let searchRoll = "";
let canEdit = false;

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function todayString() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatLongDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function colorFor(code) {
  const i = hallData.exam.subjects.indexOf(code);
  return COURSE_PALETTE[(i < 0 ? 0 : i) % COURSE_PALETTE.length];
}

function allRolls() {
  const rolls = [];
  hallData.seatMap.forEach(function (row) { row.forEach(function (cell) { if (cell) rolls.push(cell.roll); }); });
  return rolls;
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: "Bearer " + getToken() };
}

// TODO(after-jiya): switch these fetch calls to Jiya's api.js helper
function request(method, path, body) {
  return fetch(API_BASE + path, { method: method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined })
    .then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.error || "Request failed: " + res.status);
        return json.data;
      });
    });
}

/* ---------------- data ---------------- */

function loadHall(dutyId) {
  if (USE_DUMMY_HALL) return Promise.resolve(JSON.parse(JSON.stringify(DUMMY_HALL)));
  return request("GET", "/duties/" + encodeURIComponent(dutyId));
}

function saveAttendance(roll, status) {
  if (USE_DUMMY_HALL) return Promise.resolve();
  return request("PUT", "/exams/" + hallData.exam.examId + "/attendance", { hall: hallData.hall.hallNo, roll: roll, status: status });
}

function saveBulkAttendance(status) {
  if (USE_DUMMY_HALL) return Promise.resolve();
  return request("PUT", "/exams/" + hallData.exam.examId + "/attendance/bulk", { hall: hallData.hall.hallNo, status: status });
}

function saveIncident(incident) {
  if (USE_DUMMY_HALL) {
    return Promise.resolve(Object.assign({ id: "INC-" + Date.now(), reportedBy: "You", createdAt: new Date().toISOString() }, incident));
  }
  return request("POST", "/exams/" + hallData.exam.examId + "/incidents", Object.assign({ hall: hallData.hall.hallNo }, incident));
}

/* ---------------- render: header + stats ---------------- */

function renderHeader() {
  const d = hallData.duty, e = hallData.exam;
  document.getElementById("hall-title").textContent = hallData.hall.hallNo + " · " + e.examName;
  document.getElementById("hall-sub").textContent = formatLongDate(d.date) + " · " + d.slot + " · " + e.subjects.join(", ");
  document.getElementById("exam-id-pill").textContent = e.examId;
}

function renderStats() {
  const rolls = allRolls();
  const present = rolls.filter(function (r) { return hallData.attendance[r] === "present"; }).length;
  const absent = rolls.filter(function (r) { return hallData.attendance[r] === "absent"; }).length;

  document.getElementById("stat-students").textContent = rolls.length;
  document.getElementById("stat-present").textContent = present;
  document.getElementById("stat-absent").textContent = absent;
  document.getElementById("stat-unmarked").textContent = rolls.length - present - absent;
}

/* ---------------- render: legend + seat chart ---------------- */

function renderLegend() {
  let html = '<span class="legendLabel">Subjects</span><div class="legendSwatches">';
  hallData.exam.subjects.forEach(function (code) {
    html += '<span class="legendItem"><span class="legendDot" style="background:' + colorFor(code) + '"></span>' + escapeHtml(code) + "</span>";
  });
  html += '<span class="legendItem">✓ present</span><span class="legendItem">✕ absent</span></div>';
  document.getElementById("legend").innerHTML = html;
}

function renderChart() {
  const hall = hallData.hall;
  const rolls = allRolls();
  let seats = "";

  for (let r = 0; r < hall.rows; r++) {
    for (let c = 0; c < hall.cols; c++) {
      const cell = hallData.seatMap[r] && hallData.seatMap[r][c];
      if (!cell) { seats += '<div class="seat empty"></div>'; continue; }

      const status = hallData.attendance[cell.roll] || "";
      const isMatch = searchRoll && cell.roll.indexOf(searchRoll) !== -1;
      const isDim = searchRoll && !isMatch;
      const classes = ["seat", status, canEdit ? "tap" : "locked", isMatch ? "hl" : "", isDim ? "dim" : ""].join(" ");      seats +=
        '<div class="' + classes + '" style="background:' + colorFor(cell.code) + '" data-roll="' + escapeHtml(cell.roll) + '"' +
        ' title="' + escapeHtml(cell.roll) + " · seat " + (r * hall.cols + c + 1) + '">' +
        "<strong>" + escapeHtml(cell.roll) + "</strong><span>" + escapeHtml(cell.code) + "</span></div>";
    }
  }

  document.getElementById("hall-chart").innerHTML =
    '<div class="hallCard">' +
      '<div class="hallHeader">' +
        '<h3 class="hallTitle">' + escapeHtml(hall.hallNo) + "</h3>" +
        '<span class="hallInfo">' + hall.rows + "×" + hall.cols + " · " + (hall.rows * hall.cols) + " seats · " + rolls.length + " students</span>" +
      "</div>" +
      '<div class="hallDirection">↑ FRONT ↑</div>' +
      '<div class="seatingGrid" style="grid-template-columns:repeat(' + hall.cols + ',minmax(64px,1fr))">' + seats + "</div>" +
    "</div>";
}

function renderAll() {
  renderStats();
  renderChart();
}

/* ---------------- attendance actions ---------------- */

/* unmarked → present → absent → unmarked */
function nextStatus(current) {
  if (!current) return "present";
  if (current === "present") return "absent";
  return null;
}

function onSeatClick(event) {
  const seat = event.target.closest(".seat[data-roll]");
  if (!seat || !canEdit) return;

  const roll = seat.dataset.roll;
  const before = hallData.attendance[roll] || null;
  const after = nextStatus(before);

  // update the page straight away, undo if the server says no
  if (after) hallData.attendance[roll] = after; else delete hallData.attendance[roll];
  renderAll();

  saveAttendance(roll, after).catch(function (error) {
    if (before) hallData.attendance[roll] = before; else delete hallData.attendance[roll];
    renderAll();
    alert("Could not save attendance: " + error.message);
  });
}

function onMarkAll() {
  if (!canEdit) return;
  const before = Object.assign({}, hallData.attendance);
  allRolls().forEach(function (roll) { hallData.attendance[roll] = "present"; });
  renderAll();
  saveBulkAttendance("present").catch(function (error) {
    hallData.attendance = before; renderAll();
    alert("Could not save attendance: " + error.message);
  });
}

function onReset() {
  if (!canEdit || !confirm("Clear attendance for every seat in this hall?")) return;
  const before = Object.assign({}, hallData.attendance);
  hallData.attendance = {};
  renderAll();
  saveBulkAttendance(null).catch(function (error) {
    hallData.attendance = before; renderAll();
    alert("Could not reset attendance: " + error.message);
  });
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

function renderIncidentForm() {
  document.getElementById("incident-type").innerHTML =
    INCIDENT_TYPES.map(function (t) { return "<option>" + escapeHtml(t) + "</option>"; }).join("");

  document.getElementById("incident-roll").innerHTML =
    '<option value="">— Not about one student —</option>' +
    allRolls().map(function (r) { return "<option>" + escapeHtml(r) + "</option>"; }).join("");
}

function renderIncidents() {
  const list = hallData.incidents.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  document.getElementById("incident-count").textContent = list.length + " reported";

  document.getElementById("incident-list").innerHTML = list.length
    ? list.map(function (i) {
        const time = new Date(i.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        return '<div class="incident-item"><strong>' + escapeHtml(i.type) + (i.roll ? " · " + escapeHtml(i.roll) : "") + "</strong>" +
          escapeHtml(i.description) +
          '<div class="incident-meta">' + escapeHtml(i.id) + " · by " + escapeHtml(i.reportedBy) + " · " + time + "</div></div>";
      }).join("")
    : '<div class="no-exams"><i class="fa-regular fa-circle-check"></i><span>Nothing reported yet.</span></div>';
}

function onIncidentSubmit(event) {
  event.preventDefault();
  const msg = document.getElementById("incident-msg");
  const description = document.getElementById("incident-desc").value.trim();

  if (!description) {
    msg.innerHTML = '<div class="form-msg err">Add a short description first.</div>';
    return;
  }

  const incident = {
    roll: document.getElementById("incident-roll").value,
    type: document.getElementById("incident-type").value,
    description: description
  };

  saveIncident(incident)
    .then(function (saved) {
      hallData.incidents.push(saved);
      renderIncidents();
      document.getElementById("incident-form").reset();
      msg.innerHTML = '<div class="form-msg ok">Report sent to the exam cell.</div>';
    })
    .catch(function (error) {
      msg.innerHTML = '<div class="form-msg err">Could not send report: ' + escapeHtml(error.message) + "</div>";
    });
}

/* ---------------- start ---------------- */

const dutyId = new URLSearchParams(window.location.search).get("duty");

invReady
  .then(function (profile) {
    if (!profile) return;
    if (!dutyId) throw new Error("No duty selected");
    return loadHall(dutyId);
  })
  .then(function (data) {
    if (!data) return;
    hallData = data;
    hallData.attendance = hallData.attendance || {};
    hallData.incidents = hallData.incidents || [];

    canEdit = ALWAYS_EDITABLE || hallData.duty.date === todayString();
    if (!canEdit) {
      const note = document.getElementById("lock-note");
      note.style.display = "block";
      note.textContent = "Attendance can only be marked on the exam day.";
      document.getElementById("mark-all-btn").disabled = true;
    }

    renderHeader();
    renderLegend();
    renderAll();
    renderIncidentForm();
    renderIncidents();

    document.getElementById("hall-chart").addEventListener("click", onSeatClick);
    document.getElementById("mark-all-btn").addEventListener("click", onMarkAll);
    document.getElementById("reset-btn").addEventListener("click", onReset);
    document.getElementById("roll-search").addEventListener("input", onSearch);
    document.getElementById("incident-form").addEventListener("submit", onIncidentSubmit);
  })
  .catch(function (error) {
    console.log("Could not load hall:", error);
    document.getElementById("hall-chart").innerHTML =
      '<div class="no-exams"><i class="fa-solid fa-triangle-exclamation"></i><strong>Could not load this hall</strong><span>' +
      escapeHtml(error.message) + '</span><a class="matrix-btn" href="invigilatorDashboard.html">Back to My Duties</a></div>';
  });