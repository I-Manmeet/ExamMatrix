/* =========================================================
   API HELPER — js/api.js   (load js/config.js first)
   api("GET", "/auth/me")                → the "data" part of the reply
   api("POST", "/exams", { ... })        → same, with a JSON body
   Adds the login token, turns server errors into readable
   messages, and sends you to login when the session expires.
========================================================= */

const TOKEN_KEY = "em_token";

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem("em_session");
}

function api(method, path, body) {
  let headers = {};
  if (body !== undefined) { headers["Content-Type"] = "application/json"; }

  let token = getAuthToken();
  if (token) { headers["Authorization"] = "Bearer " + token; }

  return fetch(API_BASE + path, {
    method: method,
    headers: headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
    .catch(function () {
      throw new Error("Can't reach the server. Make sure the backend is running.");
    })
    .then(function (res) {
      return res.json()
        .catch(function () { return {}; })
        .then(function (data) {
          // a token was sent but the server refused it → session is over
          if (res.status === 401 && token) {
            clearAuthToken();
            if (!location.pathname.endsWith("login.html")) {
              window.location.href = "login.html?expired=1";
            }
          }
          if (!res.ok) {
            let err = new Error(data.error || "Something went wrong. Please try again.");
            err.status = res.status;
            throw err;
          }
          return data.data;
        });
    });
}