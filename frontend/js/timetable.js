/* =========================================================
   ExamMatrix — TIMETABLE
   ---------------------------------------------------------
   DATA + CALENDAR + DAY PANEL + EXPORT

   Features:
   - Monthly calendar
   - Exam count badges
   - Today button
   - Next Exam button
   - Click day -> show exams
   - Hover exam -> CSS shows classes + room
   - Mid-Semester Exam appears before Semester Exam
   - CSV export
========================================================= */


/* =========================================================
   GLOBAL DATA
========================================================= */

var timetableExams = [];


/* =========================================================
   GET EXAMS FROM LOCAL STORAGE
========================================================= */

function getTimetableExams() {

    var exams = [];

    try {

        var raw = localStorage.getItem("em_exams");

        if (raw) {

            var parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                exams = (typeof getMyExams === "function") ? getMyExams() : parsed;

            }

        }

    } catch (error) {

        console.error("Unable to load exams:", error);

        exams = [];

    }

    return exams;
}


/* =========================================================
   DATE HELPERS
========================================================= */

function formatDate(date) {

    var year = date.getFullYear();

    var month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    var day = String(
        date.getDate()
    ).padStart(2, "0");

    return year + "-" + month + "-" + day;
}


function getTodayDate() {

    return formatDate(new Date());

}


/* =========================================================
   MONTH NAMES
========================================================= */

var monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];


/* =========================================================
   EXAM SORTING
   ---------------------------------------------------------
   Order:
   1. Mid-Semester Exam
   2. Semester Exam
   3. Other exams

   Then:
   Date
   Time
========================================================= */

function getExamTypePriority(exam) {

    var name = (
        exam.examName ||
        ""
    ).toLowerCase();

    if (
        name.includes("mid-semester") ||
        name.includes("mid semester") ||
        name.includes("midsem") ||
        name.includes("mid sem")
    ) {
        return 1;
    }

    if (
        name.includes("semester")
    ) {
        return 2;
    }

    return 3;
}


function getSlotStartTime(slot) {

    if (!slot) {
        return "";
    }

    /*
        Example:
        "09:00-11:00"
        becomes
        "09:00"
    */

    return String(slot)
        .split("-")[0]
        .trim();
}


function compareExams(a, b) {

    /* Date first */

    var dateA = a.date || "";
    var dateB = b.date || "";

    if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
    }


    /* Time second */

    var timeA = getSlotStartTime(a.slot);
    var timeB = getSlotStartTime(b.slot);

    if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
    }


    /* Exam type third */

    var priorityA = getExamTypePriority(a);
    var priorityB = getExamTypePriority(b);

    if (priorityA !== priorityB) {
        return priorityA - priorityB;
    }


    /* Final alphabetical fallback */

    var nameA = (
        a.examName ||
        ""
    ).toLowerCase();

    var nameB = (
        b.examName ||
        ""
    ).toLowerCase();

    return nameA.localeCompare(nameB);
}


/* =========================================================
   SORT EXAMS
========================================================= */

function sortExams(exams) {

    return exams.slice().sort(compareExams);

}


/* =========================================================
   DISTINCT EXAM DATES
========================================================= */

function getExamDates(exams) {

    var seen = {};
    var dates = [];

    for (var i = 0; i < exams.length; i++) {

        var date = exams[i].date;

        if (
            date &&
            !seen[date]
        ) {

            seen[date] = true;

            dates.push(date);

        }

    }

    dates.sort();

    return dates;
}


/* =========================================================
   DISTINCT EXAM SLOTS
========================================================= */

function getExamSlots(exams) {

    var seen = {};
    var slots = [];

    for (var i = 0; i < exams.length; i++) {

        var slot = exams[i].slot;

        if (
            slot &&
            !seen[slot]
        ) {

            seen[slot] = true;

            slots.push(slot);

        }

    }

    slots.sort();

    return slots;
}


/* =========================================================
   COURSES ALREADY USED
========================================================= */

function getConductedCourses(exams) {

    var used = {};

    for (var i = 0; i < exams.length; i++) {

        var courses =
            exams[i].pickedCourses || [];

        for (var c = 0; c < courses.length; c++) {

            used[courses[c]] = true;

        }

    }

    return used;
}


/* =========================================================
   GET EXAMS FOR DATE + SLOT
========================================================= */

