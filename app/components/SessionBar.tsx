import { logoutUser } from "@/app/actions";
import type { EscrowActor } from "@/lib/escrow";
import { formatCents } from "@/lib/format";
import { initialsOf, roleLabel } from "@/lib/format";

export function SessionBar({
  actor,
  walletBalance,
}: {
  actor: EscrowActor;
  walletBalance: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dfece5] bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e4d3d] text-xs font-bold text-white">
          {initialsOf(actor.displayName)}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-[#18352d]">{actor.displayName}</p>
          <p className="text-xs text-[#5d736a]">{roleLabel(actor.role)}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfece5] bg-[#f8faf8] px-3 py-1.5 text-sm">
          <span className="text-xs uppercase tracking-[0.14em] text-[#5d736a]">Wallet</span>
          <span className="font-semibold text-[#1e4d3d]">{formatCents(walletBalance)}</span>
        </span>

        <form action={logoutUser}>
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