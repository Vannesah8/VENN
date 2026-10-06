import {
  applyEscrowAction,
  createEscrowTransaction,
  type CreateTransactionInput,
  type EscrowActionPayload,
  type EscrowActor,
  type EscrowErrorCode,
  type EscrowEvent,
  type EscrowRole,
  type EscrowStatus,
  type EscrowTransaction,
  EscrowError,
  fundsHeld,
  resolveParty,
} from "@/lib/escrow";
import { getDatabase, type DbLike } from "@/lib/db";
import {
  depositToWallet,
  getLedgerBalance,
  listLedgerEntriesForAccount,
  listLedgerEntriesForReference,
  moveLedgerFunds,
  walletAccountId,
  type LedgerEntryView,
} from "@/lib/ledger";
import { enqueueTransitionNotifications } from "@/lib/notifications";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LANG,
  type Currency,
  type Lang,
} from "@/lib/i18n";

export interface User {
  id: string;
  displayName: string;
  role: EscrowRole;
  email: string | null;
  passwordHash: string | null;
  phone: string | null;
  lang: Lang;
  currency: Currency;
}

export interface TransactionView extends EscrowTransaction {
  buyerName: string;
  sellerName: string;
  carrierUserName: string | null;
}

interface TransactionRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  carrier_id: string | null;
  item_name: string;
  amount_cents: number;
  status: EscrowStatus;
  tracking_number: string | null;
  carrier_name: string | null;
  origin: string | null;
  destination: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
  buyer_name?: string;
  seller_name?: string;
  carrier_user_name?: string | null;
}

interface EventRow {
  id: number;
  transaction_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: EscrowRole;
  action: EscrowEvent["action"];
  from_status: EscrowStatus | null;
  to_status: EscrowStatus;
  note: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  display_name: string;
  role: EscrowRole;
  email: string | null;
  password_hash: string | null;
  phone: string | null;
  lang: string;
  currency: string;
}

export interface TransactionPage {
  transactions: TransactionView[];
  nextCursor: string | null;
}

const TRANSACTION_COLUMNS = `
  t.id, t.buyer_id, t.seller_id, t.carrier_id, t.item_name, t.amount_cents, t.status,
  t.tracking_number, t.carrier_name, t.origin, t.destination, t.dispute_reason,
  t.created_at, t.updated_at
`;

const TRANSACTION_VIEW_JOINS = `
  LEFT JOIN users buyer ON buyer.id = t.buyer_id
  LEFT JOIN users seller ON seller.id = t.seller_id
  LEFT JOIN users carrier_user ON carrier_user.id = t.carrier_id
`;

function toUser(row: UserRow): User {
  const isLang = (value: unknown): value is Lang =>
    value === "en" || value === "sw";
  const isCurrency = (value: unknown): value is Currency =>
    value === "KES" || value === "TZS" || value === "UGX";

  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    lang: isLang(row.lang) ? row.lang : DEFAULT_LANG,
    currency: isCurrency(row.currency) ? row.currency : DEFAULT_CURRENCY,
  };
}

function toTransaction(row: TransactionRow): EscrowTransaction {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    carrierId: row.carrier_id,
    itemName: row.item_name,
    amountCents: row.amount_cents,
    status: row.status,
    trackingNumber: row.tracking_number,
    carrierName: row.carrier_name,
    origin: row.origin,
    destination: row.destination,
    disputeReason: row.dispute_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toTransactionView(row: TransactionRow): TransactionView {
  return {
    ...toTransaction(row),
    buyerName: row.buyer_name ?? "Unknown buyer",
    sellerName: row.seller_name ?? "Unknown seller",
    carrierUserName: row.carrier_user_name ?? null,
  };
}

function toEvent(row: EventRow): EscrowEvent {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    createdAt: new Date(row.created_at),
  };
}

export async function getUser(
  id: string,
  db: DbLike = getDatabase(),
): Promise<User | null> {
  const d = await db;
  const row = await d.get<UserRow>(
    "SELECT id, display_name, role, email, password_hash, phone, lang, currency FROM users WHERE id = ?",
    [id],
  );

  return row ? toUser(row) : null;
}