function examsInCell(
    exams,
    date,
    slot
) {

    var out = [];

    for (var i = 0; i < exams.length; i++) {

        if (
            exams[i].date === date &&
            exams[i].slot === slot
        ) {

            out.push(exams[i]);

        }

    }

    return sortExams(out);
}


/* =========================================================
   CREATE TEXT ELEMENT
========================================================= */

function createTextElement(
    tag,
    className,
    text
) {

    var element =
        document.createElement(tag);

    element.className = className;

    element.textContent =
        text || "";

    return element;
}


/* =========================================================
   CREATE EXAM CARD
   ---------------------------------------------------------
   Normal:
   Time
   Exam Name

   Hover:
   CSS reveals:
   Classes
   Room
========================================================= */

function createExamCard(exam) {

    var card =
        document.createElement("div");

    card.className =
        "calendarExamCard";


    /* Prevent day click */

    card.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    /* =====================================
       TIME
    ===================================== */

    var slot =
        createTextElement(
            "div",
            "calendarExamSlot",
            exam.slot || "Time not specified"
        );

    card.appendChild(slot);


    /* =====================================
       EXAM NAME
    ===================================== */

    var examName =
        createTextElement(
            "div",
            "calendarExamName",
            exam.examName || "Exam"
        );

    card.appendChild(examName);


    /* =====================================
       CLASSES
       Hidden by CSS until hover
    ===================================== */

    if (
        exam.pickedCourses &&
        exam.pickedCourses.length > 0
    ) {

        var courses =
            document.createElement("div");

        courses.className =
            "calendarExamCourses";


        var courseLabel =
            createTextElement(
                "span",
                "examLabel",
                "Classes:"
            );

        courses.appendChild(courseLabel);

        courses.appendChild(
            document.createTextNode(
                " " +
                exam.pickedCourses.join(", ")
            )
        );

        card.appendChild(courses);

    }


    /* =====================================
       ROOM
       Hidden by CSS until hover
    ===================================== */

    if (
        exam.pickedHalls &&
        exam.pickedHalls.length > 0
    ) {

        var halls =
            document.createElement("div");

        halls.className =
            "calendarExamHall";


        var hallLabel =
            createTextElement(
                "span",
                "examLabel",
                "Room:"
            );

        halls.appendChild(hallLabel);

        halls.appendChild(
            document.createTextNode(
                " " +
                exam.pickedHalls.join(", ")
            )
        );

        card.appendChild(halls);

    }


    return card;
}


/* =========================================================
   CREATE DAY EXAM PANEL
========================================================= */

function createDayExamPanel(container) {

    var panel =
        document.createElement("div");

    panel.id =
        "dayExamPanel";

    panel.className =
        "dayExamPanel";

    container.appendChild(panel);

    return panel;
}


/* =========================================================
   RENDER CALENDAR
========================================================= */

