/* =========================================================
   UPLOAD PAGE — one row per dataset → check all → save all
   ---------------------------------------------------------
   GET  /api/uploads/status          saved count per dataset
   GET  /api/uploads/:type/template  CSV with the right column names
   POST /api/uploads/all/preview     checks every chosen file, saves nothing
   POST /api/uploads/all/confirm     same files again, saved in order
   Each row keeps its own file, so switching rows never loses anything.
   The server takes the university from the login, never from this page.
   New invigilator passwords are shown once and never stored in the browser.
========================================================= */

const UPLOADS = API_BASE + "/uploads";
const DATASETS = ["halls", "subjects", "students", "invigilators"];
const LABELS = { halls: "Halls", subjects: "Subjects", students: "Students", invigilators: "Invigilators" };
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILES = [".csv", ".xlsx", ".xls", ".json"];
const MAX_ROWS_SHOWN = 100;
const MAX_ERRORS_SHOWN = 50;

const uploadMessage = document.getElementById("uploadMessage");
const checkBtn = document.getElementById("checkBtn");
const saveBtn = document.getElementById("saveBtn");
const previewPanel = document.getElementById("previewPanel");
const credentialsPanel = document.getElementById("credentialsPanel");

const chosen = {};          // dataset → File picked on this page
let checked = null;         // { files, results } from the last check
let activeTab = null;
let shownCredentials = null;

/* ---------- small helpers ---------- */

function showMessage(text, kind) {
  uploadMessage.textContent = text;
  uploadMessage.className = "uploadMsg " + kind;   // "ok" or "bad"
  uploadMessage.hidden = false;
}

function hideMessage() {
  uploadMessage.textContent = "";
  uploadMessage.hidden = true;
}

function slot(type) {
  return document.querySelector('.slot[data-type="' + type + '"]');
}

function chosenTypes() {
  return DATASETS.filter((type) => chosen[type]);
}

function cellText(value) {
  if (Array.isArray(value)) return value.join("; ");
  return value == null ? "" : String(value);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------- choosing files ---------- */

function fileProblem(file) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ALLOWED_FILES.includes(ext)) return "choose a CSV, Excel or JSON file.";
  if (file.size === 0) return "that file is empty.";
  if (file.size > MAX_FILE_SIZE) return "the maximum file size is 5 MB.";
  return null;
}

// any change to the chosen files means the last check no longer counts
function resetCheck() {
  checked = null;
  activeTab = null;
  previewPanel.hidden = true;
  saveBtn.disabled = true;
  checkBtn.disabled = chosenTypes().length === 0;
}

function setFile(type, file) {
  const problem = file ? fileProblem(file) : null;
  if (problem) {
    showMessage(LABELS[type] + ": " + problem, "bad");
    file = null;
  } else {
    hideMessage();
  }

  if (file) chosen[type] = file;
  else delete chosen[type];

  const row = slot(type);
  row.classList.toggle("hasFile", Boolean(file));
  row.querySelector(".slotFile").textContent = file ? file.name : "No file chosen";
  row.querySelector("[data-remove]").hidden = !file;
  row.querySelector('input[type="file"]').value = "";   // lets the same file be picked again
  resetCheck();
}

DATASETS.forEach((type) => {
  const row = slot(type);
  const input = row.querySelector('input[type="file"]');

  input.addEventListener("change", () => {
    if (input.files[0]) setFile(type, input.files[0]);
  });
  row.querySelector("[data-remove]").addEventListener("click", () => setFile(type, null));
  row.querySelector("[data-template]").addEventListener("click", (event) => downloadTemplate(type, event.currentTarget));

  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("dragover");
  });
  row.addEventListener("dragleave", () => row.classList.remove("dragover"));
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("dragover");
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      showMessage("Drop one file at a time onto its row.", "bad");
      return;
    }
    setFile(type, files[0]);
  });
});

/* ---------- saved counts per row ---------- */

async function loadStatus() {
  try {
    const counts = await api("GET", "/uploads/status");
    DATASETS.forEach((type) => {
      const n = counts[type] || 0;
      const badge = slot(type).querySelector(".slotSaved");
            badge.textContent = n ? "Already saved: " + n : "Nothing saved yet";
      badge.title = n
        ? n + " " + LABELS[type].toLowerCase() + " are already saved for your university. Choose a file only to add or change them."
        : "Nothing uploaded yet for " + LABELS[type].toLowerCase() + ".";
      badge.classList.toggle("empty", n === 0);
    });
  } catch {
    // the page still works without the counts; api() already handles an expired login
  }
}

