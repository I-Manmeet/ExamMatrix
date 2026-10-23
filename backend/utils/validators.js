const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(v) { return v === undefined || v === null ? "" : String(v).trim(); }

// "CS301; ma201" -> ["CS301", "MA201"]
function splitList(v, upper) {
  const list = Array.isArray(v) ? v : text(v).split(";");
  return list.map((s) => (upper ? text(s).toUpperCase() : text(s))).filter(Boolean);
}

function wholeNumber(v, min, max) {
  const n = Number(text(v));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function checkSubjects(list, knownSubjects, errors) {
  if (!knownSubjects) return;
  const unknown = list.filter((code) => !knownSubjects.has(code));
  if (unknown.length) errors.push("Unknown subject code(s): " + unknown.join(", "));
}

// key = the field that identifies a record (used for duplicates and new/update)
const RULES = {
  halls: {
    key: "hallNo",
    clean(row, errors) {
      const data = { hallNo: text(row.hallNo), rows: wholeNumber(row.rows, 1, 30), cols: wholeNumber(row.cols, 1, 30) };
      if (!data.hallNo) errors.push("hallNo is required");
      if (data.rows === null) errors.push("rows must be a whole number from 1 to 30");
      if (data.cols === null) errors.push("cols must be a whole number from 1 to 30");
      return data;
    }
  },
  subjects: {
    key: "code",
    clean(row, errors) {
      const data = { code: text(row.code).toUpperCase(), name: text(row.name), dept: text(row.dept || row.department) };
      if (!data.code) errors.push("code is required");
      if (!data.name) errors.push("name is required");
      if (!data.dept) errors.push("dept is required");
      return data;
    }
  },
  students: {
    key: "roll",
    clean(row, errors, opts) {
      const data = { roll: text(row.roll).toUpperCase(), name: text(row.name), subjects: splitList(row.subjects, true) };
      if (!data.roll) errors.push("roll is required");
      if (!data.name) errors.push("name is required");
      if (data.subjects.length === 0) errors.push("at least one subject is required");
      checkSubjects(data.subjects, opts.knownSubjects, errors);
      return data;
    }
  },
  invigilators: {
    key: "email",
    clean(row, errors, opts) {
      const data = {
        name: text(row.name),
        email: text(row.email).toLowerCase(),
        department: text(row.department || row.dept),
        subjects: splitList(row.subjects, true),
        unavailable: splitList(row.unavailable, false)
      };
      if (!data.name) errors.push("name is required");
      if (!EMAIL_RE.test(data.email)) errors.push("a valid email is required");
      if (!data.department) errors.push("department is required");
      checkSubjects(data.subjects, opts.knownSubjects, errors);
      const badDates = data.unavailable.filter((d) => !DATE_RE.test(d));
      if (badDates.length) errors.push("unavailable dates must be YYYY-MM-DD: " + badDates.join(", "));
      return data;
    }
  }
};

/*
  validateRows("students", rows, { existingKeys: Set, knownSubjects: Set })
  -> { rows: [{ rowNo, data, status: "new" | "update" | "error", errors: [] }],
       counts: { new, update, error } }
  rowNo = line in the file (row 1 is the header)
*/
function validateRows(type, rows, options = {}) {
  const rule = RULES[type];
  if (!rule) throw new Error("Unknown upload type: " + type);
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");

  const existingKeys = options.existingKeys || new Set();
  const opts = { knownSubjects: options.knownSubjects || null };
  const firstSeen = new Map();

  const result = rows.map((row, i) => {
    const errors = [];
    const data = rule.clean(row, errors, opts);
    const key = data[rule.key];
    const rowNo = i + 2;

    if (key) {
      if (firstSeen.has(key)) errors.push("Duplicate of row " + firstSeen.get(key) + " in this file");
      else firstSeen.set(key, rowNo);
    }

    const status = errors.length ? "error" : existingKeys.has(key) ? "update" : "new";
    return { rowNo, data, status, errors };
  });

  const counts = { new: 0, update: 0, error: 0 };
  result.forEach((r) => { counts[r.status]++; });
  return { rows: result, counts };
}

module.exports = { validateRows, splitList, RULES, UPLOAD_TYPES: Object.keys(RULES) };