function renderCalendar(exams) {

    var container =
        document.getElementById(
            "calendarContainer"
        );

    if (!container) {
        return;
    }


    /* Sort everything first */

    exams = sortExams(exams);


    /* Clear old calendar */

    container.innerHTML = "";


    /* =====================================
       CURRENT MONTH
    ===================================== */

    if (
        window.timetableMonth === undefined
    ) {

        window.timetableMonth =
            new Date().getMonth();

    }


    if (
        window.timetableYear === undefined
    ) {

        window.timetableYear =
            new Date().getFullYear();

    }


    var month =
        window.timetableMonth;

    var year =
        window.timetableYear;


    /* =====================================
       MONTH HEADER
    ===================================== */

    var header =
        document.createElement("div");

    header.className =
        "calendarHeader";


    /* Previous */

    var previousBtn =
        document.createElement("button");

    previousBtn.type = "button";

    previousBtn.className =
        "monthBtn";

    previousBtn.textContent = "‹";

    previousBtn.setAttribute(
        "aria-label",
        "Previous month"
    );


    /* Month title */

    var monthTitle =
        document.createElement("h2");

    monthTitle.className =
        "calendarMonthTitle";

    monthTitle.textContent =
        monthNames[month] +
        " " +
        year;


    /* Next */

    var nextBtn =
        document.createElement("button");

    nextBtn.type = "button";

    nextBtn.className =
        "monthBtn";

    nextBtn.textContent = "›";

    nextBtn.setAttribute(
        "aria-label",
        "Next month"
    );


    /* =====================================
       TODAY
    ===================================== */

    var todayBtn =
        document.createElement("button");

    todayBtn.type = "button";

    todayBtn.className =
        "monthBtn todayBtn";

    todayBtn.textContent =
        "Today";


    todayBtn.addEventListener(
        "click",
        function () {

            var today =
                new Date();

            window.timetableMonth =
                today.getMonth();

            window.timetableYear =
                today.getFullYear();

            renderCalendar(exams);

        }
    );


    /* =====================================
       NEXT EXAM
    ===================================== */

    var nextExamBtn =
        document.createElement("button");

    nextExamBtn.type = "button";

    nextExamBtn.className =
        "monthBtn nextExamBtn";

    nextExamBtn.textContent =
        "Next Exam →";


    nextExamBtn.addEventListener(
        "click",
        function () {

            var todayString =
                getTodayDate();


            var futureExams =
                sortExams(exams)
                    .filter(function (exam) {

                        return (
                            exam.date &&
                            exam.date >= todayString
                        );

                    });


            if (
                futureExams.length === 0
            ) {

                alert(
                    "No upcoming exams."
                );

                return;

            }


            var nextExam =
                futureExams[0];


            var parts =
                nextExam.date.split("-");


            window.timetableYear =
                Number(parts[0]);

            window.timetableMonth =
                Number(parts[1]) - 1;


            renderCalendar(exams);


            /*
                Wait until calendar is rendered.
            */

            setTimeout(
                function () {

                    var nextDay =
                        document.querySelector(
                            '[data-date="' +
                            nextExam.date +
                            '"]'
                        );


                    if (nextDay) {

                        nextDay.click();

                        nextDay.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                    }

                },
                50
            );

        }
    );


    /* =====================================
       MONTH NAVIGATION
    ===================================== */

    previousBtn.addEventListener(
        "click",
        function () {

            month--;

            if (month < 0) {

                month = 11;

                year--;

            }

            window.timetableMonth =
                month;

            window.timetableYear =
                year;

            renderCalendar(exams);

        }
    );


    nextBtn.addEventListener(
        "click",
        function () {

            month++;

            if (month > 11) {

                month = 0;

                year++;

            }

            window.timetableMonth =
                month;

            window.timetableYear =
                year;

            renderCalendar(exams);

        }
    );


    header.appendChild(
        previousBtn
    );

    header.appendChild(
        monthTitle
    );

    header.appendChild(
        nextBtn
    );

    header.appendChild(
        todayBtn
    );

    header.appendChild(
        nextExamBtn
    );

    container.appendChild(header);


    /* =====================================
       CALENDAR GRID
    ===================================== */

    var calendar =
        document.createElement("div");

    calendar.className =
        "monthCalendar";


    /* =====================================
       WEEKDAY HEADERS
    ===================================== */

    var weekDays = [
        "SUN",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT"
    ];


    for (
        var w = 0;
        w < weekDays.length;
        w++
    ) {

        var weekDay =
            document.createElement("div");

        weekDay.className =
            "calendarWeekDay";

        weekDay.textContent =
            weekDays[w];

        calendar.appendChild(
            weekDay
        );

    }


    /* =====================================
       MONTH INFORMATION
    ===================================== */

    var firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    var daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    /* =====================================
       EMPTY DAYS
    ===================================== */

    for (
        var empty = 0;
        empty < firstDay;
        empty++
    ) {

        var emptyCell =
            document.createElement("div");

        emptyCell.className =
            "calendarDate emptyDate";

        calendar.appendChild(
            emptyCell
        );

    }


    /* =====================================
       CREATE EACH DAY
    ===================================== */

    for (
        var day = 1;
        day <= daysInMonth;
        day++
    ) {

        var dateCell =
            document.createElement("div");

        dateCell.className =
            "calendarDate";


        /* =================================
           YYYY-MM-DD
        ================================= */

        var monthString =
            String(
                month + 1
            ).padStart(2, "0");


        var dayString =
            String(day)
                .padStart(2, "0");


        var fullDate =
            year +
            "-" +
            monthString +
            "-" +
            dayString;


        dateCell.dataset.date =
            fullDate;


        /* =================================
           DATE NUMBER
        ================================= */

        var dateNumber =
            createTextElement(
                "div",
                "calendarDateNumber",
                day
            );

        dateCell.appendChild(
            dateNumber
        );


        /* =================================
           EXAMS FOR THIS DAY
        ================================= */

        var dayExams =
            exams.filter(
                function (exam) {

                    return (
                        exam.date ===
                        fullDate
                    );

                }
            );


        dayExams =
            sortExams(dayExams);


        /* =================================
           EXAM COUNT BADGE
        ================================= */

        if (
            dayExams.length > 0
        ) {

            var examBadge =
                createTextElement(
                    "span",
                    "examCountBadge",
                    dayExams.length
                );

            examBadge.title =
                dayExams.length +
                " exam(s)";

            dateCell.appendChild(
                examBadge
            );

        }


        /* =================================
           EXAM CARDS
        ================================= */

        for (
            var e = 0;
            e < dayExams.length;
            e++
        ) {

            var exam =
                dayExams[e];


            var examCard =
                createExamCard(exam);


            dateCell.appendChild(
                examCard
            );

        }


        /* =================================
           TODAY
        ================================= */

        if (
            fullDate ===
            getTodayDate()
        ) {

            dateCell.classList.add(
                "today"
            );

        }


        /* =================================
           CLICK DAY
        ================================= */

        dateCell.addEventListener(
            "click",
            function () {

                showDayExams(
                    this.dataset.date,
                    exams
                );

            }
        );


        calendar.appendChild(
            dateCell
        );

    }


    /* =====================================
       ADD CALENDAR
    ===================================== */

    container.appendChild(
        calendar
    );


    /* =====================================
       DAY PANEL
    ===================================== */

    var panel =
        createDayExamPanel(
            container
        );


    /*
       Automatically show today's exams
       when opening the current month.
    */

    var todayString =
        getTodayDate();


    var currentMonthString =
        year +
        "-" +
        String(month + 1)
            .padStart(2, "0");


    if (
        todayString.startsWith(
            currentMonthString
        )
    ) {

        showDayExams(
            todayString,
            exams
        );

    } else {

        panel.innerHTML = "";

        var message =
            document.createElement("p");

        message.className =
            "noDayExams";

        message.textContent =
            "Click a day to view its exams.";

        panel.appendChild(
            message
        );

    }

}


