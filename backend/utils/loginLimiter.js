// Counts wrong logins per account. 5 wrong tries → locked for 15 minutes.
// Kept in memory, so it resets when the server restarts.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10000;   // stops the list growing forever

const fails = new Map();     // "admin:a@b.edu" → { count, first, lockedUntil }

function key(role, identifier) {
  return role + ":" + identifier;
}

// minutes left on the lock, or 0 if not locked
function isLocked(k, now = Date.now()) {
  const f = fails.get(k);
  if (!f || !f.lockedUntil) return 0;
  if (f.lockedUntil > now) return Math.ceil((f.lockedUntil - now) / 60000);
  fails.delete(k);
  return 0;
}

function recordFail(k, now = Date.now()) {
  if (fails.size > MAX_TRACKED) fails.clear();

  let f = fails.get(k);
  if (!f || now - f.first > LOCK_MS) {
    f = { count: 0, first: now, lockedUntil: 0 };   // old tries no longer count
  }
  f.count += 1;
  if (f.count >= MAX_FAILS) f.lockedUntil = now + LOCK_MS;
  fails.set(k, f);
}

function clearFails(k) {
  fails.delete(k);
}

module.exports = { key, isLocked, recordFail, clearFails, MAX_FAILS };