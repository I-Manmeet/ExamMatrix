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

// an empty grid for one hall; seats held by other exams are marked reserved
function emptyGrid(hall, reservedSeats) {
  const grid = [];
  for (let r = 0; r < hall.rows; r++) {
    const row = [];
    for (let c = 0; c < hall.cols; c++) {
      const code = reservedSeats && reservedSeats[seatKey(r, c)];
      row.push(code ? { reserved: true, code: code } : null);
    }
    grid.push(row);
  }
  return grid;
}

function countEmpty(grid) {
  let n = 0;
  grid.forEach(function (row) { row.forEach(function (cell) { if (cell === null) n++; }); });
  return n;
}

// free seats across the halls after taking out reserved ones
function freeSeats(halls, reserved = {}) {
  return halls.reduce(function (sum, hall) {
    return sum + countEmpty(emptyGrid(hall, reserved[hall.hallNo]));
  }, 0);
}

// pairs of same-subject neighbours in a finished seat map (safety check, should be 0)
function countConflicts(seatMap) {
  let conflicts = 0;
  Object.values(seatMap).forEach(function (grid) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        const right = grid[r][c + 1];
        const below = grid[r + 1] && grid[r + 1][c];
        if (right && right.code === cell.code) conflicts++;
        if (below && below.code === cell.code) conflicts++;
      }
    }
  });
  return conflicts;
}

function solveSeating(halls, students, reserved = {}) {
  const grids = halls.map(function (hall) {
    const grid = emptyGrid(hall, reserved[hall.hallNo]);
    return { hall: hall, grid: grid, free: countEmpty(grid) };
  });

  // greedy: each student takes the first safe seat, hall by hall, front to back
  const unplaced = [];
  for (const student of buildQueue(students)) {
    let placed = false;
    for (const g of grids) {
      if (g.free === 0) continue;   // hall is full, skip it
      for (let r = 0; r < g.grid.length && !placed; r++) {
        for (let c = 0; c < g.grid[r].length && !placed; c++) {
          if (g.grid[r][c] === null && fits(g.grid, r, c, student.code)) {
            g.grid[r][c] = { roll: student.roll, code: student.code };
            g.free--;
            placed = true;
          }
        }
      }
      if (placed) break;
    }
    if (!placed) unplaced.push(student);
  }

  // seat map of this exam only: reserved seats become null, empty halls are left out
  const seatMap = {};
  const utilization = [];
  for (const g of grids) {
    let open = 0;
    let filled = 0;
    const map = g.grid.map(function (row) {
      return row.map(function (cell) {
        if (cell && cell.reserved) return null;
        open++;
        if (!cell) return null;
        filled++;
        return { roll: cell.roll, code: cell.code };
      });
    });
    if (filled > 0) {
      seatMap[g.hall.hallNo] = map;
      utilization.push(Math.round((filled / open) * 100));
    }
  }

  const avg = utilization.length
    ? Math.round(utilization.reduce(function (a, b) { return a + b; }, 0) / utilization.length)
    : 0;

  return {
    seatMap: seatMap,
    unplaced: unplaced,
    stats: {
      seated: students.length - unplaced.length,
      hallsUsed: Object.keys(seatMap).length,
      utilization: avg,
      conflicts: countConflicts(seatMap)
    }
  };
}

module.exports = { fits, buildQueue, seatKey, freeSeats, countConflicts, solveSeating };