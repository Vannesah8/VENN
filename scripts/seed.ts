import type {
  DispatchInput,
  EscrowAction,
  EscrowActionPayload,
  EscrowActor,
  EscrowStatus,
} from "@/lib/escrow";
import { hashPassword } from "@/lib/auth";
import { getDatabase, type Db } from "@/lib/db";
import {
  applyActionToTransaction,
  createTransaction,
  createUser,
  depositWalletFunds,
} from "@/lib/transactions";

export const DEMO_PASSWORD = "venn-demo";

const STARTING_BALANCE_CENTS = 500_000;

const USERS = [
  {
    id: "usr_buyer_aisha",
    displayName: "Aisha Mwangi",
    role: "buyer" as const,
    phone: "+254712000001",
    lang: "en" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_buyer_juma",
    displayName: "Juma Otieno",
    role: "buyer" as const,
    phone: "+254712000002",
    lang: "sw" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_seller_keisha",
    displayName: "Keisha Trading Co.",
    role: "seller" as const,
    phone: "+254712000003",
    lang: "en" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_seller_kofi",
    displayName: "Kofi Mensah",
    role: "seller" as const,
    phone: "+254712000004",
    lang: "en" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_carrier_fedex",
    displayName: "FedEx Lagos Hub",
    role: "carrier" as const,
    phone: "+254712000005",
    lang: "en" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_carrier_dhl",
    displayName: "DHL Nairobi",
    role: "carrier" as const,
    phone: "+254712000006",
    lang: "en" as const,
    currency: "KES" as const,
  },
  {
    id: "usr_support",
    displayName: "Venn Support",
    role: "mediator" as const,
    phone: "+254712000007",
    lang: "en" as const,
    currency: "KES" as const,
  },
] as const;

const BUYER_AISHA: EscrowActor = {
  id: "usr_buyer_aisha",
  displayName: "Aisha Mwangi",
  role: "buyer",
};

const OTHER_BUYER: EscrowActor = {
  id: "usr_buyer_juma",
  displayName: "Juma Otieno",
  role: "buyer",
};

const SELLER_KEISHA: EscrowActor = {
  id: "usr_seller_keisha",
  displayName: "Keisha Trading Co.",
  role: "seller",
};

const SELLER_KOFI: EscrowActor = {
  id: "usr_seller_kofi",
  displayName: "Kofi Mensah",
  role: "seller",
};

const CARRIER_FEDEX: EscrowActor = {
  id: "usr_carrier_fedex",
  displayName: "FedEx Lagos Hub",
  role: "carrier",
};

const SUPPORT: EscrowActor = {
  id: "usr_support",
  displayName: "Venn Support",
  role: "mediator",
};

const FEDEX_SHIPMENT = {
  trackingNumber: "1Z9V94X7K9",
  carrierId: "usr_carrier_fedex",
  carrierName: "FedEx",
  origin: "Lagos",
  destination: "Nairobi",
} as const;

const DHL_SHIPMENT = {
  trackingNumber: "JD0146000038282213",
  carrierId: "usr_carrier_dhl",
  carrierName: "DHL",
  origin: "Accra",
  destination: "Kampala",
} as const;

type SeedStep =
  | { action: "dispatch"; input: DispatchInput }
  | { action: Exclude<EscrowAction, "dispatch">; note?: string };

function toPayload(step: SeedStep): EscrowActionPayload {
  return step.action === "dispatch"
    ? { action: "dispatch", input: step.input }
    : { action: step.action, input: { note: step.note } };
}

async function run(actor: EscrowActor, id: string, steps: SeedStep[], db: Db): Promise<void> {
  for (const step of steps) {
    await applyActionToTransaction(id, actor, toPayload(step), db);
  }
}

