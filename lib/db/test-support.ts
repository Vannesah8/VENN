import { openDatabase, type Db } from "@/lib/db";

/**
 * Tables torn down between tests. `schema_migrations` is deliberately left
 * alone: it records the applied migrations, and truncating it would force every
 * later connection to replay them.
 */
const TEST_TABLES = [
  "rate_limits",
  "fx_rates",
  "ratings",
  "transaction_messages",
  "shipment_scans",
  "payment_intents",
  "notifications",
  "outbox",
  "otp_codes",
  "ledger_entries",
  "ledger_accounts",
  "escrow_events",
  "transactions",
  "sessions",
  "users",
];

/**
 * Opens the database under test. With no `VENN_DB_URL` this is an isolated
 * in-memory SQLite instance; when `VENN_DB_URL` is set the same suite runs
 * against Postgres, truncating the shared tables first so each test starts
 * clean. Postgres runs must be serialized (`--test-concurrency=1`) because the
 * tables are shared across files.
 */
export async function openTestDatabase(): Promise<Db> {
  const url = process.env.VENN_DB_URL;

  if (!url) {
    return openDatabase(":memory:");
  }

  const db = await openDatabase(url);
  await db.exec(`TRUNCATE ${TEST_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  return db;
}
