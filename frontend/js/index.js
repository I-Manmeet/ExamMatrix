document.addEventListener('DOMContentLoaded', function () {

  // ===== HERO PREVIEW GRID =====

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

  var PROMPT = '<span class="prompt-text">💡 Hover any seat to inspect student details</span>';

  if (gridEl) {

    previewSeats.forEach(function (s, i) {

      var cell = document.createElement('div');

      cell.className = 'seat-cell seat-' + s.sub;

      cell.style.animationDelay = (300 + i * 45) + 'ms';   // seats pop in one by one

      cell.innerHTML = '<span class="seat-roll">' + s.roll.slice(-3) + '</span><span class="seat-sub">' + s.sub.toUpperCase() + '</span>';

      cell.addEventListener('mouseenter', function () {

        if (infoEl) infoEl.innerHTML = '<span class="inspected-data">' + s.roll + '</span> · ' + s.name;

      });

      cell.addEventListener('mouseleave', function () { if (infoEl) infoEl.innerHTML = PROMPT; });

      gridEl.appendChild(cell);

    });

  }

  // ===== FIND MY SEAT (ANUPAM) — asks the server, no login needed =====

  var uniInput  = document.getElementById('uniIdInput');

  var rollInput = document.getElementById('rollSearchInput');

  var searchBtn = document.getElementById('btnSearchSeat');

  var resultBox = document.getElementById('lookupResult');

  var emptyBox  = document.getElementById('lookupEmpty');

  var seatsBox  = document.getElementById('resSeats');

  var UNI_KEY   = 'em_lookupUni';

  // remember the university ID so students only type it once

  if (uniInput) { uniInput.value = localStorage.getItem(UNI_KEY) || ''; }

  function fmtDate(d) {

    try { return new Date(d).toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' }); }

    catch (e) { return d; }

  }

  // finished? the slot's end time has passed

  function isPast(seat) {

    var end = String(seat.slot || '').split('-')[1];

    var endAt = new Date(seat.date + 'T' + end + ':00');

    return !isNaN(endAt.getTime()) && Date.now() > endAt.getTime();

  }

  // one "Key  value" row; textContent so server data can't inject HTML

  function line(key, value, mono) {

    var p = document.createElement('p');

    p.className = 'res-line';

    var k = document.createElement('span');

    k.className = 'res-key';

    k.textContent = key;

    var v = document.createElement('span');

    v.textContent = value;

    if (mono) { v.className = 'res-mono'; }

    p.appendChild(k);

    p.appendChild(v);

    return p;

  }

  // re-adding the element restarts its fade-in animation

  function replay(el) {

    el.style.animation = 'none';

    void el.offsetWidth;

    el.style.animation = '';

  }

  function showMessage(text) {

    resultBox.hidden = true;

    emptyBox.textContent = text;

    emptyBox.hidden = false;

    replay(emptyBox);

  }

  function setLoading(on) {

    searchBtn.disabled = on;

    searchBtn.classList.toggle('is-loading', on);

    searchBtn.textContent = on ? 'Searching' : 'Find Seat';

  }

  function runLookup() {

    var uni  = (uniInput.value || '').trim().toUpperCase();

    var roll = (rollInput.value || '').trim().toUpperCase();

    resultBox.hidden = true;

    emptyBox.hidden = true;

    if (!uni || !roll) { showMessage('Enter both your university ID and roll number.'); return; }

    setLoading(true);

    api('GET', '/public/seat?uni=' + encodeURIComponent(uni) + '&roll=' + encodeURIComponent(roll))

      .then(function (data) {

        localStorage.setItem(UNI_KEY, uni);

        if (!data.seats.length) { showMessage('Roll ' + data.roll + ' is not seated in any exam yet.'); return; }

        document.getElementById('resStudentName').textContent = data.roll;

        seatsBox.innerHTML = '';

        data.seats.forEach(function (s, i) {

          var past = isPast(s);

          var box = document.createElement('div');

          box.className = 'res-exam' + (past ? ' is-past' : '');

          box.style.animationDelay = (i * 70) + 'ms';   // exams slide in one after another

          var title = document.createElement('p');

          title.className = 'res-exam-title';

          title.textContent = s.subject + (past ? ' (finished)' : '');

          box.appendChild(title);

          box.appendChild(line('Date & slot', fmtDate(s.date) + ' · ' + s.slot));

          box.appendChild(line('Hall', s.hall));

          box.appendChild(line('Desk', 'Row ' + s.row + ', Seat ' + s.seat, true));

          seatsBox.appendChild(box);

        });

        resultBox.hidden = false;

        replay(resultBox);

      })

      .catch(function (err) { showMessage(err.message); })

      .then(function () { setLoading(false); });

  }

  if (searchBtn) { searchBtn.addEventListener('click', runLookup); }

  [uniInput, rollInput].forEach(function (el) {

    if (el) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { runLookup(); } }); }

  });

});



/* header: mobile menu, shadow on scroll, active link for the section in view.

   header.html is loaded later by theme.js, so look the elements up each time. */

(function () {

  var SECTIONS = ['hero', 'lookup', 'features', 'workflow', 'developers'];

  function closeMenu() {

    var nav = document.getElementById('mainNav');

    var btn = document.getElementById('mobileToggle');

    if (nav) nav.classList.remove('open');

    if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

  }

  document.addEventListener('click', function (e) {

    var btn = e.target.closest('#mobileToggle');

    if (btn) {

      var nav = document.getElementById('mainNav');

      var open = nav && nav.classList.toggle('open');

      btn.classList.toggle('open', !!open);

      btn.setAttribute('aria-expanded', open ? 'true' : 'false');

      return;

    }

    if (e.target.closest('#mainNav .nav-link')) closeMenu();

  });

  function onScroll() {

    var header = document.querySelector('.site-header');

    if (header) header.classList.toggle('is-scrolled', window.scrollY > 10);

    var current = SECTIONS[0];

    SECTIONS.forEach(function (id) {

      var el = document.getElementById(id);

      if (el && el.getBoundingClientRect().top <= 120) current = id;

    });

    document.querySelectorAll('#mainNav .nav-link').forEach(function (link) {

      link.classList.toggle('active', link.getAttribute('href').endsWith('#' + current));

    });

  }

  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('load', onScroll);

})();



/* scroll reveal — replays on scroll. Uses a CSS variable for the delay so

   hover effects on the same cards stay instant. */

(function () {

  var SEL = ".hero-content, .section-header, .feature-card, .workflow-step-card, .lookup-card, .showcase-box, .dev-card, .cta-banner";

  function start() {

    var els = document.querySelectorAll(SEL);

    if (!els.length) return;

    if (!("IntersectionObserver" in window)) {

      els.forEach(function (el) { el.classList.add("reveal", "in"); });

      return;

    }

    els.forEach(function (el) {

      el.classList.add("reveal");

      var i = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;

      el.style.setProperty("--reveal-delay", Math.min(i, 6) * 80 + "ms");

    });

    var io = new IntersectionObserver(function (entries) {

      entries.forEach(function (e) {

        if (e.isIntersecting) { e.target.classList.add("in"); }

        else { e.target.classList.remove("in"); }

      });

    }, { threshold: 0.12 });

    els.forEach(function (el) { io.observe(el); });

  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);

  else start();

})();