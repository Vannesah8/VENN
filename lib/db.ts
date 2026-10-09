import path from "node:path";

export type Dialect = "sqlite" | "postgres";

/**
 * Storage adapter shared by SQLite and Postgres. Methods are async so a single
 * call site works against either driver; transactions are flattened into a
 * depth counter so nested calls join the enclosing transaction.
 */
export interface Db {
  readonly dialect: Dialect;

  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ changes: number; lastId: number | bigint | null }>;
  tx<T>(fn: () => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export type DbLike = Db | Promise<Db>;

const IDENTITY = {
  sqlite: "INTEGER",
  postgres: "BIGINT GENERATED ALWAYS AS IDENTITY",
} as const;

const EPOCH_MILLISECONDS = {
  sqlite: "INTEGER",
  postgres: "BIGINT",
} as const;

function identityFor(dialect: Dialect): string {
  return IDENTITY[dialect];
}

const SCHEMA_TEMPLATE = (identity: string, epochMilliseconds: string): string => `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'carrier', 'mediator')),
  email         TEXT,
  password_hash TEXT,
  phone         TEXT,
  lang          TEXT NOT NULL DEFAULT 'en',
  currency      TEXT NOT NULL DEFAULT 'KES',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id                  TEXT PRIMARY KEY,
  buyer_id            TEXT NOT NULL REFERENCES users(id),
  seller_id           TEXT NOT NULL REFERENCES users(id),
  carrier_id          TEXT REFERENCES users(id),
  item_name           TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
  currency            TEXT NOT NULL DEFAULT 'KES',
  status              TEXT NOT NULL CHECK (status IN ('escrow_funded', 'shipped', 'in_transit', 'delivered', 'released', 'disputed')),
  tracking_number     TEXT,
  carrier_name        TEXT,
  origin              TEXT,
  destination         TEXT,
  dispute_reason      TEXT,
  dispute_from_status TEXT,
  resolution          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escrow_events (
  id             ${identity} PRIMARY KEY,
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
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('wallet', 'escrow')),
  owner_id              TEXT NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'KES',
  balance_snapshot_cents INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  UNIQUE (kind, owner_id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id           ${identity} PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES ledger_accounts(id),
  delta_cents  INTEGER NOT NULL,
  entry_type   TEXT NOT NULL CHECK (entry_type IN ('deposit', 'escrow_deposit', 'escrow_release', 'withdrawal', 'escrow_refund')),
  reference_id TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id        ${identity} PRIMARY KEY,
  phone     TEXT NOT NULL,
  purpose   TEXT NOT NULL CHECK (purpose IN ('login', 'register')),
  code_hash TEXT NOT NULL,
  attempts  INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at   TEXT
);

CREATE TABLE IF NOT EXISTS outbox (
  id           ${identity} PRIMARY KEY,
  topic        TEXT NOT NULL,
  payload      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id             ${identity} PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  read_at        TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  currency       TEXT NOT NULL,
  phone          TEXT,
  provider       TEXT NOT NULL DEFAULT 'demo',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reference      TEXT NOT NULL,
  provider_ref   TEXT,
  detail         TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipment_scans (
  id             ${identity} PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  actor_id       TEXT NOT NULL,
  actor_name     TEXT NOT NULL,
  action         TEXT NOT NULL,
  milestone      TEXT,
  location       TEXT,
  photo_url      TEXT,
  note           TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_messages (
  id             ${identity} PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  author_id      TEXT NOT NULL,
  author_name    TEXT NOT NULL,
  author_role    TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'evidence')),
  body           TEXT NOT NULL,
  attachment_url TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id             ${identity} PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  rater_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars          INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (transaction_id, rater_id)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  currency   TEXT PRIMARY KEY,
  per_base   REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT NOT NULL,
  window_start ${epochMilliseconds} NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_carrier ON transactions(carrier_id);
CREATE INDEX IF NOT EXISTS idx_events_transaction ON escrow_events(transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id, id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference ON ledger_entries(reference_id, id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);
CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_codes(phone, purpose, id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id, id);
CREATE INDEX IF NOT EXISTS idx_scans_transaction ON shipment_scans(transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_transaction ON transaction_messages(transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id, id);
`;

const MIGRATION_INDEX = (identity: string): string => `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          ${identity} PRIMARY KEY,
  migration_id TEXT NOT NULL UNIQUE,
  applied_at   TEXT NOT NULL
);
`;

const TRAILING_INDEXES = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
`;

interface Migration {
  id: string;
  run(db: Db): Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    id: "users-credentials",
    async run(db) {
      if (db.dialect === "postgres") {
        return;
      }
      const columns = new Set(
        (
          await db.all<{ name: string }>("PRAGMA table_info(users)")
        ).map((column) => column.name),
      );

      if (!columns.has("email")) {
        await db.exec("ALTER TABLE users ADD COLUMN email TEXT");
      }
      if (!columns.has("password_hash")) {
        await db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
      }
    },
  },
  {
    id: "users-phone",
    async run(db) {
      if (db.dialect === "postgres") {
        return;
      }
      const columns = new Set(
        (await db.all<{ name: string }>("PRAGMA table_info(users)")).map(
          (column) => column.name,
        ),
      );
      if (!columns.has("phone")) {
        await db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
      }
    },
  },
  {
    id: "users-locale",
    async run(db) {
      if (db.dialect === "postgres") {
        return;
      }
      const columns = new Set(
        (await db.all<{ name: string }>("PRAGMA table_info(users)")).map(
          (column) => column.name,
        ),
      );
      if (!columns.has("lang")) {
        await db.exec("ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'");
      }
      if (!columns.has("currency")) {
        await db.exec("ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'KES'");
      }
    },
  },
  {
    id: "ledger-balance-snapshot",
    async run(db) {
      if (db.dialect === "postgres") {
        return;
      }
      const columns = new Set(
        (
          await db.all<{ name: string }>("PRAGMA table_info(ledger_accounts)")
        ).map((column) => column.name),
      );
      if (!columns.has("balance_snapshot_cents")) {
        await db.exec(
          "ALTER TABLE ledger_accounts ADD COLUMN balance_snapshot_cents INTEGER NOT NULL DEFAULT 0",
        );
      }
      await db.exec(
        `UPDATE ledger_accounts
         SET balance_snapshot_cents = (
           SELECT COALESCE(SUM(delta_cents), 0) FROM ledger_entries WHERE account_id = ledger_accounts.id
         )`,
      );
    },
  },
  {
    id: "transactions-currency",
    async run(db) {
      await ensureColumn(db, "transactions", "currency", "TEXT NOT NULL DEFAULT 'KES'");
      await ensureColumn(db, "transactions", "dispute_from_status", "TEXT");
      await ensureColumn(db, "transactions", "resolution", "TEXT");
    },
  },
  {
    id: "ledger-account-currency",
    async run(db) {
      await ensureColumn(db, "ledger_accounts", "currency", "TEXT NOT NULL DEFAULT 'KES'");
    },
  },
  {
    id: "notifications-transaction-id",
    async run(db) {
      await ensureColumn(db, "notifications", "transaction_id", "TEXT");
    },
  },
  {
    id: "ledger-entry-types",
    async run(db) {
      await replaceEntryTypeCheck(db);
    },
  },
  {
    id: "rate-limits-window-start-bigint",
    async run(db) {
      if (db.dialect === "postgres") {
        await db.exec("ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT");
      }
    },
  },
];

async function ensureColumn(
  db: Db,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (db.dialect === "postgres") {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    return;
  }

  const columns = new Set(
    (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((row) => row.name),
  );

  if (!columns.has(column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * SQLite cannot alter a CHECK constraint, so the table is rebuilt: it is
 * renamed aside, recreated under its original name, the rows are copied across
 * and the old copy is dropped. Only tables with no inbound foreign keys are
 * rebuilt this way (renaming a parent rewrites every child's REFERENCES
 * clause), and a guard refuses to drop a staging copy anything still
 * references, so a schema surprise rolls the migration back instead of losing
 * rows.
 */
async function rebuildSqliteTable(
  db: Db,
  table: string,
  createSql: string,
  copySql: string,
  indexSql: string[] = [],
): Promise<void> {
  const staging = `${table}_migration_old`;

  await db.exec(`ALTER TABLE ${table} RENAME TO ${staging}`);
  await db.exec(createSql);
  await db.exec(copySql);

  const referencing = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name <> ? AND sql LIKE ?",
    [staging, `%${staging}%`],
  );

  if ((referencing?.count ?? 0) > 0) {
    throw new Error(`Refusing to drop ${staging}: another table still references it`);
  }

  await db.exec(`DROP TABLE ${staging}`);

  for (const sql of indexSql) {
    await db.exec(sql);
  }
}

async function dropCheckIfPresent(db: Db, table: string, definitionFragment: string): Promise<boolean> {
  if (db.dialect === "postgres") {
    const row = await db.get<{ conname: string }>(
      `SELECT c.conname FROM pg_constraint c
       WHERE c.conrelid = $1::regclass AND c.contype = 'c'
         AND pg_get_constraintdef(c.oid) ILIKE $2`,
      [table, `%${definitionFragment}%`],
    );

    if (!row) {
      return false;
    }

    await db.exec(`ALTER TABLE ${table} DROP CONSTRAINT "${row.conname}"`);
    return true;
  }

  return false;
}

async function replaceEntryTypeCheck(db: Db): Promise<void> {
  const check = `CHECK (entry_type IN ('deposit', 'escrow_deposit', 'escrow_release', 'withdrawal', 'escrow_refund'))`;

  if (db.dialect === "postgres") {
    if (await dropCheckIfPresent(db, "ledger_entries", "entry_type IN")) {
      await db.exec(
        `ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_entry_type_check ${check}`,
      );
    }
    return;
  }

  await rebuildSqliteTable(
    db,
    "ledger_entries",
    `CREATE TABLE ledger_entries (
       id           INTEGER PRIMARY KEY,
       account_id   TEXT NOT NULL REFERENCES ledger_accounts(id),
       delta_cents  INTEGER NOT NULL,
       entry_type   TEXT NOT NULL ${check},
       reference_id TEXT,
       note         TEXT,
       created_at   TEXT NOT NULL
     )`,
    `INSERT INTO ledger_entries (id, account_id, delta_cents, entry_type, reference_id, note, created_at)
     SELECT id, account_id, delta_cents, entry_type, reference_id, note, created_at
     FROM ledger_entries_migration_old`,
    [
      "CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id, id)",
      "CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference ON ledger_entries(reference_id, id)",
    ],
  );
}

export async function runMigrations(db: Db): Promise<void> {
  if (db.dialect === "sqlite") {
    await db.exec("PRAGMA foreign_keys = ON");
    await db.exec("PRAGMA journal_mode = WAL");
  }

  await db.exec(MIGRATION_INDEX(identityFor(db.dialect)));
  await db.exec(
    SCHEMA_TEMPLATE(identityFor(db.dialect), EPOCH_MILLISECONDS[db.dialect]),
  );

  const applied = new Set(
    (
      await db.all<{ migration_id: string }>(
        "SELECT migration_id FROM schema_migrations",
      )
    ).map((row) => row.migration_id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    await db.tx(async () => {
      await migration.run(db);
      await db.run(
        "INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)",
        [migration.id, new Date().toISOString()],
      );
    });
  }

  await db.exec(TRAILING_INDEXES);
}

export interface SqliteTarget {
  type: "sqlite";
  file: string;
}

export interface PostgresTarget {
  type: "postgres";
  url: string;
}

export type DbTarget = SqliteTarget | PostgresTarget;

export function resolveDatabaseTarget(): DbTarget {
  if (process.env.VENN_DB_URL) {
    return { type: "postgres", url: process.env.VENN_DB_URL };
  }

  let file: string;

  if (process.env.VENN_DB_FILE) {
    file = process.env.VENN_DB_FILE;
  } else if (process.env.NODE_ENV === "test") {
    file = ":memory:";
  } else {
    file = path.join(process.cwd(), "data", "venn.db");
  }

  return { type: "sqlite", file };
}

export async function openDatabase(target: string | DbTarget): Promise<Db> {
  if (typeof target === "string") {
    target = { type: "sqlite", file: target };
  }

  if (target.type === "postgres") {
    const { openPostgresDatabase } = await import("@/lib/db/postgres");
    return openPostgresDatabase(target.url);
  }

  const { openSqliteDatabase } = await import("@/lib/db/sqlite");
  return openSqliteDatabase(target.file);
}

const globalForDb = globalThis as unknown as { vennDb?: Promise<Db> };

export function getDatabase(): Promise<Db> {
  if (!globalForDb.vennDb) {
    globalForDb.vennDb = openDatabase(resolveDatabaseTarget());
  }

  return globalForDb.vennDb;
}

export function setDatabase(db: Db | Promise<Db>): void {
  globalForDb.vennDb = Promise.resolve(db);
}
