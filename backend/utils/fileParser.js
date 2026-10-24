/* =========================================================
   ExamMatrix — FILE PARSER
   ---------------------------------------------------------
   parseFile(buffer, filename) → [{ field: "text", ... }]

   CSV   → read as a stream, line by line; text stays exactly as typed
           (so "2026-10-27" is never turned into a date)
   Excel → xlsx library; date cells come out as YYYY-MM-DD
   JSON  → JSON.parse; an array of records, or { data: [...] }
   ========================================================= */

const path = require("path");
const readline = require("readline");
const { Readable } = require("stream");
const { AppError } = require("../middleware/errorHandler");

// every header is mapped to one of these exact field names
const FIELDS = ["hallNo", "rows", "cols", "code", "name", "dept", "roll", "subjects", "email", "department", "unavailable"];
const FIELD_BY_KEY = {};
FIELDS.forEach((field) => { FIELD_BY_KEY[field.toLowerCase()] = field; });

// "Hall No", "hall_no", "HALLNO" → "hallNo"
function normalizeHeader(header) {
  const original = String(header).replace(/^\uFEFF/, "").trim();
  const key = original.toLowerCase().replace(/[\s_-]+/g, "");
  return FIELD_BY_KEY[key] || original;
}

function toText(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(toText).join(";"); // JSON lists → "CS301;MA201"
  return String(value).trim();
}

function normalizeRow(row) {
  const clean = {};
  Object.keys(row).forEach((key) => {
    const name = normalizeHeader(key);
    if (!name || name.startsWith("__EMPTY")) return; // columns without a header
    clean[name] = toText(row[key]);
  });
  return clean;
}

// CSV: the Buffer is read as a stream, one line at a time
async function parseCsv(buffer) {
  const lines = readline.createInterface({ input: Readable.from(buffer), crlfDelay: Infinity });
  let headers = null;
  const rows = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!headers) { headers = cells; continue; }
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] === undefined ? "" : cells[i]; });
    rows.push(row);
  }
  return rows;
}

function parseExcel(buffer) {
  const XLSX = require("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new AppError(400, "Unable to read the Excel file. Please check the file format.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new AppError(400, "No worksheet found in the file");
  // raw: false gives text, dateNF keeps date cells as 2026-10-27
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
}

function parseJson(buffer) {
  let data;
  try {
    data = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new AppError(400, "File is not valid JSON");
  }
  const rows = Array.isArray(data) ? data : data && data.data;
  if (!Array.isArray(rows)) throw new AppError(400, "JSON must contain an array of records");
  if (rows.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
    throw new AppError(400, "Each JSON record must be an object");
  }
  return rows;
}

// parseFile(req.file.buffer, req.file.originalname)
async function parseFile(buffer, filename) {
  if (!buffer || buffer.length === 0) throw new AppError(400, "File is empty");
  if (typeof filename !== "string" || !filename.trim()) {
    throw new AppError(400, "Original filename is missing. Please upload the file again.");
  }

  const ext = path.extname(filename.trim()).toLowerCase();
  let rows;
  if (ext === ".csv") rows = await parseCsv(buffer);
  else if (ext === ".json") rows = parseJson(buffer);
  else if (ext === ".xlsx" || ext === ".xls") rows = parseExcel(buffer);
  else throw new AppError(400, `Unsupported file type "${ext || "unknown"}". Please upload CSV, JSON, XLSX or XLS.`);

  if (rows.length === 0) throw new AppError(400, "File has no data rows");
  return rows.map(normalizeRow);
}

module.exports = { parseFile, normalizeHeader };