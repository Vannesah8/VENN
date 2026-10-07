import { t, type Currency, type Lang, type MessageKey } from "@/lib/i18n";

export const ESCROW_ROLES = ["buyer", "seller", "carrier", "mediator"] as const;
export type EscrowRole = (typeof ESCROW_ROLES)[number];

export const ESCROW_STATUSES = [
  "escrow_funded",
  "shipped",
  "in_transit",
  "delivered",
  "released",
  "disputed",
] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const ESCROW_ACTIONS = [
  "dispatch",
  "scan_in_transit",
  "scan_milestone",
  "confirm_delivery",
  "confirm_receipt",
  "release_funds",
  "open_dispute",
  "resolve_dispute",
  "refund_buyer",
] as const;
export type EscrowAction = (typeof ESCROW_ACTIONS)[number];

export const SCAN_MILESTONES = [
  "picked_up",
  "at_depot",
  "out_for_delivery",
  "attempted_delivery",
] as const;
export type ScanMilestone = (typeof SCAN_MILESTONES)[number];

export function isScanMilestone(value: unknown): value is ScanMilestone {
  return typeof value === "string" && (SCAN_MILESTONES as readonly string[]).includes(value);
}

export const ESCROW_RESOLUTIONS = ["paid", "refunded"] as const;
export type EscrowResolution = (typeof ESCROW_RESOLUTIONS)[number];

export type EscrowParty = "buyer" | "seller" | "carrier" | "mediator";

export type EscrowErrorCode =
  | "not_found"
  | "invalid_input"
  | "unknown_action"
  | "illegal_transition"
  | "forbidden"
  | "tracking_required"
  | "insufficient_funds";

export class EscrowError extends Error {
  readonly code: EscrowErrorCode;

  constructor(code: EscrowErrorCode, message: string) {
    super(message);
    this.name = "EscrowError";
    this.code = code;
  }
}

export interface EscrowActor {
  id: string;
  displayName: string;
  role: EscrowRole;
}

