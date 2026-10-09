import { getDatabase, type Db, type DbLike } from "@/lib/db";
import { assertAmountCents, EscrowError } from "@/lib/escrow";
import { convertCents } from "@/lib/fx";
import { DEFAULT_CURRENCY, isCurrency, type Currency } from "@/lib/i18n";

export type LedgerAccountKind = "wallet" | "escrow";

export type LedgerEntryType =
  | "deposit"
  | "escrow_deposit"
  | "escrow_release"
  | "withdrawal"
  | "escrow_refund";

export interface LedgerBalance {
  cents: number;
  currency: Currency;
}

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

/** Liquidity account that absorbs the difference when two legs settle in different currencies. */
export function fxHouseAccountId(currency: Currency): string {
  return walletAccountId(`fx_house_${currency}`);
}

export function asCurrency(value: unknown, fallback: Currency = DEFAULT_CURRENCY): Currency {
  return isCurrency(value) ? value : fallback;
}

export async function ensureLedgerAccount(
  kind: LedgerAccountKind,
  ownerId: string,
  db: DbLike = getDatabase(),
  currency: Currency = DEFAULT_CURRENCY,
): Promise<string> {
  const d = await db;
  const id = kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId);

  await d.run(
    "INSERT INTO ledger_accounts (id, kind, owner_id, currency, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
    [id, kind, ownerId, currency, new Date().toISOString()],
  );

  return id;
}

/**
 * Currency an account is denominated in: whatever the row already carries, so
 * a wallet keeps its money's identity even when the owner flips the display
 * currency in the session bar.
 */
export async function getAccountCurrency(
  kind: LedgerAccountKind,
  ownerId: string,
  db: DbLike = getDatabase(),
  fallback: Currency = DEFAULT_CURRENCY,
): Promise<Currency> {
  const d = await db;
  const id = kind === "wallet" ? walletAccountId(ownerId) : escrowAccountId(ownerId);
  const row = await d.get<{ currency: string }>(
    "SELECT currency FROM ledger_accounts WHERE id = ?",
    [id],
  );

  return row ? asCurrency(row.currency, fallback) : fallback;
}

