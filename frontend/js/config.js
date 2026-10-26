/* =========================================================
   CONFIG — js/config.js
   The only place the server address is written.
========================================================= */

const API_BASE =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:5001/api"
    : "https://exammatrix-api.onrender.com/api";   // set this when the backend is deployed