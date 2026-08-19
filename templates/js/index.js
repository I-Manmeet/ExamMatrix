document.addEventListener('DOMContentLoaded', function () {

  // ===== Hero seating preview grid (JIYA) =====
  var previewSeats = [
    {roll:'24AI1001',sub:'cs',name:'Aarav Sharma'},{roll:'24CS2001',sub:'ma',name:'Vihaan Das'},
    {roll:'24AI1002',sub:'cs',name:'Diya Patel'},{roll:'24CS2002',sub:'ma',name:'Aadhya Bose'},
    {roll:'24AI1003',sub:'cs',name:'Vivaan Gupta'},{roll:'24CS2003',sub:'ma',name:'Kabir Shah'},
    {roll:'24AI1005',sub:'cs',name:'Aditya Rao'},{roll:'24CS2004',sub:'ma',name:'Anika Pillai'},
    {roll:'24AI1004',sub:'cs',name:'Ananya Iyer'},{roll:'24CS2005',sub:'ma',name:'Navya Pandey'},
    {roll:'24AI1006',sub:'cs',name:'Ishita Menon'},{roll:'24CS2006',sub:'ma',name:'Sai Krishnan'},
    {roll:'24EC3001',sub:'ph',name:'Anaya Mishra'},{roll:'24CS2007',sub:'ma',name:'Zara Sheikh'},
    {roll:'24AI1007',sub:'cs',name:'Kabir Nair'},{roll:'24EC3002',sub:'ph',name:'Dhruv Saxena'},
    {roll:'24AI1008',sub:'cs',name:'Rhea Verma'},{roll:'24CS2008',sub:'ma',name:'Advik Malhotra'},
    {roll:'24AI1009',sub:'cs',name:'Arjun Reddy'},{roll:'24CS2009',sub:'ma',name:'Kiara Chopra'}
  ];
  var gridEl = document.getElementById('heroSeatingGrid');
  var infoEl = document.getElementById('seatInspectionInfo');
  if (gridEl) {
    previewSeats.forEach(function (s) {
      var cell = document.createElement('div');
      cell.className = 'seat-cell seat-' + s.sub;
      cell.innerHTML = '<span class="seat-roll">' + s.roll.slice(-3) + '</span><span class="seat-sub">' + s.sub.toUpperCase() + '</span>';
      cell.addEventListener('mouseenter', function () { if (infoEl) infoEl.innerHTML = '<span class="inspected-data">' + s.roll + '</span> · ' + s.name; });
      cell.addEventListener('mouseleave', function () { if (infoEl) infoEl.innerHTML = '<span class="prompt-text">💡 Hover any seat to inspect student details</span>'; });
      gridEl.appendChild(cell);
    });
  }

  // load hall data so findDesk can compute the exact desk
  if (typeof loadExamData === 'function') { loadExamData(function () {}); }

  // ===== FIND MY SEAT (MANMEET) =====
  var rollInput  = document.getElementById('rollSearchInput');
  var searchBtn  = document.getElementById('btnSearchSeat');
  var resultBox  = document.getElementById('lookupResult');
  var emptyBox   = document.getElementById('lookupEmpty');

    function getExams() {
    var list = [];
    try {
      var raw = JSON.parse(localStorage.getItem('em_exams'));
      if (Array.isArray(raw)) { list = raw; }
    } catch (e) { list = []; }

    // the seating page renders from em_currentExam — include it too
    try {
      var current = JSON.parse(localStorage.getItem('em_currentExam'));
      if (current && current.students) {
        var already = list.some(function (e) {
          return e.id && current.id && e.id === current.id;
        });
        if (!already) { list.push(current); }
      }
    } catch (e) {}

    return list;
  }

  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' }); }
    catch (e) { return d; }
  }

  // anti-cheat neighbour check — same rule as seating.js
  function fits(grid, row, col, student) {
    var nb = [[row-1,col],[row+1,col],[row,col-1],[row,col+1]];
    for (var i = 0; i < nb.length; i++) {
      var r = nb[i][0], c = nb[i][1];
      if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) { continue; }
      var n = grid[r][c];
      if (n !== null && n.examCode === student.examCode) { return false; }
    }
    return true;
  }

  // re-solve seating for one exam, return { hallNo, row, col } for a roll
  function findDesk(exam, roll) {
    if (typeof EM_DATA === 'undefined' || !EM_DATA.halls.length) { return null; }

    var grids = [];
    for (var i = 0; i < exam.pickedHalls.length; i++) {
      var hall = null;
      for (var h = 0; h < EM_DATA.halls.length; h++) {
        if (EM_DATA.halls[h].hallNo === exam.pickedHalls[i]) { hall = EM_DATA.halls[h]; break; }
      }
      if (!hall) { continue; }
      var cells = [];
      for (var r = 0; r < hall.rows; r++) {
        var rowArr = [];
        for (var c = 0; c < hall.cols; c++) { rowArr.push(null); }
        cells.push(rowArr);
      }
      grids.push({ hall: hall, grid: cells });
    }

    // same "biggest course first, interleaved" queue as seating.js
    var groups = {};
    for (var s = 0; s < exam.students.length; s++) {
      var st = exam.students[s];
      if (!groups[st.examCode]) { groups[st.examCode] = []; }
      groups[st.examCode].push(st);
    }
    var groupList = Object.keys(groups).map(function (k) { return groups[k]; });
    groupList.sort(function (a, b) { return b.length - a.length; });
    var queue = [], more = true;
    while (more) {
      more = false;
      for (var g = 0; g < groupList.length; g++) {
        if (groupList[g].length > 0) { queue.push(groupList[g].shift()); more = true; }
      }
    }

    for (var qi = 0; qi < queue.length; qi++) {
      var stu = queue[qi], placed = false;
      for (var gg = 0; gg < grids.length && !placed; gg++) {
        var gr = grids[gg].grid;
        for (var rr = 0; rr < gr.length && !placed; rr++) {
          for (var cc = 0; cc < gr[0].length && !placed; cc++) {
            if (gr[rr][cc] === null && fits(gr, rr, cc, stu)) {
              gr[rr][cc] = stu;
              if (stu.roll === roll) {
                return { hallNo: grids[gg].hall.hallNo, row: rr + 1, col: cc + 1 };
              }
              placed = true;
            }
          }
        }
      }
    }
    return null;
  }

  function runLookup() {
    var roll = (rollInput.value || '').trim();
    resultBox.hidden = true;
    emptyBox.hidden = true;
    if (!roll) { return; }

    var exams = getExams();
    var match = null, student = null;
    for (var i = exams.length - 1; i >= 0; i--) {
      var studs = exams[i].students || [];
      for (var s = 0; s < studs.length; s++) {
        if (String(studs[s].roll).trim().toLowerCase() === roll.toLowerCase()) {
          match = exams[i]; student = studs[s]; break;
        }
      }
      if (match) { break; }
    }

    if (!match) {
      emptyBox.hidden = false;
      emptyBox.textContent = 'Roll ' + roll + ' is not seated in any current exam.';
      return;
    }

    document.getElementById('resStudentName').textContent = student.name + ' (' + student.roll + ')';
    document.getElementById('resSubject').textContent     = student.examCode;
    document.getElementById('resTime').textContent        = fmtDate(match.date) + ' · ' + match.slot;

    var desk = findDesk(match, student.roll);
    if (desk) {
      document.getElementById('resHall').textContent = desk.hallNo;
      document.getElementById('resDesk').textContent = 'Row ' + desk.row + ', Seat ' + desk.col;
    } else {
      document.getElementById('resHall').textContent = (match.pickedHalls || []).join(', ');
      document.getElementById('resDesk').textContent = 'Not assigned';
    }
    resultBox.hidden = false;
  }

  if (searchBtn) { searchBtn.addEventListener('click', runLookup); }
  if (rollInput) {
    rollInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { runLookup(); } });
  }
  var pills = document.querySelectorAll('.pill-sample');
  for (var p = 0; p < pills.length; p++) {
    pills[p].addEventListener('click', function () {
      rollInput.value = this.getAttribute('data-roll');
      runLookup();
    });
  }

});
