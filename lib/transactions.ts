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
import { getDatabase, type Db } from "@/lib/db";
import {
  depositToWallet,
  getLedgerBalance,
  listLedgerEntriesForAccount,
  listLedgerEntriesForReference,
  moveLedgerFunds,
  walletAccountId,
  type LedgerEntryView,
} from "@/lib/ledger";

export interface User {
  id: string;
  displayName: string;
  role: EscrowRole;
  email: string | null;
  passwordHash: string | null;
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

export function getUser(id: string, db: Db = getDatabase()): User | null {
  const row = db
    .prepare(
      "SELECT id, display_name, role, email, password_hash FROM users WHERE id = ?",
    )
    .get(id) as
    | { id: string; display_name: string; role: EscrowRole; email: string | null; password_hash: string | null }
    | undefined;

  return row
    ? {
        id: row.id,
        displayName: row.display_name,
        role: row.role,
        email: row.email,
        passwordHash: row.password_hash,
      }
    : null;
}

export function getUserByEmail(email: string, db: Db = getDatabase()): User | null {
  const row = db
    .prepare(
      "SELECT id, display_name, role, email, password_hash FROM users WHERE email = ?",
    )
    .get(email) as
    | { id: string; display_name: string; role: EscrowRole; email: string | null; password_hash: string | null }
    | undefined;

  return row
    ? {
        id: row.id,
        displayName: row.display_name,
        role: row.role,
        email: row.email,
        passwordHash: row.password_hash,
      }
    : null;
}

export function listUsers(db: Db = getDatabase()): User[] {
  const rows = db
    .prepare(
      "SELECT id, display_name, role, email, password_hash FROM users ORDER BY role, display_name",
    )
    .all() as Array<{
    id: string;
    display_name: string;
    role: EscrowRole;
    email: string | null;
    password_hash: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    email: row.email,
    passwordHash: row.password_hash,
  }));
}

export function createUserId(): string {
  return `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function createUser(
  input: { id: string; displayName: string; role: EscrowRole; email: string; passwordHash: string },
  db: Db = getDatabase(),
): User {
  db.prepare(
    `INSERT INTO users (id, display_name, role, email, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       role = excluded.role,
       email = excluded.email,
       password_hash = excluded.password_hash`,
  ).run(
    input.id,
    input.displayName,
    input.role,
    input.email,
    input.passwordHash,
    new Date().toISOString(),
  );

  return {
    id: input.id,
    displayName: input.displayName,
    role: input.role,
    email: input.email,
    passwordHash: input.passwordHash,
  };
}

export function getTransactionById(id: string, db: Db = getDatabase()): EscrowTransaction | null {
  const row = db
    .prepare(`SELECT ${TRANSACTION_COLUMNS} FROM transactions t WHERE t.id = ?`)
    .get(id) as TransactionRow | undefined;

  return row ? toTransaction(row) : null;
}

export function getTransactionViewById(
  id: string,
  db: Db = getDatabase(),
): TransactionView | null {
  const row = db
    .prepare(
      `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
       FROM transactions t
       ${TRANSACTION_VIEW_JOINS}
       WHERE t.id = ?`,
    )
    .get(id) as TransactionRow | undefined;

  return row ? toTransactionView(row) : null;
}

export function listTransactionsForActor(
  actor: EscrowActor,
  db: Db = getDatabase(),
): TransactionView[] {
  if (actor.role === "mediator") {
    return listAllTransactions(db);
  }

  const rows = db
    .prepare(
      `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
       FROM transactions t
       ${TRANSACTION_VIEW_JOINS}
       WHERE t.buyer_id = @id OR t.seller_id = @id OR t.carrier_id = @id
       ORDER BY t.updated_at DESC`,
    )
    .all({ id: actor.id }) as TransactionRow[];

  return rows.map(toTransactionView);
}

export function listAllTransactions(db: Db = getDatabase()): TransactionView[] {
  const rows = db
    .prepare(
      `SELECT ${TRANSACTION_COLUMNS}, buyer.display_name AS buyer_name, seller.display_name AS seller_name, carrier_user.display_name AS carrier_user_name
       FROM transactions t
       ${TRANSACTION_VIEW_JOINS}
       ORDER BY t.updated_at DESC`,
    )
    .all() as TransactionRow[];

  return rows.map(toTransactionView);
}

export function listEscrowEvents(
  transactionId: string,
  db: Db = getDatabase(),
): EscrowEvent[] {
  const rows = db
    .prepare(
      "SELECT id, transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at FROM escrow_events WHERE transaction_id = ? ORDER BY id ASC",
    )
    .all(transactionId) as EventRow[];

  return rows.map(toEvent);
}

export function createTransaction(
  input: CreateTransactionInput,
  actor: EscrowActor,
  db: Db = getDatabase(),
): EscrowTransaction {
  if (actor.role !== "buyer" && actor.role !== "mediator") {
    throw new EscrowError("forbidden", "Only a buyer can open an escrow transaction");
  }

  const buyerId = actor.role === "buyer" ? actor.id : input.buyerId;

  if (getUser(input.sellerId, db) === null) {
    throw new EscrowError("not_found", "Seller account not found");
  }

  if (getUser(buyerId, db) === null) {
    throw new EscrowError("not_found", "Buyer account not found");
  }

  if (getLedgerBalance("wallet", buyerId, db) < input.amountCents) {
    throw new EscrowError(
      "insufficient_funds",
      "The buyer wallet does not hold enough to fund this escrow",
    );
  }

  const transaction = createEscrowTransaction({ ...input, buyerId });
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO transactions (
         id, buyer_id, seller_id, carrier_id, item_name, amount_cents, status,
         tracking_number, carrier_name, origin, destination, dispute_reason, created_at, updated_at
       ) VALUES (
         @id, @buyerId, @sellerId, NULL, @itemName, @amountCents, @status,
         NULL, NULL, NULL, NULL, NULL, @now, @now
       )`,
    ).run({
      id: transaction.id,
      buyerId: transaction.buyerId,
      sellerId: transaction.sellerId,
      itemName: transaction.itemName,
      amountCents: transaction.amountCents,
      status: transaction.status,
      now,
    });

    db.prepare(
      `INSERT INTO escrow_events (
         transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at
       ) VALUES (?, ?, ?, ?, 'created', NULL, ?, ?, ?)`,
    ).run(
      transaction.id,
      actor.id,
      actor.displayName,
      actor.role,
      transaction.status,
      null,
      now,
    );

    moveLedgerFunds(
      "wallet",
      buyerId,
      "escrow",
      transaction.id,
      transaction.amountCents,
      "escrow_deposit",
      transaction.id,
      `${transaction.itemName} placed in escrow`,
      db,
    );
  })();

  return transaction;
}

