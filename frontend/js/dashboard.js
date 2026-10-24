
"use strict";

/* =========================================
   ExamMatrix Dashboard
   Data fetched from backend APIs
========================================= */

var examsData = [];
var hallsData = [];

var uploadCounts = {
    halls: 0,
    subjects: 0,
    students: 0,
    invigilators: 0
};

var currentTab = "upcoming";
var selectedExamId = null;
var dashboardLoading = false;

document.addEventListener("DOMContentLoaded", initDashboard);

/* =========================================
   INITIALIZATION
========================================= */

function initDashboard() {
    wireTabs();
    wireHeaderButtons();
    loadDashboard();
}

/* =========================================
   LOAD BACKEND DATA
========================================= */

async function loadDashboard() {
    if (dashboardLoading) return;

    dashboardLoading = true;
    showError("");

    var examList = document.getElementById("exam-list");

    if (examList) {
        examList.replaceChildren(
            createText("p", "Loading examinations...")
        );
    }

    try {
        var results = await Promise.all([
            api("GET", "/exams"),
            api("GET", "/uploads/status"),
            api("GET", "/halls")
        ]);

        examsData = extractArray(results[0]);
        var status = extractObject(results[1]);
        hallsData = extractArray(results[2]);

        uploadCounts = {
            halls: getCount(status, "halls"),
            subjects: getCount(status, "subjects"),
            students: getCount(status, "students"),
            invigilators: getCount(status, "invigilators")
        };

        renderStats();
        renderExamList();
        renderSelectedExam();
        renderEmptyDataNotice();

    } catch (error) {
        console.error("Dashboard loading failed:", error);

        if (examList) {
            examList.replaceChildren(
                createText(
                    "p",
                    "Unable to load examinations. Please try again."
                )
            );
        }

        showError(
            "Can't reach the server or load dashboard data. " +
            "Check that your backend is running."
        );
    } finally {
        dashboardLoading = false;
    }
}

/* =========================================
   NORMALIZE API RESPONSES
========================================= */

function extractArray(response) {
    if (Array.isArray(response)) return response;

    if (!response || typeof response !== "object") return [];

    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.exams)) return response.exams;
    if (Array.isArray(response.halls)) return response.halls;

    return [];
}

function extractObject(response) {
    if (!response || typeof response !== "object") return {};

    if (
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data)
    ) {
        return response.data;
    }

    return response;
}

function getCount(object, key) {
    var value = Number(object[key]);

    return Number.isFinite(value) && value >= 0 ? value : 0;
}

/* =========================================
   STATISTICS
========================================= */

function renderStats() {
    /*
     * These IDs are optional. If your HTML still uses
     * .stat-number elements, the fallback updates them.
     */

    setText("stat-exams", examsData.length);

    // This is uploaded student count, not necessarily seated count.
    setText("stat-students", uploadCounts.students);
    setText("stat-halls", uploadCounts.halls);
    setText("stat-subjects", uploadCounts.subjects);
    setText("stat-invigilators", uploadCounts.invigilators);

    var statNumbers = document.querySelectorAll("#stats .stat-number");

    if (statNumbers.length >= 4) {
        statNumbers[0].textContent = String(examsData.length);
        statNumbers[1].textContent = String(uploadCounts.students);
        statNumbers[2].textContent = String(uploadCounts.halls);

        var conflicts = examsData.reduce(function (total, exam) {
            return total + (Number(exam.stats?.conflicts) || 0);
        }, 0);

        var conflictElement = statNumbers[3];
        var checkIcon = conflictElement.querySelector("i");

        conflictElement.replaceChildren();

        if (checkIcon && conflicts === 0) {
            conflictElement.appendChild(checkIcon);
        }

        conflictElement.appendChild(
            document.createTextNode(String(conflicts))
        );
    }
}

function renderEmptyDataNotice() {
    var notice = document.getElementById("empty-data-notice");

    if (!notice) return;

    var hasUploadedData =
        uploadCounts.halls > 0 ||
        uploadCounts.subjects > 0 ||
        uploadCounts.students > 0 ||
        uploadCounts.invigilators > 0;

    notice.hidden = hasUploadedData;
}

/* =========================================
   TABS
========================================= */

function wireTabs() {
    var upcomingTab = document.getElementById("upcoming-tab");
    var previousTab = document.getElementById("previous-tab");

    if (upcomingTab) {
        upcomingTab.addEventListener("click", function () {
            setCurrentTab("upcoming");
        });
    }

    if (previousTab) {
        previousTab.addEventListener("click", function () {
            setCurrentTab("previous");
        });
    }
}

