
document.addEventListener('DOMContentLoaded', function () {
  var headerSlot = document.getElementById('site-header-slot');
  var footerSlot = document.getElementById('site-footer-slot');

  if (headerSlot) {
    fetch('header.html')
      .then(function (r) { return r.text(); })
      .then(function (html) { headerSlot.innerHTML = html; })
      .catch(function (e) { console.error('Header load failed:', e); });
  }

  if (footerSlot) {
    fetch('footer.html')
      .then(function (r) { return r.text(); })
      .then(function (html) { footerSlot.innerHTML = html; })
      .catch(function (e) { console.error('Footer load failed:', e); });
  }
});
