/* =========================================================
   ExamMatrix — ASSIGN INVIGILATORS (admin)
   ---------------------------------------------------------
   The server runs autoAssign.js and works out who is eligible
   for each position. This page only shows the result and sends
   the admin's choices back.

   Routes (all admin only):
     GET    /api/exams                      → list of exams for the picker (Jiya)
     GET    /api/exams/:examId/duties       → assignment board (shape below)
     POST   /api/exams/:examId/duties/auto  → runs autoAssign, returns the board
     PUT    /api/exams/:examId/duties       → { hall, position, invId | null }, returns the board
     DELETE /api/exams/:examId/duties       → clears all, returns the board

   Board shape:
     { exam: { examId, examName, date, slot },
       rules: { studentsPerInvigilator, noOwnSubject, maxDutiesPerDay },
       invigilators: [ { invId, name, department, duties } ],
       positions: [ { hall, position, students, codes, assigned: invId | null,
                      unfilledReason, options: { invId: { ok, reason } } } ] }
   ========================================================= */

// TODO(after-jiya): remove these two and use Jiya's config.js + api.js
const API_BASE = "http://localhost:5000/api";
function getToken() { return localStorage.getItem("em_token"); }

// TODO(after-jiya): set to false once the duty routes exist
const USE_DUMMY_BOARD = true;

/* ---------------- dummy data (same shape the routes return) ---------------- */

const DUMMY_EXAMS = [
  { examId: "EXM-0001-0001", examName: "Mid Sem · Systems",   date: "2026-10-27", slot: "09:00-12:00" },
  { examId: "EXM-0001-0002", examName: "Mid Sem · Databases", date: "2026-10-28", slot: "09:00-12:00" }
];

/* duties = duties from OTHER exams (this exam's are added on top) */
const DUMMY_INVIGILATORS = [
  { invId: "INV-0001-0001", name: "Dr. Anjali Mehta",   department: "CSE",         duties: 1 },
  { invId: "INV-0001-0002", name: "Prof. Rajiv Sharma", department: "CSE",         duties: 0 },
  { invId: "INV-0001-0003", name: "Dr. Neha Kapoor",    department: "Mathematics", duties: 2 },
  { invId: "INV-0001-0004", name: "Prof. Suresh Iyer",  department: "ECE",         duties: 1 },
  { invId: "INV-0001-0005", name: "Dr. Arnab Bose",     department: "CSE",         duties: 0 },
  { invId: "INV-0001-0006", name: "Prof. Deepa Nair",   department: "Mathematics", duties: 0 }
];

/* who can take which position, with the reason if not (normally from canInvigilate on the server) */
function dummyOptions(blocked) {
  const options = {};
  DUMMY_INVIGILATORS.forEach(function (inv) {
    options[inv.invId] = blocked[inv.invId] ? { ok: false, reason: blocked[inv.invId] } : { ok: true };
  });
  return options;
}

function dummyBoard(examId) {
  const exam = DUMMY_EXAMS.find(function (e) { return e.examId === examId; }) || DUMMY_EXAMS[0];
  const away = { "INV-0001-0006": "Unavailable on " + exam.date };
  return {
    exam: exam,
    rules: { studentsPerInvigilator: 30, noOwnSubject: true, maxDutiesPerDay: 2 },
    invigilators: DUMMY_INVIGILATORS.map(function (i) { return Object.assign({}, i); }),
    positions: [
      { hall: "Hall A", position: 1, students: 40, codes: ["CS302", "CS303"], assigned: null, unfilledReason: "",
        options: dummyOptions(Object.assign({ "INV-0001-0002": "Teaches CS302", "INV-0001-0005": "Teaches CS303" }, away)) },
      { hall: "Hall A", position: 2, students: 40, codes: ["CS302", "CS303"], assigned: null, unfilledReason: "",
        options: dummyOptions(Object.assign({ "INV-0001-0002": "Teaches CS302", "INV-0001-0005": "Teaches CS303" }, away)) },
      { hall: "Hall C", position: 1, students: 10, codes: ["CS302"], assigned: null, unfilledReason: "",
        options: dummyOptions(Object.assign({ "INV-0001-0002": "Teaches CS302" }, away)) }
    ]
  };
}

/* what the server's auto-assign would return for the dummy board */
const DUMMY_AUTO = { "Hall A#1": "INV-0001-0001", "Hall A#2": "INV-0001-0004", "Hall C#1": "INV-0001-0005" };

/* the server recounts duties itself; in demo mode we do it here */
function dummyRecount() {
  board.invigilators.forEach(function (inv) {
    const base = DUMMY_INVIGILATORS.find(function (i) { return i.invId === inv.invId; }).duties;
    const here = board.positions.filter(function (p) { return p.assigned === inv.invId; }).length;
    inv.duties = base + here;
  });
  return board;
}

