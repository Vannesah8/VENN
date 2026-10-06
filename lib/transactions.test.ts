import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "./auth";
import { openDatabase, setDatabase, type Db } from "./db";
import type { EscrowActor, EscrowStatus, EscrowTransaction } from "./escrow";
import { EscrowError } from "./escrow";
import {
  applyActionToTransaction,
  createTransaction,
  createUser,
  depositWalletFunds,
  getEscrowAccountBalance,
  getEscrowErrorStatus,
  getEscrowLedgerEntries,
  getPortfolioStats,
  getTransactionById,
  getTransactionViewById,
  getWalletBalance,
  listEscrowEvents,
  listTransactionsForActor,
  listUsers,
  getUserByEmail,
} from "./transactions";

const BUYER: EscrowActor = { id: "buyer_1", displayName: "Aisha Mwangi", role: "buyer" };
const OTHER_BUYER: EscrowActor = { id: "buyer_2", displayName: "Juma Otieno", role: "buyer" };
const SELLER: EscrowActor = { id: "seller_1", displayName: "Keisha Trading Co.", role: "seller" };
const CARRIER: EscrowActor = { id: "carrier_1", displayName: "FedEx Lagos", role: "carrier" };
const MEDIATOR: EscrowActor = { id: "support_1", displayName: "Venn Support", role: "mediator" };

const SHIPMENT = {
  trackingNumber: "1Z9V94X7K9",
  carrierId: CARRIER.id,
  carrierName: "FedEx",
  origin: "Lagos",
  destination: "Nairobi",
} as const;

const START_BALANCE = 1_000_000;

let db: Db;

function seedUser(actor: EscrowActor): void {
  createUser(
    {
      id: actor.id,
      displayName: actor.displayName,
      role: actor.role,
      email: `${actor.id}@test.dev`,
      passwordHash: hashPassword("test-password"),
    },
    db,
  );
}

function fundWallet(actor: EscrowActor, amountCents = START_BALANCE): void {
  depositWalletFunds(actor.id, amountCents, "Test top-up", db);
}

function freshDatabase(): void {
  db = openDatabase(":memory:");
  setDatabase(db);

  for (const actor of [BUYER, OTHER_BUYER, SELLER, CARRIER, MEDIATOR]) {
    seedUser(actor);
  }

  fundWallet(BUYER);
  fundWallet(OTHER_BUYER);
}

function newEscrow(itemName = "Vintage camera lens", amountCents = 124_000) {
  return createTransaction({ buyerId: BUYER.id, sellerId: SELLER.id, itemName, amountCents }, BUYER, db);
}

function assertEscrowError(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof EscrowError, "expected an EscrowError");
    assert.equal(error.code, code);
    return true;
  });
}

test("createTransaction persists a funded escrow and its first event", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const created = newEscrow();
  const stored = getTransactionById(created.id, db);

  assert.ok(stored);
  assert.equal(stored.status, "escrow_funded");
  assert.ok(stored.createdAt instanceof Date);
  assert.ok(stored.updatedAt instanceof Date);

  const events = listEscrowEvents(created.id, db);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "created");
  assert.equal(events[0].actorId, BUYER.id);
  assert.equal(events[0].fromStatus, null);
  assert.equal(events[0].toStatus, "escrow_funded");
});

test("dates survive a round trip through storage", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const created = newEscrow();
  const stored = getTransactionById(created.id, db)!;

  assert.equal(stored.createdAt.toISOString(), created.createdAt.toISOString());
});

test("createTransaction refuses actors that are not buyers", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assertEscrowError(
    () =>
      createTransaction(
        { buyerId: BUYER.id, sellerId: SELLER.id, itemName: "Lens", amountCents: 100 },
        SELLER,
        db,
      ),
    "forbidden",
  );
});

test("createTransaction requires a known counterparty", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assertEscrowError(
    () =>
      createTransaction(
        { buyerId: BUYER.id, sellerId: "ghost", itemName: "Lens", amountCents: 100 },
        BUYER,
        db,
      ),
    "not_found",
  );
});

