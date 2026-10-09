import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "./auth";
import { setDatabase, type Db } from "./db";
import { openTestDatabase } from "./db/test-support";
import type { EscrowActor } from "./escrow";
import {
  createSessionRecord,
  deleteSessionByToken,
  getUserBySessionToken,
} from "./session";
import { createUser } from "./transactions";

const BUYER: EscrowActor = { id: "buyer_1", displayName: "Aisha Mwangi", role: "buyer" };

let db: Db;

async function freshDatabase(): Promise<void> {
  db = await openTestDatabase();
  setDatabase(db);

  await createUser(
    {
      id: BUYER.id,
      displayName: BUYER.displayName,
      role: BUYER.role,
      email: "aisha@test.dev",
      passwordHash: hashPassword("test-password"),
    },
    db,
  );
}

test("a session record resolves to the actor and can be deleted", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { token } = await createSessionRecord(BUYER.id, db);

  assert.deepEqual(await getUserBySessionToken(token, db), BUYER);

  await deleteSessionByToken(token, db);
  assert.equal(await getUserBySessionToken(token, db), null);
});

test("an unknown token resolves to no actor", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  assert.equal(await getUserBySessionToken("deadbeef", db), null);
});

test("an expired session is rejected and pruned", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { token } = await createSessionRecord(BUYER.id, db);

  await db.run("UPDATE sessions SET expires_at = ?", [new Date(0).toISOString()]);

  assert.equal(await getUserBySessionToken(token, db), null);
  assert.equal(
    (await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM sessions"))?.count ?? 0,
    0,
  );
});