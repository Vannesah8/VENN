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

function freshDatabase(): void {
  db = openDatabase(":memory:");
  setDatabase(db);
}

test("deposit credits a wallet", (t) => {
  freshDatabase();
  t.after(() => db.close());

  depositToWallet("user_1", 50_000, "Top-up", db);

  assert.equal(getLedgerBalance("wallet", "user_1", db), 50_000);

  const entries = listLedgerEntriesForAccount("wallet_user_1", db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].deltaCents, 50_000);
  assert.equal(entries[0].entryType, "deposit");
});

test("an account with no entries has a zero balance", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assert.equal(getLedgerBalance("wallet", "user_whatever", db), 0);
});

test("moveLedgerFunds writes a balanced double entry", (t) => {
  freshDatabase();
  t.after(() => db.close());

  depositToWallet("user_1", 100_000, "Top-up", db);
  moveLedgerFunds("wallet", "user_1", "escrow", "txn_1", 40_000, "escrow_deposit", "txn_1", "In escrow", db);

  assert.equal(getLedgerBalance("wallet", "user_1", db), 60_000);
  assert.equal(getLedgerBalance("escrow", "txn_1", db), 40_000);

  const entries = listLedgerEntriesForReference("txn_1", db);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].deltaCents, -40_000);
  assert.equal(entries[1].deltaCents, 40_000);
});

test("a negative account balance is possible", (t) => {
  freshDatabase();
  t.after(() => db.close());

  ensureLedgerAccount("wallet", "user_2", db);
  moveLedgerFunds("wallet", "user_2", "escrow", "txn_2", 10_000, "escrow_deposit", "txn_2", "No funds", db);

  assert.equal(getLedgerBalance("wallet", "user_2", db), -10_000);
});

test("deposit rejects invalid amounts", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assert.throws(
    () => depositToWallet("user_1", 0, "Top-up", db),
    (error: unknown) => error instanceof EscrowError && error.code === "invalid_input",
  );
});