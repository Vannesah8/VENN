import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "./auth";
import { setDatabase, type Db } from "./db";
import { openTestDatabase } from "./db/test-support";
import { EscrowError } from "./escrow";
import { getLedgerBalance, withdrawFromWallet } from "./ledger";
import {
  createPaymentIntent,
  getPaymentIntent,
  listPaymentIntents,
  settlePaymentIntent,
} from "./payments";
import { createUser, depositWalletFunds } from "./transactions";

let db: Db;

async function seedBuyer(): Promise<{ id: string }> {
  await createUser(
    {
      id: "usr_pay",
      displayName: "Pay Tester",
      role: "buyer",
      email: "pay@test.dev",
      passwordHash: hashPassword("test-password"),
      phone: "+254712000001",
    },
    db,
  );
  return { id: "usr_pay" };
}

test("a deposit intent settles completed and credits the wallet", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  const user = await seedBuyer();
  const intent = await createPaymentIntent({ userId: user.id, kind: "deposit", amountCents: 5_000 }, db);

  assert.equal(intent.status, "pending");
  assert.ok(intent.reference.length > 0);

  await depositWalletFunds(user.id, 5_000, `Deposit via ${intent.reference}`, db);
  await settlePaymentIntent(intent.id, { status: "completed" }, db);

  assert.equal(await getLedgerBalance("wallet", user.id, db), 5_000);

  const stored = await getPaymentIntent(intent.id, db);
  assert.equal(stored?.status, "completed");
  assert.equal(stored?.amountCents, 5_000);

  const list = await listPaymentIntents(user.id, db);
  assert.equal(list.length, 1);
});

test("a withdrawal debits the wallet against the intent", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  const user = await seedBuyer();
  await depositWalletFunds(user.id, 10_000, "top-up", db);

  const intent = await createPaymentIntent(
    { userId: user.id, kind: "withdrawal", amountCents: 4_000, phone: "+254712000001" },
    db,
  );
  await withdrawFromWallet(user.id, 4_000, `Withdrawal via ${intent.reference}`, db, intent.id);
  await settlePaymentIntent(intent.id, { status: "completed" }, db);

  assert.equal(await getLedgerBalance("wallet", user.id, db), 6_000);
  assert.equal((await getPaymentIntent(intent.id, db))?.status, "completed");
});

test("a payout over the balance fails the intent and leaves the wallet whole", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  const user = await seedBuyer();
  await depositWalletFunds(user.id, 1_000, "top-up", db);

  const intent = await createPaymentIntent({ userId: user.id, kind: "withdrawal", amountCents: 99_999 }, db);

  await assert.rejects(withdrawFromWallet(user.id, 99_999, "payout"), (error: unknown) => {
    assert.ok(error instanceof EscrowError);
    assert.equal(error.code, "insufficient_funds");
    return true;
  });

  await settlePaymentIntent(intent.id, { status: "failed", detail: "Insufficient funds" }, db);

  assert.equal(await getLedgerBalance("wallet", user.id, db), 1_000);
  assert.equal((await getPaymentIntent(intent.id, db))?.status, "failed");
});

test("an intent cannot settle twice", async (t) => {
  db = await openTestDatabase();
  setDatabase(db);
  t.after(async () => db.close());

  const user = await seedBuyer();
  const intent = await createPaymentIntent({ userId: user.id, kind: "deposit", amountCents: 500 }, db);

  await settlePaymentIntent(intent.id, { status: "completed" }, db);

  await assert.rejects(settlePaymentIntent(intent.id, { status: "failed" }), (error: unknown) => {
    assert.ok(error instanceof EscrowError);
    assert.equal(error.code, "invalid_input");
    return true;
  });
});