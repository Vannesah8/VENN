import Link from "next/link";

import { ConnectCard } from "@/app/components/ConnectCard";
import { FundWalletForm } from "@/app/components/FundWalletForm";
import { OpenEscrowForm } from "@/app/components/OpenEscrowForm";
import { StatusPill } from "@/app/components/StatusPill";
import { WithdrawWalletForm } from "@/app/components/WithdrawWalletForm";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";
import { describeActions } from "@/lib/escrow";
import { formatCents, formatDate, roleLabel } from "@/lib/format";
import { listNotifications } from "@/lib/notifications";
import { getPrefsFromCookies } from "@/lib/prefs";
import { requireActor } from "@/lib/session";
import {
  getPortfolioStats,
  getWalletBalance,
  listTransactionsForActor,
  listUsers,
} from "@/lib/transactions";

export default async function DashboardPage() {
  const [actor, prefs] = await Promise.all([requireActor(), getPrefsFromCookies()]);
  const [users, transactions, balance, notifications] = await Promise.all([
    listUsers(),
    listTransactionsForActor(actor),
    getWalletBalance(actor.id),
    listNotifications(actor.id),
  ]);
  const stats = getPortfolioStats(transactions);
  const sellers = users
    .filter((user) => user.role === "seller")
    .map((user) => ({ id: user.id, displayName: user.displayName }));

  const actionQueue = transactions
    .flatMap((transaction) =>
      describeActions(transaction, actor, prefs.lang).map((action) => ({
        transaction,
        action,
      })),
    )
    .slice(0, 6);

  return (
    <WorkspaceShell
      actor={actor}
      walletBalance={balance}
      prefs={prefs}
      eyebrow="Operations"
      title="Marketplace workspace"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Escrow held", value: formatCents(stats.heldCents, prefs) },
          { label: "Released to sellers", value: formatCents(stats.releasedCents, prefs) },
          { label: "Parcels in flight", value: String(stats.inFlightCount) },
          { label: "Open disputes", value: String(stats.disputedCount) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#dfece5] bg-white p-4 shadow-[0_10px_20px_rgba(24,53,45,0.04)] sm:p-5"
          >
            <p className="text-xs text-[#5d736a] sm:text-sm">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-[#18352d] sm:mt-4 sm:text-3xl">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
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
                      {formatDate(transaction.updatedAt, prefs)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <p className="font-medium text-[#18352d]">
                      {formatCents(transaction.amountCents, prefs)}
                    </p>
                    <StatusPill status={transaction.status} lang={prefs.lang} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4 sm:space-y-6">
          <ConnectCard prefs={prefs} />

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div>
                <p className="text-sm text-[#5d736a]">Wallet balance</p>
                <p className="mt-1 text-2xl font-semibold text-[#1e4d3d] sm:mt-2 sm:text-3xl">
                  {formatCents(balance, prefs)}
                </p>
              </div>
              <p className="text-xs text-[#8b9d95]">Demo cash rail · top up to fund escrow</p>
            </div>
            <div className="mt-4">
              <FundWalletForm prefs={prefs} />
              <div className="mt-4 border-t border-[#edf3ee] pt-4">
                <WithdrawWalletForm prefs={prefs} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
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
                        {transaction.itemName} · {formatCents(transaction.amountCents, prefs)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <h2 className="text-xl font-semibold text-[#18352d]">Recent updates</h2>

            {notifications.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
                Status pings and SMS alerts appear here when transactions move.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 text-sm text-[#18352d]"
                  >
                    <p className="font-medium">{notification.title}</p>
                    <p className="mt-1 text-[#5d736a]">{notification.body}</p>
                    <p className="mt-1 text-xs text-[#8b9d95]">
                      {formatDate(notification.createdAt, prefs)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actor?.role === "buyer" ? (
            <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
              <h2 className="text-xl font-semibold text-[#18352d]">Fund a new escrow</h2>
              <p className="mt-2 text-sm text-[#5d736a]">
                Funds move out of your wallet and stay held until you confirm delivery. Signed in as{" "}
                {roleLabel(actor.role, prefs.lang).toLowerCase()}.
              </p>
              <div className="mt-4">
                <OpenEscrowForm sellers={sellers} prefs={prefs} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </WorkspaceShell>
  );
}