"use client";

import { useActionState } from "react";

import { openEscrow } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { t, type LocalePrefs } from "@/lib/i18n";

export interface SellerOption {
  id: string;
  displayName: string;
}

export function OpenEscrowForm({
  sellers,
  prefs,
}: {
  sellers: SellerOption[];
  prefs: LocalePrefs;
}) {
  const [state, formAction, pending] = useActionState(openEscrow, IDLE_ACTION_STATE);
  const lang = prefs.lang;

  if (sellers.length === 0) {
    return (
      <p className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
        {t(lang, "form.noSellers")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
        >
          {state.error}
        </p>
      ) : null}

      <label className="block text-sm text-[#5d736a]">
        {t(lang, "form.seller")}
        <select
          name="sellerId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2.5 text-base text-[#18352d] sm:text-sm"
        >
          <option value="" disabled>
            {t(lang, "form.selectSeller")}
          </option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.displayName}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-[#5d736a]">
        {t(lang, "form.item")}
        <input
          name="itemName"
          required
          placeholder="Vintage camera lens"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2.5 text-base text-[#18352d] sm:text-sm"
        />
      </label>

      <label className="block text-sm text-[#5d736a]">
        {t(lang, "form.amount", { currency: prefs.currency })}
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="1240.00"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2.5 text-base text-[#18352d] sm:text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#1e4d3d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t(lang, "form.fundingEscrow") : t(lang, "form.fundEscrow")}
      </button>
    </form>
  );
}