export async function seed(reset = false): Promise<void> {
  const db = await getDatabase();

  if (reset) {
    await db.exec(
      "DELETE FROM ledger_entries; DELETE FROM ledger_accounts; DELETE FROM escrow_events; DELETE FROM transactions; DELETE FROM sessions; DELETE FROM users; DELETE FROM notifications; DELETE FROM outbox; DELETE FROM otp_codes;",
    );
  }

  const existing = (await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM transactions",
  )) ?? { count: 0 };

  if (existing.count > 0 && !reset) {
    console.log("Transactions already present. Re-run with --reset to rebuild the demo set.");
    return;
  }

  for (const user of USERS) {
    await createUser(
      {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        email: `${user.id.replace(/^usr_/, "")}@venn.demo`,
        passwordHash: hashPassword(DEMO_PASSWORD),
        phone: user.phone,
        lang: user.lang,
        currency: user.currency,
      },
      db,
    );

    if (user.role === "buyer") {
      await depositWalletFunds(
        user.id,
        STARTING_BALANCE_CENTS,
        "Seeded starting wallet balance",
        db,
      );
    }
  }

  const released = await createTransaction(
    { buyerId: BUYER_AISHA.id, sellerId: SELLER_KEISHA.id, itemName: "Vintage camera lens", amountCents: 124_000 },
    BUYER_AISHA,
    db,
  );
  await run(SELLER_KEISHA, released.id, [{ action: "dispatch", input: FEDEX_SHIPMENT }], db);
  await run(CARRIER_FEDEX, released.id, [{ action: "scan_in_transit" }], db);
  await run(CARRIER_FEDEX, released.id, [{ action: "confirm_delivery" }], db);
  await run(BUYER_AISHA, released.id, [{ action: "release_funds", note: "Lens arrived exactly as described." }], db);

  const delivered = await createTransaction(
    { buyerId: BUYER_AISHA.id, sellerId: SELLER_KOFI.id, itemName: "Leica M6 rangefinder", amountCents: 289_000 },
    BUYER_AISHA,
    db,
  );
  await run(SELLER_KOFI, delivered.id, [{ action: "dispatch", input: DHL_SHIPMENT }], db);
  await run(SELLER_KOFI, delivered.id, [{ action: "scan_in_transit" }], db);
  await run(SELLER_KOFI, delivered.id, [{ action: "confirm_delivery" }], db);

  const inTransit = await createTransaction(
    { buyerId: OTHER_BUYER.id, sellerId: SELLER_KEISHA.id, itemName: "Gaming headset", amountCents: 36_000 },
    OTHER_BUYER,
    db,
  );
  await run(SELLER_KEISHA, inTransit.id, [{ action: "dispatch", input: FEDEX_SHIPMENT }], db);
  await run(CARRIER_FEDEX, inTransit.id, [{ action: "scan_in_transit" }], db);

  const disputed = await createTransaction(
    { buyerId: OTHER_BUYER.id, sellerId: SELLER_KOFI.id, itemName: "Smart watch", amountCents: 42_000 },
    OTHER_BUYER,
    db,
  );
  await run(SELLER_KOFI, disputed.id, [{ action: "dispatch", input: DHL_SHIPMENT }], db);
  await run(SELLER_KOFI, disputed.id, [{ action: "scan_in_transit" }], db);
  await run(SELLER_KOFI, disputed.id, [{ action: "confirm_delivery" }], db);
  await run(OTHER_BUYER, disputed.id, [
    { action: "open_dispute", note: "Watch arrived with a cracked screen." },
  ], db);

  const resolved = await createTransaction(
    { buyerId: OTHER_BUYER.id, sellerId: SELLER_KEISHA.id, itemName: "Film scanner", amountCents: 18_500 },
    OTHER_BUYER,
    db,
  );
  await run(SELLER_KEISHA, resolved.id, [{ action: "dispatch", input: FEDEX_SHIPMENT }], db);
  await run(CARRIER_FEDEX, resolved.id, [{ action: "scan_in_transit" }], db);
  await run(CARRIER_FEDEX, resolved.id, [{ action: "confirm_delivery" }], db);
  await run(OTHER_BUYER, resolved.id, [{ action: "open_dispute", note: "Wrong adapter shipped." }], db);
  await run(SUPPORT, resolved.id, [{ action: "resolve_dispute", note: "Adapter sent separately, case closed." }], db);

  const funded = await createTransaction(
    { buyerId: BUYER_AISHA.id, sellerId: SELLER_KEISHA.id, itemName: "Lightroom presets bundle", amountCents: 4_900 },
    BUYER_AISHA,
    db,
  );

  await processSeedNotifications(db);

  const rows = (await db.all<{ item_name: string; status: EscrowStatus }>(
    "SELECT item_name, status FROM transactions ORDER BY created_at ASC",
  )) as Array<{ item_name: string; status: EscrowStatus }>;

  console.log(`Seeded ${USERS.length} accounts and ${rows.length} transactions:`);
  for (const row of rows) {
    console.log(`  ${row.item_name.padEnd(28)} ${row.status}`);
  }
  console.log(`\nFunded but not shipped: ${funded.id}`);
  console.log(`Sign in at /login with any account (password: ${DEMO_PASSWORD}) or phone OTP to explore.`);
}

export async function processSeedNotifications(db: Db): Promise<void> {
  const { processNotifications } = await import("@/lib/notifications");
  await processNotifications(db);
}

const isEntryPoint = process.argv[1]?.includes("seed");

if (isEntryPoint) {
  const main = async (): Promise<void> => {
    await seed(process.argv.includes("--reset"));
  };
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}