export async function getUserByEmail(
  email: string,
  db: DbLike = getDatabase(),
): Promise<User | null> {
  const d = await db;
  const row = await d.get<UserRow>(
    "SELECT id, display_name, role, email, password_hash, phone, lang, currency FROM users WHERE email = ?",
    [email.toLowerCase()],
  );

  return row ? toUser(row) : null;
}

export async function getUserByPhone(
  phone: string,
  db: DbLike = getDatabase(),
): Promise<User | null> {
  const d = await db;
  const row = await d.get<UserRow>(
    "SELECT id, display_name, role, email, password_hash, phone, lang, currency FROM users WHERE phone = ?",
    [phone],
  );

  return row ? toUser(row) : null;
}

export async function listUsers(db: DbLike = getDatabase()): Promise<User[]> {
  const d = await db;
  const rows = await d.all<UserRow>(
    "SELECT id, display_name, role, email, password_hash, phone, lang, currency FROM users ORDER BY role, display_name",
  );

  return rows.map(toUser);
}

export function createUserId(): string {
  return `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function createUser(
  input: {
    id: string;
    displayName: string;
    role: EscrowRole;
    email: string;
    passwordHash: string | null;
    phone?: string | null;
    lang?: Lang;
    currency?: Currency;
  },
  db: DbLike = getDatabase(),
): Promise<User> {
  const d = await db;
  const phone = input.phone ?? null;
  const lang = input.lang ?? DEFAULT_LANG;
  const currency = input.currency ?? DEFAULT_CURRENCY;

  await d.run(
    `INSERT INTO users (id, display_name, role, email, password_hash, phone, lang, currency, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       role = excluded.role,
       email = excluded.email,
       password_hash = excluded.password_hash,
       phone = excluded.phone,
       lang = excluded.lang,
       currency = excluded.currency`,
    [
      input.id,
      input.displayName,
      input.role,
      input.email,
      input.passwordHash,
      phone,
      lang,
      currency,
      new Date().toISOString(),
    ],
  );

  return {
    id: input.id,
    displayName: input.displayName,
    role: input.role,
    email: input.email,
    passwordHash: input.passwordHash,
    phone,
    lang,
    currency,
  };
}

export async function updateUserPrefs(
  userId: string,
  prefs: { lang: Lang; currency: Currency },
  db: DbLike = getDatabase(),
): Promise<void> {
  const d = await db;
  await d.run("UPDATE users SET lang = ?, currency = ? WHERE id = ?", [
    prefs.lang,
    prefs.currency,
    userId,
  ]);
}

export async function getTransactionById(
  id: string,
  db: DbLike = getDatabase(),
): Promise<EscrowTransaction | null> {
  const d = await db;
  const row = await d.get<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS} FROM transactions t WHERE t.id = ?`,
    [id],
  );

  return row ? toTransaction(row) : null;
}

export async function getTransactionViewById(
  id: string,
  db: DbLike = getDatabase(),
): Promise<TransactionView | null> {
  const d = await db;
  const row = await d.get<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
     FROM transactions t
     ${TRANSACTION_VIEW_JOINS}
     WHERE t.id = ?`,
    [id],
  );

  return row ? toTransactionView(row) : null;
}

export async function listTransactionsForActor(
  actor: EscrowActor,
  db: DbLike = getDatabase(),
): Promise<TransactionView[]> {
  const d = await db;

  if (actor.role === "mediator") {
    return listAllTransactions(d);
  }

  const rows = await d.all<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
     FROM transactions t
     ${TRANSACTION_VIEW_JOINS}
     WHERE t.buyer_id = ? OR t.seller_id = ? OR t.carrier_id = ?
     ORDER BY t.updated_at DESC`,
    [actor.id, actor.id, actor.id],
  );

  return rows.map(toTransactionView);
}

/**
 * Keyset-paginated listing, ordered by (updated_at, id) so the cursor is
 * unambiguous when several rows share an update timestamp.
 */
