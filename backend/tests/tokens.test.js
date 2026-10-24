const test = require("node:test");
const assert = require("node:assert");
const { makeToken, hashToken } = require("../utils/tokens.js");

test("makeToken gives a 64-character code and its hash", () => {
  const { token, hash } = makeToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.strictEqual(hash, hashToken(token));
  assert.notStrictEqual(hash, token);
});

test("every token is different", () => {
  assert.notStrictEqual(makeToken().token, makeToken().token);
});

test("hashToken always gives the same hash for the same code", () => {
  assert.strictEqual(hashToken("abc"), hashToken("abc"));
});