function setCurrentTab(tabName) {
    currentTab = tabName;

    var upcomingTab = document.getElementById("upcoming-tab");
    var previousTab = document.getElementById("previous-tab");

    if (upcomingTab) {
        upcomingTab.classList.toggle("active", tabName === "upcoming");
        upcomingTab.setAttribute(
            "aria-pressed",
            String(tabName === "upcoming")
        );
    }

    if (previousTab) {
        previousTab.classList.toggle("active", tabName === "previous");
        previousTab.setAttribute(
            "aria-pressed",
            String(tabName === "previous")
        );
    }

    renderExamList();
}

/* =========================================
   DATE HELPERS
========================================= */

function getLocalDateString() {
    var date = new Date();

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
}

function getExamDate(exam) {
    return String(exam.date || "").slice(0, 10);
}

function isPreviousExam(exam) {
    var date = getExamDate(exam);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    return date < getLocalDateString();
}

function formatExamDate(dateString) {
    if (!dateString) return "Date not specified";

    var parts = dateString.slice(0, 10).split("-");

    if (parts.length !== 3) return dateString;

    var date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric"
    });
}

/* =========================================
   RENDER EXAMS, GROUPED BY DATE
========================================= */

function renderExamList() {
    var examList = document.getElementById("exam-list");
    if (!examList) return;

    examList.replaceChildren();

    var upcoming = examsData.filter(function (exam) {
        return !isPreviousExam(exam);
    });

    var previous = examsData.filter(function (exam) {
        return isPreviousExam(exam);
    });

    setText("upcoming-count", upcoming.length);
    setText("previous-count", previous.length);

    var filteredExams = currentTab === "previous" ? previous : upcoming;

    filteredExams.sort(function (a, b) {
        return getExamDate(a).localeCompare(getExamDate(b));
    });

    if (filteredExams.length === 0) {
        var empty = document.createElement("div");
        empty.className = "empty-exams";

        var heading = createText(
            "h3",
            currentTab === "previous"
                ? "No previous exams"
                : "No upcoming exams"
        );

        var description = createText(
            "p",
            currentTab === "previous"
                ? "Previous exam sessions will appear here."
                : "Create an exam to get started."
        );

        empty.append(heading, description);

        if (currentTab === "upcoming") {
            var link = document.createElement("a");
            link.href = "createExam.html";
            link.textContent = "Create Exam";
            empty.appendChild(link);
        }

        examList.appendChild(empty);
        return;
    }

    var groupedDates = {};

    filteredExams.forEach(function (exam) {
        var date = getExamDate(exam) || "unscheduled";

        if (!groupedDates[date]) {
            groupedDates[date] = [];
        }

        groupedDates[date].push(exam);
    });

    Object.keys(groupedDates).sort().forEach(function (date) {
        var group = document.createElement("section");
        group.className = "exam-date-group";

        var dateHeading = document.createElement("div");
        dateHeading.className = "exam-date-heading";

        var calendarIcon = document.createElement("i");
        calendarIcon.className = "fa-regular fa-calendar";

        dateHeading.appendChild(calendarIcon);
        dateHeading.appendChild(
            document.createTextNode(
                date === "unscheduled"
                    ? "Date not specified"
                    : formatExamDate(date)
            )
        );

        var grid = document.createElement("div");
        grid.className = "exam-grid";

        groupedDates[date].forEach(function (exam) {
            grid.appendChild(createExamCard(exam));
        });

        group.append(dateHeading, grid);
        examList.appendChild(group);
    });
}

/* =========================================
   EXAM CARD
========================================= */

