const test = require("node:test");
const assert = require("node:assert");
const { validateUniversity, checkPassword, cleanEmail } = require("../utils/validateUniversity.js");

const good = {
  name: "Test University",
  city: "Chandigarh",
  contact: "9876543210",
  email: "admin@testuni.edu",
  password: "Test@123"
};

test("valid input passes and is cleaned", () => {
  const { error, value } = validateUniversity({
    ...good,
    name: "  Test   University ",
    email: " ADMIN@TestUni.EDU ",
    contact: "+91 98765-43210"
  });
  assert.strictEqual(error, undefined);
  assert.strictEqual(value.name, "Test University");
  assert.strictEqual(value.email, "admin@testuni.edu");
  assert.strictEqual(value.contact, "+919876543210");
});

test("missing or blank fields are rejected", () => {
  assert.match(validateUniversity({ ...good, city: "" }).error, /fill in all fields/);
  assert.match(validateUniversity({ ...good, name: "    " }).error, /fill in all fields/);
  assert.match(validateUniversity(undefined).error, /fill in all fields/);
});

test("objects instead of text are rejected (NoSQL injection)", () => {
  assert.match(validateUniversity({ ...good, email: { $gt: "" } }).error, /fill in all fields/);
});

test("bad email and phone are rejected", () => {
  assert.match(validateUniversity({ ...good, email: "admin@uni" }).error, /valid email/);
  assert.match(validateUniversity({ ...good, contact: "12345" }).error, /10 to 15 digits/);
  assert.match(validateUniversity({ ...good, contact: "98765abcde" }).error, /10 to 15 digits/);
});

test("name and city length limits", () => {
  assert.match(validateUniversity({ ...good, name: "AB" }).error, /3 to 100/);
  assert.match(validateUniversity({ ...good, city: "X".repeat(61) }).error, /2 to 60/);
});

test("weak passwords are rejected", () => {
  assert.match(validateUniversity({ ...good, password: "Ab@1" }).error, /6 to 64/);
  assert.match(validateUniversity({ ...good, password: "test@123" }).error, /capital letter/);
  assert.match(validateUniversity({ ...good, password: "Test1234" }).error, /special character/);
});

test("passwords over 64 characters are rejected (bcrypt limit)", () => {
  assert.match(validateUniversity({ ...good, password: "Aa1@" + "x".repeat(61) }).error, /6 to 64/);
});

test("password is never trimmed", () => {
  const { value } = validateUniversity({ ...good, password: " Test@123 " });
  assert.strictEqual(value.password, " Test@123 ");
});

test("checkPassword works on its own (used by password reset)", () => {
  assert.strictEqual(checkPassword("Test@123"), "");
  assert.match(checkPassword("short"), /6 to 64/);
  assert.match(checkPassword({ $gt: "" }), /6 to 64/);
});

test("cleanEmail trims, lowercases and rejects non-text", () => {
  assert.strictEqual(cleanEmail("  ADMIN@Uni.EDU "), "admin@uni.edu");
  assert.strictEqual(cleanEmail({ $gt: "" }), "");
});