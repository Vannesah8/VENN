import { Client } from "pg";

import { runMigrations, type Db } from "@/lib/db";

/**
 * Rewrites SQLite-style `?` placeholders into Postgres `$n` ones. A naive
 * global replace would also rewrite any `?` that appears inside a string
 * literal (for example a `LIKE` pattern or a JSON operator), shifting every
 * later placeholder and mis-binding the parameters — so the scan tracks
 * single-quoted literals and leaves their contents untouched.
 */
export function mapPlaceholders(sql: string): string {
  let index = 0;
  let result = "";
  let inString = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    if (char === "'") {
      // A doubled quote is an escaped quote inside a string literal.
      if (inString && sql[i + 1] === "'") {
        result += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      result += char;
      continue;
    }

    if (char === "?" && !inString) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

class PostgresDatabase implements Db {
  readonly dialect = "postgres" as const;

  private raw: Client;
  private depth = 0;

  constructor(raw: Client) {
    this.raw = raw;
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const result = await this.raw.query(mapPlaceholders(sql), params);
    return (result.rows[0] ?? undefined) as T | undefined;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.raw.query(mapPlaceholders(sql), params);
    return result.rows as unknown as T[];
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastId: number | bigint | null }> {
    const result = await this.raw.query(mapPlaceholders(sql), params);
    return {
      changes: result.rowCount ?? 0,
      lastId: null,
    };
  }

  async tx<T>(fn: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await fn();
      } finally {
        this.depth -= 1;
      }
    }

    this.depth += 1;

    try {
      await this.raw.query("BEGIN");

      try {
        const result = await fn();
        await this.raw.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await this.raw.query("ROLLBACK");
        } catch {
          // preserve the original error
        }
        throw error;
      }
    } finally {
      this.depth -= 1;
    }
  }

  async exec(sql: string): Promise<void> {
    await this.raw.query(sql);
  }

  async close(): Promise<void> {
    await this.raw.end();
  }
}

export async function openPostgresDatabase(url: string): Promise<Db> {
  const client = new Client({ connectionString: url });

  client.on("error", () => {
    // pg emits errors on broken idle connections; the next query reconnects.
  });

  await client.connect();
  const db = new PostgresDatabase(client);
  await runMigrations(db);
  return db;
}