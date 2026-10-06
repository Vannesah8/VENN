import test from "node:test";
import assert from "node:assert/strict";

import { openDatabase, setDatabase, type Db } from "./db";
import { enqueueOutbox, processOutbox, type OutboxJob } from "./outbox";

let db: Db;

async function freshDatabase(): Promise<void> {
  db = await openDatabase(":memory:");
  setDatabase(db);
}

test("enqueueOutbox stages a job that later drains through processOutbox", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await enqueueOutbox("notification", { toUserId: "u1", key: "k" }, db);

  const seen: OutboxJob[] = [];

  const { processed } = await processOutbox(
    async (job) => {
      seen.push(job);
    },
    { limit: 10 },
    db,
  );

  assert.equal(processed, 1);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].topic, "notification");
  assert.deepEqual(seen[0].payload, { toUserId: "u1", key: "k" });
  assert.equal(seen[0].status, "pending");
  assert.equal(seen[0].attempts, 1);

  const rows = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM outbox");
  assert.equal(rows?.count, 1);

  const finalStatus = await db.get<{ status: string }>("SELECT status FROM outbox WHERE id = ?", [
    seen[0].id,
  ]);
  assert.equal(finalStatus?.status, "sent");
});

test("a failing handler marks the job failed and does not retry the same pass", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await enqueueOutbox("notification", { toUserId: "u2" }, db);

  const result = await processOutbox(
    async () => {
      throw new Error("boom");
    },
    { limit: 10 },
    db,
  );

  assert.equal(result.processed, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 1);

  const status = await db.get<{ status: string }>("SELECT status FROM outbox LIMIT 1");
  assert.equal(status?.status, "failed");

  const secondPass = await processOutbox(
    async () => {},
    { limit: 10 },
    db,
  );
  assert.equal(secondPass.processed, 0);
});

test("job payloads survive a JSON round trip", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const payload = { list: [1, 2, 3], nested: { ok: true } };
  await enqueueOutbox("webhook", payload, db);

  let received: unknown;
  await processOutbox(
    async (job) => {
      received = job.payload;
    },
    { limit: 10 },
    db,
  );

  assert.deepEqual(received, payload);
});