/* =========================================================
   SHOW EXAMS FOR SELECTED DAY
========================================================= */

function showDayExams(date, exams) {

    var panel = document.getElementById("dayExamPanel");

    if (!panel) {
        return;
    }

    /* Clear previous content */
    panel.innerHTML = "";

    /* Find exams for selected date */
    var dayExams = exams.filter(function (exam) {
        return exam.date === date;
    });

    /* Sort Mid-Semester Exam before Semester Exam */
    dayExams.sort(function (a, b) {

        var aName = (a.examName || "").toLowerCase();
        var bName = (b.examName || "").toLowerCase();

        if (aName.includes("mid") && !bName.includes("mid")) {
            return -1;
        }

        if (!aName.includes("mid") && bName.includes("mid")) {
            return 1;
        }

        return 0;
    });

    /* Format selected date */
    var dateObject = new Date(date + "T00:00:00");

    var formattedDate = dateObject.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    /* =========================================
       PANEL HEADER
    ========================================= */

    var title = document.createElement("h3");

    title.textContent = "Exams on " + formattedDate;

    panel.appendChild(title);


    /* =========================================
       NO EXAMS
    ========================================= */

    if (dayExams.length === 0) {

        var noExam = document.createElement("p");

        noExam.className = "noDayExams";

        noExam.textContent =
            "No exams scheduled for this day.";

        panel.appendChild(noExam);

        panel.classList.add("show");

        return;
    }


    /* =========================================
       EXAM COUNT
    ========================================= */

    var count = document.createElement("p");

    count.className = "dayExamCount";

    count.textContent =
        dayExams.length +
        (dayExams.length === 1
            ? " exam scheduled"
            : " exams scheduled");

    panel.appendChild(count);


    /* =========================================
       EXAM ITEMS
    ========================================= */

    for (var i = 0; i < dayExams.length; i++) {

        var exam = dayExams[i];

        var item = document.createElement("div");

        item.className = "dayExamItem";


        /* Exam name */

        var name = document.createElement("strong");

        name.textContent =
            exam.examName || "Exam";

        item.appendChild(name);


        /* Time */

        var slot = document.createElement("div");

        slot.className = "dayExamTime";

        slot.textContent =
            "🕐 " + (exam.slot || "Time not specified");

        item.appendChild(slot);


        /* Classes */

        if (
            exam.pickedCourses &&
            exam.pickedCourses.length
        ) {

            var courses = document.createElement("div");

            courses.className = "dayExamCourses";

            courses.textContent =
                "📚 Classes: " +
                exam.pickedCourses.join(", ");

            item.appendChild(courses);
        }


        /* Room */

        if (
            exam.pickedHalls &&
            exam.pickedHalls.length
        ) {

            var halls = document.createElement("div");

            halls.className = "dayExamHalls";

            halls.textContent =
                "📍 Room: " +
                exam.pickedHalls.join(", ");

            item.appendChild(halls);
        }


        panel.appendChild(item);
    }


    /* Show panel */

    panel.classList.add("show");


    /* Scroll smoothly to panel */

    setTimeout(function () {

        panel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    }, 100);
}

