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
  pageTransactionsForActor,
  getUserByPhone,
  updateUserPrefs,
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

async function seedUser(actor: EscrowActor): Promise<void> {
  await createUser(
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

async function fundWallet(actor: EscrowActor, amountCents = START_BALANCE): Promise<void> {
  await depositWalletFunds(actor.id, amountCents, "Test top-up", db);
}

async function freshDatabase(): Promise<void> {
  db = await openDatabase(":memory:");
  setDatabase(db);

  for (const actor of [BUYER, OTHER_BUYER, SELLER, CARRIER, MEDIATOR]) {
    await seedUser(actor);
  }

  await fundWallet(BUYER);
  await fundWallet(OTHER_BUYER);
}

function newEscrow(itemName = "Vintage camera lens", amountCents = 124_000) {
  return createTransaction({ buyerId: BUYER.id, sellerId: SELLER.id, itemName, amountCents }, BUYER, db);
}

async function assertEscrowError(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof EscrowError, "expected an EscrowError");
    assert.equal(error.code, code);
    return true;
  });
}

test("createTransaction persists a funded escrow and its first event", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const created = await newEscrow();
  const stored = await getTransactionById(created.id, db);

  assert.ok(stored);
  assert.equal(stored.status, "escrow_funded");
  assert.ok(stored.createdAt instanceof Date);
  assert.ok(stored.updatedAt instanceof Date);

  const events = await listEscrowEvents(created.id, db);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "created");
  assert.equal(events[0].actorId, BUYER.id);
  assert.equal(events[0].fromStatus, null);
  assert.equal(events[0].toStatus, "escrow_funded");
});

test("dates survive a round trip through storage", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const created = await newEscrow();
  const stored = (await getTransactionById(created.id, db))!;

  assert.equal(stored.createdAt.toISOString(), created.createdAt.toISOString());
});

test("createTransaction refuses actors that are not buyers", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await assertEscrowError(
    () =>
      createTransaction(
        { buyerId: BUYER.id, sellerId: SELLER.id, itemName: "Lens", amountCents: 100 },
        SELLER,
        db,
      ),
    "forbidden",
  );
});

test("createTransaction requires a known counterparty", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await assertEscrowError(
    () =>
      createTransaction(
        { buyerId: BUYER.id, sellerId: "ghost", itemName: "Lens", amountCents: 100 },
        BUYER,
        db,
      ),
    "not_found",
  );
});

test("funding an escrow debits the wallet and holds the amount", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const before = await getWalletBalance(BUYER.id, db);
  const { id, amountCents } = await newEscrow();

  assert.equal(await getWalletBalance(BUYER.id, db), before - amountCents);
  assert.equal(await getEscrowAccountBalance(id, db), amountCents);

  const entries = await getEscrowLedgerEntries(id, db);
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.entryType),
    ["escrow_deposit", "escrow_deposit"],
  );
  assert.equal(entries[0].deltaCents, -amountCents);
  assert.equal(entries[1].deltaCents, amountCents);
});

test("createTransaction refuses a buyer without enough funds", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const THIN_BUYER: EscrowActor = { id: "buyer_thin", displayName: "Thin Buyer", role: "buyer" };
  await seedUser(THIN_BUYER);
  await depositWalletFunds(THIN_BUYER.id, 5_000, "thin wallet", db);
  const balance = await getWalletBalance(THIN_BUYER.id, db);

  await assertEscrowError(
    () =>
      createTransaction(
        { buyerId: THIN_BUYER.id, sellerId: SELLER.id, itemName: "Lens", amountCents: 10_000 },
        THIN_BUYER,
        db,
      ),
    "insufficient_funds",
  );

  assert.equal(await getWalletBalance(THIN_BUYER.id, db), balance);
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count ?? 0, 0);
});

test("releasing an escrow pays the seller", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id, amountCents } = await newEscrow();
  const sellerBefore = await getWalletBalance(SELLER.id, db);

  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  await applyActionToTransaction(id, BUYER, { action: "release_funds", input: { note: "Looks good" } }, db);

  assert.equal(await getWalletBalance(SELLER.id, db), sellerBefore + amountCents);
  assert.equal(await getEscrowAccountBalance(id, db), 0);

  const entries = await getEscrowLedgerEntries(id, db);
  assert.equal(entries.length, 4);
  assert.equal(entries.at(-1)?.entryType, "escrow_release");
  assert.equal(entries.at(-2)?.entryType, "escrow_release");
});

