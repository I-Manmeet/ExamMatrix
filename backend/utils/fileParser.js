
const path = require("path");
const { AppError } = require("../middleware/errorHandler");

// Supported fields
const FIELDS = [
  "hallNo",
  "rows",
  "cols",
  "code",
  "name",
  "dept",
  "roll",
  "subjects",
  "email",
  "department",
  "unavailable"
];

// Map lowercase headers to correct field names
const FIELD_BY_KEY = {};

FIELDS.forEach((field) => {
  FIELD_BY_KEY[field.toLowerCase()] = field;
});

// Normalize headers:
// "Hall No", "hall_no", "HALLNO" -> "hallNo"
function normalizeHeader(header) {
  const original = String(header)
    .replace(/^\uFEFF/, "")
    .trim();

  const key = original
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  return FIELD_BY_KEY[key] || original;
}

// Convert values to strings
function toText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(toText).join(";");
  }

  return String(value).trim();
}

// Normalize every row
function normalizeRow(row) {
  const clean = {};

  Object.keys(row).forEach((key) => {
    clean[normalizeHeader(key)] = toText(row[key]);
  });

  return clean;
}

// Read CSV, JSON and Excel files using xlsx
function readSpreadsheet(buffer, filename) {
  let XLSX;

  try {
    XLSX = require("xlsx");
  } catch {
    throw new AppError(
      500,
      "File parsing support is missing. Run npm install xlsx in your backend folder."
    );
  }

  let workbook;

  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      raw: false
    });
  } catch {
    throw new AppError(
      400,
      `Unable to read ${filename}. Please check the file format.`
    );
  }

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new AppError(400, "No worksheet or data found in file");
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    throw new AppError(400, "Unable to read the first worksheet");
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });
}

// Parse CSV
function parseCsv(buffer) {
  return readSpreadsheet(buffer, "CSV file");
}

// Parse JSON
function parseJson(buffer) {
  let data;

  try {
    data = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new AppError(400, "File is not valid JSON");
  }

  const rows = Array.isArray(data) ? data : data?.data;

  if (!Array.isArray(rows)) {
    throw new AppError(
      400,
      "JSON must contain an array of records"
    );
  }

  if (
    rows.some(
      (row) =>
        row === null ||
        typeof row !== "object" ||
        Array.isArray(row)
    )
  ) {
    throw new AppError(
      400,
      "Each JSON record must be an object"
    );
  }

  return rows;
}

// Parse Excel (.xlsx and .xls)
function parseExcel(buffer) {
  return readSpreadsheet(buffer, "Excel file");
}

// Main parser
// Usage: parseFile(req.file.buffer, req.file.originalname)
async function parseFile(buffer, filename) {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, "File is empty");
  }

  if (typeof filename !== "string" || !filename.trim()) {
    throw new AppError(
      400,
      "Original filename is missing. Please upload the file again."
    );
  }

  const ext = path.extname(filename.trim()).toLowerCase();

  console.log("Uploaded filename:", filename);
  console.log("Detected extension:", ext);

  let rows;

  switch (ext) {
    case ".csv":
      rows = parseCsv(buffer);
      break;

    case ".json":
      rows = parseJson(buffer);
      break;

    case ".xlsx":
    case ".xls":
      rows = parseExcel(buffer);
      break;

    default:
      throw new AppError(
        400,
        `Unsupported file type "${ext || "unknown"}". Please upload CSV, JSON, XLSX or XLS.`
      );
  }

  if (rows.length === 0) {
    throw new AppError(400, "File has no data rows");
  }

  // Normalize headers and values before validation
  const normalizedRows = rows.map(normalizeRow);

  console.log("Parsed row count:", normalizedRows.length);
  console.log("First parsed row:", normalizedRows[0]);

  return normalizedRows;
}

module.exports = {
  parseFile,
  normalizeHeader
};
