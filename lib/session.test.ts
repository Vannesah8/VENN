import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "./auth";
import { openDatabase, setDatabase, type Db } from "./db";
import type { EscrowActor } from "./escrow";
import {
  createSessionRecord,
  deleteSessionByToken,
  getUserBySessionToken,
} from "./session";
import { createUser } from "./transactions";

const BUYER: EscrowActor = { id: "buyer_1", displayName: "Aisha Mwangi", role: "buyer" };

let db: Db;

function freshDatabase(): void {
  db = openDatabase(":memory:");
  setDatabase(db);

  createUser(
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

test("a session record resolves to the actor and can be deleted", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { token } = createSessionRecord(BUYER.id, db);

  assert.deepEqual(getUserBySessionToken(token, db), BUYER);

  deleteSessionByToken(token, db);
  assert.equal(getUserBySessionToken(token, db), null);
});

test("an unknown token resolves to no actor", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assert.equal(getUserBySessionToken("deadbeef", db), null);
});

test("an expired session is rejected and pruned", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { token } = createSessionRecord(BUYER.id, db);

  db.prepare("UPDATE sessions SET expires_at = ?").run(new Date(0).toISOString());

  assert.equal(getUserBySessionToken(token, db), null);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count,
    0,
  );
});