test("a dispute keeps the funds in escrow custody", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id, amountCents } = await newEscrow();

  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  await applyActionToTransaction(id, BUYER, { action: "open_dispute", input: { note: "Damaged" } }, db);

  assert.equal(await getEscrowAccountBalance(id, db), amountCents);
  assert.equal(await getWalletBalance(SELLER.id, db), 0);
});

test("refunding the buyer returns the escrow and persists the resolution", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id, amountCents } = await newEscrow();
  const buyerBefore = await getWalletBalance(BUYER.id, db);

  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  await applyActionToTransaction(id, BUYER, {
    action: "open_dispute",
    input: { note: "Wrong item received" },
  }, db);
  await applyActionToTransaction(id, MEDIATOR, {
    action: "refund_buyer",
    input: { note: "Sides agreed" },
  }, db);

  const stored = (await getTransactionById(id, db))!;
  assert.equal(stored.status, "released");
  assert.equal(stored.resolution, "refunded");
  assert.equal(stored.disputeFromStatus, null);

  assert.equal(await getEscrowAccountBalance(id, db), 0);
  assert.equal(await getWalletBalance(BUYER.id, db), buyerBefore + amountCents);

  const entries = await getEscrowLedgerEntries(id, db);
  assert.ok(entries.some((entry) => entry.entryType === "escrow_refund"));
});

test("scan actions persist shipment scans with their details", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id } = await newEscrow();
  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(id, CARRIER, {
    action: "scan_milestone",
    input: { milestone: "at_depot", location: "Nairobi Depot", note: "sorted" },
  }, db);

  const rows = await db.all<{
    action: string;
    milestone: string | null;
    location: string | null;
    actor_name: string;
  }>(
    "SELECT action, milestone, location, actor_name FROM shipment_scans WHERE transaction_id = ? ORDER BY id",
    [id],
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].action, "scan_in_transit");
  assert.equal(rows[1].action, "scan_milestone");
  assert.equal(rows[1].milestone, "at_depot");
  assert.equal(rows[1].location, "Nairobi Depot");
  assert.equal(rows[1].actor_name, CARRIER.displayName);
});

test("the full lifecycle appends an audit trail", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id } = await newEscrow();

  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(id, CARRIER, { action: "confirm_delivery" }, db);
  await applyActionToTransaction(id, BUYER, { action: "release_funds", input: { note: "Looks good" } }, db);

  const events = await listEscrowEvents(id, db);

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

  assert.equal((await getTransactionById(id, db))?.status, "released");
});

test("a rejected action leaves no partial write behind", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id } = await newEscrow();
  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);

  const before = (await getTransactionById(id, db))!;
  const eventsBefore = (await listEscrowEvents(id, db)).length;

  await assertEscrowError(
    () => applyActionToTransaction(id, SELLER, { action: "release_funds" }, db),
    "forbidden",
  );
  await assertEscrowError(
    () => applyActionToTransaction(id, BUYER, { action: "release_funds" }, db),
    "illegal_transition",
  );

  const after = (await getTransactionById(id, db))!;

  assert.equal(after.status, before.status);
  assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  assert.equal((await listEscrowEvents(id, db)).length, eventsBefore);
});

test("an unknown transaction id is reported", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await assertEscrowError(
    () => applyActionToTransaction("txn_missing", BUYER, { action: "release_funds" }, db),
    "not_found",
  );
});

test("listTransactionsForActor scopes to the parties", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const mine = await newEscrow("Lens", 10_000);
  const theirs = await createTransaction(
    { buyerId: OTHER_BUYER.id, sellerId: SELLER.id, itemName: "Headset", amountCents: 36_000 },
    OTHER_BUYER,
    db,
  );

  const asBuyer = await listTransactionsForActor(BUYER, db);
  assert.deepEqual(asBuyer.map((entry) => entry.id), [mine.id]);
  assert.equal(asBuyer[0].buyerName, "Aisha Mwangi");
  assert.equal(asBuyer[0].sellerName, "Keisha Trading Co.");

  assert.deepEqual(
    (await listTransactionsForActor(SELLER, db))
      .map((entry) => entry.id)
      .sort(),
    [mine.id, theirs.id].sort(),
  );
  assert.equal((await listTransactionsForActor(MEDIATOR, db)).length, 2);
  assert.deepEqual(await listTransactionsForActor(CARRIER, db), []);

  await applyActionToTransaction(mine.id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  assert.deepEqual(
    (await listTransactionsForActor(CARRIER, db)).map((entry) => entry.id),
    [mine.id],
  );
});

