import { getDatabase, type DbLike } from "@/lib/db";
import { EscrowError } from "@/lib/escrow";
import { CURRENCIES, type Currency } from "@/lib/i18n";

/**
 * Indicative rates for the East African corridor, expressed as units of the
 * currency per 1 KES. KES is the pivot so every pair converts through one
 * book instead of a matrix of cross rates.
 *
 * The demo table is seeded from these defaults; a live deployment overrides
 * rows in `fx_rates` from its provider of choice and the ledger converts
 * against whatever is stored.
 */
export const DEFAULT_RATES: Record<Currency, number> = {
  KES: 1,
  TZS: 20,
  UGX: 28,
};

export function isFxBase(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export async function setRate(
  currency: Currency,
  perBase: number,
  db: DbLike = getDatabase(),
): Promise<void> {
  if (!Number.isFinite(perBase) || perBase <= 0) {
    throw new EscrowError("invalid_input", "A rate must be a positive number");
  }

  const d = await db;
  await d.run(
    `INSERT INTO fx_rates (currency, per_base, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (currency) DO UPDATE SET per_base = excluded.per_base, updated_at = excluded.updated_at`,
    [currency, perBase, new Date().toISOString()],
  );
}

/** Seeds missing rows with the built-in corridor rates; never overwrites. */
export async function ensureFxRates(db: DbLike = getDatabase()): Promise<void> {
  const d = await db;

  for (const currency of CURRENCIES) {
    await d.run(
      "INSERT INTO fx_rates (currency, per_base, updated_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      [currency, DEFAULT_RATES[currency], new Date().toISOString()],
    );
  }
}

export async function getRate(
  currency: Currency,
  db: DbLike = getDatabase(),
): Promise<number> {
  if (currency === "KES") {
    return 1;
  }

  const d = await db;
  const row = await d.get<{ per_base: number }>(
    "SELECT per_base FROM fx_rates WHERE currency = ?",
    [currency],
  );

  if (row && Number.isFinite(row.per_base) && row.per_base > 0) {
    return row.per_base;
  }

  await ensureFxRates(d);
  return DEFAULT_RATES[currency];
}

/**
 * Converts an integer amount between currencies, rounding once at the end so
 * no fractional cent can reach a ledger entry.
 */
export async function convertCents(
  amountCents: number,
  from: Currency,
  to: Currency,
  db: DbLike = getDatabase(),
): Promise<number> {
  if (from === to) {
    return amountCents;
  }

  if (!Number.isFinite(amountCents)) {
    throw new EscrowError("invalid_input", "Amount must be a number");
  }

  const d = await db;
  const [fromRate, toRate] = await Promise.all([getRate(from, d), getRate(to, d)]);

  return Math.round((amountCents / fromRate) * toRate);
}
