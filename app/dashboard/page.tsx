import Link from "next/link";

import { FundWalletForm } from "@/app/components/FundWalletForm";
import { OpenEscrowForm } from "@/app/components/OpenEscrowForm";
import { StatusPill } from "@/app/components/StatusPill";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";
import { describeActions } from "@/lib/escrow";
import { formatCents, formatDate, roleLabel } from "@/lib/format";
import { requireActor } from "@/lib/session";
import {
  getPortfolioStats,
  getWalletBalance,
  listTransactionsForActor,
  listUsers,
} from "@/lib/transactions";

export default async function DashboardPage() {
  const actor = await requireActor();
  const users = listUsers();
  const transactions = listTransactionsForActor(actor);
  const stats = getPortfolioStats(transactions);
  const balance = getWalletBalance(actor.id);
  const sellers = users
    .filter((user) => user.role === "seller")
    .map((user) => ({ id: user.id, displayName: user.displayName }));

  const actionQueue = transactions
    .flatMap((transaction) =>
      describeActions(transaction, actor).map((action) => ({ transaction, action })),
    )
    .slice(0, 6);

  return (
    <WorkspaceShell
      actor={actor}
      walletBalance={balance}
      eyebrow="Operations"
      title="Marketplace workspace"
    >
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Escrow held", value: formatCents(stats.heldCents) },
          { label: "Released to sellers", value: formatCents(stats.releasedCents) },
          { label: "Parcels in flight", value: String(stats.inFlightCount) },
          { label: "Open disputes", value: String(stats.disputedCount) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#dfece5] bg-white p-5 shadow-[0_10px_20px_rgba(24,53,45,0.04)]"
          >
            <p className="text-sm text-[#5d736a]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold text-[#18352d]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)]">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#18352d]">Your transactions</h2>
            <Link href="/escrow" className="text-sm text-[#1e4d3d] hover:underline">
              View all
            </Link>
          </div>

          {transactions.length === 0 ? (
            <p className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
              Nothing here yet. Fund an escrow below to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <Link
                  key={transaction.id}
                  href={`/escrow/${transaction.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 transition hover:border-[#bfd4c8]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#18352d]">{transaction.itemName}</p>
                    <p className="text-sm text-[#5d736a]">
                      {transaction.buyerName} → {transaction.sellerName} · updated{" "}
                      {formatDate(transaction.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <p className="font-medium text-[#18352d]">{formatCents(transaction.amountCents)}</p>
                    <StatusPill status={transaction.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#5d736a]">Wallet balance</p>
                <p className="mt-2 text-3xl font-semibold text-[#1e4d3d]">
                  {formatCents(balance)}
                </p>
              </div>
              <p className="text-xs text-[#8b9d95]">Demo cash rail · top up to fund escrow</p>
            </div>
            <div className="mt-4">
              <FundWalletForm />
            </div>
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)]">
            <h2 className="text-xl font-semibold text-[#18352d]">Needs your attention</h2>

            {actionQueue.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
                No pending actions for {actor.displayName}.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {actionQueue.map(({ transaction, action }) => (
                  <li key={`${transaction.id}-${action.action}`}>
                    <Link
                      href={`/escrow/${transaction.id}`}
                      className="block rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 transition hover:border-[#bfd4c8]"
                    >
                      <p className="text-sm font-medium text-[#18352d]">{action.label}</p>
                      <p className="mt-1 text-sm text-[#5d736a]">
                        {transaction.itemName} · {formatCents(transaction.amountCents)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actor?.role === "buyer" ? (
            <section className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)]">
              <h2 className="text-xl font-semibold text-[#18352d]">Fund a new escrow</h2>
              <p className="mt-2 text-sm text-[#5d736a]">
                Funds move out of your wallet and stay held until you confirm delivery. Signed in as{" "}
                {roleLabel(actor.role).toLowerCase()}.
              </p>
              <div className="mt-4">
                <OpenEscrowForm sellers={sellers} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </WorkspaceShell>
  );
}