test("getTransactionViewById joins the party names", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const { id } = await newEscrow();
  assert.equal((await getTransactionViewById(id, db))?.carrierUserName, null);

  await applyActionToTransaction(id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);

  const view = (await getTransactionViewById(id, db))!;
  assert.equal(view.carrierUserName, "FedEx Lagos");
  assert.equal(view.carrierName, "FedEx");
  assert.equal(view.trackingNumber, "1Z9V94X7K9");
  assert.equal(await getTransactionViewById("txn_missing", db), null);
});

test("createUser is idempotent and listUsers is sorted", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await createUser(
    {
      id: SELLER.id,
      displayName: "Keisha Trading",
      role: "seller",
      email: "seller_1@test.dev",
      passwordHash: hashPassword("other-password"),
    },
    db,
  );
  assert.equal(await getUserCount(), 5);
  assert.equal((await getUserByEmail("seller_1@test.dev", db))?.passwordHash !== null, true);

  const users = await listUsers(db);
  assert.equal(users.length, 5);
  assert.deepEqual(
    users.map((user) => user.role),
    [...users.map((user) => user.role)].sort(),
  );
});

test("getUserByPhone matches normalized numbers and updateUserPrefs persists", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await createUser({
    id: "buyer_phone",
    displayName: "Phone Buyer",
    role: "buyer",
    email: "buyer_phone@test.dev",
    passwordHash: hashPassword("test-password"),
    phone: "+254712000001",
    lang: "en",
    currency: "KES",
  }, db);

  assert.equal((await getUserByPhone("+254712000001", db))?.id, "buyer_phone");

  await updateUserPrefs("buyer_phone", { lang: "sw", currency: "UGX" }, db);
  const updated = (await getUserByPhone("+254712000001", db))!;
  assert.equal(updated.lang, "sw");
  assert.equal(updated.currency, "UGX");
});

test("pageTransactionsForActor paginates without skipping rows", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  await newEscrow("First lens", 10_000);
  await newEscrow("Second lens", 20_000);
  await newEscrow("Third lens", 30_000);

  const first = await pageTransactionsForActor(BUYER, { limit: 2 }, db);
  assert.equal(first.transactions.length, 2);
  assert.ok(first.nextCursor);

  const second = await pageTransactionsForActor(BUYER, { cursor: first.nextCursor, limit: 2 }, db);
  assert.equal(second.transactions.length, 1);
  assert.equal(second.nextCursor, null);

  const ids = [...first.transactions, ...second.transactions].map((entry) => entry.id);
  assert.equal(new Set(ids).size, 3);
});

test("pageTransactionsForActor filters and searches", async (t) => {
  await freshDatabase();
  t.after(async () => db.close());

  const paid = await newEscrow("Paid lens", 10_000);
  const inFlight = await newEscrow("In-flight bag", 20_000);

  await applyActionToTransaction(paid.id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(paid.id, CARRIER, { action: "scan_in_transit" }, db);
  await applyActionToTransaction(paid.id, CARRIER, { action: "confirm_delivery" }, db);
  await applyActionToTransaction(paid.id, BUYER, { action: "release_funds" }, db);

  await applyActionToTransaction(inFlight.id, SELLER, { action: "dispatch", input: { ...SHIPMENT } }, db);
  await applyActionToTransaction(inFlight.id, CARRIER, { action: "scan_in_transit" }, db);

  const released = await pageTransactionsForActor(BUYER, { filter: "released" }, db);
  assert.deepEqual(released.transactions.map((entry) => entry.id), [paid.id]);

  const held = await pageTransactionsForActor(BUYER, { filter: "held" }, db);
  assert.deepEqual(held.transactions.map((entry) => entry.id), [inFlight.id]);

  const searched = await pageTransactionsForActor(BUYER, { query: "in-flight" }, db);
  assert.deepEqual(searched.transactions.map((entry) => entry.id), [inFlight.id]);
});

test("getPortfolioStats splits held from released funds", () => {
  const at = (status: EscrowStatus, amountCents: number): EscrowTransaction => ({
    id: `txn_${status}`,
    buyerId: BUYER.id,
    sellerId: SELLER.id,
    carrierId: null,
    itemName: "Item",
    amountCents,
    currency: "KES",
    status,
    trackingNumber: null,
    carrierName: null,
    origin: null,
    destination: null,
    disputeReason: null,
    disputeFromStatus: null,
    resolution: null,
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

async function getUserCount(): Promise<number> {
  return (await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM users"))?.count ?? 0;
}