export async function pageTransactionsForActor(
  actor: EscrowActor,
  options: { cursor?: string | null; limit?: number } = {},
  db: DbLike = getDatabase(),
): Promise<TransactionPage> {
  const d = await db;
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ?? null;

  type Row = { updated_at: string; id: string };
  let cursorFrom: Row | null = null;

  if (cursor !== null) {
    const separator = cursor.lastIndexOf("__");
    cursorFrom = {
      updated_at: cursor.slice(0, separator),
      id: cursor.slice(separator + 2),
    };
  }

  const isMediator = actor.role === "mediator";
  const params: unknown[] = isMediator
    ? []
    : [actor.id, actor.id, actor.id];

  let cursorClause = "";
  if (cursorFrom) {
    cursorClause = "AND (t.updated_at < ? OR (t.updated_at = ? AND t.id < ?))";
    params.push(cursorFrom.updated_at, cursorFrom.updated_at, cursorFrom.id);
  }

  params.push(limit + 1);

  const rows = isMediator
    ? await d.all<TransactionRow>(
        `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
         FROM transactions t
         ${TRANSACTION_VIEW_JOINS}
         WHERE 1 = 1 ${cursorClause}
         ORDER BY t.updated_at DESC, t.id DESC
         LIMIT ?`,
        params,
      )
    : await d.all<TransactionRow>(
        `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
         FROM transactions t
         ${TRANSACTION_VIEW_JOINS}
         WHERE (t.buyer_id = ? OR t.seller_id = ? OR t.carrier_id = ?) ${cursorClause}
         ORDER BY t.updated_at DESC, t.id DESC
         LIMIT ?`,
        params,
      );

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? `${last.updated_at}__${last.id}` : null;

  return { transactions: page.map(toTransactionView), nextCursor };
}

