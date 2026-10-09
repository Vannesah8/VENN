"use client";

import { useActionState } from "react";

import { depositFunds } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { t, type LocalePrefs } from "@/lib/i18n";

export function FundWalletForm({ prefs }: { prefs: LocalePrefs }) {
  const [state, formAction, pending] = useActionState(depositFunds, IDLE_ACTION_STATE);
  const lang = prefs.lang;

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <label className="flex-1 text-sm text-[#5d736a]">
        {t(lang, "dashboard.addFunds")}
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="100.00"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2.5 text-base text-[#18352d] sm:text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full border border-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-[#1e4d3d] transition hover:bg-[#1e4d3d] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t(lang, "dashboard.adding") : t(lang, "dashboard.addFunds")}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-[#8a5a12]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}