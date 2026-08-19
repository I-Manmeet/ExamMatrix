fetch("students.json").then(function (response) {
        return response.json();
    }).then(function (students) {
        var result =generateSeating(students);
        displaySeating(result);
    }).catch(function (error) {
        console.error("Error loading students.json:",error);
    });


var ROWS = 5;
var COLUMNS = 10;

var seating = [];
var studentsLeft = [];


function getClassFromRoll(roll) {
    return roll.substring(2, 4);
}

// ==========================================
// CREATE EMPTY SEATING GRID
// ==========================================
function createSeatingGrid() {
    seating = [];
    for (var row = 0; row < ROWS; row++) {
        seating[row] = [];
        for (var col = 0; col < COLUMNS; col++) {
            seating[row][col] = null;
        }
    }
}

// ==========================================
// CHECK WHETHER STUDENT CAN SIT HERE
// ==========================================

function canStudentSit(row, col, student) {
    var currentClass =
        getClassFromRoll(student.roll);
    // --------------------------------------
    // LEFT
    // -------------------------------------
    if (col > 0 && seating[row][col - 1] !== null) {
        var leftClass =getClassFromRoll(seating[row][col - 1].roll);

        if (leftClass === currentClass) {
            return false;
        }
    }

    // --------------------------------------
    // ABOVE
    // --------------------------------------

    if (row > 0 && seating[row - 1][col] !== null) {
        var aboveClass =getClassFromRoll(seating[row - 1][col].roll);

        if (aboveClass === currentClass) {
            return false;
        }
    }
    return true;
}

// ==========================================
// SHUFFLE STUDENTS
// ==========================================

function shuffleStudents(array) {
    var result = [...array];
    for (var i = result.length - 1;i > 0;i--) {
        var j =Math.floor(Math.random() * (i + 1));
        var temp = result[i];
        result[i] = result[j];
        result[j] = temp;
    }
    return result;
}

// ==========================================
// BACKTRACKING SEATING ALGORITHM
// ==========================================

function arrangeStudents(position) {
    // All students have been placed
    if (studentsLeft.length === 0) {
        return true;
    }

    // All seats are full
    if (position >= ROWS * COLUMNS) {
        return false;
    }

    var row =Math.floor(position / COLUMNS);

    var col =position % COLUMNS;


    // Randomize which student we try first
    var candidates =shuffleStudents(studentsLeft);


    for (var i = 0;i < candidates.length;i++) {

        var student =candidates[i];

        // Check seating rule
        if (!canStudentSit(row,col,student)) {
            continue;
        }

        // Place student
        seating[row][col] =student;

        // Remove student from remaining list
        var studentIndex =studentsLeft.findIndex(function (item) {
                    return item.roll === student.roll;
                }
            );

        studentsLeft.splice(studentIndex,1);


        // Try next seat
        if (
            arrangeStudents(
                position + 1
            )
        ) {

            return true;

        }


        // ----------------------------------
        // BACKTRACK
        // ----------------------------------

        seating[row][col] = null;

        studentsLeft.splice(
            studentIndex,
            0,
            student
        );

    }


    return false;
}


// ==========================================
// GENERATE SEATING
// ==========================================

function generateSeating(students) {

    createSeatingGrid();

    studentsLeft =
        shuffleStudents(students);


    var success =
        arrangeStudents(0);


    if (!success) {

        console.log(
            "Unable to create a valid seating arrangement."
        );

        return null;
    }


    return seating;
}


// ==========================================
// DISPLAY SEATING IN CONSOLE
// ==========================================

function displaySeating(seating) {
    if (!seating) {
        return;
    }


    for (
        var row = 0;
        row < seating.length;
        row++
    ) {

        var rowData = [];


        for (
            var col = 0;
            col < seating[row].length;
            col++
        ) {

            var student =
                seating[row][col];


            if (student) {

                rowData.push(
                    student.roll +
                    " (" +
                    getClassFromRoll(student.roll) +
                    ")"
                );

            } else {

                rowData.push("EMPTY");

            }
        }


        console.log(
            "Row " +
            (row + 1) +
            ":",
            rowData
        );

    }
}