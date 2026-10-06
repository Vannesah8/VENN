import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { runMigrations, type Db } from "@/lib/db";

class SqliteDatabase implements Db {
  readonly dialect = "sqlite" as const;

  private raw: Database.Database;
  private depth = 0;

  constructor(raw: Database.Database) {
    this.raw = raw;
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastId: number | bigint | null }> {
    const info = this.raw.prepare(sql).run(...params);
    return { changes: info.changes, lastId: info.lastInsertRowid };
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
    this.raw.exec("BEGIN IMMEDIATE");

    try {
      const result = await fn();
      this.raw.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.raw.exec("ROLLBACK");
      } catch {
        // preserve the original error
      }
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  async exec(sql: string): Promise<void> {
    this.raw.exec(sql);
  }

  async close(): Promise<void> {
    this.raw.close();
  }
}

export async function openSqliteDatabase(file: string): Promise<Db> {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const raw = new Database(file);
  const db = new SqliteDatabase(raw);
  await runMigrations(db);
  return db;
}