export interface EscrowTransaction {
  id: string;
  buyerId: string;
  sellerId: string;
  carrierId: string | null;
  itemName: string;
  amountCents: number;
  currency: Currency;
  status: EscrowStatus;
  trackingNumber: string | null;
  carrierName: string | null;
  origin: string | null;
  destination: string | null;
  disputeReason: string | null;
  disputeFromStatus: EscrowStatus | null;
  resolution: EscrowResolution | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowEvent {
  id: number;
  transactionId: string;
  actorId: string;
  actorName: string;
  actorRole: EscrowRole;
  action: EscrowAction | "created";
  fromStatus: EscrowStatus | null;
  toStatus: EscrowStatus;
  note: string | null;
  createdAt: Date;
}

export interface CreateTransactionInput {
  buyerId: string;
  sellerId: string;
  itemName: string;
  amountCents: number;
  currency?: Currency;
}

export interface DispatchInput {
  trackingNumber: string;
  carrierId: string;
  carrierName: string;
  origin: string;
  destination: string;
}

export interface ScanInput {
  note?: string;
  milestone?: string;
  location?: string;
  photoUrl?: string;
}

export type EscrowActionPayload =
  | { action: "dispatch"; input: DispatchInput }
  | { action: "scan_in_transit" | "scan_milestone"; input?: ScanInput }
  | { action: Exclude<EscrowAction, "dispatch" | "scan_in_transit" | "scan_milestone">; input?: { note?: string } };

interface ActionRule {
  from: readonly EscrowStatus[];
  to: EscrowStatus;
  parties: readonly EscrowParty[];
  label: string;
  description: string;
}

const ACTION_RULES: Record<EscrowAction, ActionRule> = {
  dispatch: {
    from: ["escrow_funded"],
    to: "shipped",
    parties: ["seller"],
    label: "Record shipment",
    description: "Attach a tracking number to hand the order to the carrier.",
  },
  scan_in_transit: {
    from: ["shipped"],
    to: "in_transit",
    parties: ["seller", "carrier"],
    label: "Mark in transit",
    description: "Log the first carrier scan on the parcel.",
  },
  scan_milestone: {
    from: ["in_transit"],
    to: "in_transit",
    parties: ["seller", "carrier"],
    label: "Log a scan",
    description: "Record where the parcel is right now — depot, van, or out for delivery.",
  },
  confirm_delivery: {
    from: ["in_transit"],
    to: "delivered",
    parties: ["seller", "carrier"],
    label: "Confirm delivery",
    description: "Record that the parcel reached the buyer.",
  },
  confirm_receipt: {
    from: ["delivered"],
    to: "delivered",
    parties: ["buyer"],
    label: "Confirm you received it",
    description: "Buyer acknowledges the parcel in hand before money moves.",
  },
  release_funds: {
    from: ["delivered"],
    to: "released",
    parties: ["buyer"],
    label: "Release funds",
    description: "Buyer confirms the item and escrow pays the seller.",
  },
  open_dispute: {
    from: ["shipped", "in_transit", "delivered"],
    to: "disputed",
    parties: ["buyer"],
    label: "Open dispute",
    description: "Buyer reports a problem and escrow is held for review.",
  },
  resolve_dispute: {
    from: ["disputed"],
    to: "delivered",
    parties: ["mediator"],
    label: "Resolve dispute",
    description: "Support closes the case and returns the order to the buyer.",
  },
  refund_buyer: {
    from: ["disputed"],
    to: "released",
    parties: ["mediator"],
    label: "Refund the buyer",
    description: "Support closes the case and returns the escrow to the buyer.",
  },
};

const STATUS_TONES: Record<EscrowStatus, "neutral" | "progress" | "positive" | "warning"> = {
  escrow_funded: "neutral",
  shipped: "progress",
  in_transit: "progress",
  delivered: "progress",
  released: "positive",
  disputed: "warning",
};

/**
 * `resolve_dispute` sends the order back to wherever it was when the case
 * opened (a parcel disputed in transit goes back to in transit, not delivered),
 * so the rule's static `to` is only the fallback for records written before the
 * column existed.
 */
export function disputeResolutionTarget(transaction: EscrowTransaction): EscrowStatus {
  if (transaction.disputeFromStatus && isEscrowStatus(transaction.disputeFromStatus)) {
    return transaction.disputeFromStatus;
  }
  return "delivered";
}

export function isEscrowStatus(value: unknown): value is EscrowStatus {
  return typeof value === "string" && (ESCROW_STATUSES as readonly string[]).includes(value);
}

export function isEscrowRole(value: unknown): value is EscrowRole {
  return typeof value === "string" && (ESCROW_ROLES as readonly string[]).includes(value);
}

export function isEscrowAction(value: unknown): value is EscrowAction {
  return typeof value === "string" && (ESCROW_ACTIONS as readonly string[]).includes(value);
}

export function getEscrowStatusLabel(
  status: EscrowStatus,
  lang: Lang = "en",
): string {
  return t(lang, `status.${status}` as MessageKey);
}

export function getEscrowStatusTone(status: EscrowStatus) {
  return STATUS_TONES[status] ?? "neutral";
}

export function getActionRule(action: EscrowAction): ActionRule {
  return ACTION_RULES[action];
}

export function isTerminalStatus(status: EscrowStatus): boolean {
  return status === "released";
}

export function fundsHeld(status: EscrowStatus): boolean {
  return status !== "released";
}

export function resolveParty(
  transaction: EscrowTransaction,
  actor: EscrowActor,
): EscrowParty | null {
  if (actor.role === "mediator") {
    return "mediator";
  }

  if (actor.role === "buyer" && actor.id === transaction.buyerId) {
    return "buyer";
  }

  if (actor.role === "seller" && actor.id === transaction.sellerId) {
    return "seller";
  }

  if (actor.role === "carrier" && actor.id === transaction.carrierId) {
    return "carrier";
  }

  return null;
}

export function canViewTransaction(
  transaction: EscrowTransaction,
  actor: EscrowActor,
): boolean {
  return resolveParty(transaction, actor) !== null;
}

export function getNextStatuses(status: EscrowStatus): EscrowStatus[] {
  return Object.values(ACTION_RULES)
    .filter((rule) => rule.from.includes(status))
    .map((rule) => rule.to);
}

export function isAllowedTransition(
  from: EscrowStatus,
  to: EscrowStatus,
  party: EscrowParty,
): boolean {
  return Object.values(ACTION_RULES).some(
    (rule) => rule.from.includes(from) && rule.to === to && rule.parties.includes(party),
  );
}

export function availableActions(
  transaction: EscrowTransaction,
  actor: EscrowActor,
): EscrowAction[] {
  const party = resolveParty(transaction, actor);

  if (!party) {
    return [];
  }

  return (Object.keys(ACTION_RULES) as EscrowAction[]).filter((action) => {
    const rule = ACTION_RULES[action];
    return rule.from.includes(transaction.status) && rule.parties.includes(party);
  });
}

export interface DescribedAction {
  action: EscrowAction;
  label: string;
  description: string;
  to: EscrowStatus;
  actionLabelKey: string;
  actionDescriptionKey: string;
}

export function describeActions(
  transaction: EscrowTransaction,
  actor: EscrowActor,
  lang: Lang = "en",
): DescribedAction[] {
  return availableActions(transaction, actor).map((action) => {
    const rule = ACTION_RULES[action];
    const to =
      action === "resolve_dispute" ? disputeResolutionTarget(transaction) : rule.to;

    return {
      action,
      label: t(lang, `action.${action}.label` as MessageKey),
      description: t(lang, `action.${action}.description` as MessageKey),
      to,
      actionLabelKey: `action.${action}.label`,
      actionDescriptionKey: `action.${action}.description`,
    };
  });
}

export function assertAmountCents(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new EscrowError("invalid_input", "Amount must be a positive whole number of cents");
  }
}

