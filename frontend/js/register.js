/* =========================================================
   REGISTER — js/register.js
   Starts a university registration. The server emails a
   verification link; the UNI- ID is given after it's opened.
   (Task 4 will swap the fetch below for the shared api.js helper.)
========================================================= */

const API_BASE = "http://localhost:5001/api";

let registerForm = document.getElementById("registerForm");
let registerButton = document.getElementById("registerButton");
let passwordInput = document.getElementById("password");
let resendBtn = document.getElementById("resendBtn");
let sentToEmail = "";

let specialChar = /[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=;'`~]/;

let passwordRules = {
  length: function (p) { return p.length >= 6 && p.length <= 64; },
  upper: function (p) { return /[A-Z]/.test(p); },
  lower: function (p) { return /[a-z]/.test(p); },
  number: function (p) { return /[0-9]/.test(p); },
  special: function (p) { return specialChar.test(p); }
};


// turn each rule chip green as soon as it's met
passwordInput.addEventListener("input", function () {
  let chips = document.querySelectorAll("#passwordRules li");
  chips.forEach(function (chip) {
    let check = passwordRules[chip.dataset.rule];
    chip.classList.toggle("ok", check(passwordInput.value));
  });
});


function getPasswordError(password) {
  let missing = [];

  if (!passwordRules.upper(password)) { missing.push("capital letter"); }
  if (!passwordRules.lower(password)) { missing.push("small letter"); }
  if (!passwordRules.number(password)) { missing.push("number"); }
  if (!passwordRules.special(password)) { missing.push("special character"); }

  if (missing.length === 0) { return ""; }
  if (missing.length === 1) { return "Add a " + missing[0] + "."; }
  if (missing.length === 2) { return "Add a " + missing[0] + " and " + missing[1] + "."; }

  let last = missing.pop();
  return "Add a " + missing.join(", ") + ", and " + last + ".";
}


// same rules as backend/utils/validateUniversity.js
function validateRegistration(form) {
  if (!form.name || !form.city || !form.contact || !form.email || !form.password || !form.confirmPassword) {
    return "Please fill in all fields.";
  }
  if (form.name.length < 3) {
    return "University name must be at least 3 characters.";
  }
  if (form.city.length < 2) {
    return "Enter a valid city.";
  }
  if (!/^\+?[0-9]{10,15}$/.test(form.contact.replace(/[\s-]/g, ""))) {
    return "Contact number must be 10 to 15 digits.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) {
    return "Enter a valid email.";
  }
  if (!passwordRules.length(form.password)) {
    return "Password must be 6 to 64 characters.";
  }
  let passwordError = getPasswordError(form.password);
  if (passwordError !== "") {
    return passwordError;
  }
  if (form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
}


function postJSON(path, body) {
  return fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
    .catch(function () {
      throw new Error("Can't reach the server. Make sure the backend is running.");
    })
    .then(function (res) {
      return res.json()
        .catch(function () { throw new Error("The server sent an unexpected reply. Please try again."); })
        .then(function (data) {
          if (!res.ok) { throw new Error(data.error || "Something went wrong"); }
          return data.data;
        });
    });
}


function showCheckInbox(email) {
  sentToEmail = email;
  registerForm.hidden = true;
  document.getElementById("message").className = "";
  document.getElementById("loginRedirect").hidden = true;
  document.getElementById("roleLinks").hidden = true;
  document.getElementById("sentTo").textContent = email;
  document.getElementById("successPanel").hidden = false;
}


registerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (registerButton.disabled) { return; }   // ignore double clicks

  let form = {
    name: document.getElementById("name").value.trim(),
    city: document.getElementById("city").value.trim(),
    contact: document.getElementById("contact").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: passwordInput.value,
    confirmPassword: document.getElementById("confirmPassword").value
  };

  let error = validateRegistration(form);
  if (error !== "") {
    showMessage(error, false);
    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "Sending link...";

  postJSON("/universities", {
    name: form.name,
    city: form.city,
    contact: form.contact,
    email: form.email,
    password: form.password
  })
    .then(function (data) {
      showCheckInbox(data.email);
    })
    .catch(function (err) {
      showMessage(err.message, false);
      registerButton.disabled = false;
      registerButton.textContent = "Register university";
    });
});


// "Send the link again": one try per minute, matching the server
resendBtn.addEventListener("click", function () {
  if (resendBtn.disabled || !sentToEmail) { return; }

  resendBtn.disabled = true;
  resendBtn.textContent = "Sending...";

  postJSON("/universities/resend-verification", { email: sentToEmail })
    .then(function (data) {
      showMessage(data.message, true);
      resendBtn.textContent = "Sent. Try again in a minute";
      setTimeout(function () {
        resendBtn.disabled = false;
        resendBtn.textContent = "Send the link again";
      }, 60000);
    })
    .catch(function (err) {
      showMessage(err.message, false);
      resendBtn.disabled = false;
      resendBtn.textContent = "Send the link again";
    });
});