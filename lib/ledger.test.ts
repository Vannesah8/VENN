import test from "node:test";
import assert from "node:assert/strict";

import { setDatabase, type Db } from "./db";
import { openTestDatabase } from "./db/test-support";
import { EscrowError } from "./escrow";
import {
  depositToWallet,
  ensureLedgerAccount,
  getLedgerBalance,
  listLedgerEntriesForAccount,
  listLedgerEntriesForReference,
  moveLedgerFunds,
} from "./ledger";

let db: Db;

async function freshDatabase(): Promise<void> {
  db = await openTestDatabase();
  setDatabase(db);
}

test("deposit credits a wallet", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await depositToWallet("user_1", 50_000, "Top-up", db);

  assert.equal(await getLedgerBalance("wallet", "user_1", db), 50_000);

  const entries = await listLedgerEntriesForAccount("wallet_user_1", db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].deltaCents, 50_000);
  assert.equal(entries[0].entryType, "deposit");
});

test("an account with no entries has a zero balance", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  assert.equal(await getLedgerBalance("wallet", "user_whatever", db), 0);
});

test("moveLedgerFunds writes a balanced double entry", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await depositToWallet("user_1", 100_000, "Top-up", db);
  await moveLedgerFunds("wallet", "user_1", "escrow", "txn_1", 40_000, "escrow_deposit", "txn_1", "In escrow", db);

  assert.equal(await getLedgerBalance("wallet", "user_1", db), 60_000);
  assert.equal(await getLedgerBalance("escrow", "txn_1", db), 40_000);

  const entries = await listLedgerEntriesForReference("txn_1", db);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].deltaCents, -40_000);
  assert.equal(entries[1].deltaCents, 40_000);
});

test("a wallet cannot spend more than it holds", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await ensureLedgerAccount("wallet", "user_2", db);

  await assert.rejects(
    () =>
      moveLedgerFunds(
        "wallet",
        "user_2",
        "escrow",
        "txn_2",
        10_000,
        "escrow_deposit",
        "txn_2",
        "No funds",
        db,
      ),
    (error: unknown) =>
      error instanceof EscrowError && error.code === "insufficient_funds",
  );

  assert.equal(await getLedgerBalance("wallet", "user_2", db), 0);
  assert.equal(await getLedgerBalance("escrow", "txn_2", db), 0);
});

test("an escrow account cannot pay out more than it holds", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await depositToWallet("user_1", 10_000, "Top-up", db);
  await moveLedgerFunds("wallet", "user_1", "escrow", "txn_3", 5_000, "escrow_deposit", "txn_3", "In escrow", db);

  await assert.rejects(
    () =>
      moveLedgerFunds("escrow", "txn_3", "wallet", "user_1", 9_000, "escrow_release", "txn_3", "Overpay", db),
    (error: unknown) =>
      error instanceof EscrowError && error.code === "insufficient_funds",
  );

  assert.equal(await getLedgerBalance("escrow", "txn_3", db), 5_000);
});

test("deposit rejects invalid amounts", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await assert.rejects(
    () => depositToWallet("user_1", 0, "Top-up", db),
    (error: unknown) =>
      error instanceof EscrowError && error.code === "invalid_input",
  );
});