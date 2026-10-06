import { openDatabase, resolveDatabaseTarget, setDatabase } from "@/lib/db";
import { processNotifications } from "@/lib/notifications";

/**
 * Background outbox drain. Run with `npm run worker` (or `WORKER_ONCE=1 npm run
 * worker` for a single pass). Server actions also drain the outbox inline, so
 * this worker is the safety net for anything enqueued while the app is idle.
 *
 * Env:
 *   WORKER_POLL_MS  delay between passes (default 2000)
 *   WORKER_ONCE=1   process one pass and exit
 *   VENN_DB_URL     switch to Postgres (otherwise SQLite)
 */
const once = process.env.WORKER_ONCE === "1";
const configuredPollMs = Number(process.env.WORKER_POLL_MS ?? "2000");
const pollMs = Number.isFinite(configuredPollMs) && configuredPollMs > 0 ? configuredPollMs : 2000;

let shuttingDown = false;

async function drainOnce(): Promise<void> {
  try {
    const result = await processNotifications();
    if (result.processed > 0) {
      console.log(
        `[venn-worker] processed ${result.processed} job${result.processed === 1 ? "" : "s"}: ` +
          `${result.succeeded} ok, ${result.failed} failed`,
      );
    }
  } catch (error) {
    console.error("[venn-worker] drain failed:", error);
  }
}

async function main(): Promise<void> {
  const db = await openDatabase(resolveDatabaseTarget());
  setDatabase(db);

  console.log(
    `[venn-worker] draining outbox via ${db.dialect}${once ? " (single pass)" : " every " + pollMs + "ms"}`,
  );

  await drainOnce();

  if (once) {
    await db.close();
    return;
  }

  process.on("SIGINT", () => {
    shuttingDown = true;
  });
  process.on("SIGTERM", () => {
    shuttingDown = true;
  });

  while (!shuttingDown) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    await drainOnce();
  }

  console.log("[venn-worker] shutting down");
  await db.close();
}

main().catch((error) => {
  console.error("[venn-worker] fatal:", error);
  process.exit(1);
});