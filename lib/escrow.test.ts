import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEscrowAction,
  availableActions,
  canViewTransaction,
  createEscrowTransaction,
  describeActions,
  fundsHeld,
  getEscrowStatusLabel,
  isAllowedTransition,
  isEscrowAction,
  isEscrowRole,
  isEscrowStatus,
  isTerminalStatus,
  resolveParty,
  type EscrowActor,
  type EscrowTransaction,
  EscrowError,
} from "./escrow";

const BUYER: EscrowActor = { id: "buyer_1", displayName: "Aisha Mwangi", role: "buyer" };
const SELLER: EscrowActor = { id: "seller_1", displayName: "Keisha Trading Co.", role: "seller" };
const CARRIER: EscrowActor = { id: "carrier_1", displayName: "FedEx Lagos", role: "carrier" };
const MEDIATOR: EscrowActor = { id: "support_1", displayName: "Venn Support", role: "mediator" };
const STRANGER: EscrowActor = { id: "buyer_9", displayName: "Mallory", role: "buyer" };

const SHIPMENT = {
  trackingNumber: "1Z9V94X7K9",
  carrierId: CARRIER.id,
  carrierName: "FedEx",
  origin: "Lagos",
  destination: "Nairobi",
} as const;

function funded(): EscrowTransaction {
  return createEscrowTransaction({
    buyerId: BUYER.id,
    sellerId: SELLER.id,
    itemName: "Vintage camera lens",
    amountCents: 124_000,
  });
}

function dispatched(): EscrowTransaction {
  return applyEscrowAction(funded(), SELLER, { action: "dispatch", input: { ...SHIPMENT } });
}

function delivered(): EscrowTransaction {
  return applyEscrowAction(
    applyEscrowAction(dispatched(), CARRIER, { action: "scan_in_transit" }),
    CARRIER,
    { action: "confirm_delivery" },
  );
}

function assertEscrowError(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof EscrowError, "expected an EscrowError");
    assert.equal(error.code, code);
    return true;
  });
}

test("createEscrowTransaction opens a funded escrow", () => {
  const transaction = funded();

  assert.equal(transaction.status, "escrow_funded");
  assert.equal(transaction.amountCents, 124_000);
  assert.equal(transaction.itemName, "Vintage camera lens");
  assert.equal(transaction.trackingNumber, null);
  assert.equal(transaction.carrierId, null);
});

test("createEscrowTransaction generates unique ids", () => {
  const ids = new Set(Array.from({ length: 50 }, () => funded().id));
  assert.equal(ids.size, 50);
});

test("createEscrowTransaction rejects invalid amounts", () => {
  for (const amountCents of [0, -1, 12.5, Number.NaN]) {
    assertEscrowError(
      () =>
        createEscrowTransaction({
          buyerId: BUYER.id,
          sellerId: SELLER.id,
          itemName: "Lens",
          amountCents,
        }),
      "invalid_input",
    );
  }
});

test("createEscrowTransaction rejects self-trading and blank items", () => {
  assertEscrowError(
    () =>
      createEscrowTransaction({
        buyerId: BUYER.id,
        sellerId: BUYER.id,
        itemName: "Lens",
        amountCents: 100,
      }),
    "invalid_input",
  );

  assertEscrowError(
    () =>
      createEscrowTransaction({
        buyerId: BUYER.id,
        sellerId: SELLER.id,
        itemName: "   ",
        amountCents: 100,
      }),
    "invalid_input",
  );
});

test("the seller dispatches and attaches shipment details", () => {
  const transaction = dispatched();

  assert.equal(transaction.status, "shipped");
  assert.equal(transaction.trackingNumber, "1Z9V94X7K9");
  assert.equal(transaction.carrierId, CARRIER.id);
  assert.equal(transaction.origin, "Lagos");
  assert.equal(transaction.destination, "Nairobi");
});

test("dispatch requires every shipment field", () => {
  assertEscrowError(
    () =>
      applyEscrowAction(funded(), SELLER, {
        action: "dispatch",
        input: { ...SHIPMENT, trackingNumber: "  " },
      }),
    "tracking_required",
  );

  assertEscrowError(
    () => applyEscrowAction(funded(), SELLER, { action: "dispatch", input: { ...SHIPMENT, origin: "" } }),
    "tracking_required",
  );
});

