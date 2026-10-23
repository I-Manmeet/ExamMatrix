const validators = {
  students(row) {
    const errors = [];

    if (!row.roll || !String(row.roll).trim()) {
      errors.push("Roll number is required");
    }

    if (!row.name || !String(row.name).trim()) {
      errors.push("Student name is required");
    }

    if (
      row.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim())
    ) {
      errors.push("Invalid email format");
    }

    if (
      row.semester !== undefined &&
      row.semester !== "" &&
      (!Number.isInteger(Number(row.semester)) ||
        Number(row.semester) < 1)
    ) {
      errors.push("Semester must be a positive integer");
    }

    return errors;
  },

  halls(row) {
    const errors = [];

    if (!row.hallCode || !String(row.hallCode).trim()) {
      errors.push("Hall code is required");
    }

    if (!row.capacity || !Number.isInteger(Number(row.capacity)) ||
        Number(row.capacity) < 1) {
      errors.push("Capacity must be a positive integer");
    }

    return errors;
  },

  subjects(row) {
    const errors = [];

    if (!row.subjectCode || !String(row.subjectCode).trim()) {
      errors.push("Subject code is required");
    }

    if (!row.subjectName || !String(row.subjectName).trim()) {
      errors.push("Subject name is required");
    }

    return errors;
  }
};

/**
 * Validates every row and returns valid rows and row-wise errors.
 * type: "students", "halls", or "subjects"
 */
function validateRows(rows, type) {
  if (!Array.isArray(rows)) {
    throw new TypeError("Rows must be an array");
  }

  if (!validators[type]) {
    throw new Error(
      "Invalid type. Use students, halls, or subjects"
    );
  }

  const validRows = [];
  const invalidRows = [];

  rows.forEach((row, index) => {
    const errors = validators[type](row);

    if (errors.length > 0) {
      invalidRows.push({
        row: index + 2,
        data: row,
        errors
      });
    } else {
      validRows.push(row);
    }
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    validRows,
    invalidRows
  };
}

module.exports = {
  validateRows
};
