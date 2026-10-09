import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionPanel } from "@/app/components/ActionPanel";
import { StatusPill } from "@/app/components/StatusPill";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";
import { canViewTransaction, describeActions, resolveParty } from "@/lib/escrow";
import { formatCents, formatDate, formatSignedCents, partySentence, roleLabel } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { getPrefsFromCookies } from "@/lib/prefs";
import { requireActor } from "@/lib/session";
import {
  getEscrowLedgerEntries,
  getTransactionViewById,
  getWalletBalance,
  listEscrowEvents,
  listShipmentScans,
  listUsers,
} from "@/lib/transactions";

const LEDGER_LABELS: Record<string, string> = {
  escrow_deposit: "Funds moved into escrow",
  escrow_release: "Escrow released to seller",
  deposit: "Wallet deposit",
};

export default async function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [actor, prefs] = await Promise.all([requireActor(), getPrefsFromCookies()]);
  const [users, transaction, balance] = await Promise.all([
    listUsers(),
    getTransactionViewById(id),
    getWalletBalance(actor.id),
  ]);

  if (!transaction) {
    notFound();
  }

  if (!canViewTransaction(transaction, actor)) {
    notFound();
  }

  const [events, ledger, scans] = await Promise.all([
    listEscrowEvents(transaction.id),
    getEscrowLedgerEntries(transaction.id),
    listShipmentScans(transaction.id),
  ]);
  const actions = describeActions(transaction, actor, prefs.lang);
  const party = resolveParty(transaction, actor);
  const carriers = users
    .filter((user) => user.role === "carrier")
    .map((user) => ({ id: user.id, displayName: user.displayName }));

  return (
    <WorkspaceShell
      actor={actor}
      walletBalance={balance}
      prefs={prefs}
      eyebrow="Trust layer"
      title={transaction.itemName}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/escrow" className="text-sm text-[#1e4d3d] hover:underline">
          ← All transactions
        </Link>
        <span className="text-sm text-[#8b9d95]">{transaction.id}</span>
        <StatusPill status={transaction.status} lang={prefs.lang} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4 sm:space-y-6">
          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              {[
                { label: "Buyer", value: transaction.buyerName },
                { label: "Seller", value: transaction.sellerName },
                { label: "Escrow balance", value: formatCents(transaction.amountCents, prefs) },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#5d736a]">{cell.label}</p>
                  <p className="mt-1.5 text-base font-medium text-[#18352d] sm:mt-2 sm:text-lg">{cell.value}</p>
                </div>
              ))}
            </div>

            {transaction.disputeReason ? (
              <p className="mt-4 rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] p-4 text-sm text-[#8a5a12]">
                Dispute: {transaction.disputeReason}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#18352d]">Ledger</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-[#8b9d95]">
                Held by Venn custody
              </p>
            </div>

            {ledger.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 sm:p-4 text-sm text-[#5d736a]">
                No money has moved for this escrow yet.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {ledger.map((entry) => {
                  const inbound = entry.deltaCents > 0;
                  const label =
                    LEDGER_LABELS[entry.entryType] ?? entry.entryType.replace(/_/g, " ");

                  return (
                    <li key={entry.id} className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#18352d]">
                            {label}
                            <span className="ml-2 text-xs text-[#8b9d95]">
                              {entry.accountKind === "wallet"
                                ? inbound
                                  ? "seller wallet"
                                  : "buyer wallet"
                                : "escrow holding"}
                            </span>
                          </p>
                          {entry.note ? (
                            <p className="mt-1 truncate text-sm text-[#5d736a]">{entry.note}</p>
                          ) : null}
                        </div>
                        <p
                          className={`text-sm font-semibold ${
                            inbound ? "text-[#1e4d3d]" : "text-[#8a5a12]"
                          }`}
                        >
                          {formatSignedCents(entry.deltaCents, prefs)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <h2 className="text-xl font-semibold text-[#18352d]">Timeline</h2>

            <ol className="mt-5 space-y-5">
              {events.map((event, index) => (
                <li key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e4d3d] text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    {index < events.length - 1 ? (
                      <span className="mt-2 h-12 w-px bg-[#dfece5]" />
                    ) : null}
                  </div>

                  <div className="flex-1 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium text-[#18352d]">
                        {event.action === "created"
                          ? "Escrow funded"
                          : event.action.replace(/_/g, " ")}
                      </h3>
                      <span className="text-xs text-[#8b9d95]">
                        {formatDate(event.createdAt, prefs)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#5d736a]">
                      {event.actorName} ({roleLabel(event.actorRole, prefs.lang)})
                      {event.fromStatus ? ` · ${event.fromStatus.replace(/_/g, " ")} → ` : " · "}
                      {event.toStatus.replace(/_/g, " ")}
                    </p>
                    {event.note ? (
                      <p className="mt-2 text-sm text-[#18352d]">“{event.note}”</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 sm:space-y-6">
          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <h2 className="text-sm text-[#5d736a]">Shipment</h2>

            {transaction.trackingNumber ? (
              <div className="mt-3 space-y-3 text-sm text-[#18352d]">
                <p className="text-xl font-semibold">{transaction.trackingNumber}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[#5d736a]">Carrier</span>
                  <span>{transaction.carrierName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5d736a]">Origin</span>
                  <span>{transaction.origin}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5d736a]">Destination</span>
                  <span>{transaction.destination}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5d736a]">Carrier account</span>
                  <span>{transaction.carrierUserName ?? "—"}</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#5d736a]">
                Awaiting shipment details from the seller.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#18352d]">Scans</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-[#8b9d95]">
                {scans.length} logged
              </p>
            </div>

            {scans.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-3 sm:p-4 text-sm text-[#5d736a]">
                No carrier scans yet. They appear here as the parcel moves.
              </p>
            ) : (
              <ol className="mt-5 space-y-4">
                {scans.map((scan) => (
                  <li key={scan.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1e4d3d]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-[#18352d]">
                          {scan.milestone
                            ? t(prefs.lang, `milestone.${scan.milestone}` as MessageKey)
                            : t(
                                prefs.lang,
                                scan.action === "scan_in_transit"
                                  ? "action.scan_in_transit.label"
                                  : "action.scan_milestone.label",
                              )}
                        </p>
                        <span className="text-xs text-[#8b9d95]">
                          {formatDate(scan.createdAt, prefs)}
                        </span>
                      </div>
                      {scan.location ? (
                        <p className="mt-1 text-sm text-[#5d736a]">{scan.location}</p>
                      ) : null}
                      {scan.note ? (
                        <p className="mt-1 text-sm text-[#18352d]">“{scan.note}”</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#8b9d95]">{scan.actorName}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfece5] bg-white p-4 shadow-[0_16px_30px_rgba(24,53,45,0.05)] sm:p-6">
            <h2 className="text-xl font-semibold text-[#18352d]">Available actions</h2>
            <p className="mt-2 text-sm text-[#5d736a]">
              {party ? partySentence(party, prefs.lang) : "You are not a party to this transaction."}
            </p>
            <div className="mt-4">
              <ActionPanel
                transactionId={transaction.id}
                actions={actions}
                carriers={carriers}
                lang={prefs.lang}
              />
            </div>
          </section>
        </aside>
      </div>
    </WorkspaceShell>
  );
}