function createExamCard(exam) {
    var card = document.createElement("article");
    card.className = "exam-card";

    var examId = getExamId(exam);
    var examDate = getExamDate(exam);

    // Highlight the selected exam.
    card.classList.toggle(
        "selected",
        selectedExamId !== null &&
        String(selectedExamId) === String(examId)
    );

    // Left side: exam information.
    var main = document.createElement("div");
    main.className = "exam-card-main";

    var header = document.createElement("div");
    header.className = "exam-card-header";

    header.appendChild(
        createText(
            "h3",
            exam.examName || exam.name || "Untitled Examination"
        )
    );

    var status = createText(
        "span",
        examDate === getLocalDateString()
            ? "Today"
            : isPreviousExam(exam)
                ? "Previous"
                : "Upcoming"
    );

    status.className = "exam-status";
    header.appendChild(status);

    main.appendChild(header);

    var subjects = Array.isArray(exam.subjects) ? exam.subjects : [];

    if (subjects.length) {
        var subjectNames = subjects.map(function (subject) {
            return typeof subject === "string"
                ? subject
                : subject.code || subject.name || "";
        }).filter(Boolean);

        if (subjectNames.length) {
            main.appendChild(
                createText("p", subjectNames.join(", "))
            );
        }
    }

    var details = document.createElement("div");
    details.className = "exam-details";

    var slotRow = document.createElement("div");
    slotRow.className = "exam-detail-row";

    slotRow.appendChild(
        createText("span", "◷ " + (exam.slot || "Time not specified"))
    );

    details.appendChild(slotRow);
    main.appendChild(details);

    // Right side: actions.
    var actions = document.createElement("div");
    actions.className = "exam-card-actions";

    var matrixButton = createButton(
        "Matrix →",
        "btn-primary",
        function () {
            openExamSeating(examId);
        }
    );

    var deleteButton = createButton(
        "Delete",
        "btn-danger",
        function () {
            deleteExam(examId);
        }
    );

    actions.append(matrixButton, deleteButton);
    card.append(main, actions);

    // Clicking the card selects it and displays its allocation.
    card.addEventListener("click", function (event) {
        if (event.target.closest("button, a")) return;

        selectedExamId = examId;
        renderExamList();
        renderSelectedExam();
    });

    return card;
}


function createButton(label, className, callback) {
    var button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", callback);

    return button;
}

function getExamId(exam) {
    return exam.examId ?? exam.id ?? exam._id ?? null;
}

function getExamStudentCount(exam) {
    return Number(exam.studentCount ?? exam.studentsCount ?? 0) || 0;
}

/* =========================================
   OPEN SEATING PAGE
========================================= */

function openExamSeating(examId) {
    if (examId === null || examId === undefined || examId === "") {
        showError("This examination does not have a valid exam ID.");
        return;
    }

    window.location.href =
        "seating.html?examId=" + encodeURIComponent(examId);
}

/* =========================================
   HALL CAPACITY
========================================= */

function renderSelectedExam() {
    var examName = document.getElementById("selected-exam-name");
    var examDetails = document.getElementById("selected-exam-details");
    var capacityGrid = document.getElementById("capacity-grid");
    var sectionTitle = document.getElementById("hall-section-title");
    var sectionSubtitle = document.getElementById("hall-section-subtitle");

    if (!examName || !examDetails || !capacityGrid) return;

    capacityGrid.replaceChildren();

    var exam = findExam(selectedExamId);

    if (!exam) {
        examName.textContent = "Select an examination";
        examDetails.textContent = "Select an exam above to view its hall capacity.";

        if (sectionTitle) {
            sectionTitle.textContent = "Hall Capacity & Allocation";
        }

        if (sectionSubtitle) {
            sectionSubtitle.textContent =
                "Select an exam to view its hall allocation";
        }

        capacityGrid.appendChild(
            createText("p", "No examination selected.")
        );

        return;
    }

    var assignedHalls = Array.isArray(exam.halls) ? exam.halls : [];
    var totalStudents = getExamStudentCount(exam);

    examName.textContent =
        exam.examName || exam.name || "Untitled Examination";

    examDetails.textContent =
        totalStudents + " Students • " + assignedHalls.length + " Halls Assigned";

    if (sectionTitle) {
        sectionTitle.textContent =
            "Hall Capacity & Allocation — " +
            (exam.examName || exam.name || "Examination");
    }

    if (sectionSubtitle) {
        sectionSubtitle.textContent =
            "Hall allocation for this particular examination";
    }

    if (assignedHalls.length === 0) {
        capacityGrid.appendChild(
            createText("p", "No halls assigned to this examination.")
        );
        return;
    }

    var remainingStudents = totalStudents;

    assignedHalls.forEach(function (assignedHall, index) {
        var hallNumber = typeof assignedHall === "object"
            ? (assignedHall.hallNo ?? assignedHall.name ?? assignedHall._id)
            : assignedHall;

        var hallId = typeof assignedHall === "object"
            ? (assignedHall._id ?? assignedHall.hallId ?? null)
            : null;

        var hall = hallsData.find(function (item) {
            var itemId = item._id ?? item.hallId ?? null;

            if (hallId && itemId) {
                return String(itemId) === String(hallId);
            }

            return String(item.hallNo) === String(hallNumber);
        });

        var hallCard = document.createElement("article");
        hallCard.className = "capacity-card";

        var heading = createText(
            "h3",
            hall
                ? "Block " + (hall.block || "A") + " – Room " +
                    (hall.hallNo ?? hallNumber)
                : "Hall " + String(hallNumber ?? "Unknown")
        );

        hallCard.appendChild(heading);

        if (!hall) {
            hallCard.appendChild(
                createText("p", "Hall details are unavailable.")
            );
            capacityGrid.appendChild(hallCard);
            return;
        }

        var rows = Number(hall.rows) || 0;
        var cols = Number(hall.cols) || 0;
        var capacity = rows * cols;

        /*
         * Estimate distribution only if backend does not provide
         * actual per-hall occupied-seat data.
         * Replace this estimate with real seating allocations
         * when your seating API exposes them.
         */

        var occupied = Number(
            assignedHall.studentCount ??
            assignedHall.occupiedSeats ??
            assignedHall.studentsCount
        );

        if (!Number.isFinite(occupied) || occupied < 0) {
            var hallsLeft = assignedHalls.length - index;
            occupied = hallsLeft > 0
                ? Math.min(remainingStudents, capacity)
                : 0;
        }

        occupied = Math.max(0, Math.min(occupied, capacity));
        remainingStudents = Math.max(0, remainingStudents - occupied);

        var percentage = capacity > 0
            ? Math.min(100, Math.round((occupied / capacity) * 100))
            : 0;

        var statsLine = document.createElement("div");
        statsLine.className = "capacity-progress-label";

        var seatCount = createText(
            "span",
            occupied + " / " + capacity + " Seats"
        );

        var occupiedBadge = createText(
            "span",
            occupied >= capacity && capacity > 0
                ? "Full"
                : "Occupied"
        );

        occupiedBadge.className = "capacity-occupied";

        statsLine.append(seatCount, occupiedBadge);

        var progress = document.createElement("div");
        progress.className = "capacity-progress";

        var track = document.createElement("div");
        track.className = "capacity-progress-track";

        var fill = document.createElement("div");
        fill.className = "capacity-progress-fill";
        fill.style.width = percentage + "%";
        fill.setAttribute("role", "progressbar");
        fill.setAttribute("aria-valuemin", "0");
        fill.setAttribute("aria-valuemax", "100");
        fill.setAttribute("aria-valuenow", String(percentage));
        fill.setAttribute(
            "aria-label",
            "Hall utilization " + percentage + "%"
        );

        track.appendChild(fill);

        var percentageLabel = createText("span", percentage + "%");
        percentageLabel.style.cssText =
            "display:block;margin-top:5px;text-align:right;" +
            "font-size:9px;font-weight:800;color:#3478e5;";

        progress.append(statsLine, track, percentageLabel);
        hallCard.appendChild(progress);

        capacityGrid.appendChild(hallCard);
    });
}

