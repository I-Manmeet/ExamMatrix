/* =========================================================
   FORGOT PASSWORD — js/forgot-password.js
========================================================= */

let forgotForm = document.getElementById("forgotForm");
let forgotButton = document.getElementById("forgotButton");

forgotForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (forgotButton.disabled) { return; }

  let email = document.getElementById("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    showMessage("Enter a valid email.", false);
    return;
  }

  forgotButton.disabled = true;
  forgotButton.textContent = "Sending...";

  postJSON("/universities/forgot-password", { email: email })
    .then(function (data) {
      showMessage(data.message + " The link works for 30 minutes.", true);
      forgotButton.textContent = "Link sent";
      // allow another try after a minute (the server sends one per minute)
      setTimeout(function () {
        forgotButton.disabled = false;
        forgotButton.textContent = "Send reset link";
      }, 60000);
    })
    .catch(function (err) {
      showMessage(err.message, false);
      forgotButton.disabled = false;
      forgotButton.textContent = "Send reset link";
    });
});