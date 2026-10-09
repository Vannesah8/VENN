import { logoutUser } from "@/app/actions";
import { PrefToggle } from "@/app/components/PrefToggle";
import type { EscrowActor } from "@/lib/escrow";
import { formatCents, initialsOf, roleLabel } from "@/lib/format";
import type { LocalePrefs } from "@/lib/i18n";

export function SessionBar({
  actor,
  walletBalance,
  prefs,
}: {
  actor: EscrowActor;
  walletBalance: number;
  prefs: LocalePrefs;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#dfece5] bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e4d3d] text-xs font-bold text-white">
          {initialsOf(actor.displayName)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-[#18352d]">{actor.displayName}</p>
          <p className="text-xs text-[#5d736a]">{roleLabel(actor.role, prefs.lang)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfece5] bg-[#f8faf8] px-3 py-1.5 text-sm">
          <span className="text-xs uppercase tracking-[0.14em] text-[#5d736a]">Wallet</span>
          <span className="font-semibold text-[#1e4d3d]">
            {formatCents(walletBalance, prefs)}
          </span>
        </span>

        <PrefToggle prefs={prefs} />

        <form action={logoutUser} className="ml-auto sm:ml-0">
          <button
            type="submit"
            className="rounded-full border border-[#dfece5] px-4 py-2 text-sm font-semibold text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}