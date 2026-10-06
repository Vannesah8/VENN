import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "./auth";

test("hashPassword produces a scrypt hash that verifies", () => {
  const stored = hashPassword("correct horse battery staple");

  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
});

test("verifyPassword rejects wrong and malformed credentials", () => {
  const stored = hashPassword("correct horse battery staple");

  assert.equal(verifyPassword("wrong password", stored), false);
  assert.equal(verifyPassword("correct horse battery staple", "plaintext"), false);
  assert.equal(verifyPassword("correct horse battery staple", "scrypt$nosalt"), false);
});

test("two hashes of the same password differ", () => {
  assert.notEqual(hashPassword("same-password"), hashPassword("same-password"));
});