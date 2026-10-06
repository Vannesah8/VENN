import test from "node:test";
import assert from "node:assert/strict";

import { openDatabase, setDatabase, type Db } from "./db";
import { issueOtp, normalizePhone, verifyOtp } from "./otp";

let db: Db;

async function freshDatabase(): Promise<void> {
  db = await openDatabase(":memory:");
  setDatabase(db);
}

test("normalizePhone normalizes local and missing prefixes", () => {
  assert.equal(normalizePhone("0712345678"), "+254712345678");
  assert.equal(normalizePhone("+254 712 345 678"), "+254712345678");
  assert.equal(normalizePhone("712345678"), "+712345678");
  assert.equal(normalizePhone("",).length, 0);
});

test("issueOtp returns a demo code in demo mode", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const result = await issueOtp("+254712345678", "login", db);
  assert.ok(result.demoCode, "demo mode should surface the code");
  assert.match(result.demoCode, /^\d{6}$/);
  assert.ok(result.expiresInMs > 0);
});

test("a fresh code passes verification once", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { demoCode } = await issueOtp("+254712345678", "login", db);
  assert.ok(demoCode);

  assert.equal(await verifyOtp("+254712345678", demoCode, "login", db), true);
  assert.equal(await verifyOtp("+254712345678", demoCode, "login", db), false);
});

test("wrong codes are rejected and burn attempts", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await issueOtp("+254712345678", "login", db);

  for (let i = 0; i < 5; i += 1) {
    assert.equal(await verifyOtp("+254712345678", "000000", "login", db), false);
  }

  assert.equal(await verifyOtp("+254712345678", "000000", "login", db), false);
});

test("an unknown phone has no code to verify", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  assert.equal(await verifyOtp("+254799999999", "123456", "login", db), false);
});