export async function listAllTransactions(
  db: DbLike = getDatabase(),
): Promise<TransactionView[]> {
  const d = await db;
  const rows = await d.all<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
     FROM transactions t
     ${TRANSACTION_VIEW_JOINS}
     ORDER BY t.updated_at DESC`,
  );

  return rows.map(toTransactionView);
}

export async function listEscrowEvents(
  transactionId: string,
  db: DbLike = getDatabase(),
): Promise<EscrowEvent[]> {
  const d = await db;
  const rows = await d.all<EventRow>(
    "SELECT id, transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at FROM escrow_events WHERE transaction_id = ? ORDER BY id ASC",
    [transactionId],
  );

  return rows.map(toEvent);
}

export async function createTransaction(
  input: CreateTransactionInput,
  actor: EscrowActor,
  db: DbLike = getDatabase(),
): Promise<EscrowTransaction> {
  const d = await db;

  if (actor.role !== "buyer" && actor.role !== "mediator") {
    throw new EscrowError("forbidden", "Only a buyer can open an escrow transaction");
  }

  const buyerId = actor.role === "buyer" ? actor.id : input.buyerId;

  if ((await getUser(input.sellerId, d)) === null) {
    throw new EscrowError("not_found", "Seller account not found");
  }

  if ((await getUser(buyerId, d)) === null) {
    throw new EscrowError("not_found", "Buyer account not found");
  }

  if ((await getLedgerBalance("wallet", buyerId, d)) < input.amountCents) {
    throw new EscrowError(
      "insufficient_funds",
      "The buyer wallet does not hold enough to fund this escrow",
    );
  }

  const transaction = createEscrowTransaction({ ...input, buyerId });
  const now = new Date().toISOString();

  await d.tx(async () => {
    await d.run(
      `INSERT INTO transactions (
         id, buyer_id, seller_id, carrier_id, item_name, amount_cents, status,
         tracking_number, carrier_name, origin, destination, dispute_reason, created_at, updated_at
       ) VALUES (
         ?, ?, ?, NULL, ?, ?, ?,
         NULL, NULL, NULL, NULL, NULL, ?, ?
       )`,
      [
        transaction.id,
        transaction.buyerId,
        transaction.sellerId,
        transaction.itemName,
        transaction.amountCents,
        transaction.status,
        now,
        now,
      ],
    );

    await d.run(
      `INSERT INTO escrow_events (
         transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at
       ) VALUES (?, ?, ?, ?, 'created', NULL, ?, NULL, ?)`,
      [
        transaction.id,
        actor.id,
        actor.displayName,
        actor.role,
        transaction.status,
        now,
      ],
    );

    await moveLedgerFunds(
      "wallet",
      buyerId,
      "escrow",
      transaction.id,
      transaction.amountCents,
      "escrow_deposit",
      transaction.id,
      `${transaction.itemName} placed in escrow`,
      d,
    );

    await enqueueTransitionNotifications(transaction, "created", d);
  });

  return transaction;
}

export async function applyActionToTransaction(
  id: string,
  actor: EscrowActor,
  payload: EscrowActionPayload,
  db: DbLike = getDatabase(),
): Promise<EscrowTransaction> {
  const d = await db;

  return d.tx(async () => {
    const current = await getTransactionById(id, d);

    if (!current) {
      throw new EscrowError("not_found", "Transaction not found");
    }

    const updated = applyEscrowAction(current, actor, payload);
    const now = new Date().toISOString();

    await d.run(
      `UPDATE transactions
       SET status = ?,
           carrier_id = ?,
           tracking_number = ?,
           carrier_name = ?,
           origin = ?,
           destination = ?,
           dispute_reason = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        updated.status,
        updated.carrierId,
        updated.trackingNumber,
        updated.carrierName,
        updated.origin,
        updated.destination,
        updated.disputeReason,
        now,
        updated.id,
      ],
    );

    const note = payload.action === "dispatch" ? null : (payload.input?.note ?? null);

    await d.run(
      `INSERT INTO escrow_events (
         transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        updated.id,
        actor.id,
        actor.displayName,
        actor.role,
        payload.action,
        current.status,
        updated.status,
        note,
        now,
      ],
    );

    if (current.status === "delivered" && updated.status === "released") {
      await moveLedgerFunds(
        "escrow",
        id,
        "wallet",
        current.sellerId,
        current.amountCents,
        "escrow_release",
        id,
        `${current.itemName} escrow released to seller`,
        d,
      );
    }

    await enqueueTransitionNotifications(updated, payload.action, d);

    return updated;
  });
}

export interface PortfolioStats {
  totalCents: number;
  heldCents: number;
  releasedCents: number;
  inFlightCount: number;
  deliveredCount: number;
  disputedCount: number;
  releasedCount: number;
}

export function getPortfolioStats(transactions: EscrowTransaction[]): PortfolioStats {
  const stats: PortfolioStats = {
    totalCents: 0,
    heldCents: 0,
    releasedCents: 0,
    inFlightCount: 0,
    deliveredCount: 0,
    disputedCount: 0,
    releasedCount: 0,
  };

  for (const transaction of transactions) {
    stats.totalCents += transaction.amountCents;

    if (fundsHeld(transaction.status)) {
      stats.heldCents += transaction.amountCents;
    }

    if (transaction.status === "in_transit" || transaction.status === "shipped") {
      stats.inFlightCount += 1;
    }

    if (transaction.status === "delivered") {
      stats.deliveredCount += 1;
    }

    if (transaction.status === "disputed") {
      stats.disputedCount += 1;
    }

    if (transaction.status === "released") {
      stats.releasedCents += transaction.amountCents;
      stats.releasedCount += 1;
    }
  }

  return stats;
}

export async function getWalletBalance(
  userId: string,
  db: DbLike = getDatabase(),
): Promise<number> {
  return getLedgerBalance("wallet", userId, db);
}

export async function listWalletEntries(
  userId: string,
  db: DbLike = getDatabase(),
): Promise<LedgerEntryView[]> {
  return listLedgerEntriesForAccount(walletAccountId(userId), db);
}

export async function getEscrowLedgerEntries(
  transactionId: string,
  db: DbLike = getDatabase(),
): Promise<LedgerEntryView[]> {
  return listLedgerEntriesForReference(transactionId, db);
}

export async function getEscrowAccountBalance(
  transactionId: string,
  db: DbLike = getDatabase(),
): Promise<number> {
  return getLedgerBalance("escrow", transactionId, db);
}

export async function depositWalletFunds(
  userId: string,
  amountCents: number,
  note: string,
  db: DbLike = getDatabase(),
): Promise<void> {
  await depositToWallet(userId, amountCents, note, db);
}

export { walletAccountId };

export function getEscrowErrorStatus(code: EscrowErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "insufficient_funds":
    case "invalid_input":
    case "unknown_action":
    case "tracking_required":
      return 400;
    case "illegal_transition":
      return 409;
    default:
      return 400;
  }
}

export { resolveParty };