/* =========================================================
   VERIFY EMAIL — js/verify-email.js
   Reads ?token= from the link. The server then creates the
   university and returns its UNI- ID. The check needs this
   page's script to run, so an email app's link scanner
   can't verify by accident.
========================================================= */

let statusEl = document.getElementById("verifyStatus");
let doneBox = document.getElementById("verifyDone");
let resendForm = document.getElementById("resendForm");
let resendButton = document.getElementById("resendButton");
let copyIdBtn = document.getElementById("copyIdBtn");

function showResend(text) {
  statusEl.hidden = true;
  showMessage(text, false);
  resendForm.hidden = false;
}

let token = getTokenFromUrl();

if (!token) {
  showResend("This verification link is missing or broken.");
} else {
  postJSON("/universities/verify-email", { token: token })
    .then(function (data) {
      statusEl.hidden = true;
      document.getElementById("loginRedirect").hidden = true;
      document.getElementById("newUniId").textContent = data.universityId;
      doneBox.hidden = false;
      // remove the code from the address bar so a refresh doesn't reuse it
      history.replaceState(null, "", window.location.pathname);
    })
    .catch(function (err) {
      showResend(err.message + ". If you've already verified, check your email for your ID and log in.");
    });
}


// copy the ID; if the browser blocks it, select the text so it can be copied by hand
copyIdBtn.addEventListener("click", function () {
  let idEl = document.getElementById("newUniId");

  function selectId() {
    let range = document.createRange();
    range.selectNodeContents(idEl);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    copyIdBtn.textContent = "Press Cmd+C";
  }

  if (!navigator.clipboard) { selectId(); return; }

  navigator.clipboard.writeText(idEl.textContent)
    .then(function () {
      copyIdBtn.textContent = "Copied";
      setTimeout(function () { copyIdBtn.textContent = "Copy"; }, 1500);
    })
    .catch(selectId);
});


resendForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (resendButton.disabled) { return; }

  let email = document.getElementById("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    showMessage("Enter a valid email.", false);
    return;
  }

  resendButton.disabled = true;
  resendButton.textContent = "Sending...";

  postJSON("/universities/resend-verification", { email: email })
    .then(function (data) { showMessage(data.message, true); })
    .catch(function (err) { showMessage(err.message, false); })
    .finally(function () {
      resendButton.disabled = false;
      resendButton.textContent = "Send new link";
    });
});