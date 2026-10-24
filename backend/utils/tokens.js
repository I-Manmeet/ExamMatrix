const crypto = require("crypto");

// One-time code for email links. The link carries the code;
// the database only stores its sha256 hash, so a leaked
// database has no working links in it.
function makeToken() {
  const token = crypto.randomBytes(32).toString("hex");   // 64 characters
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = { makeToken, hashToken };