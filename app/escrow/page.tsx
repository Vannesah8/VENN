import Link from "next/link";

import { LoadMoreTransactions } from "@/app/components/LoadMoreTransactions";
import { StatusPill } from "@/app/components/StatusPill";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";
import { getEscrowStatusLabel } from "@/lib/escrow";
import type { EscrowStatus } from "@/lib/escrow";
import { formatCents, formatDate } from "@/lib/format";
import { getPrefsFromCookies } from "@/lib/prefs";
import { requireActor } from "@/lib/session";
import {
  getWalletBalance,
  pageTransactionsForActor,
} from "@/lib/transactions";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "held", label: "Funds held" },
  { key: "delivered", label: "Awaiting confirmation" },
  { key: "disputed", label: "Disputes" },
  { key: "released", label: "Released" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const PAGE_SIZE = 10;

export default async function EscrowIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const [actor, prefs] = await Promise.all([requireActor(), getPrefsFromCookies()]);
  const params = await searchParams;
  const active = (FILTERS.find((entry) => entry.key === params.filter)?.key ?? "all") as FilterKey;
  const query = params.q?.trim() || undefined;
  const balance = await getWalletBalance(actor.id);

  const page = await pageTransactionsForActor(actor, { limit: PAGE_SIZE, filter: active, query });
  const transactions = page.transactions;
  const loadMoreCursor = page.nextCursor;

  return (
    <WorkspaceShell
      actor={actor}
      walletBalance={balance}
      prefs={prefs}
      eyebrow="Trust layer"
      title="Escrow transactions"
    >
      <form
        role="search"
        action="/escrow"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search item, tracking, buyer or seller"
          className="w-full max-w-sm rounded-full border border-[#dfece5] bg-white px-5 py-2 text-sm text-[#18352d] outline-none transition focus:border-[#1e4d3d]"
        />
        <button
          type="submit"
          className="rounded-full border border-[#1e4d3d] bg-[#1e4d3d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#18352d]"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Link
            key={entry.key}
            href={`/escrow?${new URLSearchParams(
              entry.key === "all"
                ? query
                  ? { q: query }
                  : {}
                : query
                  ? { filter: entry.key, q: query }
                  : { filter: entry.key },
            ).toString()}`}
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
                <StatusPill status={transaction.status} lang={prefs.lang} />
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
                    {formatCents(transaction.amountCents, prefs)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-[#f8faf8] p-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Updated</dt>
                  <dd className="mt-1 font-medium text-[#18352d]">
                    {formatDate(transaction.updatedAt, prefs)}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-sm text-[#5d736a]">
                {getEscrowStatusLabel(transaction.status, prefs.lang)}
                {transaction.trackingNumber ? ` · ${transaction.trackingNumber}` : ""}
              </p>
            </Link>
          ))}

          {loadMoreCursor ? (
            <LoadMoreTransactions
              initialCursor={loadMoreCursor}
              filter={active}
              query={query}
              className="contents"
            >
              {(item) => (
                <Link
                  key={item.id}
                  href={`/escrow/${item.id}`}
                  className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)] transition hover:border-[#bfd4c8]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-[#18352d]">
                        {item.itemName}
                      </p>
                      <p className="mt-1 text-sm text-[#5d736a]">{item.id}</p>
                    </div>
                    <StatusPill status={item.status as EscrowStatus} lang={prefs.lang} />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-[#f8faf8] p-3">
                      <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Buyer</dt>
                      <dd className="mt-1 font-medium text-[#18352d]">{item.buyerName}</dd>
                    </div>
                    <div className="rounded-2xl bg-[#f8faf8] p-3">
                      <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Seller</dt>
                      <dd className="mt-1 font-medium text-[#18352d]">{item.sellerName}</dd>
                    </div>
                    <div className="rounded-2xl bg-[#f8faf8] p-3">
                      <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Escrow</dt>
                      <dd className="mt-1 font-medium text-[#18352d]">
                        {formatCents(item.amountCents, prefs)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-[#f8faf8] p-3">
                      <dt className="text-xs uppercase tracking-[0.16em] text-[#5d736a]">Updated</dt>
                      <dd className="mt-1 font-medium text-[#18352d]">
                        {formatDate(new Date(item.updatedAt), prefs)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              )}
            </LoadMoreTransactions>
          ) : null}
        </div>
      )}
    </WorkspaceShell>
  );
}