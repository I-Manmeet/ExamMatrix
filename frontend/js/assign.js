/* =========================================================
   ExamMatrix — ASSIGN INVIGILATORS (admin)
   ---------------------------------------------------------
   The server runs autoAssign.js and works out who is eligible
   for each position. This page only shows the result and sends
   the admin's choices back. Every change is saved straight away.

   Routes (all admin only, via api.js):
     GET    /api/exams                      → exams for the picker
     GET    /api/exams/:examId/duties       → assignment board
     POST   /api/exams/:examId/duties/auto  → runs autoAssign, returns the board
     PUT    /api/exams/:examId/duties       → { hall, position, invId | null }, returns the board
     DELETE /api/exams/:examId/duties       → clears all, returns the board
   Once attendance is marked, the server locks the duties (409).

   Board shape:
     { exam: { examId, examName, date, slot },
       rules: { studentsPerInvigilator, noOwnSubject, maxDutiesPerDay },
       invigilators: [ { invId, name, department, duties } ],
       positions: [ { hall, position, students, codes, assigned: invId | null,
                      unfilledReason, options: { invId: { ok, reason } } } ] }

   Open as assign.html?examId=EXM-0001-0001 (old ?exam= links still work).
   ========================================================= */

/* ---------------- page state ---------------- */

let examsList = [];
let board = null;
let busy = false;      // a save is running → buttons and dropdowns are off
let loadToken = 0;     // bumps on every exam switch; replies for an older exam are ignored

