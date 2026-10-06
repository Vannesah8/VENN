import type { EscrowParty, EscrowRole, EscrowStatus } from "@/lib/escrow";
import { getEscrowStatusLabel, getEscrowStatusTone } from "@/lib/escrow";
import {
  DEFAULT_PREFS,
  localeFor,
  t,
  type Lang,
  type LocalePrefs,
  type MessageKey,
} from "@/lib/i18n";

export function formatCents(
  cents: number,
  prefs: LocalePrefs = DEFAULT_PREFS,
): string {
  return new Intl.NumberFormat(localeFor(prefs.lang, prefs.currency), {
    style: "currency",
    currency: prefs.currency,
    maximumFractionDigits: prefs.currency === "UGX" ? 0 : 2,
  }).format(cents / 100);
}

export function formatSignedCents(
  cents: number,
  prefs: LocalePrefs = DEFAULT_PREFS,
): string {
  return new Intl.NumberFormat(localeFor(prefs.lang, prefs.currency), {
    style: "currency",
    currency: prefs.currency,
    signDisplay: "always",
    maximumFractionDigits: prefs.currency === "UGX" ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(
  date: Date,
  prefs: LocalePrefs = DEFAULT_PREFS,
): string {
  const lang = prefs.lang as Lang;
  return new Intl.DateTimeFormat(
    lang === "sw" ? "sw-KE" : localeFor(prefs.lang, prefs.currency),
    { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" },
  ).format(date);
}

export function statusLabel(status: EscrowStatus, lang: Lang = "en"): string {
  return getEscrowStatusLabel(status, lang);
}

export function statusTone(status: EscrowStatus): string {
  return getEscrowStatusTone(status);
}

export function roleLabel(role: EscrowRole, lang: Lang = "en"): string {
  return t(lang, `role.${role}` as MessageKey);
}

export function partySentence(party: EscrowParty, lang: Lang = "en"): string {
  return t(lang, `party.${party}` as MessageKey);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}