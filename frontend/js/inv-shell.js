/* =========================================================
   INVIGILATOR SHELL — invigilator navbar (inv-header) + footer.
   ---------------------------------------------------------
   No user data is stored in the browser. Only the JWT token
   from login is kept (localStorage "em_token"). The profile
   (name, invId, university) comes from MongoDB through
   GET /api/auth/me on every page load.

   Each invigilator page needs:
     <body data-page="inv-dashboard">
     <div id="navbarContainer"></div>
     <div id="footerContainer"></div>
     <script src="js/inv-shell.js"></script>
   and then waits for the profile with:
     invReady.then(function (profile) { ... });
   ========================================================= */

// TODO(after-jiya): remove this line and use API_BASE from Jiya's js/config.js
const API_BASE = "http://localhost:5000/api";

// TODO(after-jiya): set to false once Jiya's login + GET /api/auth/me are merged
const INV_DEMO_MODE = true;
const DEMO_PROFILE = { invId: "INV-0001-0004", name: "Dr. Neha Kapoor", university: "UNI-2026-0001", role: "invigilator" };

function getToken() {
  return localStorage.getItem("em_token");
}

/* ask the server who this token belongs to */
// TODO(after-jiya): switch this fetch to Jiya's api.js helper once it exists
function fetchProfile() {
  if (INV_DEMO_MODE) return Promise.resolve(DEMO_PROFILE);

  const token = getToken();
  if (!token) return Promise.reject(new Error("Not logged in"));

  return fetch(API_BASE + "/auth/me", {
    headers: { Authorization: "Bearer " + token }
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Session expired");
      return res.json();
    })
    .then(function (body) {
      if (body.data.role !== "invigilator") throw new Error("Not an invigilator");
      return body.data;
    });
}

/* every invigilator page waits on this before rendering */
const invReady = fetchProfile().catch(function () {
  localStorage.removeItem("em_token");
  window.location.href = "login.html";
});

/* load the invigilator navbar, then fill in the name */
Promise.all([
  fetch("inv-header.html").then(function (r) { return r.text(); }),
  invReady
])
  .then(function (results) {
    const html = results[0];
    const profile = results[1];
    document.getElementById("navbarContainer").innerHTML = html;

    if (profile) {
      document.getElementById("invName").textContent = profile.name + " · " + profile.invId;
    }

    const current = document.body.dataset.page;
    if (current) {
      const link = document.querySelector('.nav-link[data-page="' + current + '"]');
      if (link) link.classList.add("active");
    }
  })
  .catch(function () { console.log("inv-header.html not found"); });

/* load the shared footer */
fetch("footer.html")
  .then(function (r) { return r.text(); })
  .then(function (html) { document.getElementById("footerContainer").innerHTML = html; })
  .catch(function () { console.log("footer.html not found"); });

/* logout: just throw the token away */
function invLogout() {
  localStorage.removeItem("em_token");
  window.location.href = "login.html";
}