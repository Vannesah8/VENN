import Link from "next/link";

import { StatusPill } from "@/app/components/StatusPill";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";
import { getEscrowStatusLabel } from "@/lib/escrow";
import { formatCents, formatDate } from "@/lib/format";
import { requireActor } from "@/lib/session";
import { getWalletBalance, listTransactionsForActor } from "@/lib/transactions";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "held", label: "Funds held" },
  { key: "delivered", label: "Awaiting confirmation" },
  { key: "disputed", label: "Disputes" },
  { key: "released", label: "Released" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default async function EscrowIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const actor = await requireActor();
  const { filter } = await searchParams;
  const active = (FILTERS.find((entry) => entry.key === filter)?.key ?? "all") as FilterKey;
  const balance = getWalletBalance(actor.id);

  const all = listTransactionsForActor(actor);
  const transactions = all.filter((transaction) => {
    switch (active) {
      case "held":
        return transaction.status !== "released";
      case "delivered":
        return transaction.status === "delivered";
      case "disputed":
        return transaction.status === "disputed";
      case "released":
        return transaction.status === "released";
      default:
        return true;
    }
  });

  return (
    <WorkspaceShell
      actor={actor}
      walletBalance={balance}
      eyebrow="Trust layer"
      title="Escrow transactions"
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Link
            key={entry.key}
            href={entry.key === "all" ? "/escrow" : `/escrow?filter=${entry.key}`}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              active === entry.key
                ? "border-[#1e4d3d] bg-[#1e4d3d] text-white"
                : "border-[#dfece5] bg-white text-[#18352d] hover:border-[#1e4d3d]"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {transactions.length === 0 ? (
        <p className="rounded-2xl border border-[#dfece5] bg-white p-6 text-sm text-[#5d736a]">
          No transactions match this filter.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {transactions.map((transaction) => (
            <Link
              key={transaction.id}
              href={`/escrow/${transaction.id}`}
              className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)] transition hover:border-[#bfd4c8]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-[#18352d]">
                    {transaction.itemName}
                  </p>
                  <p className="mt-1 text-sm text-[#5d736a]">{transaction.id}</p>
                </div>
                <StatusPill status={transaction.status} />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[#f8faf8] p-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Buyer</dt>
                  <dd className="mt-1 font-medium text-[#18352d]">{transaction.buyerName}</dd>
                </div>
                <div className="rounded-2xl bg-[#f8faf8] p-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Seller</dt>
                  <dd className="mt-1 font-medium text-[#18352d]">{transaction.sellerName}</dd>
                </div>
                <div className="rounded-2xl bg-[#f8faf8] p-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Escrow</dt>
                  <dd className="mt-1 font-medium text-[#18352d]">
                    {formatCents(transaction.amountCents)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-[#f8faf8] p-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Updated</dt>
                  <dd className="mt-1 font-medium text-[#18352d]">
                    {formatDate(transaction.updatedAt)}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-sm text-[#5d736a]">
                {getEscrowStatusLabel(transaction.status)}
                {transaction.trackingNumber ? ` · ${transaction.trackingNumber}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}