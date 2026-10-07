import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "./auth";
import { openDatabase, setDatabase, type Db } from "./db";
import type { EscrowTransaction } from "./escrow";
import {
  enqueueTransitionNotifications,
  listNotifications,
  processNotifications,
} from "./notifications";
import { createUser } from "./transactions";

let db: Db;

function fundedTransaction(buyerId: string, sellerId: string): EscrowTransaction {
  return {
    id: "txn_1",
    buyerId,
    sellerId,
    carrierId: null,
    itemName: "Vintage camera lens",
    amountCents: 124_000,
    currency: "KES",
    status: "escrow_funded",
    trackingNumber: null,
    carrierName: null,
    origin: null,
    destination: null,
    disputeReason: null,
    disputeFromStatus: null,
    resolution: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function freshDatabase(): Promise<void> {
  db = await openDatabase(":memory:");
  setDatabase(db);

  await createUser({
    id: "buyer_1",
    displayName: "Aisha Mwangi",
    role: "buyer",
    email: "buyer@test.dev",
    passwordHash: hashPassword("test-password"),
    phone: "+254712000001",
    lang: "en",
    currency: "KES",
  }, db);

  await createUser({
    id: "seller_1",
    displayName: "Keisha Trading Co.",
    role: "seller",
    email: "seller@test.dev",
    passwordHash: hashPassword("test-password"),
    phone: "+254712000003",
    lang: "sw",
    currency: "KES",
  }, db);
}

test("transition notifications enqueue then drain into language-correct rows", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const transaction = fundedTransaction("buyer_1", "seller_1");
  await enqueueTransitionNotifications(transaction, "created", db);

  const result = await processNotifications(db);
  assert.equal(result.processed, 2);
  assert.equal(result.succeeded, 2);

  const buyerRows = await db.all<{ title: string; body: string }>(
    "SELECT title, body FROM notifications WHERE user_id = 'buyer_1'",
  );
  const sellerRows = await db.all<{ title: string; body: string }>(
    "SELECT title, body FROM notifications WHERE user_id = 'seller_1'",
  );

  assert.equal(buyerRows.length, 1);
  assert.equal(buyerRows[0].title, "Escrow funded");
  assert.match(sellerRows[0].body, /Keisha Trading Co\./);
  assert.equal(sellerRows.length, 1);
  assert.match(sellerRows[0].title, /Dhamana imewekwa/);
});

test("escrow release pings only the seller", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const transaction = { ...fundedTransaction("buyer_1", "seller_1"), status: "released" as const };
  await enqueueTransitionNotifications(transaction, "release_funds", db);
  const result = await processNotifications(db);

  assert.equal(result.processed, 1);

  const buyerRows = await db.all("SELECT id FROM notifications WHERE user_id = 'buyer_1'");
  const sellerRows = await db.all("SELECT id FROM notifications WHERE user_id = 'seller_1'");
  assert.equal(buyerRows.length, 0);
  assert.equal(sellerRows.length, 1);
});

test("listNotifications returns the newest first", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const transaction = fundedTransaction("buyer_1", "seller_1");
  await enqueueTransitionNotifications(transaction, "created", db);
  await enqueueTransitionNotifications(transaction, "created", db);
  await processNotifications(db);

  const rows = await db.all<{ id: number }>(
    "SELECT id FROM notifications WHERE user_id = 'buyer_1' ORDER BY id",
  );
  const listed = await listNotifications("buyer_1", db);
  assert.equal(listed.length, 2);
  assert.equal(listed[0].id, rows[1].id);
  assert.equal(listed[1].id, rows[0].id);
});