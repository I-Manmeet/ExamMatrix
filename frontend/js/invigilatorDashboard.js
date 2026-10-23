/* =========================================================
   ExamMatrix — INVIGILATOR DASHBOARD (My Duties)
   ---------------------------------------------------------
   Shows the logged-in invigilator's duties from MongoDB,
   grouped by date, split into Upcoming and Completed tabs.
   Needs inv-shell.js loaded first (invReady, API_BASE, getToken).
   ========================================================= */

// TODO(after-jiya): delete DUMMY_DUTIES once the duties route is live
const USE_DUMMY_DUTIES = true;

const DUMMY_DUTIES = [
  {
    id: "DTY-1",
    exam: { examId: "EXM-0001-0001", examName: "Mid Sem · Systems", subjects: ["CS302", "CS303"] },
    hall: "Hall A", position: 1, date: "2026-10-23", slot: "09:00-12:00",
    students: 40, coInvigilators: ["Prof. Suresh Iyer"]
  },
  {
    id: "DTY-2",
    exam: { examId: "EXM-0001-0002", examName: "Mid Sem · Databases", subjects: ["CS301"] },
    hall: "LT-1", position: 2, date: "2026-10-27", slot: "09:00-12:00",
    students: 50, coInvigilators: ["Dr. Gurpreet Singh"]
  },
  {
    id: "DTY-3",
    exam: { examId: "EXM-0001-0003", examName: "Mid Sem · Electronics", subjects: ["EC201"] },
    hall: "Hall C", position: 1, date: "2026-10-27", slot: "14:00-17:00",
    students: 18, coInvigilators: []
  },
  {
    id: "DTY-4",
    exam: { examId: "EXM-0001-0004", examName: "Mid Sem · Communication", subjects: ["HS101"] },
    hall: "Hall B", position: 1, date: "2026-10-29", slot: "09:00-12:00",
    students: 40, coInvigilators: ["Prof. Lakshmi Rao"]
  },
  {
    id: "DTY-0",
    exam: { examId: "EXM-0001-0000", examName: "Class Test · Networks", subjects: ["CS303"] },
    hall: "Hall B", position: 1, date: "2026-10-20", slot: "14:00-17:00",
    students: 32, coInvigilators: []
  }
];

let allDuties = [];
let activeTab = "upcoming";

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

/* "YYYY-MM-DD" for today, in local time */
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function dutyStatus(duty) {
  const today = todayString();
  if (duty.date < today) return "completed";
  if (duty.date === today) return "today";
  return "upcoming";
}

function formatLongDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ---------------- data (from MongoDB through the server) ---------------- */

// TODO(after-jiya): switch this fetch to Jiya's api.js helper once it exists
function loadDuties() {
  if (USE_DUMMY_DUTIES) return Promise.resolve(DUMMY_DUTIES);

  return fetch(API_BASE + "/invigilators/me/duties", {
    headers: { Authorization: "Bearer " + getToken() }
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    })
    .then(function (body) { return body.data; });
}

/* ---------------- render ---------------- */

function renderHeader(profile) {
  document.getElementById("welcome-title").textContent = "Hello, " + profile.name;
  document.getElementById("inv-id-pill").textContent = profile.invId;
}

function renderStats() {
  const upcoming = allDuties.filter(function (d) { return dutyStatus(d) !== "completed"; });
  const days = new Set(allDuties.map(function (d) { return d.date; }));
  const students = upcoming.reduce(function (sum, d) { return sum + (d.students || 0); }, 0);

  document.getElementById("stat-total").textContent = allDuties.length;
  document.getElementById("stat-upcoming").textContent = upcoming.length;
  document.getElementById("stat-days").textContent = days.size;
  document.getElementById("stat-students").textContent = students;

  document.getElementById("upcoming-count").textContent = upcoming.length;
  document.getElementById("past-count").textContent = allDuties.length - upcoming.length;
}

