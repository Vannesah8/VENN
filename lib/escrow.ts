import { t, type Lang, type MessageKey } from "@/lib/i18n";

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
  "confirm_delivery",
  "release_funds",
  "open_dispute",
  "resolve_dispute",
] as const;
export type EscrowAction = (typeof ESCROW_ACTIONS)[number];

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
  status: EscrowStatus;
  trackingNumber: string | null;
  carrierName: string | null;
  origin: string | null;
  destination: string | null;
  disputeReason: string | null;
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
}

export interface DispatchInput {
  trackingNumber: string;
  carrierId: string;
  carrierName: string;
  origin: string;
  destination: string;
}

export type EscrowActionPayload =
  | { action: "dispatch"; input: DispatchInput }
  | { action: Exclude<EscrowAction, "dispatch">; input?: { note?: string } };

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
  confirm_delivery: {
    from: ["in_transit"],
    to: "delivered",
    parties: ["seller", "carrier"],
    label: "Confirm delivery",
    description: "Record that the parcel reached the buyer.",
  },
  release_funds: {
    from: ["delivered"],
    to: "released",
    parties: ["buyer"],
    label: "Release funds",
    description: "Buyer confirms the item and escrow pays the seller.",
  },
  open_dispute: {
    from: ["delivered"],
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
    description: "Mediator closes the case and returns the order to the buyer.",
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
    return {
      action,
      label: t(lang, `action.${action}.label` as MessageKey),
      description: t(lang, `action.${action}.description` as MessageKey),
      to: rule.to,
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
    status: "escrow_funded",
    trackingNumber: null,
    carrierName: null,
    origin: null,
    destination: null,
    disputeReason: null,
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

  return {
    ...transaction,
    status: rule.to,
    disputeReason: payload.action === "open_dispute" ? readNote(payload) : null,
    updatedAt: now,
  };
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