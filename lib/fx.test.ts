import test from "node:test";
import assert from "node:assert/strict";

import { setDatabase, type Db } from "./db";
import { openTestDatabase } from "./db/test-support";
import { DEFAULT_RATES, convertCents, getRate, setRate } from "./fx";

let db: Db;

test("the pivot rate is constant and the corridor defaults are sane", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  assert.equal(DEFAULT_RATES.KES, 1);
  assert.ok(DEFAULT_RATES.TZS > 1);
  assert.ok(DEFAULT_RATES.UGX > 1);
});

test("getRate falls back to the seeded defaults without persisting", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  assert.equal(await getRate("KES"), 1);
  assert.equal(await getRate("TZS"), DEFAULT_RATES.TZS);
  assert.equal(await getRate("UGX"), DEFAULT_RATES.UGX);

  const stored = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM fx_rates",
  );
  assert.equal(stored?.count ?? 0, 3);
});

test("setRate overrides the persisted rate for later conversions", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  await setRate("TZS", 25);
  assert.equal(await getRate("TZS"), 25);
});

test("convertCents rounds once and moves through the KES pivot", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  assert.equal(await convertCents(1_000, "KES", "KES"), 1_000);
  assert.equal(await convertCents(1_000, "KES", "TZS"), 20_000);
  assert.equal(await convertCents(20_000, "TZS", "KES"), 1_000);
  assert.equal(await convertCents(20_000, "TZS", "UGX"), 28_000);
  assert.equal(await convertCents(55, "KES", "TZS"), 1_100);
  assert.equal(await convertCents(57_301, "UGX", "TZS"), 40_929);
});

test("convertCents refuses non-finite amounts", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  await assert.rejects(convertCents(Number.NaN, "KES", "TZS"));
  await assert.rejects(convertCents(Number.POSITIVE_INFINITY, "KES", "TZS"));
});