/* ---------------- helpers ---------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function invName(invId) {
  const inv = board.invigilators.find(function (i) { return i.invId === invId; });
  return inv ? inv.name : invId;
}

function formatDate(value) {
  const d = new Date(String(value || "") + "T00:00:00");
  if (isNaN(d)) return String(value || "");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function dutiesPath(examId) {
  return "/exams/" + encodeURIComponent(examId) + "/duties";
}

function showMessage(text, isError) {
  const box = document.getElementById("assign-msg");
  box.replaceChildren();
  if (text) box.appendChild(el("div", "form-msg " + (isError ? "err" : "ok"), text));
}

function showEmpty(iconClass, title, text, link) {
  const box = el("div", "no-exams");
  box.append(el("i", iconClass), el("strong", "", title), el("span", "", text));
  if (link) {
    const a = el("a", "", link.text);
    a.href = link.href;
    box.appendChild(a);
  }
  document.getElementById("positions-table").replaceChildren(box);
}

function refreshButtons() {
  const hasSeats = Boolean(board && board.positions.length);
  const hasPeople = Boolean(board && board.invigilators.length);
  const anyAssigned = Boolean(board && board.positions.some(function (p) { return p.assigned; }));

  document.getElementById("auto-btn").disabled = busy || !hasSeats || !hasPeople;
  document.getElementById("clear-btn").disabled = busy || !anyAssigned;
  document.getElementById("exam-picker").disabled = examsList.length === 0;
  document.querySelectorAll(".inv-select").forEach(function (s) { s.disabled = busy; });
}

function setBusy(on) {
  busy = on;
  refreshButtons();
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

// one rule line: icon + text, with the number in bold
function ruleItem(iconClass, before, bold, after) {
  const li = el("li");
  const span = el("span", "", before);
  if (bold !== undefined) span.appendChild(el("b", "", bold));
  if (after) span.appendChild(document.createTextNode(after));
  li.append(el("i", iconClass), span);
  return li;
}

function renderRules() {
  const r = board.rules;
  const items = [
    ruleItem("fa-solid fa-users", "1 invigilator per ", r.studentsPerInvigilator, " students, at least 1 per hall"),
    ruleItem("fa-solid fa-clock", "Nobody in two places in the same date and slot")
  ];
  if (r.noOwnSubject) items.push(ruleItem("fa-solid fa-book", "Teachers never invigilate a hall writing their own subject"));
  items.push(
    ruleItem("fa-solid fa-calendar-day", "At most ", r.maxDutiesPerDay, " duties per person per day"),
    ruleItem("fa-solid fa-plane", "Unavailable dates are skipped")
  );
  document.getElementById("rules-list").replaceChildren.apply(document.getElementById("rules-list"), items);
}

function invigilatorSelect(p, index) {
  const select = el("select", "inv-select" + (p.assigned ? "" : " unfilled"));
  select.dataset.index = index;
  select.disabled = busy;

  const none = el("option", "", "— Unassigned —");
  none.value = "";
  select.appendChild(none);

  // assigned person was deleted after assigning → still show who is in the seat
  const known = board.invigilators.some(function (i) { return i.invId === p.assigned; });
  if (p.assigned && !known) {
    const gone = el("option", "", p.assigned + " (no longer in the invigilator list)");
    gone.value = p.assigned;
    gone.selected = true;
    select.appendChild(gone);
  }

  board.invigilators.forEach(function (inv) {
    // the server already checks every rule, including "already in another hall"
    const check = p.options[inv.invId] || { ok: false, reason: "Not eligible" };
    const isSelected = p.assigned === inv.invId;
    const reason = check.ok ? "" : check.reason;

    const option = el("option", "",
      inv.name + " · " + inv.duties + (inv.duties === 1 ? " duty" : " duties") + (reason ? " — " + reason : ""));
    option.value = inv.invId;
    option.selected = isSelected;
    option.disabled = Boolean(reason) && !isSelected;
    select.appendChild(option);
  });

  return select;
}

function statusCell(p) {
  const td = el("td");
  if (p.assigned) {
    td.appendChild(el("span", "badge-ok", "✓ " + p.assigned));
  } else {
    td.appendChild(el("span", "badge-bad", "Unfilled"));
    if (p.unfilledReason) td.appendChild(el("div", "unfilled-reason", p.unfilledReason));
  }
  return td;
}

function renderPositions() {
  const e = board.exam;
  document.getElementById("exam-sub").textContent = e.examName + " · " + formatDate(e.date) + " · " + e.slot;

  if (board.positions.length === 0) {
    showEmpty("fa-solid fa-chair", "No seated halls for this exam", "Generate seating first.");
    return;
  }

  const tbody = el("tbody");
  board.positions.forEach(function (p, index) {
    const tr = el("tr");

    // the hall cell spans all of that hall's positions
    if (index === 0 || board.positions[index - 1].hall !== p.hall) {
      const span = board.positions.filter(function (x) { return x.hall === p.hall; }).length;
      const hallCell = el("td", "hall-cell");
      hallCell.rowSpan = span;
      hallCell.append(el("strong", "", p.hall), el("span", "", p.students + " students · " + p.codes.join(", ")));
      tr.appendChild(hallCell);
    }

    const selectCell = el("td");
    selectCell.appendChild(invigilatorSelect(p, index));
    tr.append(el("td", "pos-cell", "#" + p.position), selectCell, statusCell(p));
    tbody.appendChild(tr);
  });

  const headRow = el("tr");
  ["Hall", "Pos", "Invigilator", "Status"].forEach(function (h) { headRow.appendChild(el("th", "", h)); });
  const thead = el("thead");
  thead.appendChild(headRow);

  const table = el("table", "assign-table");
  table.append(thead, tbody);
  document.getElementById("positions-table").replaceChildren(table);
}

function renderAll() {
  renderStats();
  renderRules();
  renderPositions();
  refreshButtons();
}

/* ---------------- actions ---------------- */

function selectExam(examId) {
  const mine = ++loadToken;
  board = null;
  showMessage("");
  showEmpty("fa-solid fa-spinner fa-spin", "Loading…", "Fetching halls and invigilators.");
  setBusy(false);

  return api("GET", dutiesPath(examId))
    .then(function (b) {
      if (mine !== loadToken) return;
      board = b;
      renderAll();
      history.replaceState(null, "", "?examId=" + encodeURIComponent(examId));
      if (!board.invigilators.length) {
        showMessage("No invigilators uploaded yet. Add them on the Upload page first.", true);
      }
    })
    .catch(function (error) {
      if (mine !== loadToken) return;
      showEmpty("fa-solid fa-triangle-exclamation", "Could not load this exam", error.message);
      refreshButtons();
    });
}