test("the carrier cannot be the buyer or the seller", () => {
  assertEscrowError(
    () =>
      applyEscrowAction(funded(), SELLER, {
        action: "dispatch",
        input: { ...SHIPMENT, carrierId: SELLER.id },
      }),
    "invalid_input",
  );
});

test("only the seller can dispatch", () => {
  assertEscrowError(
    () => applyEscrowAction(funded(), BUYER, { action: "dispatch", input: { ...SHIPMENT } }),
    "forbidden",
  );

  assertEscrowError(
    () => applyEscrowAction(funded(), STRANGER, { action: "dispatch", input: { ...SHIPMENT } }),
    "forbidden",
  );
});

test("an unknown action is rejected", () => {
  assertEscrowError(
    () => applyEscrowAction(funded(), SELLER, { action: "wire_the_money" } as never),
    "unknown_action",
  );
});

test("the carrier can only scan after being assigned", () => {
  assertEscrowError(
    () => applyEscrowAction(dispatched(), STRANGER, { action: "scan_in_transit" }),
    "forbidden",
  );

  const inTransit = applyEscrowAction(dispatched(), CARRIER, { action: "scan_in_transit" });
  assert.equal(inTransit.status, "in_transit");
});

test("the buyer releases funds once delivery is confirmed", () => {
  const released = applyEscrowAction(delivered(), BUYER, {
    action: "release_funds",
    input: { note: "Arrived as described" },
  });

  assert.equal(released.status, "released");
  assert.equal(released.disputeReason, null);
  assert.ok(released.updatedAt.getTime() >= delivered().updatedAt.getTime());
});

test("funds cannot be released before delivery", () => {
  assertEscrowError(
    () => applyEscrowAction(funded(), BUYER, { action: "release_funds" }),
    "illegal_transition",
  );

  assertEscrowError(
    () => applyEscrowAction(dispatched(), BUYER, { action: "release_funds" }),
    "illegal_transition",
  );
});

test("the seller cannot release funds to themselves", () => {
  assertEscrowError(
    () => applyEscrowAction(delivered(), SELLER, { action: "release_funds" }),
    "forbidden",
  );
});

test("a released transaction is terminal", () => {
  const released = applyEscrowAction(delivered(), BUYER, { action: "release_funds" });

  assertEscrowError(
    () => applyEscrowAction(released, BUYER, { action: "open_dispute" }),
    "illegal_transition",
  );

  assertEscrowError(
    () => applyEscrowAction(released, SELLER, { action: "dispatch", input: { ...SHIPMENT } }),
    "illegal_transition",
  );
});

test("the buyer disputes and a mediator returns the order for confirmation", () => {
  const disputed = applyEscrowAction(delivered(), BUYER, {
    action: "open_dispute",
    input: { note: "Cracked screen" },
  });

  assert.equal(disputed.status, "disputed");
  assert.equal(disputed.disputeReason, "Cracked screen");

  assertEscrowError(
    () => applyEscrowAction(disputed, BUYER, { action: "resolve_dispute" }),
    "forbidden",
  );

  assertEscrowError(
    () => applyEscrowAction(disputed, SELLER, { action: "resolve_dispute" }),
    "forbidden",
  );

  const resolved = applyEscrowAction(disputed, MEDIATOR, { action: "resolve_dispute" });
  assert.equal(resolved.status, "delivered");
  assert.equal(resolved.disputeReason, null);

  assert.equal(applyEscrowAction(resolved, BUYER, { action: "release_funds" }).status, "released");
});

test("a dispute cannot be opened before the parcel ships", () => {
  assertEscrowError(
    () => applyEscrowAction(funded(), BUYER, { action: "open_dispute" }),
    "illegal_transition",
  );
});

