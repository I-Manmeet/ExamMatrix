/* =========================================================
   PASSWORD EYE — js/pw-toggle.js
   Every <button class="pwToggle" data-target="inputId">
   shows / hides the password in that input.
========================================================= */

document.querySelectorAll(".pwToggle").forEach(function (btn) {
  let input = document.getElementById(btn.dataset.target);
  if (!input) { return; }

  btn.addEventListener("click", function () {
    let show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});