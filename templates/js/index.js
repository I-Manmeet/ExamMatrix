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

});
