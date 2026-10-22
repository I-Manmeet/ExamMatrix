document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginButton");
  const btnText = loginBtn ? loginBtn.querySelector(".btnText") : null;
  const messageBox = document.getElementById("message");
  const pwToggle = document.getElementById("pwToggle");
  const pwInput = document.getElementById("password");

  function showMessage(text, isOk) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = isOk ? "msg-ok" : "msg-error";
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

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = pwInput.value;

      if (!username || !password) {
        showMessage("Please enter both username and password.", false);
        return;
      }

      // Button loading state
      loginBtn.classList.add("loading");
      if (btnText) btnText.textContent = "Verifying...";
      loginBtn.disabled = true;

      setTimeout(function () {
        const users = JSON.parse(localStorage.getItem("em_users")) || [];
        
        // Demo fallback if no users are in localStorage yet
        const foundUser = users.find(u => u.username === username && u.password === password) ||
                          (username === "admin" && password === "admin123");

        if (!foundUser) {
          loginBtn.classList.remove("loading");
          if (btnText) btnText.textContent = "Log in";
          loginBtn.disabled = false;
          showMessage("Invalid staff username or password.", false);
          return;
        }

        sessionStorage.setItem("em_session", JSON.stringify({ username: username }));
        showMessage("✓ Credentials verified. Redirecting to dashboard...", true);

        setTimeout(function () {
          window.location.href = "dashboard.html";
        }, 800);
      }, 500);
    });
  }
});