function dutyCardHtml(duty) {
  const status = dutyStatus(duty);
  const d = new Date(duty.date + "T00:00:00");
  const statusLabel = { today: "Today", upcoming: "Upcoming", completed: "Completed" }[status];

  const subjects = (duty.exam.subjects || []).map(function (code) {
    return '<span class="code-chip">' + escapeHtml(code) + "</span>";
  }).join("");

  const withText = duty.coInvigilators && duty.coInvigilators.length
    ? "With " + duty.coInvigilators.map(escapeHtml).join(", ")
    : "Sole invigilator in this hall";

  const actionLabel = status === "completed" ? "View hall" : "Open hall";

  return (
    '<div class="duty-item ' + status + '">' +
      '<div class="date-tile"><b>' + d.getDate() + "</b><span>" +
        d.toLocaleDateString("en", { month: "short" }) + "</span></div>" +

      '<div class="duty-info">' +
        "<strong>" + escapeHtml(duty.hall) + " · " + escapeHtml(duty.exam.examName) + "</strong>" +
        '<div class="duty-meta">' +
          '<span><i class="fa-regular fa-clock"></i>' + escapeHtml(duty.slot) + "</span>" +
          '<span><i class="fa-solid fa-user-group"></i>' + duty.students + " students</span>" +
          '<span><i class="fa-solid fa-hashtag"></i>' + escapeHtml(duty.exam.examId) + "</span>" +
          "<span>" + subjects + "</span>" +
        "</div>" +
        '<div class="duty-with">' + withText + "</div>" +
      "</div>" +

      '<div class="duty-actions">' +
        '<span class="exam-status ' + status + '">' + statusLabel + "</span>" +
        '<a class="matrix-btn" href="hallDuty.html?duty=' + encodeURIComponent(duty.id) + '">' +
          '<i class="fa-solid fa-table-cells"></i> ' + actionLabel +
        "</a>" +
      "</div>" +
    "</div>"
  );
}

function renderDuties() {
  const list = document.getElementById("duty-list");

  const shown = allDuties.filter(function (d) {
    const done = dutyStatus(d) === "completed";
    return activeTab === "past" ? done : !done;
  });

  // upcoming: soonest first; completed: most recent first
  shown.sort(function (a, b) {
    const order = a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot);
    return activeTab === "past" ? -order : order;
  });

  if (shown.length === 0) {
    list.innerHTML =
      '<div class="no-exams"><i class="fa-regular fa-calendar"></i>' +
      "<strong>" + (activeTab === "past" ? "No completed duties yet" : "No upcoming duties") + "</strong>" +
      "<span>Duties appear here as soon as the exam cell assigns you.</span></div>";
    return;
  }

  // group by date
  let html = "";
  let currentDate = null;
  shown.forEach(function (duty) {
    if (duty.date !== currentDate) {
      if (currentDate !== null) html += "</div>";
      currentDate = duty.date;
      html +=
        '<div class="exam-date-group">' +
        '<div class="exam-date-heading"><i class="fa-regular fa-calendar"></i>' + formatLongDate(duty.date) + "</div>" +
        '<div class="exam-date-line"></div>';
    }
    html += dutyCardHtml(duty);
  });
  html += "</div>";

  list.innerHTML = html;
}

/* ---------------- tabs ---------------- */

function setTab(tab) {
  activeTab = tab;
  document.getElementById("upcoming-tab").classList.toggle("active", tab === "upcoming");
  document.getElementById("past-tab").classList.toggle("active", tab === "past");
  renderDuties();
}

document.getElementById("upcoming-tab").addEventListener("click", function () { setTab("upcoming"); });
document.getElementById("past-tab").addEventListener("click", function () { setTab("past"); });

/* ---------------- start ---------------- */

invReady
  .then(function (profile) {
    if (!profile) return;          // already being sent to login
    renderHeader(profile);
    return loadDuties();
  })
  .then(function (duties) {
    if (!duties) return;
    allDuties = duties;
    renderStats();
    renderDuties();
  })
  .catch(function (error) {
    console.log("Could not load duties:", error);
    document.getElementById("duty-list").innerHTML =
      '<div class="no-exams"><i class="fa-solid fa-triangle-exclamation"></i><strong>Could not load your duties</strong></div>';
  });