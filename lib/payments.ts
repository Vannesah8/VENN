import { getDatabase, type DbLike } from "@/lib/db";
import { EscrowError } from "@/lib/escrow";
import { isCurrency, type Currency } from "@/lib/i18n";

/**
 * Model of the external cash rail. A "payment intent" is a promise to move
 * money in or out of a wallet; the ledger only moves once the rail settles it
 * (completed), and a failed payout is written back as its own entry so the
 * audit stays balanced.
 *
 * The demo provider settles instantly; a live deployment points the same rows
 * at MPESA / bank / card providers through provider_ref.
 */

export const PAYMENT_KINDS = ["deposit", "withdrawal"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ["pending", "completed", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentIntent {
  id: string;
  userId: string;
  kind: PaymentKind;
  amountCents: number;
  currency: Currency;
  phone: string | null;
  provider: string;
  status: PaymentStatus;
  reference: string;
  providerRef: string | null;
  detail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentIntentRow {
  id: string;
  user_id: string;
  kind: PaymentKind;
  amount_cents: number;
  currency: string;
  phone: string | null;
  provider: string;
  status: PaymentStatus;
  reference: string;
  provider_ref: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
}

export function createPaymentIntentId(): string {
  return `pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function createReference(): string {
  return `${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function toPaymentIntent(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    amountCents: row.amount_cents,
    currency: isCurrency(row.currency) ? row.currency : "KES",
    phone: row.phone,
    provider: row.provider,
    status: row.status,
    reference: row.reference,
    providerRef: row.provider_ref,
    detail: row.detail,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function createPaymentIntent(
  input: {
    userId: string;
    kind: PaymentKind;
    amountCents: number;
    currency?: Currency;
    phone?: string | null;
  },
  db: DbLike = getDatabase(),
): Promise<PaymentIntent> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new EscrowError("invalid_input", "An amount greater than zero is required");
  }

  const d = await db;
  const now = new Date().toISOString();
  const intent: PaymentIntent = {
    id: createPaymentIntentId(),
    userId: input.userId,
    kind: input.kind,
    amountCents: input.amountCents,
    currency: input.currency ?? "KES",
    phone: input.phone ?? null,
    provider: "demo",
    status: "pending",
    reference: createReference(),
    providerRef: null,
    detail: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };

  await d.run(
    `INSERT INTO payment_intents (
       id, user_id, kind, amount_cents, currency, phone, provider, status, reference,
       provider_ref, detail, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    [
      intent.id,
      intent.userId,
      intent.kind,
      intent.amountCents,
      intent.currency,
      intent.phone,
      intent.provider,
      intent.status,
      intent.reference,
      now,
      now,
    ],
  );

  return intent;
}

/**
 * Records the rail's answer. A completed intent implies the ledger has already
 * moved (callers control the order); a failed intent is how a payout bounces
 * back and gets its refund entry.
 */
export async function settlePaymentIntent(
  id: string,
  result: { status: "completed" | "failed"; providerRef?: string; detail?: string },
  db: DbLike = getDatabase(),
): Promise<PaymentIntent | null> {
  const d = await db;

  const existing = await d.get<PaymentIntentRow>(
    "SELECT * FROM payment_intents WHERE id = ?",
    [id],
  );

  if (!existing) {
    throw new EscrowError("not_found", "Payment intent not found");
  }

  if (existing.status !== "pending") {
    throw new EscrowError("invalid_input", "Payment intent has already settled");
  }

  const now = new Date().toISOString();
  await d.run(
    `UPDATE payment_intents
     SET status = ?, provider_ref = ?, detail = ?, updated_at = ?
     WHERE id = ?`,
    [
      result.status,
      result.providerRef ?? null,
      result.detail ?? null,
      now,
      id,
    ],
  );

  return {
    ...toPaymentIntent(existing),
    status: result.status,
    providerRef: result.providerRef ?? existing.provider_ref,
    detail: result.detail ?? existing.detail,
    updatedAt: new Date(now),
  };
}

export async function getPaymentIntent(
  id: string,
  db: DbLike = getDatabase(),
): Promise<PaymentIntent | null> {
  const d = await db;
  const row = await d.get<PaymentIntentRow>(
    "SELECT * FROM payment_intents WHERE id = ?",
    [id],
  );
  return row ? toPaymentIntent(row) : null;
}

export async function listPaymentIntents(
  userId: string,
  db: DbLike = getDatabase(),
  limit = 20,
): Promise<PaymentIntent[]> {
  const d = await db;
  const rows = await d.all<PaymentIntentRow>(
    "SELECT * FROM payment_intents WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return rows.map(toPaymentIntent);
}