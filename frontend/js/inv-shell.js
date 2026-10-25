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
     <script src="js/config.js"></script>
     <script src="js/api.js"></script>
     <script src="js/inv-shell.js"></script>
   and then waits for the profile with:
     invReady.then(function (profile) { ... });
   profile is null while the page is being sent somewhere else.
   ========================================================= */

function goToInvLogin() {
  clearAuthToken();
  window.location.href = "login.html?role=invigilator";
}

/* ask the server who this token belongs to */
function fetchProfile() {
  if (!getAuthToken()) {
    goToInvLogin();
    return Promise.resolve(null);
  }

  return api("GET", "/auth/me").then(
    function (profile) {
      if (profile && profile.role === "invigilator") return profile;
      window.location.href = "dashboard.html";   // an admin opened an invigilator page
      return null;
    },
    function (error) {
      if (error.status === 401) return null;    // api.js has already sent them to login
      throw error;                               // server down: keep the token, the page shows the message
    }
  );
}

/* every invigilator page waits on this before rendering */
const invReady = fetchProfile();

/* load the invigilator navbar, then fill in the name */
Promise.all([
  fetch("inv-header.html").then(function (r) { return r.text(); }),
  invReady.catch(function () { return null; })   // still show the navbar if the server is down
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
  clearAuthToken();
  window.location.href = "login.html?role=invigilator";
}