"use client";

import { useActionState } from "react";

import { withdrawFunds } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { t, type LocalePrefs } from "@/lib/i18n";

export function WithdrawWalletForm({ prefs }: { prefs: LocalePrefs }) {
  const [state, formAction, pending] = useActionState(withdrawFunds, IDLE_ACTION_STATE);
  const lang = prefs.lang;

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="flex-1 text-sm text-[#5d736a]">
          {t(lang, "dashboard.withdrawAmount")}
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
          {pending ? t(lang, "form.working") : t(lang, "dashboard.withdraw")}
        </button>
      </div>
      <label className="block text-sm text-[#5d736a]">
        {t(lang, "dashboard.withdrawToMpesa")}
        <input
          name="phone"
          inputMode="tel"
          placeholder="+2547..."
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2.5 text-base text-[#18352d] sm:text-sm"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-[#8a5a12]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}