export function applyActionToTransaction(
  id: string,
  actor: EscrowActor,
  payload: EscrowActionPayload,
  db: Db = getDatabase(),
): EscrowTransaction {
  return db.transaction(() => {
    const current = getTransactionById(id, db);

    if (!current) {
      throw new EscrowError("not_found", "Transaction not found");
    }

    const updated = applyEscrowAction(current, actor, payload);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE transactions
       SET status = @status,
           carrier_id = @carrierId,
           tracking_number = @trackingNumber,
           carrier_name = @carrierName,
           origin = @origin,
           destination = @destination,
           dispute_reason = @disputeReason,
           updated_at = @now
       WHERE id = @id`,
    ).run({
      id: updated.id,
      status: updated.status,
      carrierId: updated.carrierId,
      trackingNumber: updated.trackingNumber,
      carrierName: updated.carrierName,
      origin: updated.origin,
      destination: updated.destination,
      disputeReason: updated.disputeReason,
      now,
    });

    const note = payload.action === "dispatch" ? null : (payload.input?.note ?? null);

    db.prepare(
      `INSERT INTO escrow_events (
         transaction_id, actor_id, actor_name, actor_role, action, from_status, to_status, note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      updated.id,
      actor.id,
      actor.displayName,
      actor.role,
      payload.action,
      current.status,
      updated.status,
      note,
      now,
    );

    if (current.status === "delivered" && updated.status === "released") {
      moveLedgerFunds(
        "escrow",
        id,
        "wallet",
        current.sellerId,
        current.amountCents,
        "escrow_release",
        id,
        `${current.itemName} escrow released to seller`,
        db,
      );
    }

    return updated;
  })();
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

export function getPortfolioStats(
  transactions: EscrowTransaction[],
): PortfolioStats {
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

export function getWalletBalance(userId: string, db: Db = getDatabase()): number {
  return getLedgerBalance("wallet", userId, db);
}

export function listWalletEntries(userId: string, db: Db = getDatabase()): LedgerEntryView[] {
  return listLedgerEntriesForAccount(walletAccountId(userId), db);
}

export function getEscrowLedgerEntries(
  transactionId: string,
  db: Db = getDatabase(),
): LedgerEntryView[] {
  return listLedgerEntriesForReference(transactionId, db);
}

export function getEscrowAccountBalance(
  transactionId: string,
  db: Db = getDatabase(),
): number {
  return getLedgerBalance("escrow", transactionId, db);
}

export function depositWalletFunds(
  userId: string,
  amountCents: number,
  note: string,
  db: Db = getDatabase(),
): void {
  depositToWallet(userId, amountCents, note, db);
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