test("a dispute opened in transit resolves back to in transit", () => {
  const inTransit = applyEscrowAction(dispatched(), CARRIER, { action: "scan_in_transit" });
  const disputed = applyEscrowAction(inTransit, BUYER, { action: "open_dispute" });

  assert.equal(disputed.status, "disputed");
  assert.equal(disputed.disputeFromStatus, "in_transit");

  const resolved = applyEscrowAction(disputed, MEDIATOR, { action: "resolve_dispute" });
  assert.equal(resolved.status, "in_transit");
  assert.equal(resolved.disputeFromStatus, null);
});

test("resolveParty identifies the acting side", () => {
  const transaction = dispatched();

  assert.equal(resolveParty(transaction, BUYER), "buyer");
  assert.equal(resolveParty(transaction, SELLER), "seller");
  assert.equal(resolveParty(transaction, CARRIER), "carrier");
  assert.equal(resolveParty(transaction, MEDIATOR), "mediator");
  assert.equal(resolveParty(transaction, STRANGER), null);
});

test("canViewTransaction limits reads to the parties and support", () => {
  const transaction = delivered();

  assert.equal(canViewTransaction(transaction, BUYER), true);
  assert.equal(canViewTransaction(transaction, SELLER), true);
  assert.equal(canViewTransaction(transaction, CARRIER), true);
  assert.equal(canViewTransaction(transaction, MEDIATOR), true);
  assert.equal(canViewTransaction(transaction, STRANGER), false);
});

test("availableActions follows the machine and the actor role", () => {
  const fundedActions = availableActions(funded(), SELLER);
  assert.deepEqual(fundedActions, ["dispatch"]);
  assert.deepEqual(availableActions(funded(), BUYER), []);
  assert.deepEqual(availableActions(funded(), CARRIER), []);

  assert.deepEqual(availableActions(dispatched(), CARRIER), ["scan_in_transit"]);

  const inTransit = applyEscrowAction(dispatched(), CARRIER, { action: "scan_in_transit" });
  assert.deepEqual(availableActions(inTransit, CARRIER), ["scan_milestone", "confirm_delivery"]);

  assert.deepEqual(availableActions(delivered(), BUYER), [
    "confirm_receipt",
    "release_funds",
    "open_dispute",
  ]);
  assert.deepEqual(availableActions(delivered(), SELLER), []);
  assert.deepEqual(availableActions(delivered(), STRANGER), []);

  const disputed = applyEscrowAction(delivered(), BUYER, { action: "open_dispute" });
  assert.deepEqual(availableActions(disputed, MEDIATOR), ["resolve_dispute", "refund_buyer"]);
  assert.deepEqual(availableActions(disputed, CARRIER), []);
});

test("describeActions carries UI copy", () => {
  const [action] = describeActions(funded(), SELLER);

  assert.equal(action.label, "Record shipment");
  assert.equal(action.to, "shipped");
  assert.ok(action.description.length > 0);
});

test("status helpers label and classify every state", () => {
  assert.equal(getEscrowStatusLabel("escrow_funded"), "Escrow funded");
  assert.equal(getEscrowStatusLabel("in_transit"), "In transit");
  assert.equal(getEscrowStatusLabel("released"), "Released to seller");
  assert.equal(getEscrowStatusLabel("disputed"), "Dispute review");

  assert.equal(isTerminalStatus("released"), true);
  assert.equal(isTerminalStatus("delivered"), false);

  assert.equal(fundsHeld("delivered"), true);
  assert.equal(fundsHeld("released"), false);
});

test("isAllowedTransition rejects skipping states", () => {
  assert.equal(isAllowedTransition("escrow_funded", "shipped", "seller"), true);
  assert.equal(isAllowedTransition("escrow_funded", "released", "buyer"), false);
  assert.equal(isAllowedTransition("delivered", "released", "seller"), false);
  assert.equal(isAllowedTransition("released", "delivered", "mediator"), false);
});

test("type guards accept only known values", () => {
  assert.equal(isEscrowStatus("delivered"), true);
  assert.equal(isEscrowStatus("refunded"), false);
  assert.equal(isEscrowAction("dispatch"), true);
  assert.equal(isEscrowAction("payout"), false);
  assert.equal(isEscrowRole("mediator"), true);
  assert.equal(isEscrowRole("admin"), false);
});