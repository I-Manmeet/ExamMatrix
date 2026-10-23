const path = require("path");
const readline = require("readline");
const { Readable } = require("stream");
const { AppError } = require("../middleware/errorHandler");

// Every header is mapped to one of these exact field names
const FIELDS = ["hallNo", "rows", "cols", "code", "name", "dept", "roll", "subjects", "email", "department", "unavailable"];
const FIELD_BY_KEY = {};
FIELDS.forEach((f) => { FIELD_BY_KEY[f.toLowerCase()] = f; });

// "Hall No", "hall_no", "HALLNO" -> "hallNo"
function normalizeHeader(header) {
  const squashed = String(header).replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return FIELD_BY_KEY[squashed] || String(header).trim();
}

function toText(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(toText).join(";"); // JSON lists -> "CS301;MA201"
  return String(value).trim();
}

function normalizeRow(row) {
  const clean = {};
  Object.keys(row).forEach((key) => { clean[normalizeHeader(key)] = toText(row[key]); });
  return clean;
}

// CSV: read the Buffer as a stream, one line at a time
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

function parseJson(buffer) {
  let data;
  try { data = JSON.parse(buffer.toString("utf8")); }
  catch (e) { throw new AppError(400, "File is not valid JSON"); }
  const rows = Array.isArray(data) ? data : data.data;
  if (!Array.isArray(rows)) throw new AppError(400, "JSON must be an array of records");
  return rows;
}

function parseExcel(buffer) {
  const XLSX = require("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new AppError(400, "No worksheet found");
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

// parseFile(req.file.buffer, req.file.originalname) -> [{ hallNo: "Hall A", rows: "5", ... }]
async function parseFile(buffer, filename) {
  if (!buffer || buffer.length === 0) throw new AppError(400, "File is empty");
  const ext = path.extname(filename || "").toLowerCase();

  let rows;
  if (ext === ".csv") rows = await parseCsv(buffer);
  else if (ext === ".json") rows = parseJson(buffer);
  else if (ext === ".xlsx" || ext === ".xls") rows = parseExcel(buffer);
  else throw new AppError(400, "Only CSV, JSON, XLSX and XLS files are supported");

  if (rows.length === 0) throw new AppError(400, "File has no rows");
  return rows.map(normalizeRow);
}

module.exports = { parseFile, normalizeHeader };
