/* =========================================================
   ExamMatrix — Dashboard JS
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STORAGE KEYS
    ===================================================== */

    var EXAMS_KEY = "em_exams";

    var CURRENT_KEY = "em_currentExam";

    var SESSION_KEY = "em_session";

    var SEATING_PAGE = "seating.html";


    /* =====================================================
       CURRENT TAB
    ===================================================== */

    var currentTab = "upcoming";

    var selectedExamId = null;


    /* =====================================================
       GET EXAMS
    ===================================================== */

    function getExams() {

        var list = [];

        try {

            var raw =
                localStorage.getItem(EXAMS_KEY);

            if (raw) {

                var parsed =
                    JSON.parse(raw);

                if (Array.isArray(parsed)) {

                    list = (typeof getMyExams === "function") ? getMyExams() : parsed;


                }

            }

        } catch (e) {

        }


        /* Fallback to current exam */

        if (!list.length) {

            try {

                var cur =
                    localStorage.getItem(CURRENT_KEY);

                if (cur) {

                    var one =
                        JSON.parse(cur);

                    if (one && one.examName && one.owner === getSessionUser()) {

                        if (one.id == null) {

                            one.id = "current";

                        }

                        list = [one];

                    }

                }

            } catch (e) {

            }

        }


        return list;

    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function num(value) {

        var n =
            Number(value);

        return isFinite(n) ? n : 0;

    }


    function studentCount(exam) {

        return Array.isArray(exam.students)
            ? exam.students.length
            : num(exam.studentCount || exam.studentsCount);

    }


    function examHalls(exam) {

        return Array.isArray(exam.pickedHalls)
            ? exam.pickedHalls
            : [];

    }


    function examConflicts(exam) {

        if (Array.isArray(exam.conflicts)) {

            return exam.conflicts.length;

        }

        return num(exam.conflicts);

    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(str) {

        return String(
            str == null ? "" : str
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    }


    /* =====================================================
       DATE PARSER
    ===================================================== */

    function parseExamDate(dateValue) {

        if (!dateValue) {

            return null;

        }


        var value =
            String(dateValue).trim();

        var date = null;


        /* YYYY-MM-DD */

        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {

            var parts =
                value.split("-");

            date =
                new Date(
                    Number(parts[0]),
                    Number(parts[1]) - 1,
                    Number(parts[2])
                );

        }


        /* DD-MM-YYYY */

        else if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {

            var parts2 =
                value.split("-");

            date =
                new Date(
                    Number(parts2[2]),
                    Number(parts2[1]) - 1,
                    Number(parts2[0])
                );

        }


        /* DD/MM/YYYY */

        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {

            var parts3 =
                value.split("/");

            date =
                new Date(
                    Number(parts3[2]),
                    Number(parts3[1]) - 1,
                    Number(parts3[0])
                );

        }


        /* Normal JS date */

        else {

            date =
                new Date(value);

        }


        if (
            !date ||
            isNaN(date.getTime())
        ) {

            return null;

        }


        date.setHours(
            0,
            0,
            0,
            0
        );


        return date;

    }


    /* =====================================================
       TODAY
    ===================================================== */

    function getToday() {

        var today =
            new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        return today;

    }


    /* =====================================================
       PREVIOUS EXAM
    ===================================================== */

    function isPreviousExam(exam) {

        var date =
            parseExamDate(exam.date);


        if (!date) {

            return false;

        }


        return date < getToday();

    }


    /* =====================================================
       FORMAT DATE
    ===================================================== */

    function formatDate(dateValue) {

        var date =
            parseExamDate(dateValue);


        if (!date) {

            return "Date Not Available";

        }


        return date.toLocaleDateString(
            "en-US",
            {
                month: "long",
                day: "numeric",
                year: "numeric"
            }
        );

    }


    /* =====================================================
       SORT EXAMS
    ===================================================== */

    function sortByDate(exams, ascending) {

        return exams.slice().sort(

            function (a, b) {

                var dateA =
                    parseExamDate(a.date);

                var dateB =
                    parseExamDate(b.date);


                if (!dateA && !dateB) {

                    return 0;

                }


                if (!dateA) {

                    return 1;

                }


                if (!dateB) {

                    return -1;

                }


                if (ascending) {

                    return dateA - dateB;

                }


                return dateB - dateA;

            }

        );

    }


    /* =====================================================
       GROUP BY DATE
    ===================================================== */

    function groupExamsByDate(exams) {

        var groups = {};


        exams.forEach(

            function (exam) {

                var date =
                    parseExamDate(exam.date);

                var key;


                if (date) {

                    key =
                        date.getFullYear() +
                        "-" +
                        String(
                            date.getMonth() + 1
                        ).padStart(2, "0") +
                        "-" +
                        String(
                            date.getDate()
                        ).padStart(2, "0");

                } else {

                    key = "unknown";

                }


                if (!groups[key]) {

                    groups[key] = [];

                }


                groups[key].push(exam);

            }

        );


        return groups;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function getExamStatus(exam) {

        var date =
            parseExamDate(exam.date);


        if (!date) {

            return {

                text: "Upcoming",

                className: "upcoming"

            };

        }


        var today =
            getToday();


        if (date < today) {

            return {

                text: "Completed",

                className: "completed"

            };

        }


        if (
            date.getTime() ===
            today.getTime()
        ) {

            return {

                text: "Today",

                className: "today"

            };

        }


        return {

            text: "Upcoming",

            className: "upcoming"

        };

    }


    /* =====================================================
       TIME
    ===================================================== */

    function getExamTime(exam) {

        if (exam.slot) {

            return escapeHtml(
                exam.slot
            );

        }


        if (exam.time) {

            return escapeHtml(
                exam.time
            );

        }


        return "Time not specified";

    }


    /* =====================================================
       CREATE EXAM CARD
    ===================================================== */

    function createExamCard(exam, index) {

        var id =
            exam.id != null
                ? exam.id
                : index;


        var name =
            escapeHtml(
                exam.examName ||
                "Untitled Exam"
            );


        var courses =
            Array.isArray(
                exam.pickedCourses
            )
                ? exam.pickedCourses
                : [];


        var subject =
            escapeHtml(
                courses.length
                    ? courses.join(", ")
                    : "No subject specified"
            );


        var status =
            getExamStatus(exam);


        var selectedClass =
            String(id) === String(selectedExamId)
                ? " selected"
                : "";


        return (

            '<div class="exam-item' +
                selectedClass +
                '" data-exam-id="' +
                escapeHtml(id) +
            '">' +


                '<div class="exam-information">' +

                    '<strong>' +
                        name +
                    '</strong>' +

                    '<span class="exam-subject">' +
                        subject +
                    '</span>' +

                    '<span class="exam-time">' +

                        '<i class="fa-regular fa-clock"></i>' +

                        getExamTime(exam) +

                    '</span>' +

                '</div>' +


                '<div class="exam-actions">' +

                    '<span class="exam-status ' +
                        status.className +
                    '">' +

                        status.text +

                    '</span>' +


                    '<button ' +

                        'class="matrix-btn" ' +

                        'data-exam-id="' +
                            escapeHtml(id) +
                        '"' +

                    '>' +

                        'Matrix' +

                        '<i class="fa-solid fa-arrow-right"></i>' +

                    '</button>' +


                    '<button ' +

                        'class="delete-exam-btn" ' +

                        'data-exam-id="' +
                            escapeHtml(id) +
                        '"' +

                    '>' +

                        'Delete' +

                    '</button>' +

                '</div>' +

            '</div>'

        );

    }


    /* =====================================================
       CREATE DATE GROUP
    ===================================================== */

    function createDateGroup(dateKey, exams, indexStart) {

        var firstExam =
            exams[0];


        var dateText =
            formatDate(
                firstExam.date
            );


        var html =

            '<div class="exam-date-group">' +

                '<div class="exam-date-heading">' +

                    '<i class="fa-regular fa-calendar"></i>' +

                    '<span>' +

                        escapeHtml(dateText) +

                    '</span>' +

                '</div>' +


                '<div class="exam-date-line"></div>';


        exams.forEach(

            function (exam, index) {

                html +=
                    createExamCard(
                        exam,
                        indexStart + index
                    );

            }

        );


        html +=
            '</div>';


        return html;

    }


    /* =====================================================
       RENDER EXAM LIST
    ===================================================== */

    function renderExamList(

        container,

        exams,

        emptyMessage,

        ascending

    ) {

        if (!container) {

            return;

        }


        if (!exams.length) {

            container.innerHTML =

                '<div class="no-exams">' +

                    '<i class="fa-regular fa-calendar-xmark"></i>' +

                    '<span>' +

                        emptyMessage +

                    '</span>' +

                '</div>';

            return;

        }


        var sorted =
            sortByDate(
                exams,
                ascending
            );


        var groups =
            groupExamsByDate(
                sorted
            );


        var html = "";

        var counter = 0;


        Object.keys(groups)

            .sort(

                function (a, b) {

                    if (a === "unknown") {

                        return 1;

                    }


                    if (b === "unknown") {

                        return -1;

                    }


                    if (ascending) {

                        return a.localeCompare(b);

                    }


                    return b.localeCompare(a);

                }

            )

            .forEach(

                function (key) {

                    html +=
                        createDateGroup(
                            key,
                            groups[key],
                            counter
                        );


                    counter +=
                        groups[key].length;

                }

            );


        container.innerHTML =
            html;

    }


    /* =====================================================
       FIND EXAM
    ===================================================== */

    function findExam(examId) {

        var exams =
            getExams();


        for (
            var i = 0;
            i < exams.length;
            i++
        ) {

            var id =
                exams[i].id != null
                    ? exams[i].id
                    : i;


            if (
                String(id) ===
                String(examId)
            ) {

                return exams[i];

            }

        }


        return null;

    }


    /* =====================================================
       SELECT EXAM
    ===================================================== */

    function selectExam(examId) {

        var exam =
            findExam(examId);


        if (!exam) {

            return;

        }


        selectedExamId =
            exam.id != null
                ? exam.id
                : examId;


        renderCurrentTab();


        renderSelectedExamHall(exam);

    }


    /* =====================================================
       SELECTED EXAM HALL CAPACITY
    ===================================================== */

    function renderSelectedExamHall(exam) {

        var grid =
            document.getElementById(
                "capacity-grid"
            );


        var title =
            document.getElementById(
                "hall-section-title"
            );


        var subtitle =
            document.getElementById(
                "hall-section-subtitle"
            );


        var examName =
            document.getElementById(
                "selected-exam-name"
            );


        var examDetails =
            document.getElementById(
                "selected-exam-details"
            );


        if (!grid) {

            return;

        }


        var name =
            exam.examName ||
            "Selected Exam";


        var students =
            studentCount(exam);


        var halls =
            examHalls(exam);


        if (title) {

            title.textContent =
                "Hall Capacity & Allocation — " +
                name;

        }


        if (subtitle) {

            subtitle.textContent =
                "Hall allocation for this particular exam";

        }


        if (examName) {

            examName.textContent =
                name;

        }


        if (examDetails) {

            examDetails.textContent =
                students +
                " Students • " +
                halls.length +
                " Halls Assigned";

        }


        if (!halls.length) {

            grid.innerHTML =

                '<div class="hall-card">' +

                    '<div class="hall-info-row">' +

                        '<span class="hall-title">' +

                            'No halls assigned' +

                        '</span>' +

                    '</div>' +

                    '<div class="progress-bar-wrapper">' +

                        '<span class="empty-text">' +

                            'No hall allocation available for this exam.' +

                        '</span>' +

                    '</div>' +

                '</div>';

            return;

        }


        var allHalls =

            (
                typeof EM_DATA !== "undefined" &&
                EM_DATA.halls
            ) || [];


        var studentsPerHall =
            halls.length > 0
                ? Math.ceil(
                    students / halls.length
                )
                : 0;


        var html = "";


        halls.forEach(

            function (hallValue) {

                var hallName =
                    String(hallValue).trim();


                var hallData = null;


                for (
                    var i = 0;
                    i < allHalls.length;
                    i++
                ) {

                    if (
                        String(
                            allHalls[i].hallNo
                        ).trim() === hallName
                    ) {

                        hallData =
                            allHalls[i];

                        break;

                    }

                }


                var capacity =
                    hallData
                        ? num(hallData.rows) *
                          num(hallData.cols)
                        : 0;


                var seated =
                    studentsPerHall;


                if (
                    capacity > 0 &&
                    seated > capacity
                ) {

                    seated =
                        capacity;

                }


                var percent =
                    capacity > 0
                        ? Math.round(
                            (
                                seated /
                                capacity
                            ) * 100
                        )
                        : 0;


                if (percent > 100) {

                    percent = 100;

                }


                var state =
                    hallState(percent);


                var percentageText =
                    percent === 0
                        ? '<span class="empty-text">0%</span>'
                        : '<span>' +
                            percent +
                            '%' +
                          '</span>';


                html +=

                    '<div class="hall-card">' +

                        '<div class="hall-info-row">' +

                            '<span class="hall-title">' +

                                escapeHtml(
                                    hallName
                                ) +

                            '</span>' +


                            '<div class="hall-meta">' +

                                '<span class="capacity-count">' +

                                    seated +
                                    ' / ' +
                                    capacity +
                                    ' Seats' +

                                '</span>' +


                                '<span class="hall-status-badge ' +
                                    state.badge +
                                '">' +

                                    '<i class="fa-solid fa-circle"></i>' +

                                    state.label +

                                '</span>' +

                            '</div>' +

                        '</div>' +


                        '<div class="progress-bar-wrapper">' +

                            '<div ' +

                                'class="progress-bar ' +
                                    state.bar +
                                '"' +

                                'style="width:' +
                                    percent +
                                '%;"' +

                            '>' +

                                percentageText +

                            '</div>' +

                        '</div>' +

                    '</div>';

            }

        );


        grid.innerHTML =
            html;

    }


    /* =====================================================
       HALL STATE
    ===================================================== */

    function hallState(percent) {

        if (percent >= 100) {

            return {

                badge: "status-full",

                bar: "bar-full",

                label: "Filled"

            };

        }


        if (percent >= 50) {

            return {

                badge: "status-occupied",

                bar: "bar-blue",

                label: "Occupied"

            };

        }


        if (percent > 0) {

            return {

                badge: "status-available",

                bar: "bar-gold",

                label: "Available"

            };

        }


        return {

            badge: "status-empty",

            bar: "bar-empty",

            label: "Empty"

        };

    }


    /* =====================================================
       STATISTICS
    ===================================================== */

/* =====================================================
   STATISTICS
===================================================== */

function renderStats(exams) {

    var numbers =
        document.querySelectorAll(
            "#stats .stat-number"
        );


    if (!numbers.length) {
        return;
    }


    /* =================================================
       ONLY UPCOMING EXAMS
    ================================================= */

    var upcomingExams =
        exams.filter(
            function (exam) {

                return !isPreviousExam(exam);

            }
        );


    /* =================================================
       1. EXAMS SCHEDULED
       Only upcoming exams
    ================================================= */

    var examsScheduled =
        upcomingExams.length;


    /* =================================================
       2. STUDENTS SEATED
       Only students of upcoming exams
    ================================================= */

    var studentsSeated =
        upcomingExams.reduce(

            function (total, exam) {

                return total +
                    studentCount(exam);

            },

            0

        );


    /* =================================================
       3. HALLS AVAILABLE
       Halls assigned to upcoming exams

       We count unique halls so that if the same hall
       is used by multiple upcoming exams, it is not
       counted multiple times.
    ================================================= */

    var uniqueHalls = [];


    upcomingExams.forEach(

        function (exam) {

            var halls =
                examHalls(exam);


            halls.forEach(

                function (hall) {

                    var hallName =
                        String(hall).trim();


                    if (
                        hallName &&
                        uniqueHalls.indexOf(hallName) === -1
                    ) {

                        uniqueHalls.push(
                            hallName
                        );

                    }

                }

            );

        }

    );


    var hallsAvailable =
        uniqueHalls.length;


    /* =================================================
       4. TOTAL CONFLICTS
       Only conflicts of upcoming exams
    ================================================= */

    var totalConflicts =
        upcomingExams.reduce(

            function (total, exam) {

                return total +
                    examConflicts(exam);

            },

            0

        );


    /* =================================================
       UPDATE DASHBOARD
    ================================================= */

    setStat(
        numbers[0],
        examsScheduled
    );


    setStat(
        numbers[1],
        studentsSeated
    );


    setStat(
        numbers[2],
        hallsAvailable
    );


    setStat(
        numbers[3],
        totalConflicts,
        true
    );

}


    function setStat(
        element,
        value,
        keepIcon
    ) {

        if (!element) {

            return;

        }


        if (keepIcon) {

            var icon =
                element.querySelector("i");


            element.textContent = "";


            if (icon) {

                element.appendChild(icon);

            }


            element.appendChild(
                document.createTextNode(
                    " " + value
                )
            );

        } else {

            element.textContent =
                String(value);

        }

    }


    /* =====================================================
       MATRIX BUTTON
    ===================================================== */

    function openExamMatrix(examId) {

        var selectedExam =
            findExam(examId);


        if (!selectedExam) {

            return;

        }


        try {

            localStorage.setItem(

                CURRENT_KEY,

                JSON.stringify(
                    selectedExam
                )

            );

        } catch (e) {

        }


        window.location.href =

            SEATING_PAGE +
            "?examId=" +
            encodeURIComponent(
                examId
            );

    }


    /* =====================================================
       DELETE EXAM
    ===================================================== */

    function deleteExam(examId) {

        var exams =
            getExams();


        var filtered =
            exams.filter(

                function (exam, index) {

                    var id =
                        exam.id != null
                            ? exam.id
                            : index;


                    return String(id) !==
                        String(examId);

                }

            );


        try {

            localStorage.setItem(

                EXAMS_KEY,

                JSON.stringify(
                    filtered
                )

            );

        } catch (e) {

        }


        try {

            var current =
                JSON.parse(
                    localStorage.getItem(
                        CURRENT_KEY
                    )
                );


            if (

                current &&

                String(current.id) ===
                String(examId)

            ) {

                localStorage.removeItem(
                    CURRENT_KEY
                );

            }

        } catch (e) {

        }


        if (
            String(selectedExamId) ===
            String(examId)
        ) {

            selectedExamId = null;

            resetSelectedExamHall();

        }


        renderAll();

    }


    /* =====================================================
       RESET HALL PANEL
    ===================================================== */

    function resetSelectedExamHall() {

        var title =
            document.getElementById(
                "hall-section-title"
            );


        var subtitle =
            document.getElementById(
                "hall-section-subtitle"
            );


        var examName =
            document.getElementById(
                "selected-exam-name"
            );


        var examDetails =
            document.getElementById(
                "selected-exam-details"
            );


        var grid =
            document.getElementById(
                "capacity-grid"
            );


        if (title) {

            title.textContent =
                "Hall Capacity & Allocation";

        }


        if (subtitle) {

            subtitle.textContent =
                "Select an exam to view its hall allocation";

        }


        if (examName) {

            examName.textContent =
                "No Exam Selected";

        }


        if (examDetails) {

            examDetails.textContent =
                "Select an exam above to view its hall capacity.";

        }


        if (grid) {

            grid.innerHTML =

                '<div class="hall-card">' +

                    '<div class="hall-info-row">' +

                        '<span class="hall-title">' +

                            'No Exam Selected' +

                        '</span>' +

                    '</div>' +

                    '<div class="progress-bar-wrapper">' +

                        '<span class="empty-text">' +

                            'Select an exam above.' +

                        '</span>' +

                    '</div>' +

                '</div>';

        }

    }


    /* =====================================================
       RENDER CURRENT TAB
    ===================================================== */

    function renderCurrentTab() {

        var exams =
            getExams();


        var upcoming =
            exams.filter(

                function (exam) {

                    return !isPreviousExam(
                        exam
                    );

                }

            );


        var previous =
            exams.filter(

                function (exam) {

                    return isPreviousExam(
                        exam
                    );

                }

            );


        var list =
            document.getElementById(
                "exam-list"
            );


        if (currentTab === "upcoming") {

            renderExamList(

                list,

                upcoming,

                "No upcoming exams. Click + New Exam to create one.",

                true

            );

        } else {

            renderExamList(

                list,

                previous,

                "No previous exams yet.",

                false

            );

        }


        var upcomingCount =
            document.getElementById(
                "upcoming-count"
            );


        var previousCount =
            document.getElementById(
                "previous-count"
            );


        if (upcomingCount) {

            upcomingCount.textContent =
                upcoming.length;

        }


        if (previousCount) {

            previousCount.textContent =
                previous.length;

        }


        updateTabs();


        if (selectedExamId != null) {

            var selectedExam =
                findExam(selectedExamId);


            if (selectedExam) {

                renderSelectedExamHall(
                    selectedExam
                );

            }

        }

    }


    /* =====================================================
       UPDATE TABS
    ===================================================== */

    function updateTabs() {

        var upcomingTab =
            document.getElementById(
                "upcoming-tab"
            );


        var previousTab =
            document.getElementById(
                "previous-tab"
            );


        if (upcomingTab) {

            upcomingTab.classList.toggle(
                "active",
                currentTab === "upcoming"
            );

        }


        if (previousTab) {

            previousTab.classList.toggle(
                "active",
                currentTab === "previous"
            );

        }

    }


    /* =====================================================
       TAB EVENTS
    ===================================================== */

    function wireTabs() {

        var upcomingTab =
            document.getElementById(
                "upcoming-tab"
            );


        var previousTab =
            document.getElementById(
                "previous-tab"
            );


        if (upcomingTab) {

            upcomingTab.addEventListener(

                "click",

                function () {

                    currentTab =
                        "upcoming";

                    renderCurrentTab();

                }

            );

        }


        if (previousTab) {

            previousTab.addEventListener(

                "click",

                function () {

                    currentTab =
                        "previous";

                    renderCurrentTab();

                }

            );

        }

    }


    /* =====================================================
       CLICK EVENTS
    ===================================================== */

    function wireExamButtons() {

        document.addEventListener(

            "click",

            function (event) {


                /* Matrix */

                var matrixButton =
                    event.target.closest(
                        ".matrix-btn"
                    );


                if (matrixButton) {

                    event.preventDefault();

                    event.stopPropagation();


                    var id =
                        matrixButton.getAttribute(
                            "data-exam-id"
                        );


                    if (id) {

                        openExamMatrix(id);

                    }


                    return;

                }


                /* Delete */

                var deleteButton =
                    event.target.closest(
                        ".delete-exam-btn"
                    );


                if (deleteButton) {

                    event.preventDefault();

                    event.stopPropagation();


                    var deleteId =
                        deleteButton.getAttribute(
                            "data-exam-id"
                        );


                    var examName =
                        deleteButton
                            .closest(".exam-item")
                            ?.querySelector("strong")
                            ?.textContent ||
                        "this exam";


                    if (

                        deleteId &&

                        window.confirm(

                            'Delete "' +
                            examName +
                            '"?\n\n' +
                            'Its halls and subjects will be freed.'

                        )

                    ) {

                        deleteExam(
                            deleteId
                        );

                    }


                    return;

                }


                /* Exam card */

                var examCard =
                    event.target.closest(
                        ".exam-item"
                    );


                if (examCard) {

                    var examId =
                        examCard.getAttribute(
                            "data-exam-id"
                        );


                    if (examId) {

                        selectExam(
                            examId
                        );

                    }

                }

            }

        );

    }


    /* =====================================================
       RENDER EVERYTHING
    ===================================================== */

    function renderAll() {

        var exams =
            getExams();


        renderStats(
            exams
        );


        renderCurrentTab();


        /*
         * If there is no selected exam,
         * automatically select first exam
         */

        if (selectedExamId == null) {

            var firstExam = null;


            var upcoming =
                exams.filter(

                    function (exam) {

                        return !isPreviousExam(
                            exam
                        );

                    }

                );


            var previous =
                exams.filter(

                    function (exam) {

                        return isPreviousExam(
                            exam
                        );

                    }

                );


            if (currentTab === "upcoming") {

                firstExam =
                    sortByDate(
                        upcoming,
                        true
                    )[0];

            } else {

                firstExam =
                    sortByDate(
                        previous,
                        false
                    )[0];

            }


            if (firstExam) {

                selectedExamId =
                    firstExam.id != null
                        ? firstExam.id
                        : 0;


                renderCurrentTab();


                renderSelectedExamHall(
                    firstExam
                );

            } else {

                resetSelectedExamHall();

            }

        }

    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function init() {

        wireTabs();

        wireExamButtons();


        if (
            typeof loadExamData ===
            "function"
        ) {

            loadExamData(

                renderAll

            );

        } else {

            renderAll();

        }

    }


    /* =====================================================
       DOM READY
    ===================================================== */

    if (

        document.readyState ===
        "loading"

    ) {

        document.addEventListener(

            "DOMContentLoaded",

            init

        );

    } else {

        init();

    }

})();