function findExam(examId) {
    if (examId === null || examId === undefined) return null;

    return examsData.find(function (exam) {
        return String(getExamId(exam)) === String(examId);
    }) || null;
}

/* =========================================
   DELETE EXAM
========================================= */

async function deleteExam(examId) {
    if (examId === null || examId === undefined || examId === "") {
        showError("Cannot delete this exam because its ID is missing.");
        return;
    }

    if (!window.confirm("Are you sure you want to delete this examination?")) {
        return;
    }

    showError("");

    try {
        await api("DELETE", "/exams/" + encodeURIComponent(examId));

        examsData = examsData.filter(function (exam) {
            return String(getExamId(exam)) !== String(examId);
        });

        if (String(selectedExamId) === String(examId)) {
            selectedExamId = null;
        }

        renderStats();
        renderExamList();
        renderSelectedExam();

    } catch (error) {
        console.error("Exam deletion failed:", error);
        showError("Unable to delete the exam. Please try again.");
    }
}

/* =========================================
   HEADER BUTTONS
========================================= */

function wireHeaderButtons() {
    var timetableButton = document.getElementById("view-timetable-btn");
    var newExamButton = document.getElementById("new-exam-btn");

    if (timetableButton) {
        timetableButton.addEventListener("click", function () {
            window.location.href = "timetable.html";
        });
    }

    if (newExamButton) {
        newExamButton.addEventListener("click", function () {
            window.location.href = "createExam.html";
        });
    }
}

/* =========================================
   COMMON HELPERS
========================================= */

function setText(id, value) {
    var element = document.getElementById(id);

    if (element) {
        element.textContent = String(value);
    }
}

function createText(tagName, value) {
    var element = document.createElement(tagName);
    element.textContent = String(value);
    return element;
}

function showError(message) {
    var errorElement = document.getElementById("dashboard-error");

    if (!errorElement) {
        if (message) console.error(message);
        return;
    }

    errorElement.textContent = message;
    errorElement.hidden = !message;
}

