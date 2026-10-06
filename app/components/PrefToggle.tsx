"use client";

import { useTransition } from "react";

import { setPrefs } from "@/app/actions";
import {
  CURRENCIES,
  LANGS,
  type Currency,
  type Lang,
  type LocalePrefs,
} from "@/lib/i18n";

const LANG_LABELS: Record<Lang, string> = { en: "English", sw: "Kiswahili" };
const CURRENCY_LABELS: Record<Currency, string> = {
  KES: "KES · Kenya",
  TZS: "TZS · Tanzania",
  UGX: "UGX · Uganda",
};

export function PrefToggle({ prefs }: { prefs: LocalePrefs }) {
  const [isPending, startTransition] = useTransition();

  function change(next: Partial<LocalePrefs>) {
    const merged = { ...prefs, ...next };
    startTransition(() => {
      void setPrefs({ lang: merged.lang, currency: merged.currency });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Language"
        value={prefs.lang}
        disabled={isPending}
        onChange={(event) => change({ lang: event.target.value as Lang })}
        className="rounded-full border border-[#dfece5] bg-[#f8faf8] px-3 py-1.5 text-xs font-medium text-[#18352d]"
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {LANG_LABELS[lang]}
          </option>
        ))}
      </select>

      <select
        aria-label="Currency"
        value={prefs.currency}
        disabled={isPending}
        onChange={(event) => change({ currency: event.target.value as Currency })}
        className="rounded-full border border-[#dfece5] bg-[#f8faf8] px-3 py-1.5 text-xs font-medium text-[#18352d]"
      >
        {CURRENCIES.map((currency) => (
          <option key={currency} value={currency}>
            {CURRENCY_LABELS[currency]}
          </option>
        ))}
      </select>

      {isPending ? (
        <span className="text-xs text-[#8b9d95]">Saving…</span>
      ) : null}
    </div>
  );
}