/* =========================================================
   ExamMatrix — SEATING
   ---------------------------------------------------------
   Moved from frontend createExam.js / seating.js so the server
   is the only place seats are worked out. Pure functions, no
   database, so they are easy to test.

   solveSeating(halls, students, reserved?)
     halls:    [{ hallNo, rows, cols }]   in the order to fill
     students: [{ roll, code }]
     reserved: { "Hall A": { "0_3": "CS301", ... } }
               seats held by other exams at the same time
               (row_col → subject code sitting there)
   → { seatMap, unplaced, stats }
     seatMap:  { "Hall A": [[{ roll, code } | null]] }
               only this exam's students, only halls it used
========================================================= */

const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // front, back, left, right

function seatKey(row, col) {
  return row + "_" + col;
}

// a seat is safe if no front/back/left/right neighbour has the same subject code
// (diagonals don't count)
function fits(grid, row, col, code) {
  for (const [dr, dc] of NEIGHBOURS) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[r].length) continue;
    const cell = grid[r][c];
    if (cell && cell.code === code) return false;
  }
  return true;
}

// biggest subject first, then one from each subject in turn: A B C A B C A B A ...
function buildQueue(students) {
  const groups = new Map();
  for (const s of students) {
    if (!groups.has(s.code)) groups.set(s.code, []);
    groups.get(s.code).push(s);
  }

  const list = [...groups.values()];
  list.forEach(function (g) { g.sort(function (a, b) { return a.roll.localeCompare(b.roll); }); });  // same input → same seats
  list.sort(function (a, b) { return b.length - a.length || a[0].code.localeCompare(b[0].code); });

  const queue = [];
  const longest = list.length ? list[0].length : 0;
  for (let i = 0; i < longest; i++) {
    for (const g of list) {
      if (i < g.length) queue.push(g[i]);
    }
  }
  return queue;
}

module.exports = { fits, buildQueue, seatKey };