export function createEscrowTransaction(
  input: CreateTransactionInput,
  now: Date = new Date(),
): EscrowTransaction {
  assertAmountCents(input.amountCents);

  if (!input.buyerId || !input.sellerId) {
    throw new EscrowError("invalid_input", "A buyer and a seller are required");
  }

  if (input.buyerId === input.sellerId) {
    throw new EscrowError("invalid_input", "Buyer and seller must be different accounts");
  }

  if (!input.itemName?.trim()) {
    throw new EscrowError("invalid_input", "An item name is required");
  }

  return {
    id: createTransactionId(),
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    carrierId: null,
    itemName: input.itemName.trim(),
    amountCents: input.amountCents,
    currency: input.currency ?? "KES",
    status: "escrow_funded",
    trackingNumber: null,
    carrierName: null,
    origin: null,
    destination: null,
    disputeReason: null,
    disputeFromStatus: null,
    resolution: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTransactionId(): string {
  return `txn_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function applyEscrowAction(
  transaction: EscrowTransaction,
  actor: EscrowActor,
  payload: EscrowActionPayload,
  now: Date = new Date(),
): EscrowTransaction {
  if (!isEscrowAction(payload.action)) {
    throw new EscrowError("unknown_action", `Unknown action: ${String(payload.action)}`);
  }

  const rule = ACTION_RULES[payload.action];
  const party = resolveParty(transaction, actor);

  if (!party) {
    throw new EscrowError("forbidden", "You are not a party to this transaction");
  }

  if (!rule.parties.includes(party)) {
    throw new EscrowError("forbidden", `${actor.displayName} cannot ${rule.label.toLowerCase()}`);
  }

  if (!rule.from.includes(transaction.status)) {
    throw new EscrowError(
      "illegal_transition",
      `Cannot ${rule.label.toLowerCase()} while escrow is ${getEscrowStatusLabel(transaction.status).toLowerCase()}`,
    );
  }

  if (payload.action === "dispatch") {
    return dispatch(transaction, payload.input, now);
  }

  if (payload.action === "scan_in_transit" || payload.action === "scan_milestone") {
    return { ...transaction, status: rule.to, updatedAt: now };
  }

  const base: EscrowTransaction = { ...transaction, updatedAt: now };

  switch (payload.action) {
    case "confirm_delivery":
    case "confirm_receipt":
      return { ...base, status: rule.to, disputeReason: null };

    case "release_funds":
      return { ...base, status: rule.to, resolution: "paid", disputeReason: null };

    case "open_dispute":
      return {
        ...base,
        status: rule.to,
        disputeReason: readNote(payload),
        disputeFromStatus: transaction.status,
        resolution: null,
      };

    case "resolve_dispute":
      return {
        ...base,
        status: disputeResolutionTarget(transaction),
        disputeReason: null,
        disputeFromStatus: null,
        resolution: null,
      };

    case "refund_buyer":
      return {
        ...base,
        status: "released",
        disputeFromStatus: null,
        resolution: "refunded",
      };

    default:
      return { ...base, status: rule.to };
  }
}

function dispatch(
  transaction: EscrowTransaction,
  input: DispatchInput,
  now: Date,
): EscrowTransaction {
  const trackingNumber = input?.trackingNumber?.trim();
  const carrierId = input?.carrierId?.trim();
  const carrierName = input?.carrierName?.trim();
  const origin = input?.origin?.trim();
  const destination = input?.destination?.trim();

  if (!trackingNumber || !carrierId || !carrierName || !origin || !destination) {
    throw new EscrowError(
      "tracking_required",
      "Tracking number, carrier, origin and destination are required to dispatch",
    );
  }

  if (carrierId === transaction.buyerId || carrierId === transaction.sellerId) {
    throw new EscrowError("invalid_input", "The carrier cannot be the buyer or the seller");
  }

  return {
    ...transaction,
    status: "shipped",
    trackingNumber,
    carrierId,
    carrierName,
    origin,
    destination,
    updatedAt: now,
  };
}

function readNote(payload: EscrowActionPayload): string | null {
  if (payload.action === "dispatch") {
    return null;
  }

  const note = payload.input?.note?.trim();
  return note ? note.slice(0, 500) : null;
}