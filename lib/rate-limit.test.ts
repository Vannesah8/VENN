import test from "node:test";
import assert from "node:assert/strict";

import { setDatabase, type Db } from "./db";
import { openTestDatabase } from "./db/test-support";
import { consumeRateLimit, pruneRateLimits, rateLimitError } from "./rate-limit";

let db: Db;

async function freshDatabase(): Promise<void> {
  db = await openTestDatabase();
  setDatabase(db);
}

test("consumeRateLimit allows requests inside the window and blocks beyond the limit", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  for (let i = 0; i < 3; i += 1) {
    const result = await consumeRateLimit("login:someone@example.com", { limit: 3 }, db);
    assert.equal(result.allowed, true);
  }

  const blocked = await consumeRateLimit("login:someone@example.com", { limit: 3 }, db);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("different keys are counted independently", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await consumeRateLimit("a", { limit: 1 }, db);
  assert.equal((await consumeRateLimit("b", { limit: 1 }, db)).allowed, true);
  assert.equal((await consumeRateLimit("a", { limit: 1 }, db)).allowed, false);
});

test("pruneRateLimits removes stale windows", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await consumeRateLimit("k", { limit: 5 }, db);
  await db.run("UPDATE rate_limits SET window_start = ?", [0]);
  await pruneRateLimits(db);

  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM rate_limits"))?.count, 0);
});

test("rateLimitError renders a hint only when denied", async () => {
  assert.equal(await rateLimitError(true, 0), null);
  const denied = await rateLimitError(false, 5_000);
  assert.ok(denied);
  assert.equal(denied.status, "rate_limited");
  assert.match(denied.error, /5 seconds/);
});