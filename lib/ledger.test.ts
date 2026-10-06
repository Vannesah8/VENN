import test from "node:test";
import assert from "node:assert/strict";

import { openDatabase, setDatabase, type Db } from "./db";
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
  db = await openDatabase(":memory:");
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

test("a negative account balance is possible", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await ensureLedgerAccount("wallet", "user_2", db);
  await moveLedgerFunds("wallet", "user_2", "escrow", "txn_2", 10_000, "escrow_deposit", "txn_2", "No funds", db);

  assert.equal(await getLedgerBalance("wallet", "user_2", db), -10_000);
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