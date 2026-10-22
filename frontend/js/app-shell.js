/* =========================================================
   APP SHELL — logged-in navbar (app-header) + Jiya's footer.
   Fills username, wires logout, gates access to logged-in users.

   Each admin page needs:
     <div id="navbarContainer"></div>
     <div id="footerContainer"></div>
     <body data-page="dashboard">
     <link rel="stylesheet" href="css/theme.css">
     <link rel="stylesheet" href="css/headerFooter.css">
     <script src="js/app-shell.js"></script>
========================================================= */

/* auth gate: must be logged in */
let emSession = JSON.parse(sessionStorage.getItem("em_session"));
if (!emSession || !emSession.username) {
  window.location.href = "login.html";
}

/* load the logged-in navbar */
fetch("app-header.html")
  .then(function (r) { return r.text(); })
  .then(function (html) {
    document.getElementById("navbarContainer").innerHTML = html;

    if (emSession && emSession.username) {
      document.getElementById("username").textContent = emSession.username;
    }

    // highlight the active page link
    let current = document.body.dataset.page;
    if (current) {
      let link = document.querySelector('.nav-link[data-page="' + current + '"]');
      if (link) { link.classList.add("active"); }   // Jiya's .active underline
    }
  })
  .catch(function () { console.log("app-header.html not found"); });

/* load Jiya's shared footer */
fetch("footer.html")
  .then(function (r) { return r.text(); })
  .then(function (html) {
    document.getElementById("footerContainer").innerHTML = html;
  })
  .catch(function () { console.log("footer.html not found"); });

/* logout */
function logout() {
  sessionStorage.removeItem("em_session");
  window.location.href = "login.html";
}
