import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'carrier', 'mediator')),
  email         TEXT,
  password_hash TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  buyer_id        TEXT NOT NULL REFERENCES users(id),
  seller_id       TEXT NOT NULL REFERENCES users(id),
  carrier_id      TEXT REFERENCES users(id),
  item_name       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  status          TEXT NOT NULL CHECK (status IN ('escrow_funded', 'shipped', 'in_transit', 'delivered', 'released', 'disputed')),
  tracking_number TEXT,
  carrier_name    TEXT,
  origin          TEXT,
  destination     TEXT,
  dispute_reason  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escrow_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  actor_id       TEXT NOT NULL,
  actor_name     TEXT NOT NULL,
  actor_role     TEXT NOT NULL,
  action         TEXT NOT NULL,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  note           TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('wallet', 'escrow')),
  owner_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, owner_id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   TEXT NOT NULL REFERENCES ledger_accounts(id),
  delta_cents  INTEGER NOT NULL,
  entry_type   TEXT NOT NULL CHECK (entry_type IN ('deposit', 'escrow_deposit', 'escrow_release')),
  reference_id TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_carrier ON transactions(carrier_id);
CREATE INDEX IF NOT EXISTS idx_events_transaction ON escrow_events(transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id, id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference ON ledger_entries(reference_id, id);
`;

const MIGRATIONS = [
  {
    id: "users-credentials",
    run(db: Db): void {
      const columns = new Set(
        (db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map((column) => column.name),
      );

      if (!columns.has("email")) {
        db.exec("ALTER TABLE users ADD COLUMN email TEXT");
      }

      if (!columns.has("password_hash")) {
        db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
      }
    },
  },
];

const MIGRATION_INDEX = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_id TEXT NOT NULL UNIQUE,
  applied_at   TEXT NOT NULL
);
`;

export type Db = Database.Database;

export function runMigrations(db: Db): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATION_INDEX);
  db.exec(SCHEMA);

  const applied = new Set(
    (
      db.prepare("SELECT migration_id FROM schema_migrations").all() as Array<{
        migration_id: string;
      }>
    ).map((row) => row.migration_id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    db.transaction(() => {
      migration.run(db);
      db.prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
    })();
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
}

export function openDatabase(file: string): Db {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new Database(file);
  runMigrations(db);
  return db;
}

export function resolveDatabaseFile(): string {
  if (process.env.VENN_DB_FILE) {
    return process.env.VENN_DB_FILE;
  }

  if (process.env.NODE_ENV === "test") {
    return ":memory:";
  }

  return path.join(process.cwd(), "data", "venn.db");
}

const globalForDb = globalThis as unknown as { vennDb?: Db };

export function getDatabase(): Db {
  if (!globalForDb.vennDb) {
    globalForDb.vennDb = openDatabase(resolveDatabaseFile());
  }

  return globalForDb.vennDb;
}

export function setDatabase(db: Db): void {
  globalForDb.vennDb = db;
}