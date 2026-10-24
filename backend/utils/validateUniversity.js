/* =========================================================
   validateUniversity(body) → { value } or { error }
   checkPassword(password)  → "" or an error message
   cleanEmail(value)        → trimmed lowercase email or ""
   The server runs these even though the pages do too,
   because anyone can call the API directly.
========================================================= */

const SPECIAL = /[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=;'`~]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9]{10,15}$/;

// only accept real text; objects like { "$gt": "" } become ""
function cleanText(v) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

function cleanEmail(v) {
  return cleanText(v).toLowerCase();
}

// bcrypt only uses the first 72 bytes, so cap the length at 64
function checkPassword(password) {
  if (typeof password !== "string" || password.length < 6 || password.length > 64) {
    return "Password must be 6 to 64 characters";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) || !SPECIAL.test(password)) {
    return "Password needs a capital letter, a small letter, a number and a special character";
  }
  return "";
}

function validateUniversity(body) {
  const b = body && typeof body === "object" ? body : {};

  const value = {
    name: cleanText(b.name),
    city: cleanText(b.city),
    contact: cleanText(b.contact).replace(/[\s-]/g, ""),
    email: cleanEmail(b.email),
    password: typeof b.password === "string" ? b.password : ""   // never trim a password
  };

  if (!value.name || !value.city || !value.contact || !value.email || !value.password) {
    return { error: "Please fill in all fields" };
  }
  if (value.name.length < 3 || value.name.length > 100) {
    return { error: "University name must be 3 to 100 characters" };
  }
  if (value.city.length < 2 || value.city.length > 60) {
    return { error: "City must be 2 to 60 characters" };
  }
  if (!PHONE.test(value.contact)) {
    return { error: "Contact number must be 10 to 15 digits" };
  }
  if (value.email.length > 254 || !EMAIL.test(value.email)) {
    return { error: "Enter a valid email" };
  }
  const pwError = checkPassword(value.password);
  if (pwError) {
    return { error: pwError };
  }

  return { value };
}

module.exports = { validateUniversity, checkPassword, cleanEmail };