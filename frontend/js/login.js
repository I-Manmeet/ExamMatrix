/* =========================================================
   LOGIN — js/login.js
   Needs config.js, api.js and login-role.js loaded first.
   Logs in on the server, keeps only the token in the browser,
   then opens the right dashboard for the role.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginButton");
  const btnText = loginBtn ? loginBtn.querySelector(".btnText") : null;
  const messageBox = document.getElementById("message");
  const pwToggle = document.getElementById("pwToggle");
  const pwInput = document.getElementById("password");
  const usernameInput = document.getElementById("username");
  const roleInput = document.getElementById("loginRole");

  function showMessage(text, isOk) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = isOk ? "msg-ok" : "msg-error";
  }

  function setLoading(on) {
    loginBtn.disabled = on;
    loginBtn.classList.toggle("loading", on);
    if (btnText) btnText.textContent = on ? "Verifying..." : "Log in";
  }

  // the page to return to after an expired session; only a page in this folder,
  // e.g. "hallDuty.html?examId=EXM-0001-0001", never another website
  function safeNext() {
    let next = new URLSearchParams(window.location.search).get("next") || "";
    if (!/^[A-Za-z][\w-]*\.html(\?[^#]*)?$/.test(next)) return "";
    if (next.startsWith("login.html")) return "";
    return next;
  }


  function goToDashboard(user) {
    // phase-1 pages (data.js) still read em_session until they move to the server
    sessionStorage.setItem("em_session", JSON.stringify({
      username: user.university,
      name: user.name,
      role: user.role,
      university: user.university
    }));
    window.location.href = safeNext() ||
      (user.role === "admin" ? "dashboard.html" : "invigilatorDashboard.html");
  }

  // Toggle show/hide password
  if (pwToggle && pwInput) {
    pwToggle.addEventListener("click", function () {
      const isHidden = pwInput.type === "password";
      pwInput.type = isHidden ? "text" : "password";
      pwToggle.textContent = isHidden ? "🙈" : "👁";
      pwToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  }

  // sent here because the session ran out?
  if (new URLSearchParams(window.location.search).get("expired")) {
    showMessage("Your session ended (logins last 8 hours). Log in again with the same password.", false);
  }

  // already logged in? skip the form
  if (getAuthToken()) {
    api("GET", "/auth/me")
      .then(goToDashboard)
      .catch(function () { clearAuthToken(); });
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (loginBtn.disabled) return;   // ignore double clicks

    const role = roleInput.value;
    let identifier = usernameInput.value.trim();
    if (role === "invigilator") { identifier = identifier.toUpperCase(); }   // inv-0001-0001 → INV-0001-0001
    const password = pwInput.value;

    if (!identifier || !password) {
      showMessage(role === "admin"
        ? "Please enter your email and password."
        : "Please enter your Invigilator ID and password.", false);
      return;
    }
    if (role === "admin" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier)) {
      showMessage("Enter a valid email.", false);
      return;
    }
    if (role === "invigilator" && !/^INV-\d{4}-\d{4}$/i.test(identifier)) {
      showMessage("Invigilator IDs look like INV-0001-0007.", false);
      return;
    }

    setLoading(true);

    api("POST", "/auth/login", { role: role, identifier: identifier, password: password })
      .then(function (data) {
        saveAuthToken(data.token);
        showMessage("✓ Logged in. Opening your dashboard...", true);
        setTimeout(function () { goToDashboard(data.user); }, 600);
      })
      .catch(function (err) {
        showMessage(err.message, false);
        setLoading(false);
        pwInput.focus();
        pwInput.select();
      });
  });
});