/* ---------------- page state ---------------- */

let board = null;

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function posKey(p) { return p.hall + "#" + p.position; }

function invName(invId) {
  const inv = board.invigilators.find(function (i) { return i.invId === invId; });
  return inv ? inv.name : invId;
}

function showMessage(text, isError) {
  document.getElementById("assign-msg").innerHTML = text
    ? '<div class="form-msg ' + (isError ? "err" : "ok") + '">' + escapeHtml(text) + "</div>"
    : "";
}

// TODO(after-jiya): switch to Jiya's api.js helper
function request(method, path, body) {
  return fetch(API_BASE + path, {
    method: method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (res) {
    return res.json().then(function (json) {
      if (!res.ok) throw new Error(json.error || "Request failed: " + res.status);
      return json.data;
    });
  });
}

/* ---------------- data ---------------- */

function loadExams() {
  if (USE_DUMMY_BOARD) return Promise.resolve(DUMMY_EXAMS);
  return request("GET", "/exams");
}

function loadBoard(examId) {
  if (USE_DUMMY_BOARD) return Promise.resolve(dummyBoard(examId));
  return request("GET", "/exams/" + examId + "/duties");
}

function runAutoAssign() {
  if (USE_DUMMY_BOARD) {
    // pretend the server ran autoAssign; only use a pick if that person is eligible
    board.positions.forEach(function (p) {
      const pick = DUMMY_AUTO[posKey(p)];
      const allowed = pick && p.options[pick] && p.options[pick].ok;
      p.assigned = allowed ? pick : null;
      p.unfilledReason = allowed ? "" : "No eligible invigilator left";
    });
    return Promise.resolve(dummyRecount());
  }
  return request("POST", "/exams/" + board.exam.examId + "/duties/auto");
}

function saveDuty(position, invId) {
  if (USE_DUMMY_BOARD) {
    position.assigned = invId || null;
    if (invId) position.unfilledReason = "";
    return Promise.resolve(dummyRecount());
  }
  return request("PUT", "/exams/" + board.exam.examId + "/duties", { hall: position.hall, position: position.position, invId: invId || null });
}

function clearDuties() {
  if (USE_DUMMY_BOARD) {
    board.positions.forEach(function (p) { p.assigned = null; p.unfilledReason = ""; });
    return Promise.resolve(dummyRecount());
  }
  return request("DELETE", "/exams/" + board.exam.examId + "/duties");
}

/* ---------------- render ---------------- */

function renderPicker(exams, selectedId) {
  document.getElementById("exam-picker").innerHTML = exams.map(function (e) {
    return '<option value="' + escapeHtml(e.examId) + '"' + (e.examId === selectedId ? " selected" : "") + ">" +
      escapeHtml(e.examId + " · " + e.examName) + "</option>";
  }).join("");
}

function renderStats() {
  const filled = board.positions.filter(function (p) { return p.assigned; }).length;
  const unfilled = board.positions.length - filled;
  const counts = board.invigilators.map(function (i) { return i.duties; });

  document.getElementById("stat-positions").textContent = board.positions.length;
  document.getElementById("stat-filled").textContent = filled;

  const unfilledEl = document.getElementById("stat-unfilled");
  unfilledEl.textContent = unfilled;
  unfilledEl.classList.toggle("danger-text", unfilled > 0);

  document.getElementById("stat-spread").textContent =
    counts.length ? Math.min.apply(null, counts) + "–" + Math.max.apply(null, counts) : "—";
}

function renderRules() {
  const r = board.rules;
  document.getElementById("rules-list").innerHTML =
    '<li><i class="fa-solid fa-users"></i><span>1 invigilator per <b>' + r.studentsPerInvigilator + "</b> students, at least 1 per hall</span></li>" +
    '<li><i class="fa-solid fa-clock"></i><span>Nobody in two places in the same date and slot</span></li>' +
    (r.noOwnSubject ? '<li><i class="fa-solid fa-book"></i><span>Teachers never invigilate a hall writing their own subject</span></li>' : "") +
    '<li><i class="fa-solid fa-calendar-day"></i><span>At most <b>' + r.maxDutiesPerDay + "</b> duties per person per day</span></li>" +
    '<li><i class="fa-solid fa-plane"></i><span>Unavailable dates are skipped</span></li>';
}

function selectHtml(p, index) {
  const takenElsewhere = board.positions
    .filter(function (x, i) { return i !== index && x.assigned; })
    .map(function (x) { return x.assigned; });

  let html = '<select class="inv-select' + (p.assigned ? "" : " unfilled") + '" data-index="' + index + '">' +
    '<option value="">— Unassigned —</option>';

  board.invigilators.forEach(function (inv) {
    const opt = p.options[inv.invId] || { ok: false, reason: "Not eligible" };
    const isSelected = p.assigned === inv.invId;
    let reason = "";
    if (!opt.ok) reason = opt.reason;
    else if (takenElsewhere.indexOf(inv.invId) !== -1) reason = "Already in another hall";

    html += '<option value="' + escapeHtml(inv.invId) + '"' +
      (isSelected ? " selected" : "") +
      (reason && !isSelected ? " disabled" : "") + ">" +
      escapeHtml(inv.name + " · " + inv.duties + " duties" + (reason ? " — " + reason : "")) +
      "</option>";
  });

  return html + "</select>";
}

function renderPositions() {
  const e = board.exam;
  const d = new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  document.getElementById("exam-sub").textContent = e.examName + " · " + d + " · " + e.slot;

  if (board.positions.length === 0) {
    document.getElementById("positions-table").innerHTML =
      '<div class="no-exams"><i class="fa-solid fa-chair"></i><strong>No seated halls for this exam</strong><span>Generate seating first.</span></div>';
    return;
  }

  let rows = "";
  board.positions.forEach(function (p, index) {
    const first = index === 0 || board.positions[index - 1].hall !== p.hall;
    const span = board.positions.filter(function (x) { return x.hall === p.hall; }).length;

    rows += "<tr>" +
      (first
        ? '<td class="hall-cell" rowspan="' + span + '"><strong>' + escapeHtml(p.hall) + "</strong><span>" +
          p.students + " students · " + escapeHtml(p.codes.join(", ")) + "</span></td>"
        : "") +
      '<td class="pos-cell">#' + p.position + "</td>" +
      "<td>" + selectHtml(p, index) + "</td>" +
      "<td>" + (p.assigned
        ? '<span class="badge-ok">✓ ' + escapeHtml(p.assigned) + "</span>"
        : '<span class="badge-bad">Unfilled</span>' +
          (p.unfilledReason ? '<div class="unfilled-reason">' + escapeHtml(p.unfilledReason) + "</div>" : "")) +
      "</td></tr>";
  });

  document.getElementById("positions-table").innerHTML =
    '<table class="assign-table"><thead><tr><th>Hall</th><th>Pos</th><th>Invigilator</th><th>Status</th></tr></thead>' +
    "<tbody>" + rows + "</tbody></table>";
}

function renderAll() {
  renderStats();
  renderRules();
  renderPositions();
}

/* ---------------- actions ---------------- */

function selectExam(examId) {
  showMessage("");
  return loadBoard(examId).then(function (b) {
    board = b;
    renderAll();
    history.replaceState(null, "", "?exam=" + encodeURIComponent(examId));
  });
}

function onAutoAssign() {
  if (!board) return;
  const btn = document.getElementById("auto-btn");
  btn.disabled = true;
  runAutoAssign()
    .then(function (b) {
      board = b;
      renderAll();
      const unfilled = board.positions.filter(function (p) { return !p.assigned; }).length;
      showMessage(unfilled ? unfilled + " position(s) could not be filled. See the reasons below." : "All positions filled.", unfilled > 0);
    })
    .catch(function (error) { showMessage("Auto-assign failed: " + error.message, true); })
    .then(function () { btn.disabled = false; });
}

function onSelectChange(event) {
  const select = event.target.closest(".inv-select");
  if (!select) return;
  const position = board.positions[Number(select.dataset.index)];
  const before = position.assigned;

  saveDuty(position, select.value)
    .then(function (b) {
      board = b;
      renderAll();
      showMessage(select.value ? invName(select.value) + " assigned to " + position.hall + " #" + position.position + "." : "Position cleared.");
    })
    .catch(function (error) {
      position.assigned = before;
      renderAll();
      showMessage("Could not save: " + error.message, true);
    });
}

function onClear() {
  if (!board) return;
  if (!confirm("Remove every invigilator from this exam?")) return;
  clearDuties()
    .then(function (b) { board = b; renderAll(); showMessage("All positions cleared."); })
    .catch(function (error) { showMessage("Could not clear: " + error.message, true); });
}

/* ---------------- start ---------------- */

const requestedExam = new URLSearchParams(window.location.search).get("exam");

loadExams()
  .then(function (exams) {
    if (!exams.length) {
      document.getElementById("positions-table").innerHTML =
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
document.getElementById("auto-btn").addEventListener("click", onAutoAssign);
document.getElementById("clear-btn").addEventListener("click", onClear);
document.getElementById("positions-table").addEventListener("change", onSelectChange);