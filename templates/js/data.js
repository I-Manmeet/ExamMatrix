/* =========================================================
   DATA LOADER — js/data.js
   Loads the 3 JSON files from the repo-root /data folder.
   Pages are in /templates, so the path goes UP one level: ../data/
   Must be run via Live Server (not file://).
========================================================= */
/* current logged-in username from the session */
function getSessionUser() {
  try {
    var s = JSON.parse(sessionStorage.getItem("em_session"));
    return s && s.username ? s.username : "";
  } catch (e) { return ""; }
}

/* every saved exam that belongs to the logged-in user */
function getMyExams() {
  var list = [];
  try {
    var raw = JSON.parse(localStorage.getItem("em_exams"));
    if (Array.isArray(raw)) { list = raw; }
  } catch (e) { list = []; }
  var me = getSessionUser();
  return list.filter(function (ex) { return ex.owner === me; });
}


let EM_DATA = {
  subjects: [],
  halls: [],
  students: []
};

function loadExamData(onReady) {

  Promise.all([
    fetch("../data/subjects.json").then(function (r) { return r.json(); }),
    fetch("../data/halls.json").then(function (r) { return r.json(); }),
    fetch("../data/students.json").then(function (r) { return r.json(); })
  ])
  .then(function (results) {
    EM_DATA.subjects = results[0];
    EM_DATA.halls    = results[1];
    EM_DATA.students = results[2];

    console.log(
      "Loaded:",
      EM_DATA.subjects.length, "subjects,",
      EM_DATA.halls.length, "halls,",
      EM_DATA.students.length, "students"
    );

    if (onReady) { onReady(); }
  })
  .catch(function (error) {
    console.log("Could not load data files:", error);
    alert("Could not load data. Make sure you're running through Live Server, and that the ../data path is correct.");
  });
}
