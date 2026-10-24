/* =========================================================
   UPLOAD PAGE — choose a dataset + file → preview → confirm
   ---------------------------------------------------------
   GET  /api/uploads/:type/template   CSV with the right column names
   POST /api/uploads/:type/preview    checks the file, saves nothing
   POST /api/uploads/:type/confirm    same file again, saves the good rows
   The server takes the university from the login, never from this page.
   New invigilator passwords are shown once and never stored in the browser.
========================================================= */

const UPLOADS = API_BASE + "/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILES = [".csv", ".xlsx", ".xls", ".json"];
const MAX_ROWS_SHOWN = 100;
const MAX_ERRORS_SHOWN = 50;

const uploadForm = document.getElementById("uploadForm");
const dataType = document.getElementById("dataType");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileNameEl = document.getElementById("fileName");
const uploadMessage = document.getElementById("uploadMessage");
const previewBtn = document.getElementById("previewBtn");
const previewPanel = document.getElementById("previewPanel");
const confirmBtn = document.getElementById("confirmBtn");
const credentialsPanel = document.getElementById("credentialsPanel");

let previewType = null;     // dataset the preview was made for
let previewFile = null;     // file the preview was made for
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

function typeLabel() {
  return dataType.options[dataType.selectedIndex].text;
}

function cellText(value) {
  if (Array.isArray(value)) return value.join("; ");
  return value == null ? "" : String(value);
}

function resetPreview() {
  previewType = null;
  previewFile = null;
  confirmBtn.disabled = true;
  previewPanel.hidden = true;
  document.getElementById("validationErrors").hidden = true;
}

function clearFile() {
  fileInput.value = "";
  fileNameEl.textContent = "No file selected";
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

/* ---------- choosing a dataset and a file ---------- */

dataType.addEventListener("change", () => {
  document.getElementById("selectedType").textContent = typeLabel();
  resetPreview();
  hideMessage();
});

function selectFile(file) {
  resetPreview();
  hideMessage();
  if (!file) {
    clearFile();
    return;
  }

  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ALLOWED_FILES.includes(ext)) {
    clearFile();
    showMessage("Choose a CSV, Excel or JSON file.", "bad");
    return;
  }
  if (file.size === 0) {
    clearFile();
    showMessage("That file is empty.", "bad");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    clearFile();
    showMessage("The maximum file size is 5 MB.", "bad");
    return;
  }
  fileNameEl.textContent = file.name;
}

fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  const files = event.dataTransfer.files;
  if (files.length > 1) {
    showMessage("Drop one file at a time.", "bad");
    return;
  }
  if (!files[0]) return;
  try {
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    fileInput.files = transfer.files;
    selectFile(files[0]);
  } catch {
    showMessage("Please click the box and choose your file instead.", "bad");
  }
});

/* ---------- talking to the server ---------- */

// files can't go through api() (it sends JSON), so this adds the login token itself
async function sendFile(type, step, file) {
  const body = new FormData();
  body.append("file", file);

  let response;
  try {
    response = await fetch(`${UPLOADS}/${encodeURIComponent(type)}/${step}`, {
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

/* ---------- preview ---------- */

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetPreview();
  hideMessage();

  const file = fileInput.files[0];
  const type = dataType.value;
  if (!file) {
    showMessage("Choose a file first.", "bad");
    return;
  }

  previewBtn.disabled = true;
  previewBtn.textContent = "Checking…";
  try {
    const data = await sendFile(type, "preview", file);
    const usable = data.counts.new + data.counts.update;

    previewType = type;
    previewFile = file;

    renderRows(data.rows);
    renderErrors(data.rows.filter((r) => r.status === "error"));
    document.getElementById("selectedType").textContent = typeLabel();
    document.getElementById("previewCount").textContent = data.rows.length;
    document.getElementById("errorCount").textContent = data.counts.error;
    document.getElementById("previewDescription").textContent =
      `${data.counts.new} new, ${data.counts.update} to update, ${data.counts.error} with problems.` +
      (data.rows.length > MAX_ROWS_SHOWN ? ` Showing the first ${MAX_ROWS_SHOWN} rows.` : "");
    previewPanel.hidden = false;

    if (usable === 0) {
      showMessage("Every row has a problem. Fix the file and preview again.", "bad");
    } else if (data.counts.error) {
      showMessage(`${data.counts.error} row(s) have problems and will be skipped. Fix them in the file to include them.`, "bad");
    } else {
      showMessage("Everything looks good. Check the rows and confirm.", "ok");
    }
    confirmBtn.disabled = usable === 0;
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(error.message, "bad");
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = "Preview records →";
  }
});

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
  resetPreview();
  hideMessage();
});

/* ---------- confirm ---------- */

confirmBtn.addEventListener("click", async () => {
  if (confirmBtn.disabled || !previewFile) return;
  if (dataType.value !== previewType || fileInput.files[0] !== previewFile) {
    resetPreview();
    showMessage("The dataset or file changed. Preview it again.", "bad");
    return;
  }
  if (!confirm("Save these records?")) return;

  confirmBtn.disabled = true;
  confirmBtn.textContent = "Saving…";
  try {
    const data = await sendFile(previewType, "confirm", previewFile);
    resetPreview();
    clearFile();
    showMessage(
      `Saved: ${data.added} added, ${data.updated} updated` + (data.skipped ? `, ${data.skipped} skipped.` : "."),
      "ok"
    );
    if (data.credentials && data.credentials.length) showCredentials(data.credentials);
  } catch (error) {
    showMessage(error.message, "bad");
    confirmBtn.disabled = false;
  } finally {
    confirmBtn.textContent = "Confirm & save →";
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

// warn before leaving while passwords are still on screen
window.addEventListener("beforeunload", (event) => {
  if (shownCredentials) event.preventDefault();
});

/* ---------- template download (public, only column names) ---------- */

document.getElementById("templateBtn").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const type = dataType.value;
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
});