import { getDatabase, type DbLike } from "@/lib/db";

export type OutboxStatus = "pending" | "sending" | "sent" | "failed";

export interface OutboxJob {
  id: number;
  topic: string;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  createdAt: Date;
}

interface OutboxRow {
  id: number;
  topic: string;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  created_at: string;
}

/**
 * Enqueues a job, usually inside the same transaction as the state change it
 * describes, so the job commits atomically with the facts it notifies about.
 */
export async function enqueueOutbox(
  topic: string,
  payload: unknown,
  db: DbLike = getDatabase(),
): Promise<void> {
  const d = await db;
  await d.run(
    "INSERT INTO outbox (topic, payload, status, created_at) VALUES (?, ?, 'pending', ?)",
    [topic, JSON.stringify(payload), new Date().toISOString()],
  );
}

/**
 * Processes at most `limit` pending jobs. Each job is claimed inside a
 * transaction (so a crash mid-drain re-queues it), then handed to `handler`.
 * Failures are recorded on the row and do not stop the queue.
 */
export async function processOutbox(
  handler: (job: OutboxJob) => Promise<void>,
  options: { limit?: number } = {},
  db: DbLike = getDatabase(),
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const d = await db;
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);

  const claimed = await d.tx(async () => {
    const rows = await d.all<OutboxRow>(
      "SELECT id, topic, payload, status, attempts, created_at FROM outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?",
      [limit],
    );

    for (const row of rows) {
      await d.run("UPDATE outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ?", [
        row.id,
      ]);
    }

    return rows;
  });

  let succeeded = 0;
  let failed = 0;

  for (const row of claimed) {
    const job: OutboxJob = {
      id: row.id,
      topic: row.topic,
      payload: safeParse(row.payload),
      status: row.status,
      attempts: row.attempts + 1,
      createdAt: new Date(row.created_at),
    };

    try {
      await handler(job);
      await d.run("UPDATE outbox SET status = 'sent', processed_at = ? WHERE id = ?", [
        new Date().toISOString(),
        row.id,
      ]);
      succeeded += 1;
    } catch {
      await d.run("UPDATE outbox SET status = 'failed', processed_at = ? WHERE id = ?", [
        new Date().toISOString(),
        row.id,
      ]);
      failed += 1;
    }
  }

  return { processed: claimed.length, succeeded, failed };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}