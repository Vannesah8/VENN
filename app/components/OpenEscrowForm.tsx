"use client";

import { useActionState } from "react";

import { openEscrow } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export interface SellerOption {
  id: string;
  displayName: string;
}

export function OpenEscrowForm({ sellers }: { sellers: SellerOption[] }) {
  const [state, formAction, pending] = useActionState(openEscrow, IDLE_ACTION_STATE);

  if (sellers.length === 0) {
    return (
      <p className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
        No seller accounts are available to trade with yet.
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
        Seller
        <select
          name="sellerId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        >
          <option value="" disabled>
            Select a seller
          </option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.displayName}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-[#5d736a]">
        Item
        <input
          name="itemName"
          required
          placeholder="Vintage camera lens"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <label className="block text-sm text-[#5d736a]">
        Amount (USD)
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="1240.00"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Funding escrow..." : "Fund escrow"}
      </button>
    </form>
  );
}