test("funding an escrow debits the wallet and holds the amount", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const before = getWalletBalance(BUYER.id, db);
  const { id, amountCents } = newEscrow();

  assert.equal(getWalletBalance(BUYER.id, db), before - amountCents);
  assert.equal(getEscrowAccountBalance(id, db), amountCents);

  const entries = getEscrowLedgerEntries(id, db);
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.entryType),
    ["escrow_deposit", "escrow_deposit"],
  );
  assert.equal(entries[0].deltaCents, -amountCents);
  assert.equal(entries[1].deltaCents, amountCents);
});

test("createTransaction refuses a buyer without enough funds", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const THIN_BUYER: EscrowActor = { id: "buyer_thin", displayName: "Thin Buyer", role: "buyer" };
  seedUser(THIN_BUYER);
  depositWalletFunds(THIN_BUYER.id, 5_000, "thin wallet", db);
  const balance = getWalletBalance(THIN_BUYER.id, db);

  assertEscrowError(
    () =>
      createTransaction(
        { buyerId: THIN_BUYER.id, sellerId: SELLER.id, itemName: "Lens", amountCents: 10_000 },
        THIN_BUYER,
        db,
      ),
    "insufficient_funds",
  );

  assert.equal(getWalletBalance(THIN_BUYER.id, db), balance);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM transactions").get() as { count: number }).count,
    0,
  );
});

test("releasing an escrow pays the seller", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { id, amountCents } = newEscrow();
  const sellerBefore = getWalletBalance(SELLER.id, db);

  applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  applyActionToTransaction(id, BUYER, { action: "release_funds", input: { note: "Looks good" } }, db);

  assert.equal(getWalletBalance(SELLER.id, db), sellerBefore + amountCents);
  assert.equal(getEscrowAccountBalance(id, db), 0);

  const entries = getEscrowLedgerEntries(id, db);
  assert.equal(entries.length, 4);
  assert.equal(entries.at(-1)?.entryType, "escrow_release");
  assert.equal(entries.at(-2)?.entryType, "escrow_release");
});

test("a dispute keeps the funds in escrow custody", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { id, amountCents } = newEscrow();

  applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  applyActionToTransaction(id, BUYER, { action: "open_dispute", input: { note: "Damaged" } }, db);

  assert.equal(getEscrowAccountBalance(id, db), amountCents);
  assert.equal(getWalletBalance(SELLER.id, db), 0);
});

test("the full lifecycle appends an audit trail", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { id } = newEscrow();

  applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  applyActionToTransaction(id, BUYER, { action: "release_funds", input: { note: "Looks good" } }, db);

  const events = listEscrowEvents(id, db);

  assert.deepEqual(
    events.map((event) => event.action),
    ["created", "dispatch", "scan_in_transit", "confirm_delivery", "release_funds"],
  );
  assert.deepEqual(
    events.map((event) => event.toStatus),
    ["escrow_funded", "shipped", "in_transit", "delivered", "released"],
  );
  assert.equal(events.at(-1)?.note, "Looks good");
  assert.equal(events.every((event) => event.actorName.length > 0), true);

  assert.equal(getTransactionById(id, db)?.status, "released");
});

test("a rejected action leaves no partial write behind", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { id } = newEscrow();
  applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);

  const before = getTransactionById(id, db)!;
  const eventsBefore = listEscrowEvents(id, db).length;

  assertEscrowError(
    () => applyActionToTransaction(id, SELLER, { action: "release_funds" }, db),
    "forbidden",
  );
  assertEscrowError(
    () => applyActionToTransaction(id, BUYER, { action: "release_funds" }, db),
    "illegal_transition",
  );

  const after = getTransactionById(id, db)!;

  assert.equal(after.status, before.status);
  assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  assert.equal(listEscrowEvents(id, db).length, eventsBefore);
});

test("an unknown transaction id is reported", (t) => {
  freshDatabase();
  t.after(() => db.close());

  assertEscrowError(() => applyActionToTransaction("txn_missing", BUYER, { action: "release_funds" }, db), "not_found");
});

