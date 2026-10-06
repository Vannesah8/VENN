import { getDatabase, type Db } from "@/lib/db";
import { assertAmountCents } from "@/lib/escrow";

export type LedgerAccountKind = "wallet" | "escrow";

export type LedgerEntryType = "deposit" | "escrow_deposit" | "escrow_release";

export interface LedgerEntryView {
  id: number;
  accountId: string;
  accountKind: LedgerAccountKind;
  deltaCents: number;
  entryType: LedgerEntryType;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
}

interface EntryRow {
  id: number;
  account_id: string;
  delta_cents: number;
  entry_type: LedgerEntryType;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export function walletAccountId(ownerId: string): string {
  return `wallet_${ownerId}`;
}

export function escrowAccountId(transactionId: string): string {
  return `escrow_${transactionId}`;
}

export function ensureLedgerAccount(
  kind: LedgerAccountKind,
  ownerId: string,
  db: Db = getDatabase(),
): string {
  const id = kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId);

  db.prepare(
    "INSERT OR IGNORE INTO ledger_accounts (id, kind, owner_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, kind, ownerId, new Date().toISOString());

  return id;
}

export function getLedgerBalance(
  kind: LedgerAccountKind,
  ownerId: string,
  db: Db = getDatabase(),
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(delta_cents), 0) AS balance
       FROM ledger_entries
       WHERE account_id = ?`,
    )
    .get(kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId)) as {
    balance: number;
  };

  return row.balance;
}

function insertEntry(
  accountId: string,
  deltaCents: number,
  entryType: LedgerEntryType,
  referenceId: string | null,
  note: string | null,
  db: Db,
  now: string,
): void {
  db.prepare(
    `INSERT INTO ledger_entries (account_id, delta_cents, entry_type, reference_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(accountId, deltaCents, entryType, referenceId, note, now);
}

export function moveLedgerFunds(
  fromKind: LedgerAccountKind,
  fromOwnerId: string,
  toKind: LedgerAccountKind,
  toOwnerId: string,
  amountCents: number,
  entryType: LedgerEntryType,
  referenceId: string,
  note: string,
  db: Db = getDatabase(),
): void {
  assertAmountCents(amountCents);

  const fromId = ensureLedgerAccount(fromKind, fromOwnerId, db);
  const toId = ensureLedgerAccount(toKind, toOwnerId, db);
  const now = new Date().toISOString();

  insertEntry(fromId, -amountCents, entryType, referenceId, note, db, now);
  insertEntry(toId, amountCents, entryType, referenceId, note, db, now);
}

export function depositToWallet(
  userId: string,
  amountCents: number,
  note: string,
  db: Db = getDatabase(),
): void {
  assertAmountCents(amountCents);

  const accountId = ensureLedgerAccount("wallet", userId, db);

  db.transaction(() => {
    insertEntry(accountId, amountCents, "deposit", null, note, db, new Date().toISOString());
  })();
}

function toEntryView(row: EntryRow): LedgerEntryView {
  return {
    id: row.id,
    accountId: row.account_id,
    accountKind: row.account_id.startsWith("wallet_") ? "wallet" : "escrow",
    deltaCents: row.delta_cents,
    entryType: row.entry_type,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: new Date(row.created_at),
  };
}

export function listLedgerEntriesForAccount(
  accountId: string,
  db: Db = getDatabase(),
): LedgerEntryView[] {
  const rows = db
    .prepare("SELECT * FROM ledger_entries WHERE account_id = ? ORDER BY id DESC")
    .all(accountId) as EntryRow[];

  return rows.map(toEntryView);
}

export function listLedgerEntriesForReference(
  referenceId: string,
  db: Db = getDatabase(),
): LedgerEntryView[] {
  const rows = db
    .prepare("SELECT * FROM ledger_entries WHERE reference_id = ? ORDER BY id ASC")
    .all(referenceId) as EntryRow[];

  return rows.map(toEntryView);
}