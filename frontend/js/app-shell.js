/* =========================================================
   APP SHELL — logged-in navbar (app-header) + footer.
   ---------------------------------------------------------
   Only the JWT token is kept in the browser (localStorage
   "em_token"). Who is logged in comes from GET /api/auth/me
   on every page load. The em_session copy in sessionStorage
   is only for phase-1 code (data.js) until those pages move
   to the server.

   Each admin page needs:
     <div id="navbarContainer"></div>
     <div id="footerContainer"></div>
     <body data-page="dashboard">
     <link rel="stylesheet" href="css/theme.css">
     <link rel="stylesheet" href="css/headerFooter.css">
     <script src="js/app-shell.js"></script>
   and can wait for the profile with:
     adminReady.then(function (profile) { ... });
========================================================= */

const SHELL_API = typeof API_BASE !== "undefined" ? API_BASE : "http://localhost:5001/api";

let emToken = localStorage.getItem("em_token");
let emSession = JSON.parse(sessionStorage.getItem("em_session") || "null");

/* auth gate: must be logged in */
if (!emToken) {
  window.location.href = "login.html";
}

/* ask the server who this token belongs to (skip it if there's no token) */
const adminReady = !emToken
  ? Promise.reject(new Error("Not logged in"))
  : fetch(SHELL_API + "/auth/me", {
    headers: { Authorization: "Bearer " + emToken }
  })
    .then(function (res) {
      if (res.status === 401) {
        let err = new Error("Session expired");
        err.expired = true;
        throw err;
      }
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(function (body) {
      let profile = body.data;
      if (profile.role !== "admin") {
        window.location.href = "invigilatorDashboard.html";
        throw new Error("Not an admin");
      }
      emSession = {
        username: profile.university,
        name: profile.name,
        role: "admin",
        university: profile.university
      };
      sessionStorage.setItem("em_session", JSON.stringify(emSession));
      return profile;
    });

adminReady.catch(function (err) {
  if (err.expired) {
    localStorage.removeItem("em_token");
    sessionStorage.removeItem("em_session");
    window.location.href = "login.html?expired=1";
  } else if (err.message !== "Not an admin" && err.message !== "Not logged in") {
    console.log("Can't reach the server to check the login");   // stay logged in; the server may be restarting
  }
});

/* load the logged-in navbar, then fill in the name */
Promise.all([
  fetch("app-header.html").then(function (r) { return r.text(); }),
  adminReady.catch(function () { return null; })
])
  .then(function (results) {
    document.getElementById("navbarContainer").innerHTML = results[0];

    let profile = results[1];
    let label = profile
      ? profile.name + " · " + profile.university
      : (emSession && emSession.name) || "";
    let nameEl = document.getElementById("username");
    if (nameEl) nameEl.textContent = label;

    // highlight the active page link
    let current = document.body.dataset.page;
    if (current) {
      let link = document.querySelector('.nav-link[data-page="' + current + '"]');
      if (link) { link.classList.add("active"); }
    }
  })
  .catch(function () { console.log("app-header.html not found"); });

/* load the shared footer */
fetch("footer.html")
  .then(function (r) { return r.text(); })
  .then(function (html) {
    document.getElementById("footerContainer").innerHTML = html;
  })
  .catch(function () { console.log("footer.html not found"); });

/* logout: throw the token away */
function logout() {
  localStorage.removeItem("em_token");
  sessionStorage.removeItem("em_session");
  window.location.href = "login.html";
}