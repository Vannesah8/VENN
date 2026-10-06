import { getDatabase, type Db, type DbLike } from "@/lib/db";
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

export interface LedgerPage {
  entries: LedgerEntryView[];
  nextCursor: number | null;
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

export async function ensureLedgerAccount(
  kind: LedgerAccountKind,
  ownerId: string,
  db: DbLike = getDatabase(),
): Promise<string> {
  const d = await db;
  const id = kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId);

  await d.run(
    "INSERT INTO ledger_accounts (id, kind, owner_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    [id, kind, ownerId, new Date().toISOString()],
  );

  return id;
}

export async function getLedgerBalance(
  kind: LedgerAccountKind,
  ownerId: string,
  db: DbLike = getDatabase(),
): Promise<number> {
  const d = await db;
  const accountId = kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId);

  const row = await d.get<{ balance: number | null }>(
    "SELECT balance_snapshot_cents AS balance FROM ledger_accounts WHERE id = ?",
    [accountId],
  );

  return row?.balance ?? 0;
}

async function insertEntry(
  accountId: string,
  deltaCents: number,
  entryType: LedgerEntryType,
  referenceId: string | null,
  note: string | null,
  db: Db,
  now: string,
): Promise<void> {
  await db.run(
    `INSERT INTO ledger_entries (account_id, delta_cents, entry_type, reference_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accountId, deltaCents, entryType, referenceId, note, now],
  );

  await db.run(
    "UPDATE ledger_accounts SET balance_snapshot_cents = balance_snapshot_cents + ? WHERE id = ?",
    [deltaCents, accountId],
  );
}

export async function moveLedgerFunds(
  fromKind: LedgerAccountKind,
  fromOwnerId: string,
  toKind: LedgerAccountKind,
  toOwnerId: string,
  amountCents: number,
  entryType: LedgerEntryType,
  referenceId: string,
  note: string,
  db: DbLike = getDatabase(),
): Promise<void> {
  assertAmountCents(amountCents);

  const d = await db;
  const fromId = await ensureLedgerAccount(fromKind, fromOwnerId, d);
  const toId = await ensureLedgerAccount(toKind, toOwnerId, d);
  const now = new Date().toISOString();

  await insertEntry(fromId, -amountCents, entryType, referenceId, note, d, now);
  await insertEntry(toId, amountCents, entryType, referenceId, note, d, now);
}

export async function depositToWallet(
  userId: string,
  amountCents: number,
  note: string,
  db: DbLike = getDatabase(),
): Promise<void> {
  assertAmountCents(amountCents);

  const d = await db;

  await d.tx(async () => {
    const accountId = await ensureLedgerAccount("wallet", userId, d);
    await insertEntry(accountId, amountCents, "deposit", null, note, d, new Date().toISOString());
  });
}

/**
 * Recomputes every account's snapshot from the append-only entries. Used by
 * the audit trail and tests to prove the denormalized balance matches the
 * ledger, and by migrations that backfill existing databases.
 */
export async function rebalanceAll(db: DbLike = getDatabase()): Promise<number> {
  const d = await db;

  await d.exec(
    `UPDATE ledger_accounts
     SET balance_snapshot_cents = (
       SELECT COALESCE(SUM(delta_cents), 0) FROM ledger_entries WHERE account_id = ledger_accounts.id
     )`,
  );

  return (
    await d.get<{ count: number }>("SELECT COUNT(*) AS count FROM ledger_accounts")
  )?.count ?? 0;
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

export async function listLedgerEntriesForAccount(
  accountId: string,
  db: DbLike = getDatabase(),
): Promise<LedgerEntryView[]> {
  const d = await db;
  const rows = await d.all<EntryRow>(
    "SELECT * FROM ledger_entries WHERE account_id = ? ORDER BY id DESC",
    [accountId],
  );

  return rows.map(toEntryView);
}

export async function listLedgerEntriesForReference(
  referenceId: string,
  db: DbLike = getDatabase(),
): Promise<LedgerEntryView[]> {
  const d = await db;
  const rows = await d.all<EntryRow>(
    "SELECT * FROM ledger_entries WHERE reference_id = ? ORDER BY id ASC",
    [referenceId],
  );

  return rows.map(toEntryView);
}

export async function pageLedgerEntriesForAccount(
  accountId: string,
  options: { cursor?: number | null; limit?: number } = {},
  db: DbLike = getDatabase(),
): Promise<LedgerPage> {
  const d = await db;
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ?? null;

  const params: unknown[] = [accountId];
  let cursorClause = "";

  if (cursor !== null) {
    cursorClause = "AND id < ?";
    params.push(cursor);
  }

  params.push(limit + 1);

  const rows = await d.all<EntryRow>(
    `SELECT * FROM ledger_entries
     WHERE account_id = ? ${cursorClause}
     ORDER BY id DESC
     LIMIT ?`,
    params,
  );

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

  return { entries: page.map(toEntryView), nextCursor };
}