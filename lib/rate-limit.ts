import { getDatabase, type DbLike } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consumeRateLimit(
  key: string,
  options: { limit?: number; windowMs?: number } = {},
  db: DbLike = getDatabase(),
): Promise<RateLimitResult> {
  const d = await db;
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  await d.run(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1`,
    [key, windowStart],
  );

  const row = await d.get<{ count: number }>(
    "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
    [key, windowStart],
  );

  const count = row?.count ?? 1;

  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(windowStart + windowMs - now, 0),
    };
  }

  return { allowed: true, remaining: limit - count, retryAfterMs: 0 };
}

/** Prunes expired windows so the rate-limit table does not grow forever. */
export async function pruneRateLimits(
  db: DbLike = getDatabase(),
): Promise<void> {
  const d = await db;
  const horizon = Date.now() - 24 * 60 * 60 * 1000;
  await d.run("DELETE FROM rate_limits WHERE window_start < ?", [horizon]);
}

export async function rateLimitError(
  allowed: boolean,
  retryAfterMs: number,
): Promise<{ error: string; status: string } | null> {
  if (allowed) {
    return null;
  }

  return {
    error:
      retryAfterMs > 0
        ? `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`
        : "Too many attempts. Please wait and try again.",
    status: "rate_limited",
  };
}