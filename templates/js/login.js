/* =========================================================
   [MEMBER 2] LOGIN LOGIC
========================================================= */



let loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  let username = document.getElementById("username").value.trim();
  let password = document.getElementById("password").value;

  if (username === "" || password === "") {
    showMessage("Please enter your username and password.", false);
    return;
  }

  let users = JSON.parse(localStorage.getItem("em_users")) || [];

  let foundUser = users.find(function (user) {
    return user.username === username && user.password === password;
  });

  if (!foundUser) {
    showMessage("Wrong username or password.", false);
    return;
  }

  sessionStorage.setItem("em_session", JSON.stringify({ username: username }));

  showMessage("Login successful! Redirecting…", true);
  setTimeout(function () { window.location.href = "dashboard.html"; }, 1000);
});
