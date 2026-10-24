/* =========================================================
   AUTH PAGES HELPER — js/auth-api.js   (load js/config.js first)
   Used by verify-email, forgot-password and reset-password.
========================================================= */



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

// the 64-character code from ?token=... in the address bar, or "" if missing/broken
function getTokenFromUrl() {
  let token = new URLSearchParams(window.location.search).get("token") || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}