/* =========================================================
   LOGIN ROLE TABS — js/login-role.js
   Switches the login form between University admin and
   Invigilator. login.html?role=invigilator opens the
   Invigilator tab directly. login.js reads the chosen
   role from #loginRole.
========================================================= */

(function () {
  // wrapped in a function so these names can't clash with other scripts
  let roleTabs = document.querySelectorAll(".roleTab");
  let roleInput = document.getElementById("loginRole");
  let usernameLabel = document.getElementById("usernameLabel");
  let usernameInput = document.getElementById("username");
  let forgotRow = document.getElementById("forgotRow");
  let adminRegister = document.getElementById("adminRegister");
  let heroText = document.getElementById("heroText");
  let authBadge = document.getElementById("authBadge");
  let message = document.getElementById("message");

  if (!roleTabs.length || !roleInput || !usernameInput) {
    console.warn("login-role.js: role tabs or #loginRole not found in login.html");
    return;
  }

  let ROLES = {
    admin: {
      badge: "UNIVERSITY ADMIN",
      hero: "Log in to manage examinations & seating grids",
      label: "Admin email",
      placeholder: "admin@university.edu",
      autocomplete: "email"
    },
    invigilator: {
      badge: "INVIGILATOR",
      hero: "Log in to see your duties and mark attendance",
      label: "Invigilator ID",
      placeholder: "e.g. INV-0001-0007",
      autocomplete: "username"
    }
  };


  function showForgot(role) {
    if (!forgotRow) return;
    forgotRow.textContent = "";
    if (role === "admin") {
      let link = document.createElement("a");
      link.href = "forgot-password.html";
      link.textContent = "Forgot password?";
      forgotRow.appendChild(link);
    } else {
      let note = document.createElement("span");
      note.className = "forgotNote";
      note.textContent = "Forgot your password? Ask your exam admin.";
      forgotRow.appendChild(note);
    }
  }


  function setRole(role, fromClick) {
    if (!ROLES[role]) { role = "admin"; }               // anything unknown in the URL falls back to admin
    if (fromClick && roleInput.value === role) return;  // clicking the open tab again keeps what you typed
    let r = ROLES[role];

    roleInput.value = role;

    roleTabs.forEach(function (tab) {
      let on = tab.dataset.role === role;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (authBadge) authBadge.textContent = r.badge;
    if (heroText) heroText.textContent = r.hero;
    if (usernameLabel) usernameLabel.textContent = r.label;
    usernameInput.placeholder = r.placeholder;
    usernameInput.setAttribute("autocomplete", r.autocomplete);
    usernameInput.value = "";                             // an email isn't an INV ID, so start clean

    if (adminRegister) adminRegister.hidden = role !== "admin";   // invigilators can't register themselves
    showForgot(role);

    // clear any old error from the other tab
    if (message) {
      message.className = "";
      message.textContent = "";
      message.style.display = "";
    }

    // keep ?role= in the address bar so a refresh stays on the same tab
    let url = new URL(window.location.href);
    url.searchParams.set("role", role);
    history.replaceState(null, "", url);
  }


  roleTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setRole(tab.dataset.role, true);
      usernameInput.focus();
    });

    // left/right arrow keys switch tabs too
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      let next = tab.dataset.role === "admin" ? "invigilator" : "admin";
      setRole(next, true);
      let nextTab = document.querySelector('.roleTab[data-role="' + next + '"]');
      if (nextTab) nextTab.focus();
    });
  });

  setRole(new URLSearchParams(window.location.search).get("role"), false);
})();