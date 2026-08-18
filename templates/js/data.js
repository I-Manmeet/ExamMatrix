/* =========================================================
   DATA LOADER — js/data.js
   Loads the 3 JSON files from the repo-root /data folder.
   Pages are in /templates, so the path goes UP one level: ../data/
   Must be run via Live Server (not file://).
========================================================= */

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
