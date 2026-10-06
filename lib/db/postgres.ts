import { Client } from "pg";

import { runMigrations, type Db } from "@/lib/db";

function mapPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
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