/* =========================================================
   CSV EXPORT
========================================================= */

function setupExport() {

    var btn =
        document.getElementById(
            "exportBtn"
        );

    if (!btn) {
        return;
    }


    /* Prevent duplicate listeners */

    if (
        btn.dataset.exportReady === "true"
    ) {
        return;
    }


    btn.dataset.exportReady =
        "true";


    btn.addEventListener(
        "click",
        function () {

            if (
                timetableExams.length === 0
            ) {

                alert(
                    "There are no exams to export."
                );

                return;

            }


            var rows = [
                [
                    "Exam",
                    "Date",
                    "Slot",
                    "Courses",
                    "Halls"
                ]
            ];


            var sorted =
                sortExams(
                    timetableExams
                );


            for (
                var i = 0;
                i < sorted.length;
                i++
            ) {

                var exam =
                    sorted[i];


                rows.push([
                    exam.examName ||
                        ("Exam " + (i + 1)),

                    exam.date || "",

                    exam.slot || "",

                    (
                        exam.pickedCourses ||
                        []
                    ).join("; "),

                    (
                        exam.pickedHalls ||
                        []
                    ).join("; ")
                ]);

            }


            /* Build CSV */

            var csv =
                rows.map(
                    function (row) {

                        return row.map(
                            function (field) {

                                return (
                                    '"' +
                                    String(field)
                                        .replace(
                                            /"/g,
                                            '""'
                                        ) +
                                    '"'
                                );

                            }
                        ).join(",");

                    }
                ).join("\n");


            /* Download */

            var blob =
                new Blob(
                    [csv],
                    {
                        type:
                            "text/csv;charset=utf-8;"
                    }
                );


            var url =
                URL.createObjectURL(
                    blob
                );


            var link =
                document.createElement(
                    "a"
                );

            link.href = url;

            link.download =
                "ExamMatrix-Timetable.csv";


            document.body.appendChild(
                link
            );

            link.click();


            document.body.removeChild(
                link
            );


            URL.revokeObjectURL(
                url
            );

        }
    );

}


/* =========================================================
   PAGE STARTUP
========================================================= */

function loadTimetable() {

    timetableExams =
        getTimetableExams();


    /* =====================================
       UPDATE INFO
    ===================================== */

    var info =
        document.getElementById(
            "ttInfo"
        );


    if (info) {

        if (
            timetableExams.length
        ) {

            info.textContent =
                timetableExams.length +
                " exam(s) scheduled";

        } else {

            info.textContent =
                "No exams scheduled yet.";

        }

    }


    /* =====================================
       NO EXAMS
    ===================================== */

    if (
        timetableExams.length === 0
    ) {

        var calendar =
            document.getElementById(
                "calendarContainer"
            );


        if (calendar) {

            calendar.innerHTML =
                '<div class="ttEmpty">' +
                'No exams scheduled yet. ' +
                '<a href="createExam.html">' +
                'Create Exam' +
                '</a>.' +
                '</div>';

        }


        setupExport();

        return;

    }


    /* =====================================
       SORT DATA
    ===================================== */

    timetableExams =
        sortExams(
            timetableExams
        );


    /* =====================================
       RENDER CALENDAR
    ===================================== */

    if (
        typeof renderCalendar ===
        "function"
    ) {

        renderCalendar(
            timetableExams
        );

    }


    /* =====================================
       CLASH DETECTION
    ===================================== */

    if (
        typeof detectClashes ===
        "function"
    ) {

        detectClashes(
            timetableExams
        );

    }


    /* =====================================
       EXPORT
    ===================================== */

    if (
        typeof setupExport ===
        "function"
    ) {

        setupExport();

    }

}


/* =========================================================
   LOAD DATA
========================================================= */

if (
    typeof loadExamData ===
    "function"
) {

    loadExamData(
        loadTimetable
    );

} else {

    loadTimetable();

}