function onAutoAssign() {
  if (!board || busy) return;
  const anyAssigned = board.positions.some(function (p) { return p.assigned; });
  if (anyAssigned && !confirm("Auto-assign replaces everyone already assigned to this exam. Continue?")) return;

  const mine = loadToken;
  setBusy(true);
  api("POST", dutiesPath(board.exam.examId) + "/auto")
    .then(function (b) {
      if (mine !== loadToken) return;
      board = b;
      renderAll();
      const unfilled = board.positions.filter(function (p) { return !p.assigned; }).length;
      showMessage(unfilled ? unfilled + " position(s) could not be filled. See the reasons below." : "All positions filled.", unfilled > 0);
    })
    .catch(function (error) {
      if (mine === loadToken) showMessage("Auto-assign failed: " + error.message, true);
    })
    .then(function () { if (mine === loadToken) setBusy(false); });
}

function onSelectChange(event) {
  const select = event.target.closest(".inv-select");
  if (!select || !board || busy) return;

  const position = board.positions[Number(select.dataset.index)];
  if (!position) return;
  const examId = board.exam.examId;
  const invId = select.value || null;
  const mine = loadToken;

  setBusy(true);
  api("PUT", dutiesPath(examId), { hall: position.hall, position: position.position, invId: invId })
    .then(function (b) {
      if (mine !== loadToken) return;
      board = b;
      renderAll();
      showMessage(invId ? invName(invId) + " assigned to " + position.hall + " #" + position.position + "." : "Position cleared.");
    })
    .catch(function (error) {
      if (mine !== loadToken) return;
      showMessage("Could not save: " + error.message, true);
      // someone else may have changed the board → reload it; if that fails, put the dropdown back
      return api("GET", dutiesPath(examId))
        .then(function (b) { if (mine === loadToken) board = b; })
        .catch(function () {})
        .then(function () { if (mine === loadToken) renderAll(); });
    })
    .then(function () { if (mine === loadToken) setBusy(false); });
}

function onClear() {
  if (!board || busy) return;
  if (!confirm("Remove every invigilator from this exam?")) return;

  const mine = loadToken;
  setBusy(true);
  api("DELETE", dutiesPath(board.exam.examId))
    .then(function (b) {
      if (mine !== loadToken) return;
      board = b;
      renderAll();
      showMessage("All positions cleared.");
    })
    .catch(function (error) {
      if (mine === loadToken) showMessage("Could not clear: " + error.message, true);
    })
    .then(function () { if (mine === loadToken) setBusy(false); });
}

/* ---------------- start ---------------- */

const params = new URLSearchParams(window.location.search);
const requestedExam = String(params.get("examId") || params.get("exam") || "").trim().toUpperCase();

refreshButtons();

api("GET", "/exams")
  .then(function (exams) {
    examsList = Array.isArray(exams) ? exams : [];
    if (!examsList.length) {
      showEmpty("fa-regular fa-calendar", "No exams yet", "Create an exam first.", { href: "createExam.html", text: "Create exam" });
      refreshButtons();
      return;
    }
    const found = examsList.some(function (e) { return e.examId === requestedExam; });
    const selected = found ? requestedExam : examsList[0].examId;
    renderPicker(selected);
    return selectExam(selected).then(function () {
      if (requestedExam && !found && !document.querySelector("#assign-msg .err")) {
        showMessage("Exam " + requestedExam + " was not found, so the first exam is shown.", true);
      }
    });
  })
  .catch(function (error) {
    showEmpty("fa-solid fa-triangle-exclamation", "Could not load exams", error.message);
  });

document.getElementById("exam-picker").addEventListener("change", function (e) { selectExam(e.target.value); });
document.getElementById("auto-btn").addEventListener("click", onAutoAssign);
document.getElementById("clear-btn").addEventListener("click", onClear);
document.getElementById("positions-table").addEventListener("change", onSelectChange);