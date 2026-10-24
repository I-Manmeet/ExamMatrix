/* =========================================================
   RESET PASSWORD — js/reset-password.js
   Same password rules as register.js and the server.
========================================================= */

let resetForm = document.getElementById("resetForm");
let resetButton = document.getElementById("resetButton");
let passwordInput = document.getElementById("password");

let specialChar = /[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=;'`~]/;

let passwordRules = {
  length:  function (p) { return p.length >= 6 && p.length <= 64; },
  upper:   function (p) { return /[A-Z]/.test(p); },
  lower:   function (p) { return /[a-z]/.test(p); },
  number:  function (p) { return /[0-9]/.test(p); },
  special: function (p) { return specialChar.test(p); }
};

passwordInput.addEventListener("input", function () {
  document.querySelectorAll("#passwordRules li").forEach(function (chip) {
    chip.classList.toggle("ok", passwordRules[chip.dataset.rule](passwordInput.value));
  });
});

let token = getTokenFromUrl();
if (!token) {
  resetForm.hidden = true;
  showMessage("This reset link is missing or broken. Ask for a new one below.", false);
}

resetForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (resetButton.disabled) { return; }

  let password = passwordInput.value;
  let confirm = document.getElementById("confirmPassword").value;

  let allOk = Object.keys(passwordRules).every(function (rule) {
    return passwordRules[rule](password);
  });
  if (!allOk) {
    showMessage("Your password doesn't meet all the rules yet.", false);
    return;
  }
  if (password !== confirm) {
    showMessage("Passwords do not match.", false);
    return;
  }

  resetButton.disabled = true;
  resetButton.textContent = "Updating...";

  postJSON("/universities/reset-password", { token: token, password: password })
    .then(function () {
      resetForm.hidden = true;
      document.getElementById("message").className = "";
      document.getElementById("loginRedirect").hidden = true;
      document.getElementById("resetDone").hidden = false;
    })
    .catch(function (err) {
      showMessage(err.message, false);
      resetButton.disabled = false;
      resetButton.textContent = "Update password";
    });
});