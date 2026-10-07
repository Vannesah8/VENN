import { EscrowError } from "@/lib/escrow";

const CURRENCY_PREFIX = /^(KES|TZS|UGX|Ksh|TSh|USh)\s*/i;

export function parseAmountToCents(raw: string): number {
  const cleaned = raw.replace(CURRENCY_PREFIX, "").replace(/[$,\s]/g, "");

  if (!/^\d*\.?\d+$/.test(cleaned)) {
    throw new EscrowError("invalid_input", "Enter an amount greater than zero");
  }

  const value = Number.parseFloat(cleaned);

  if (!Number.isFinite(value) || value <= 0) {
    throw new EscrowError("invalid_input", "Enter an amount greater than zero");
  }

  const cents = Math.round(value * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new EscrowError("invalid_input", "Amount is out of range");
  }

  return cents;
}