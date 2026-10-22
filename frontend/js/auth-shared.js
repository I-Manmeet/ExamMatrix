/* =========================================================
   ExamMatrix — SHARED AUTH JS
   Used by both login.js and register.js.
========================================================= */

/* Load shared header + footer partials */
fetch("header.html")
  .then(function (res) { return res.text(); })
  .then(function (html) {
    let c = document.getElementById("headerContainer");
    if (c) c.innerHTML = html;
  })
  .catch(function () { console.log("header.html not added yet"); });

fetch("footer.html")
  .then(function (res) { return res.text(); })
  .then(function (html) {
    let c = document.getElementById("footerContainer");
    if (c) c.innerHTML = html;
  })
  .catch(function () { console.log("footer.html not added yet"); });


/* Shared message helper (uses .msg-error / .msg-ok from theme.css) */
function showMessage(text, isOk) {
  let message = document.getElementById("message");
  message.textContent = text;
  message.style.display = "block";
  message.className = isOk ? "msg-ok" : "msg-error";
}
