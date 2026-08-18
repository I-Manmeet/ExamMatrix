/* =========================================================
   [MEMBER 1] REGISTER SUBMIT  +  [MEMBER 3] VALIDATION
   Username-only (no email). Uses showMessage() from auth-shared.js.
========================================================= */


let registerForm = document.getElementById("registerForm");

let usernameInput = document.getElementById("username");
let passwordInput = document.getElementById("password");
let confirmPasswordInput = document.getElementById("confirmPassword");


/* ---- [MEMBER 3] password strength check ---- */
function getPasswordError(password) {
  let missing = [];

  if (!/[A-Z]/.test(password)) { missing.push("capital letter"); }
  if (!/[a-z]/.test(password)) { missing.push("small letter"); }
  if (!/[0-9]/.test(password)) { missing.push("number"); }
  if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=;'`~]/.test(password)) { missing.push("special character"); }

  if (missing.length === 0) { return ""; }
  if (missing.length === 1) { return "Add a " + missing[0] + "."; }
  if (missing.length === 2) { return "Add a " + missing[0] + " and " + missing[1] + "."; }

  let last = missing.pop();
  return "Add a " + missing.join(", ") + ", and " + last + ".";
}


/* ---- [MEMBER 3] full registration validation (username-only) ---- */
function validateRegistration(username, password, confirmPassword) {

  if (username === "" || password === "" || confirmPassword === "") {
    return "Please fill in all fields.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  let passwordError = getPasswordError(password);
  if (passwordError !== "") {
    return passwordError;
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  let users = JSON.parse(localStorage.getItem("em_users")) || [];

  for (let i = 0; i < users.length; i++) {
    if (
      users[i].username &&
      users[i].username.toLowerCase() === username.toLowerCase()
    ) {
      return "That username is already taken.";
    }
  }

  return "";
}


/* ---- [MEMBER 1] submit handler ---- */
registerForm.addEventListener("submit", function (event) {
  event.preventDefault();

  let username = usernameInput.value.trim();
  let password = passwordInput.value;
  let confirmPassword = confirmPasswordInput.value;

  let error = validateRegistration(username, password, confirmPassword);

  if (error !== "") {
    showMessage(error, false);
    return;
  }

  let users = JSON.parse(localStorage.getItem("em_users")) || [];

  users.push({
    username: username,
    password: password
  });

  localStorage.setItem("em_users", JSON.stringify(users));

  sessionStorage.setItem("em_session", JSON.stringify({ username: username }));

  showMessage("Account created successfully! Redirecting to login...", true);

  setTimeout(function () {
    window.location.href = "login.html";
  }, 1000);
});
