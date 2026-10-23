const fs = require("fs/promises");
const path = require("path");
const XLSX = require("xlsx");

async function parseFile(filePath) {
  if (!filePath) {
    throw new Error("File path is required");
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    const content = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(content);

    const rows = Array.isArray(data) ? data : data.data;

    if (!Array.isArray(rows)) {
      throw new Error("JSON must contain an array of records");
    }

    return normalizeRows(rows);
  }

  if ([".csv", ".xlsx", ".xls"].includes(ext)) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error("No worksheet found");
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      blankrows: false
    });

    if (rows.length === 0) {
      throw new Error("Uploaded file is empty");
    }

    return normalizeRows(rows);
  }

  throw new Error("Only CSV, JSON, XLS and XLSX are supported");
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

      normalized[cleanKey] =
        typeof value === "string" ? value.trim() : value;
    }

    return normalized;
  });
}

module.exports = { parseFile };