/* ---------- talking to the server ---------- */

// files can't go through api() (it sends JSON), so this adds the login token itself
async function sendFiles(step, files) {
  const body = new FormData();
  DATASETS.forEach((type) => {
    if (files[type]) body.append(type, files[type]);
  });

  let response;
  try {
    response = await fetch(`${UPLOADS}/all/${step}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getAuthToken() },
      body
    });
  } catch {
    throw new Error("Can't reach the server. Make sure the backend is running.");
  }

  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearAuthToken();
    window.location.href = "login.html?expired=1";
    throw new Error("Please log in again.");
  }
  if (!response.ok) throw new Error(result.error || `Server error (${response.status}).`);
  return result.data;
}

/* ---------- check ---------- */

checkBtn.addEventListener("click", async () => {
  const files = { ...chosen };
  if (Object.keys(files).length === 0) {
    showMessage("Choose at least one file.", "bad");
    return;
  }

  hideMessage();
  checkBtn.disabled = true;
  checkBtn.textContent = "Checking…";
  try {
    const data = await sendFiles("preview", files);
    checked = { files, results: data.files };

    const types = DATASETS.filter((type) => checked.results[type]);
    let usable = 0;
    let problems = 0;
    types.forEach((type) => {
      const c = checked.results[type].counts;
      usable += c.new + c.update;
      problems += c.error;
    });

    showTab(types.find((type) => checked.results[type].counts.error) || types[0]);
    previewPanel.hidden = false;
    saveBtn.disabled = usable === 0;

    if (usable === 0) {
      showMessage("Every row has a problem. Fix the files and check again.", "bad");
    } else if (problems) {
      showMessage(`${problems} row(s) have problems and will be skipped. Fix them in the file to include them.`, "bad");
    } else {
      showMessage("Everything looks good. Check the rows and save.", "ok");
    }
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(error.message, "bad");
  } finally {
    checkBtn.disabled = chosenTypes().length === 0;
    checkBtn.textContent = "Check files →";
  }
});

function renderTabs() {
  const tabs = document.getElementById("previewTabs");
  tabs.replaceChildren();
  DATASETS.filter((type) => checked.results[type]).forEach((type) => {
    const c = checked.results[type].counts;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab" + (c.error ? " hasErrors" : "") + (type === activeTab ? " active" : "");
    button.setAttribute("role", "tab");
    button.textContent = LABELS[type] + " · " + (c.new + c.update) + " ok" + (c.error ? " · " + c.error + " with problems" : "");
    button.addEventListener("click", () => showTab(type));
    tabs.appendChild(button);
  });
}

function showTab(type) {
  activeTab = type;
  renderTabs();
  const result = checked.results[type];
  const c = result.counts;
  renderRows(result.rows);
  renderErrors(result.rows.filter((r) => r.status === "error"));
  document.getElementById("previewDescription").textContent =
    `${LABELS[type]}: ${c.new} new, ${c.update} to update, ${c.error} with problems.` +
    (result.rows.length > MAX_ROWS_SHOWN ? ` Showing the first ${MAX_ROWS_SHOWN} rows.` : "");
}

// rows from the server: [{ rowNo, status: "new" | "update" | "error", data, errors }]
function renderRows(rows) {
  const head = document.getElementById("previewHead");
  const body = document.getElementById("previewBody");
  head.replaceChildren();
  body.replaceChildren();

  const shown = rows.slice(0, MAX_ROWS_SHOWN);
  if (!shown.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "emptyHint";
    td.textContent = "No rows to show.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  const fields = [...new Set(shown.flatMap((r) => Object.keys(r.data || {})))];
  const headRow = document.createElement("tr");
  ["Row", "Status", ...fields].forEach((name) => {
    const th = document.createElement("th");
    th.textContent = name;
    headRow.appendChild(th);
  });
  head.appendChild(headRow);

  shown.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.status === "error") tr.className = "rowError";

    const rowTd = document.createElement("td");
    rowTd.textContent = r.rowNo;
    tr.appendChild(rowTd);

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "statusBadge " + r.status;
    badge.textContent = r.status;
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    fields.forEach((f) => {
      const td = document.createElement("td");
      td.textContent = cellText((r.data || {})[f]);   // textContent, so file text can never become HTML
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function renderErrors(errorRows) {
  const box = document.getElementById("validationErrors");
  box.replaceChildren();
  if (!errorRows.length) {
    box.hidden = true;
    return;
  }

  const heading = document.createElement("strong");
  heading.textContent = "Rows that will be skipped";
  box.appendChild(heading);

  const list = document.createElement("ul");
  errorRows.slice(0, MAX_ERRORS_SHOWN).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = "Row " + r.rowNo + ": " + (r.errors || []).join("; ");
    list.appendChild(li);
  });
  if (errorRows.length > MAX_ERRORS_SHOWN) {
    const li = document.createElement("li");
    li.textContent = "and " + (errorRows.length - MAX_ERRORS_SHOWN) + " more";
    list.appendChild(li);
  }
  box.appendChild(list);
  box.hidden = false;
}

document.getElementById("cancelBtn").addEventListener("click", () => {
  resetCheck();
  hideMessage();
});

/* ---------- save ---------- */

function sameFiles(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

saveBtn.addEventListener("click", async () => {
  if (saveBtn.disabled || !checked) return;
  if (!sameFiles(checked.files, chosen)) {
    resetCheck();
    showMessage("The files changed since the check. Check them again.", "bad");
    return;
  }
  if (!confirm("Save all checked files? Rows with problems are skipped.")) return;

  saveBtn.disabled = true;
  checkBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    const data = await sendFiles("confirm", checked.files);
    const lines = DATASETS.filter((type) => data.saved[type]).map((type) => {
      const s = data.saved[type];
      return `${LABELS[type]}: ${s.added} added, ${s.updated} updated` + (s.skipped ? `, ${s.skipped} skipped` : "");
    });

    DATASETS.forEach((type) => setFile(type, null));   // clears the rows and the old check
    showMessage("Saved. " + lines.join(" · "), "ok");

    const invigilators = data.saved.invigilators;
    if (invigilators && invigilators.credentials && invigilators.credentials.length) {
      showCredentials(invigilators.credentials);
    }
  } catch (error) {
    // files are saved one after another, so earlier ones may already be in; saving again only updates them
    showMessage(error.message + " Anything saved before this stays saved; you can safely save again.", "bad");
    saveBtn.disabled = false;
    checkBtn.disabled = chosenTypes().length === 0;
  } finally {
    saveBtn.textContent = "Save all →";
    loadStatus();
  }
});

/* ---------- new invigilator passwords: shown once ---------- */

// Excel runs cells starting with = + - @ as formulas, so those get a ' in front
function csvCell(value) {
  let text = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function showCredentials(list) {
  shownCredentials = list;
  const tbody = document.getElementById("credentialsBody");
  tbody.replaceChildren();
  list.forEach((c) => {
    const tr = document.createElement("tr");
    [c.invId, c.name, c.email, c.password].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  credentialsPanel.hidden = false;
  credentialsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("credentialsDownload").addEventListener("click", () => {
  if (!shownCredentials) return;
  const lines = ["INV ID,Name,Email,Temporary password"].concat(
    shownCredentials.map((c) => [c.invId, c.name, c.email, c.password].map(csvCell).join(","))
  );
  downloadBlob(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }), "invigilator-logins.csv");
});

document.getElementById("credentialsDone").addEventListener("click", () => {
  if (!confirm("Have you saved the passwords? They can't be shown again.")) return;
  document.getElementById("credentialsBody").replaceChildren();
  credentialsPanel.hidden = true;
  shownCredentials = null;
});

// warn before leaving while passwords or unsaved files are on the page
window.addEventListener("beforeunload", (event) => {
  if (shownCredentials || chosenTypes().length) event.preventDefault();
});

/* ---------- template download (public, only column names) ---------- */

async function downloadTemplate(type, button) {
  button.disabled = true;
  try {
    let response;
    try {
      response = await fetch(`${UPLOADS}/${encodeURIComponent(type)}/template`);
    } catch {
      throw new Error("Can't reach the server. Make sure the backend is running.");
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Template request failed (${response.status}).`);
    }
    downloadBlob(await response.blob(), `${type}-template.csv`);
  } catch (error) {
    showMessage(error.message, "bad");
  } finally {
    button.disabled = false;
  }
}

/* ---------- start ---------- */

resetCheck();
loadStatus();