/** A wallet adopts its owner's display currency the first time it is funded. */
export async function resolveWalletCurrency(
  userId: string,
  db: DbLike = getDatabase(),
): Promise<Currency> {
  const d = await db;
  const existing = await getAccountCurrency("wallet", userId, d, DEFAULT_CURRENCY);
  const hasAccount = await d.get<{ id: string }>(
    "SELECT id FROM ledger_accounts WHERE id = ?",
    [walletAccountId(userId)],
  );

  if (hasAccount) {
    return existing;
  }

  const user = await d.get<{ currency: string }>(
    "SELECT currency FROM users WHERE id = ?",
    [userId],
  );

  return user ? asCurrency(user.currency, DEFAULT_CURRENCY) : DEFAULT_CURRENCY;
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

export async function getLedgerBalanceIn(
  kind: LedgerAccountKind,
  ownerId: string,
  db: DbLike = getDatabase(),
): Promise<LedgerBalance> {
  const [cents, currency] = await Promise.all([
    getLedgerBalance(kind, ownerId, db),
    getAccountCurrency(kind, ownerId, db),
  ]);

  return { cents, currency };
}

const FX_HOUSE_PREFIX = "wallet_fx_house_";

/** The FX house accounts are the system's balancing sink and may run negative. */
function isSystemAccount(accountId: string): boolean {
  return accountId.startsWith(FX_HOUSE_PREFIX);
}

/**
 * Appends one leg and maintains the account's snapshot. A debit (negative
 * delta) on a real wallet or escrow account is applied with a conditional
 * update that requires the balance to cover it, so two concurrent debits can
 * never drive an account negative: the loser of the race matches zero rows and
 * the whole transaction is rejected. The check lives in the same statement as
 * the decrement, which makes it atomic under both SQLite and Postgres.
 */
async function insertEntry(
  accountId: string,
  deltaCents: number,
  entryType: LedgerEntryType,
  referenceId: string | null,
  note: string | null,
  db: Db,
  now: string,
): Promise<void> {
  if (deltaCents < 0 && !isSystemAccount(accountId)) {
    const required = -deltaCents;
    const { changes } = await db.run(
      `UPDATE ledger_accounts
       SET balance_snapshot_cents = balance_snapshot_cents - ?
       WHERE id = ? AND balance_snapshot_cents >= ?`,
      [required, accountId, required],
    );

    if (changes === 0) {
      throw new EscrowError(
        "insufficient_funds",
        "The account does not hold enough for this debit",
      );
    }
  } else {
    await db.run(
      "UPDATE ledger_accounts SET balance_snapshot_cents = balance_snapshot_cents + ? WHERE id = ?",
      [deltaCents, accountId],
    );
  }

  await db.run(
    `INSERT INTO ledger_entries (account_id, delta_cents, entry_type, reference_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accountId, deltaCents, entryType, referenceId, note, now],
  );
}

export interface MoveFundsOptions {
  fromCurrency?: Currency;
  toCurrency?: Currency;
}

/**
 * Moves funds between two accounts. When the sides are denominated in
 * different currencies the transfer is converted at the stored FX rate and
 * two balancing legs are written against the FX house account, so the sum of
 * every ledger entry still nets to zero across the system.
 */
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
  options: MoveFundsOptions = {},
): Promise<void> {
  assertAmountCents(amountCents);

  const d = await db;
  const fromCurrency =
    options.fromCurrency ??
    (fromKind === "wallet"
      ? await resolveWalletCurrency(fromOwnerId, d)
      : await getAccountCurrency(fromKind, fromOwnerId, d));
  const toCurrency =
    options.toCurrency ??
    (toKind === "wallet"
      ? await resolveWalletCurrency(toOwnerId, d)
      : await getAccountCurrency(toKind, toOwnerId, d));

  const fromId = await ensureLedgerAccount(fromKind, fromOwnerId, d, fromCurrency);
  const toId = await ensureLedgerAccount(toKind, toOwnerId, d, toCurrency);
  const now = new Date().toISOString();

  await insertEntry(fromId, -amountCents, entryType, referenceId, note, d, now);

  if (fromCurrency === toCurrency) {
    await insertEntry(toId, amountCents, entryType, referenceId, note, d, now);
    return;
  }

  const converted = await convertCents(amountCents, fromCurrency, toCurrency, d);
  assertAmountCents(converted);

  await insertEntry(toId, converted, entryType, referenceId, note, d, now);

  const houseFrom = await ensureLedgerAccount("wallet", `fx_house_${fromCurrency}`, d, fromCurrency);
  const houseTo = await ensureLedgerAccount("wallet", `fx_house_${toCurrency}`, d, toCurrency);

  await insertEntry(
    houseFrom,
    amountCents,
    entryType,
    referenceId,
    `FX cover ${fromCurrency} → ${toCurrency}`,
    d,
    now,
  );
  await insertEntry(
    houseTo,
    -converted,
    entryType,
    referenceId,
    `FX cover ${fromCurrency} → ${toCurrency}`,
    d,
    now,
  );
}

export async function depositToWallet(
  userId: string,
  amountCents: number,
  note: string,
  db: DbLike = getDatabase(),
  currency?: Currency,
): Promise<void> {
  assertAmountCents(amountCents);

  const d = await db;
  const walletCurrency = currency ?? (await resolveWalletCurrency(userId, d));

  await d.tx(async () => {
    const accountId = await ensureLedgerAccount("wallet", userId, d, walletCurrency);
    await insertEntry(accountId, amountCents, "deposit", null, note, d, new Date().toISOString());
  });
}

/**
 * Debits a wallet for a payout. The caller settles the external rail; this
 * only takes the money out of the balance so it cannot be spent twice.
 */
export async function withdrawFromWallet(
  userId: string,
  amountCents: number,
  note: string,
  db: DbLike = getDatabase(),
  referenceId: string | null = null,
  currency?: Currency,
): Promise<Currency> {
  assertAmountCents(amountCents);

  const d = await db;
  const walletCurrency = currency ?? (await resolveWalletCurrency(userId, d));
  const accountId = walletAccountId(userId);
  const balance = await getLedgerBalance("wallet", userId, d);

  if (balance < amountCents) {
    throw new EscrowError("insufficient_funds", "The wallet does not hold enough for this payout");
  }

  await d.tx(async () => {
    await ensureLedgerAccount("wallet", userId, d, walletCurrency);
    await insertEntry(
      accountId,
      -amountCents,
      "withdrawal",
      referenceId,
      note,
      d,
      new Date().toISOString(),
    );
  });

  return walletCurrency;
}

/** Returns a failed payout to the wallet, auditable as its own entry. */
export async function refundWithdrawal(
  userId: string,
  amountCents: number,
  note: string,
  db: DbLike = getDatabase(),
  referenceId: string | null = null,
): Promise<void> {
  assertAmountCents(amountCents);

  const d = await db;
  const walletCurrency = await getAccountCurrency("wallet", userId, d);

  await d.tx(async () => {
    await ensureLedgerAccount("wallet", userId, d, walletCurrency);
    await insertEntry(
      walletAccountId(userId),
      amountCents,
      "deposit",
      referenceId,
      note,
      d,
      new Date().toISOString(),
    );
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