test("listTransactionsForActor scopes to the parties", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const mine = newEscrow("Lens", 10_000);
  const theirs = createTransaction(
    { buyerId: OTHER_BUYER.id, sellerId: SELLER.id, itemName: "Headset", amountCents: 36_000 },
    OTHER_BUYER,
    db,
  );

  const asBuyer = listTransactionsForActor(BUYER, db);
  assert.deepEqual(asBuyer.map((entry) => entry.id), [mine.id]);
  assert.equal(asBuyer[0].buyerName, "Aisha Mwangi");
  assert.equal(asBuyer[0].sellerName, "Keisha Trading Co.");

  assert.deepEqual(
    listTransactionsForActor(SELLER, db)
      .map((entry) => entry.id)
      .sort(),
    [mine.id, theirs.id].sort(),
  );
  assert.deepEqual(listTransactionsForActor(MEDIATOR, db).length, 2);
  assert.deepEqual(listTransactionsForActor(CARRIER, db), []);

  applyActionToTransaction(mine.id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  assert.deepEqual(
    listTransactionsForActor(CARRIER, db).map((entry) => entry.id),
    [mine.id],
  );
});

test("getTransactionViewById joins the party names", (t) => {
  freshDatabase();
  t.after(() => db.close());

  const { id } = newEscrow();
  assert.equal(getTransactionViewById(id, db)?.carrierUserName, null);

  applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);

  const view = getTransactionViewById(id, db)!;
  assert.equal(view.carrierUserName, "FedEx Lagos");
  assert.equal(view.carrierName, "FedEx");
  assert.equal(view.trackingNumber, "1Z9V94X7K9");
  assert.equal(getTransactionViewById("txn_missing", db), null);
});

test("createUser is idempotent and listUsers is sorted", (t) => {
  freshDatabase();
  t.after(() => db.close());

  createUser(
    {
      id: SELLER.id,
      displayName: "Keisha Trading",
      role: "seller",
      email: "seller_1@test.dev",
      passwordHash: hashPassword("other-password"),
    },
    db,
  );
  assert.equal(getUserCount(), 5);
  assert.equal(getUserByEmail("seller_1@test.dev", db)?.passwordHash !== null, true);

  const users = listUsers(db);
  assert.equal(users.length, 5);
  assert.deepEqual(
    users.map((user) => user.role),
    [...users.map((user) => user.role)].sort(),
  );
});

test("getPortfolioStats splits held from released funds", () => {
  const at = (status: EscrowStatus, amountCents: number): EscrowTransaction => ({
    id: `txn_${status}`,
    buyerId: BUYER.id,
    sellerId: SELLER.id,
    carrierId: null,
    itemName: "Item",
    amountCents,
    status,
    trackingNumber: null,
    carrierName: null,
    origin: null,
    destination: null,
    disputeReason: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });

  assert.deepEqual(
    getPortfolioStats([
      at("escrow_funded", 100_00),
      at("shipped", 20_00),
      at("in_transit", 30_00),
      at("delivered", 40_00),
      at("disputed", 50_00),
      at("released", 60_00),
    ]),
    {
      totalCents: 300_00,
      heldCents: 240_00,
      releasedCents: 60_00,
      inFlightCount: 2,
      deliveredCount: 1,
      disputedCount: 1,
      releasedCount: 1,
    },
  );

  assert.deepEqual(getPortfolioStats([]), {
    totalCents: 0,
    heldCents: 0,
    releasedCents: 0,
    inFlightCount: 0,
    deliveredCount: 0,
    disputedCount: 0,
    releasedCount: 0,
  });
});

test("escrow error codes map onto HTTP statuses", () => {
  assert.equal(getEscrowErrorStatus("not_found"), 404);
  assert.equal(getEscrowErrorStatus("forbidden"), 403);
  assert.equal(getEscrowErrorStatus("illegal_transition"), 409);
  assert.equal(getEscrowErrorStatus("invalid_input"), 400);
  assert.equal(getEscrowErrorStatus("insufficient_funds"), 400);
  assert.equal(getEscrowErrorStatus("tracking_required"), 400);
  assert.equal(getEscrowErrorStatus("unknown_action"), 400);
});

function getUserCount(): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}